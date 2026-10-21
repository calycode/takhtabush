-- Migration 0007 — a deployment has at most one owner account (single tenancy).
-- `is_owner` is 1 for the first user and 0 for anyone explicitly allowed later.

CREATE UNIQUE INDEX idx_users_single_owner ON users(is_owner) WHERE is_owner = 1;
