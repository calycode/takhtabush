import { browser } from 'wxt/browser';
import { defineBackground } from 'wxt/utils/define-background';
import { cloneSet } from '@/lib/clone';
import { connectionStorage, getConnection } from '@/lib/connection';
import { AppError } from '@/lib/errors';
import { log } from '@/lib/logger';
import type { ConnectionStatus, Message, MessageResponse } from '@/lib/messages';

async function handle(message: Message): Promise<MessageResponse> {
   switch (message.type) {
      case 'status': {
         const connection = await getConnection();
         const status: ConnectionStatus = {
            connected: Boolean(connection),
            ...(connection ? { origin: connection.origin } : {}),
         };
         log.debug('Status requested.', status);
         return { ok: true, data: status };
      }

      case 'clone': {
         log.info('Clone message received.', {
            title: message.payload.title,
            pairs: message.payload.cards.length,
            sourceUrl: message.payload.sourceUrl,
         });

         const connection = await getConnection();
         if (!connection) {
            log.warn('Clone rejected: no Takhtabush connection saved.');
            throw new AppError(
               'NOT_CONNECTED',
               'Connect Takhtabush from the extension settings first.',
            );
         }

         try {
            const result = await cloneSet(connection, message.payload);
            log.info('Clone succeeded.', {
               origin: connection.origin,
               deckId: result.deckId,
               imported: result.imported,
               updated: result.updated,
               skipped: result.skipped,
            });
            return { ok: true, data: result };
         } catch (cause) {
            log.error('Clone message failed.', {
               origin: connection.origin,
               code: cause instanceof AppError ? cause.code : 'UNEXPECTED',
               message: cause instanceof Error ? cause.message : String(cause),
            });
            if (cause instanceof AppError && cause.code === 'AUTH_FAILED') {
               await connectionStorage.setValue(null);
            }
            throw cause;
         }
      }

      case 'open-options':
         log.info('Opening extension settings.');
         await browser.runtime.openOptionsPage();
         return { ok: true };

      default:
         log.warn('Unknown extension message.', message);
         throw new AppError('UNKNOWN_MESSAGE', 'Unknown extension request.');
   }
}

export default defineBackground(() => {
   log.info('Background service worker started.');

   browser.runtime.onInstalled.addListener(({ reason }) => {
      log.info('Extension installed/updated.', { reason });
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
