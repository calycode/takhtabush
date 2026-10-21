import type {
   Card,
   CardRevision,
   Deck,
   Folder,
   MediaObject,
   StudySession,
   ReviewEvent,
} from '@caly/shared';

function bool(value: unknown): boolean {
   return value === 1 || value === true || value === '1';
}

/** Raw D1 row shapes (snake_case) → API schemas (camelCase). */

export function mapDeck(row: Record<string, unknown>): Deck {
   return {
      id: String(row.id),
      ownerId: String(row.owner_id),
      title: String(row.title),
      description: (row.description as string | null) ?? null,
      folderId: (row.folder_id as string | null) ?? null,
      cardCount: Number(row.card_count ?? 0),
      createdAt: String(row.created_at),
      updatedAt: String(row.updated_at),
      deletedAt: (row.deleted_at as string | null) ?? null,
   };
}

export function mapCard(row: Record<string, unknown>): Card {
   const choicesJson = row.choices_json as string | null;
   const tagsJson = row.tags_json as string | null;
   return {
      id: String(row.id),
      deckId: String(row.deck_id),
      ownerId: String(row.owner_id),
      type: row.type as Card['type'],
      front: String(row.front),
      back: (row.back as string | null) ?? null,
      clozeText: (row.cloze_text as string | null) ?? null,
      choices: choicesJson ? (JSON.parse(choicesJson) as string[]) : null,
      correctChoice:
         row.correct_choice === null || row.correct_choice === undefined
            ? null
            : Number(row.correct_choice),
      imageMediaId: (row.image_media_id as string | null) ?? null,
      audioMediaId: (row.audio_media_id as string | null) ?? null,
      tags: tagsJson ? (JSON.parse(tagsJson) as string[]) : [],
      status: (row.status as Card['status']) ?? 'active',
      source: (row.source as Card['source']) ?? 'manual',
      createdAt: String(row.created_at),
      updatedAt: String(row.updated_at),
      deletedAt: (row.deleted_at as string | null) ?? null,
   };
}

export function mapFolder(row: Record<string, unknown>): Folder {
   return {
      id: String(row.id),
      ownerId: String(row.owner_id),
      name: String(row.name),
      parentId: (row.parent_id as string | null) ?? null,
      createdAt: String(row.created_at),
      deletedAt: (row.deleted_at as string | null) ?? null,
   };
}

export function mapMedia(row: Record<string, unknown>): MediaObject {
   return {
      id: String(row.id),
      ownerId: String(row.owner_id),
      mimeType: String(row.mime_type),
      byteSize: Number(row.byte_size ?? 0),
      checksum: (row.checksum as string | null) ?? null,
      status: (row.status as MediaObject['status']) ?? 'pending',
      createdAt: String(row.created_at),
   };
}

export function mapSession(row: Record<string, unknown>): StudySession {
   return {
      id: String(row.id),
      userId: String(row.user_id),
      deckId: String(row.deck_id),
      mode: row.mode as StudySession['mode'],
      strategy: (row.strategy as string | null) ?? null,
      plannedCardIds: JSON.parse(String(row.planned_card_ids_json ?? '[]')) as string[],
      status: (row.status as StudySession['status']) ?? 'active',
      startedAt: String(row.started_at),
      completedAt: (row.completed_at as string | null) ?? null,
      createdBy: (row.created_by as StudySession['createdBy']) ?? 'user',
   };
}

export function mapReviewEvent(row: Record<string, unknown>): ReviewEvent {
   return {
      id: String(row.id),
      sessionId: String(row.session_id),
      cardId: String(row.card_id),
      userId: String(row.user_id),
      response: row.response as ReviewEvent['response'],
      isCorrect: bool(row.is_correct),
      durationMs:
         row.duration_ms === null || row.duration_ms === undefined ? null : Number(row.duration_ms),
      schedulerState: JSON.parse(String(row.scheduler_state_json ?? '{}')) as Record<
         string,
         unknown
      >,
      reviewedAt: String(row.reviewed_at),
   };
}

export function mapCardRevision(row: Record<string, unknown>): CardRevision {
   return {
      id: String(row.id),
      cardId: String(row.card_id),
      authorId: String(row.author_id),
      snapshot: JSON.parse(String(row.snapshot_json ?? '{}')) as Record<string, unknown>,
      createdAt: String(row.created_at),
   };
}
