import type { CreateFolderInput, Folder, UpdateFolderInput } from '@caly/shared';
import type { AppEnv } from '../env';
import { forbidden, notFound } from '../lib/errors';
import { mapFolder } from '../lib/map';
import {
   getFolderRow,
   insertFolder,
   listFolders,
   softDeleteFolder,
   updateFolder,
} from '../repositories/folders';

export function listUserFolders(env: AppEnv, userId: string): Promise<Folder[]> {
   return listFolders(env, userId);
}

export async function createFolder(
   env: AppEnv,
   userId: string,
   input: CreateFolderInput,
): Promise<Folder> {
   return insertFolder(env, { ownerId: userId, name: input.name, parentId: input.parentId });
}

export async function patchFolder(
   env: AppEnv,
   userId: string,
   folderId: string,
   input: UpdateFolderInput,
): Promise<Folder> {
   const row = await getFolderRow(env, folderId);
   if (!row) throw notFound('Folder not found');
   if (String(row.owner_id) !== userId) throw forbidden('You do not own this folder');
   const folder = await updateFolder(env, folderId, input);
   if (!folder) throw notFound('Folder not found');
   return folder;
}

export async function removeFolder(env: AppEnv, userId: string, folderId: string): Promise<void> {
   const row = await getFolderRow(env, folderId);
   if (!row) throw notFound('Folder not found');
   if (String(row.owner_id) !== userId) throw forbidden('You do not own this folder');
   await softDeleteFolder(env, folderId);
}

export function mapFolderRow(row: Record<string, unknown>): Folder {
   return mapFolder(row);
}
