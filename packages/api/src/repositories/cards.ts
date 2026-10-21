import { encodeCursor, decodeCursor } from '@caly/shared';
import type { Card, CreateCardInput, UpdateCardInput } from '@caly/shared';
import { newId, nowIso } from '@caly/worker-kit';
import type { AppEnv } from '../env';
import { mapCard } from '../lib/map';

export function getCardRow(env: AppEnv, id: string): Promise<Record<string, unknown> | null> {
   return env.DB.prepare('SELECT * FROM cards WHERE id = ? AND deleted_at IS NULL')
      .bind(id)
      .first<Record<string, unknown>>();
}

export async function listCards(
   env: AppEnv,
   deckId: string,
   opts: { limit: number; cursor?: string; status?: string },
): Promise<{ items: Card[]; nextCursor: string | null }> {
   const decoded = opts.cursor ? decodeCursor(opts.cursor) : null;
   const params: unknown[] = [deckId];
   let sql = 'SELECT * FROM cards WHERE deck_id = ? AND deleted_at IS NULL';
   if (opts.status) {
      sql += ' AND status = ?';
      params.push(opts.status);
   }
   if (decoded) {
      sql += ' AND (updated_at < ? OR (updated_at = ? AND id < ?))';
      params.push(decoded.updatedAt, decoded.updatedAt, decoded.id);
   }
   sql += ' ORDER BY updated_at DESC, id DESC LIMIT ?';
   params.push(opts.limit + 1);

   const result = await env.DB.prepare(sql)
      .bind(...params)
      .all<Record<string, unknown>>();
   const rows = result.results ?? [];
   const hasMore = rows.length > opts.limit;
   const page = hasMore ? rows.slice(0, opts.limit) : rows;
   const last = page[page.length - 1];
   return {
      items: page.map(mapCard),
      nextCursor: hasMore && last ? encodeCursor(String(last.updated_at), String(last.id)) : null,
   };
}

/** Every tag string used on the user's live cards (for tag suggestions). */
export async function listOwnedTagStrings(env: AppEnv, ownerId: string): Promise<string[]> {
   const result = await env.DB.prepare(
      'SELECT tags_json FROM cards WHERE owner_id = ? AND deleted_at IS NULL',
   )
      .bind(ownerId)
      .all<{ tags_json: string }>();

   const tags: string[] = [];
   for (const row of result.results ?? []) {
      try {
         const parsed = JSON.parse(row.tags_json || '[]') as unknown;
         if (Array.isArray(parsed)) for (const tag of parsed) tags.push(String(tag));
      } catch {
         // ignore malformed rows
      }
   }
   return tags;
}

/** id + front for every live card in a deck (used to dedupe imports). */
export async function listCardFronts(
   env: AppEnv,
   deckId: string,
): Promise<Array<{ id: string; front: string }>> {
   const result = await env.DB.prepare(
      'SELECT id, front FROM cards WHERE deck_id = ? AND deleted_at IS NULL',
   )
      .bind(deckId)
      .all<{ id: string; front: string }>();
   return result.results ?? [];
}

/** Keep only ids that are live cards in the deck and owned by the caller. */
export async function filterOwnedCardIds(
   env: AppEnv,
   ownerId: string,
   deckId: string,
   ids: string[],
): Promise<string[]> {
   if (ids.length === 0) return [];
   const placeholders = ids.map(() => '?').join(',');
   const result = await env.DB.prepare(
      `SELECT id FROM cards
        WHERE owner_id = ? AND deck_id = ? AND deleted_at IS NULL AND id IN (${placeholders})`,
   )
      .bind(ownerId, deckId, ...ids)
      .all<{ id: string }>();
   const owned = new Set((result.results ?? []).map((row) => row.id));
   return ids.filter((id) => owned.has(id));
}

export async function listAllCards(env: AppEnv, deckId: string): Promise<Card[]> {
   const result = await env.DB.prepare(
      'SELECT * FROM cards WHERE deck_id = ? AND deleted_at IS NULL ORDER BY created_at ASC',
   )
      .bind(deckId)
      .all<Record<string, unknown>>();
   return (result.results ?? []).map(mapCard);
}

function cardFields(input: CreateCardInput) {
   return [
      input.type,
      input.front,
      input.back ?? null,
      input.clozeText ?? null,
      input.choices ? JSON.stringify(input.choices) : null,
      input.correctChoice ?? null,
      input.imageMediaId ?? null,
      input.audioMediaId ?? null,
      JSON.stringify(input.tags ?? []),
      input.status ?? 'active',
      input.source ?? 'manual',
   ];
}

export async function insertCard(
   env: AppEnv,
   input: { deckId: string; ownerId: string; card: CreateCardInput },
): Promise<Card> {
   const id = newId('card');
   const now = nowIso();
   await env.DB.prepare(
      `INSERT INTO cards
         (id, deck_id, owner_id, type, front, back, cloze_text, choices_json, correct_choice,
          image_media_id, audio_media_id, tags_json, status, source, created_at, updated_at, deleted_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NULL)`,
   )
      .bind(id, input.deckId, input.ownerId, ...cardFields(input.card), now, now)
      .run();
   const row = await getCardRow(env, id);
   if (!row) throw new Error('Failed to create card');
   return mapCard(row);
}

export async function updateCard(
   env: AppEnv,
   id: string,
   patch: UpdateCardInput,
): Promise<Card | null> {
   const map: Array<[keyof UpdateCardInput, string]> = [
      ['front', 'front'],
      ['back', 'back'],
      ['clozeText', 'cloze_text'],
      ['imageMediaId', 'image_media_id'],
      ['audioMediaId', 'audio_media_id'],
      ['status', 'status'],
   ];
   const sets: string[] = [];
   const params: unknown[] = [];
   for (const [key, column] of map) {
      if (patch[key] !== undefined) {
         sets.push(`${column} = ?`);
         params.push(patch[key]);
      }
   }
   if (patch.choices !== undefined) {
      sets.push('choices_json = ?');
      params.push(patch.choices ? JSON.stringify(patch.choices) : null);
   }
   if (patch.correctChoice !== undefined) {
      sets.push('correct_choice = ?');
      params.push(patch.correctChoice);
   }
   if (patch.tags !== undefined) {
      sets.push('tags_json = ?');
      params.push(JSON.stringify(patch.tags));
   }

   if (sets.length > 0) {
      sets.push('updated_at = ?');
      params.push(nowIso(), id);
      await env.DB.prepare(`UPDATE cards SET ${sets.join(', ')} WHERE id = ?`)
         .bind(...params)
         .run();
   }
   const row = await getCardRow(env, id);
   return row ? mapCard(row) : null;
}

export async function softDeleteCard(env: AppEnv, id: string): Promise<void> {
   const now = nowIso();
   await env.DB.prepare('UPDATE cards SET deleted_at = ?, updated_at = ? WHERE id = ?')
      .bind(now, now, id)
      .run();
}

/** A card row regardless of soft-delete state (used to restore). */
export function getCardRowIncludingDeleted(
   env: AppEnv,
   id: string,
): Promise<Record<string, unknown> | null> {
   return env.DB.prepare('SELECT * FROM cards WHERE id = ?')
      .bind(id)
      .first<Record<string, unknown>>();
}

export async function restoreCard(env: AppEnv, id: string): Promise<void> {
   await env.DB.prepare('UPDATE cards SET deleted_at = NULL, updated_at = ? WHERE id = ?')
      .bind(nowIso(), id)
      .run();
}

export async function insertCardRevision(
   env: AppEnv,
   input: { cardId: string; authorId: string; snapshot: Record<string, unknown> },
): Promise<void> {
   await env.DB.prepare(
      `INSERT INTO card_revisions (id, card_id, author_id, snapshot_json, created_at) VALUES (?, ?, ?, ?, ?)`,
   )
      .bind(newId('rev'), input.cardId, input.authorId, JSON.stringify(input.snapshot), nowIso())
      .run();
}

export type CardSearchRow = Record<string, unknown> & { due_state: string };

/**
 * MCP search across cards with optional filters, keyset pagination, and the
 * due-state computed in SQL (avoids an N+1 learning-state lookup per card).
 */
export async function searchCardsPage(
   env: AppEnv,
   opts: {
      ownerId: string;
      deckId?: string;
      query?: string;
      tag?: string;
      due?: string;
      status?: string;
      limit: number;
      cursor?: string;
   },
): Promise<{ rows: CardSearchRow[]; nextCursor: string | null }> {
   const now = nowIso();
   const decoded = opts.cursor ? decodeCursor(opts.cursor) : null;

   // Inner params: CASE due-date param, join user param, then WHERE params.
   const innerParams: unknown[] = [now, opts.ownerId, opts.ownerId];
   let where = 'c.owner_id = ? AND c.deleted_at IS NULL';
   if (opts.deckId) {
      where += ' AND c.deck_id = ?';
      innerParams.push(opts.deckId);
   }
   if (opts.status) {
      where += ' AND c.status = ?';
      innerParams.push(opts.status);
   }
   if (opts.query) {
      where += ' AND c.front LIKE ?';
      innerParams.push(`%${opts.query}%`);
   }
   if (opts.tag) {
      where += ' AND c.tags_json LIKE ?';
      innerParams.push(`%"${opts.tag}"%`);
   }

   const inner = `SELECT c.*, CASE
        WHEN c.status = 'suspended' THEN 'suspended'
        WHEN ls.card_id IS NULL THEN 'new'
        WHEN ls.due_at IS NOT NULL AND ls.due_at <= ? THEN 'due'
        ELSE 'scheduled'
      END AS due_state
     FROM cards c
     LEFT JOIN learning_state ls ON ls.card_id = c.id AND ls.user_id = ?
     WHERE ${where}`;

   const outerParams: unknown[] = [];
   let outerWhere = '1=1';
   if (opts.due) {
      outerWhere += ' AND due_state = ?';
      outerParams.push(opts.due);
   }
   if (decoded) {
      outerWhere += ' AND (updated_at < ? OR (updated_at = ? AND id < ?))';
      outerParams.push(decoded.updatedAt, decoded.updatedAt, decoded.id);
   }
   outerParams.push(opts.limit + 1);

   const result = await env.DB.prepare(
      `SELECT * FROM (${inner}) t WHERE ${outerWhere} ORDER BY updated_at DESC, id DESC LIMIT ?`,
   )
      .bind(...innerParams, ...outerParams)
      .all<CardSearchRow>();

   const rows = result.results ?? [];
   const hasMore = rows.length > opts.limit;
   const page = hasMore ? rows.slice(0, opts.limit) : rows;
   const last = page[page.length - 1];
   return {
      rows: page,
      nextCursor: hasMore && last ? encodeCursor(String(last.updated_at), String(last.id)) : null,
   };
}
