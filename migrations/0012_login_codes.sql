-- A sign-in email carries both a magic link and a six-digit code. Either one
-- consumes the same row, so the link and the code cannot sign in twice.
ALTER TABLE magic_link_tokens ADD COLUMN code_hash TEXT;

CREATE INDEX IF NOT EXISTS idx_magic_link_tokens_email_code
   ON magic_link_tokens(email, code_hash, expires_at);
