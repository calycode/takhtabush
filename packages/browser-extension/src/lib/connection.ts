import { storage } from 'wxt/utils/storage';

export type Connection = {
   origin: string;
   token: string;
   connectedAt: string;
};

export { normalizeOrigin, permissionPattern } from './url';

export const connectionStorage = storage.defineItem<Connection | null>('local:connection', {
   fallback: null,
});

export async function getConnection(): Promise<Connection | null> {
   const value = await connectionStorage.getValue();
   if (!value?.origin || !value.token) return null;
   return value;
}
