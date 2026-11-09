import { browser } from 'wxt/browser';
import { defineBackground } from 'wxt/utils/define-background';
import { cloneSet } from '@/lib/clone';
import { connectionStorage, getConnection } from '@/lib/connection';
import { AppError } from '@/lib/errors';
import type { ConnectionStatus, Message, MessageResponse } from '@/lib/messages';

async function handle(message: Message): Promise<MessageResponse> {
   switch (message.type) {
      case 'status': {
         const connection = await getConnection();
         const status: ConnectionStatus = {
            connected: Boolean(connection),
            ...(connection ? { origin: connection.origin } : {}),
         };
         return { ok: true, data: status };
      }

      case 'clone': {
         const connection = await getConnection();
         if (!connection) {
            throw new AppError(
               'NOT_CONNECTED',
               'Connect Takhtabush from the extension settings first.',
            );
         }
         try {
            return { ok: true, data: await cloneSet(connection, message.payload) };
         } catch (cause) {
            if (cause instanceof AppError && cause.code === 'AUTH_FAILED') {
               await connectionStorage.setValue(null);
            }
            throw cause;
         }
      }

      case 'open-options':
         await browser.runtime.openOptionsPage();
         return { ok: true };

      default:
         throw new AppError('UNKNOWN_MESSAGE', 'Unknown extension request.');
   }
}

export default defineBackground(() => {
   browser.runtime.onInstalled.addListener(({ reason }) => {
      if (reason === 'install') {
         void browser.runtime.openOptionsPage().catch(() => undefined);
      }
   });

   browser.runtime.onMessage.addListener((message, _sender, sendResponse) => {
      handle(message as Message).then(
         (response) => sendResponse(response),
         (cause) =>
            sendResponse({
               ok: false,
               code: cause instanceof AppError ? cause.code : 'UNEXPECTED',
               message: cause instanceof Error ? cause.message : 'Something went wrong.',
            } satisfies MessageResponse),
      );
      return true;
   });
});
