-- Migration 0001_init — core schema (SPEC §4.1).
-- Timestamps are ISO-8601 TEXT; ids are prefixed opaque strings.

CREATE TABLE users (
   id TEXT PRIMARY KEY,
   email TEXT NOT NULL UNIQUE,
   display_name TEXT NOT NULL,
   is_owner INTEGER NOT NULL DEFAULT 0,
   created_at TEXT NOT NULL,
   updated_at TEXT NOT NULL
);

CREATE TABLE sessions (
   id TEXT PRIMARY KEY,
   user_id TEXT NOT NULL REFERENCES users(id),
   token_hash TEXT NOT NULL UNIQUE,
   user_agent TEXT,
   ip_hash TEXT,
   created_at TEXT NOT NULL,
   expires_at TEXT NOT NULL,
   revoked_at TEXT
);

CREATE TABLE magic_link_tokens (
   id TEXT PRIMARY KEY,
   email TEXT NOT NULL,
   token_hash TEXT NOT NULL UNIQUE,
   created_at TEXT NOT NULL,
   expires_at TEXT NOT NULL,
   consumed_at TEXT
);

CREATE TABLE decks (
   id TEXT PRIMARY KEY,
   owner_id TEXT NOT NULL REFERENCES users(id),
   title TEXT NOT NULL,
   description TEXT,
   folder_id TEXT,
   visibility TEXT NOT NULL DEFAULT 'private',
   card_count INTEGER NOT NULL DEFAULT 0,
   created_at TEXT NOT NULL,
   updated_at TEXT NOT NULL,
   deleted_at TEXT
);

CREATE TABLE cards (
   id TEXT PRIMARY KEY,
   deck_id TEXT NOT NULL REFERENCES decks(id),
   owner_id TEXT NOT NULL REFERENCES users(id),
   type TEXT NOT NULL,
   front TEXT NOT NULL,
   back TEXT,
   cloze_text TEXT,
   choices_json TEXT,
   correct_choice INTEGER,
   image_media_id TEXT,
   audio_media_id TEXT,
   tags_json TEXT NOT NULL DEFAULT '[]',
   status TEXT NOT NULL DEFAULT 'active',
   source TEXT NOT NULL DEFAULT 'manual',
   created_at TEXT NOT NULL,
   updated_at TEXT NOT NULL,
   deleted_at TEXT
);

CREATE TABLE card_revisions (
   id TEXT PRIMARY KEY,
   card_id TEXT NOT NULL REFERENCES cards(id),
   author_id TEXT NOT NULL REFERENCES users(id),
   snapshot_json TEXT NOT NULL,
   created_at TEXT NOT NULL
);

CREATE TABLE folders (
   id TEXT PRIMARY KEY,
   owner_id TEXT NOT NULL REFERENCES users(id),
   name TEXT NOT NULL,
   parent_id TEXT,
   created_at TEXT NOT NULL,
   deleted_at TEXT
);

CREATE TABLE media_objects (
   id TEXT PRIMARY KEY,
   owner_id TEXT NOT NULL REFERENCES users(id),
   r2_key TEXT NOT NULL UNIQUE,
   mime_type TEXT NOT NULL,
   byte_size INTEGER NOT NULL,
   checksum TEXT,
   status TEXT NOT NULL DEFAULT 'pending',
   created_at TEXT NOT NULL,
   deleted_at TEXT
);

CREATE TABLE study_sessions (
   id TEXT PRIMARY KEY,
   user_id TEXT NOT NULL REFERENCES users(id),
   deck_id TEXT NOT NULL REFERENCES decks(id),
   mode TEXT NOT NULL,
   strategy TEXT,
   planned_card_ids_json TEXT NOT NULL,
   status TEXT NOT NULL DEFAULT 'active',
   started_at TEXT NOT NULL,
   completed_at TEXT,
   created_by TEXT NOT NULL DEFAULT 'user'
);

CREATE TABLE review_events (
   id TEXT PRIMARY KEY,
   session_id TEXT NOT NULL REFERENCES study_sessions(id),
   card_id TEXT NOT NULL REFERENCES cards(id),
   user_id TEXT NOT NULL REFERENCES users(id),
   response TEXT NOT NULL,
   is_correct INTEGER NOT NULL,
   duration_ms INTEGER,
   scheduler_state_json TEXT NOT NULL,
   reviewed_at TEXT NOT NULL
);

CREATE TABLE learning_state (
   user_id TEXT NOT NULL,
   card_id TEXT NOT NULL,
   scheduler_version INTEGER NOT NULL,
   state_json TEXT NOT NULL,
   due_at TEXT,
   interval_days REAL,
   ease REAL,
   repetitions INTEGER NOT NULL DEFAULT 0,
   lapses INTEGER NOT NULL DEFAULT 0,
   last_reviewed_at TEXT,
   suspended INTEGER NOT NULL DEFAULT 0,
   PRIMARY KEY (user_id, card_id)
);

CREATE TABLE ai_evaluations (
   id TEXT PRIMARY KEY,
   user_id TEXT NOT NULL,
   subject_type TEXT NOT NULL,
   subject_id TEXT NOT NULL,
   purpose TEXT NOT NULL,
   model TEXT NOT NULL,
   gateway_request_id TEXT,
   input_hash TEXT NOT NULL,
   question_schema_json TEXT NOT NULL,
   result_json TEXT NOT NULL,
   status TEXT NOT NULL DEFAULT 'succeeded',
   confidence REAL,
   created_at TEXT NOT NULL
);

CREATE TABLE mcp_audit_events (
   id TEXT PRIMARY KEY,
   user_id TEXT NOT NULL,
   tool_name TEXT NOT NULL,
   action TEXT NOT NULL,
   input_summary_json TEXT NOT NULL,
   affected_ids_json TEXT NOT NULL,
   request_id TEXT,
   created_at TEXT NOT NULL
);
