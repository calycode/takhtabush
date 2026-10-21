import { newId, nowIso } from '@caly/worker-kit';
import type { User } from '@caly/shared';
import type { AppEnv } from '../env';

export type UserRow = {
   id: string;
   email: string;
   display_name: string;
   is_owner: number;
   created_at: string;
   updated_at: string;
};

export function mapUserRow(row: UserRow): User {
   return {
      id: row.id,
      email: row.email,
      displayName: row.display_name,
      isOwner: row.is_owner === 1,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
   };
}

export function getUserById(env: AppEnv, id: string): Promise<UserRow | null> {
   return env.DB.prepare('SELECT * FROM users WHERE id = ?').bind(id).first<UserRow>();
}

export function getUserByEmail(env: AppEnv, email: string): Promise<UserRow | null> {
   return env.DB.prepare('SELECT * FROM users WHERE email = ?')
      .bind(email.toLowerCase())
      .first<UserRow>();
}

/** The deployment owner. The partial unique index guarantees at most one. */
export function getOwner(env: AppEnv): Promise<UserRow | null> {
   return env.DB.prepare('SELECT * FROM users WHERE is_owner = 1 LIMIT 1').first<UserRow>();
}

export async function countUsers(env: AppEnv): Promise<number> {
   const row = await env.DB.prepare('SELECT COUNT(*) AS count FROM users').first<{
      count: number;
   }>();
   return Number(row?.count ?? 0);
}

export async function insertUser(
   env: AppEnv,
   input: { email: string; displayName: string; isOwner: boolean },
): Promise<UserRow> {
   const id = newId('usr');
   const now = nowIso();
   await env.DB.prepare(
      `INSERT INTO users (id, email, display_name, is_owner, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?)`,
   )
      .bind(id, input.email.toLowerCase(), input.displayName, input.isOwner ? 1 : 0, now, now)
      .run();
   const row = await getUserById(env, id);
   if (!row) throw new Error('Failed to create user');
   return row;
}

export async function updateUser(
   env: AppEnv,
   id: string,
   patch: { displayName?: string },
): Promise<UserRow | null> {
   const sets: string[] = [];
   const params: unknown[] = [];
   if (patch.displayName !== undefined) {
      sets.push('display_name = ?');
      params.push(patch.displayName);
   }
   if (sets.length === 0) return getUserById(env, id);
   sets.push('updated_at = ?');
   params.push(nowIso(), id);
   await env.DB.prepare(`UPDATE users SET ${sets.join(', ')} WHERE id = ?`)
      .bind(...params)
      .run();
   return getUserById(env, id);
}
