-- Migration 0004_api_keys — opaque API keys for MCP clients (SPEC §3.4, §9.3).

CREATE TABLE api_keys (
   id TEXT PRIMARY KEY,
   user_id TEXT NOT NULL REFERENCES users(id),
   name TEXT NOT NULL,
   key_prefix TEXT NOT NULL,
   key_hash TEXT NOT NULL UNIQUE,
   scopes_json TEXT NOT NULL DEFAULT '[]',
   created_at TEXT NOT NULL,
   last_used_at TEXT,
   revoked_at TEXT
);

CREATE INDEX idx_api_keys_user ON api_keys(user_id, revoked_at);
CREATE INDEX idx_api_keys_hash ON api_keys(key_hash);
