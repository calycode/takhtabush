-- Migration 0003_rate_limits — fixed-window rate limiting for auth (SPEC §3.2).

CREATE TABLE rate_limits (
   bucket TEXT NOT NULL,
   window_start INTEGER NOT NULL,
   count INTEGER NOT NULL DEFAULT 0,
   PRIMARY KEY (bucket, window_start)
);

CREATE INDEX idx_rate_limits_window ON rate_limits(window_start);
