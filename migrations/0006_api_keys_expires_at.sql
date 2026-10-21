-- Migration 0006 — optional expiration for API keys.
-- NULL means the key never expires; otherwise it stops authenticating after
-- this timestamp.

ALTER TABLE api_keys ADD COLUMN expires_at TEXT;
