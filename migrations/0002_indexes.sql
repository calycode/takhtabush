-- Migration 0002_indexes — hot lookup paths (SPEC §4.2).

CREATE INDEX idx_decks_owner ON decks(owner_id, deleted_at, updated_at DESC);
CREATE INDEX idx_cards_deck ON cards(deck_id, deleted_at, updated_at DESC);
CREATE INDEX idx_cards_owner ON cards(owner_id, deleted_at);
CREATE INDEX idx_reviews_user_card ON review_events(user_id, card_id, reviewed_at DESC);
CREATE INDEX idx_reviews_session ON review_events(session_id, reviewed_at);
CREATE INDEX idx_learning_due ON learning_state(user_id, due_at, suspended);
CREATE INDEX idx_media_owner ON media_objects(owner_id, status, created_at DESC);
CREATE INDEX idx_ai_subject ON ai_evaluations(subject_type, subject_id, created_at DESC);

-- Auth + supporting lookups.
CREATE INDEX idx_sessions_user ON sessions(user_id, expires_at);
CREATE INDEX idx_magic_link_email ON magic_link_tokens(email, expires_at);
CREATE INDEX idx_decks_folder ON decks(owner_id, folder_id, deleted_at);
CREATE INDEX idx_sessions_status ON study_sessions(user_id, deck_id, status);
CREATE INDEX idx_audit_user ON mcp_audit_events(user_id, created_at DESC);
