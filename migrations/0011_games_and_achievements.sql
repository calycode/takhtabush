-- Arcade sessions persist their authoritative game state on the study session.
ALTER TABLE study_sessions ADD COLUMN game_state_json TEXT;

CREATE TABLE game_results (
   id TEXT PRIMARY KEY,
   user_id TEXT NOT NULL REFERENCES users(id),
   session_id TEXT NOT NULL UNIQUE REFERENCES study_sessions(id),
   deck_id TEXT NOT NULL REFERENCES decks(id),
   mode TEXT NOT NULL,
   result TEXT NOT NULL,
   score INTEGER NOT NULL DEFAULT 0,
   best_combo INTEGER NOT NULL DEFAULT 0,
   lives_left INTEGER NOT NULL DEFAULT 0,
   bosses_defeated INTEGER NOT NULL DEFAULT 0,
   duration_ms INTEGER,
   created_at TEXT NOT NULL
);

CREATE INDEX idx_game_results_user_time ON game_results(user_id, created_at DESC);
CREATE INDEX idx_game_results_user_mode ON game_results(user_id, mode, result);

CREATE TABLE user_achievements (
   user_id TEXT NOT NULL REFERENCES users(id),
   achievement_id TEXT NOT NULL,
   unlocked_at TEXT NOT NULL,
   seen_at TEXT,
   shared_at TEXT,
   PRIMARY KEY (user_id, achievement_id)
);

CREATE INDEX idx_user_achievements_user ON user_achievements(user_id, unlocked_at DESC);
