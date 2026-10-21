import {
   DEFAULT_NEW_PER_DAY,
   DEFAULT_REVIEWS_PER_DAY,
   createJourneyPlan,
   isCorrectResponse,
   newLearningState,
   scheduleReview,
   type ReviewEventInput,
   type ReviewResult,
   type StartSessionInput,
   type StudyPlan,
   type StudyPreview,
   type StudyRecommendation,
   type StudySession,
   type StudySessionDetail,
   type StudyOptions,
   type StudyGoal,
   type StudyMode,
} from '@caly/shared';
import { newId } from '@caly/worker-kit';
import type { AppEnv } from '../env';
import { conflict, forbidden, notFound } from '../lib/errors';
import { mapSession } from '../lib/map';
import {
   abandonStudySession,
   appendReviewEvent,
   completeStudySession,
   createStudySession,
   getDeckStudySummary,
   getLearningState,
   mapLearningState,
   getStudySessionRow,
   listActiveCardIds,
   listDueCardIds,
   listNewCardIds,
   listReviewedCardIds,
   listSessionsForUser,
   listWeakCardIds,
   upsertLearningState,
} from '../repositories/study';
import { filterOwnedCardIds } from '../repositories/cards';
import { getOwnedCard } from './card-service';
import { getOwnedDeck } from './deck-service';
import { chooseStrategy } from './ai/evaluation-service';

async function gatherCandidates(env: AppEnv, userId: string, deckId: string, goal: StudyGoal) {
   const weak = await listWeakCardIds(env, userId, deckId, 500);

   // Cram is not tied to the schedule — it may revise any card in the set.
   if (goal === 'cram') {
      const all = await listActiveCardIds(env, deckId, 500);
      return { due: all, weak, fresh: [] as string[] };
   }

   const nowIso = new Date().toISOString();
   const [due, fresh] = await Promise.all([
      listDueCardIds(env, userId, deckId, nowIso, DEFAULT_REVIEWS_PER_DAY),
      listNewCardIds(env, userId, deckId, DEFAULT_NEW_PER_DAY),
   ]);
   return { due, weak, fresh };
}

export type PlanInput = {
   deckId: string;
   mode: StudyMode;
   goal: StudyGoal;
   minutes: number;
   cardIds?: string[];
};

async function buildPlan(
   env: AppEnv,
   userId: string,
   deckId: string,
   input: PlanInput,
   useClef = true,
) {
   const sessionId = newId('stu');
   let plan: StudyPlan;

   if (input.cardIds?.length) {
      const selected = await filterOwnedCardIds(env, userId, deckId, input.cardIds);
      plan = createJourneyPlan({
         sessionId,
         mode: input.mode,
         goal: input.goal,
         minutes: input.minutes,
         dueCardIds: [],
         weakCardIds: [],
         newCardIds: [],
         selectedCardIds: selected,
      });
   } else {
      const { due, weak, fresh } = await gatherCandidates(env, userId, deckId, input.goal);
      plan = createJourneyPlan({
         sessionId,
         mode: input.mode,
         goal: input.goal,
         minutes: input.minutes,
         dueCardIds: due,
         weakCardIds: weak,
         newCardIds: fresh,
      });
   }

   let source: StudyRecommendation['source'] = 'scheduler';
   if (useClef) {
      const strategy = await chooseStrategy(env, userId, sessionId, plan.reasons);
      if (strategy) {
         plan.strategy = strategy as StudyPlan['strategy'];
         source = 'clef';
      }
   }

   return { plan, source };
}

/** Dry-run the deterministic plan for a configuration (no session created). */
export async function previewStudy(
   env: AppEnv,
   userId: string,
   input: { deckId: string; mode: StudyMode; goal: StudyGoal; minutes: number },
): Promise<StudyPreview> {
   const deck = await getOwnedDeck(env, userId, input.deckId);
   const { plan } = await buildPlan(
      env,
      userId,
      deck.id,
      { deckId: deck.id, mode: input.mode, goal: input.goal, minutes: input.minutes },
      false,
   );
   return {
      cardCount: plan.cardIds.length,
      estimatedMinutes: plan.estimatedMinutes,
      strategy: plan.strategy,
      reasons: plan.reasons,
   };
}

/** Deck summary + which study modes the deck's card types support. */
export async function getStudyOptions(
   env: AppEnv,
   userId: string,
   deckId: string,
): Promise<StudyOptions> {
   const deck = await getOwnedDeck(env, userId, deckId);
   const summary = await getDeckStudySummary(env, userId, deck.id);
   const withBack =
      summary.typeCounts.term_definition +
      summary.typeCounts.typed +
      summary.typeCounts.image_prompt;

   const availableModes: StudyMode[] = [];
   if (summary.total > 0) availableModes.push('flashcards', 'multiple_choice', 'mixed');
   if (withBack > 0) availableModes.push('typed');
   if (withBack >= 2) availableModes.push('matching');
   if (summary.typeCounts.cloze > 0) availableModes.push('cloze');

   return {
      cardCount: summary.total,
      dueCount: summary.due,
      newCount: summary.new,
      typeCounts: {
         term_definition: summary.typeCounts.term_definition ?? 0,
         cloze: summary.typeCounts.cloze ?? 0,
         multiple_choice: summary.typeCounts.multiple_choice ?? 0,
         typed: summary.typeCounts.typed ?? 0,
         image_prompt: summary.typeCounts.image_prompt ?? 0,
      },
      availableModes,
   };
}

export async function startSession(
   env: AppEnv,
   userId: string,
   input: StartSessionInput,
   createdBy: 'user' | 'mcp' = 'user',
): Promise<{ session: StudySession; plan: StudyPlan }> {
   const deck = await getOwnedDeck(env, userId, input.deckId);
   const { plan } = await buildPlan(env, userId, deck.id, {
      deckId: deck.id,
      mode: input.mode,
      goal: input.goal,
      minutes: input.minutes,
      cardIds: input.cardIds,
   });

   const session = await createStudySession(env, {
      id: plan.sessionId,
      userId,
      deckId: deck.id,
      mode: plan.mode,
      strategy: plan.strategy,
      plannedCardIds: plan.cardIds,
      createdBy,
   });

   return { session, plan };
}

export async function getSession(
   env: AppEnv,
   userId: string,
   sessionId: string,
): Promise<StudySession> {
   const row = await getStudySessionRow(env, sessionId);
   if (!row) throw notFound('Study session not found');
   if (String(row.user_id) !== userId) throw forbidden('You do not own this session');
   return mapSession(row);
}

/** Session detail plus the cards already reviewed (for resume). */
export async function getSessionDetail(
   env: AppEnv,
   userId: string,
   sessionId: string,
): Promise<StudySessionDetail> {
   const session = await getSession(env, userId, sessionId);
   const reviewed = await listReviewedCardIds(env, sessionId);
   return { ...session, reviewedCardIds: [...reviewed] };
}

export function listSessions(
   env: AppEnv,
   userId: string,
   opts: { status?: string; limit: number },
): Promise<StudySession[]> {
   return listSessionsForUser(env, userId, opts);
}

/** Mark an in-progress session abandoned; completed sessions are left as-is. */
export async function abandonSession(
   env: AppEnv,
   userId: string,
   sessionId: string,
): Promise<StudySession> {
   const session = await getSession(env, userId, sessionId);
   if (session.status === 'active') {
      await abandonStudySession(env, sessionId);
      return { ...session, status: 'abandoned', completedAt: new Date().toISOString() };
   }
   return session;
}

export async function recordReview(
   env: AppEnv,
   userId: string,
   sessionId: string,
   input: ReviewEventInput,
): Promise<ReviewResult> {
   const row = await getStudySessionRow(env, sessionId);
   if (!row) throw notFound('Study session not found');
   if (String(row.user_id) !== userId) throw forbidden('You do not own this session');
   if (String(row.status) !== 'active') throw conflict('Study session is not active');

   const card = await getOwnedCard(env, userId, input.cardId);
   const existingRow = await getLearningState(env, userId, card.id);
   const current = existingRow
      ? mapLearningState(existingRow)
      : newLearningState(userId, card.id, new Date());
   const next = scheduleReview(current, input.response, new Date());
   await upsertLearningState(env, next);

   const event = await appendReviewEvent(env, {
      sessionId,
      cardId: card.id,
      userId,
      response: input.response,
      isCorrect: isCorrectResponse(input.response),
      durationMs: input.durationMs,
      schedulerState: next.state,
   });

   const reviewed = await listReviewedCardIds(env, sessionId);
   const planned = JSON.parse(String(row.planned_card_ids_json ?? '[]')) as string[];
   const remaining = planned.filter((id) => !reviewed.has(id)).length;

   return { event, state: next, remaining };
}

export async function completeSession(
   env: AppEnv,
   userId: string,
   sessionId: string,
): Promise<StudySession> {
   const session = await getSession(env, userId, sessionId);
   await completeStudySession(env, sessionId);
   Object.assign(session, { status: 'completed', completedAt: new Date().toISOString() });
   return session;
}

export async function recommendStudyPlan(
   env: AppEnv,
   userId: string,
   input: PlanInput,
): Promise<StudyRecommendation> {
   const deck = await getOwnedDeck(env, userId, input.deckId);
   const { plan, source } = await buildPlan(env, userId, deck.id, input);
   return { plan, source, evaluationId: null };
}
