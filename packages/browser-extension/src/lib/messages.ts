export type QuizletCard = {
   term: string;
   definition: string;
};

export type QuizletSet = {
   title: string;
   description: string;
   cards: QuizletCard[];
};

export type CloneSetPayload = QuizletSet & {
   sourceUrl: string;
};

export type CloneResult = {
   deckId: string;
   deckTitle: string;
   imported: number;
   updated: number;
   skipped: number;
   origin: string;
};

export type ConnectionStatus = {
   connected: boolean;
   origin?: string;
};

export type Message =
   { type: 'status' } | { type: 'clone'; payload: CloneSetPayload } | { type: 'open-options' };

export type MessageResponse =
   { ok: true; data?: unknown } | { ok: false; code: string; message: string };
