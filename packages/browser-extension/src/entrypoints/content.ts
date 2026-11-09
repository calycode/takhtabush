import { MAX_CARDS_PER_DECK } from '@caly/shared/limits';
import { browser } from 'wxt/browser';
import { defineContentScript } from 'wxt/utils/define-content-script';
import { connectionStorage } from '@/lib/connection';
import { log } from '@/lib/logger';
import type {
   CloneResult,
   ConnectionStatus,
   Message,
   MessageResponse,
   PageDiagnostics,
   PagePingMessage,
} from '@/lib/messages';
import { findTermsList, parseQuizletSet } from '@/lib/quizlet';

const HOST_ATTRIBUTE = 'data-takhtabush-clone';

const STYLES = `
:host {
   all: initial;
   display: block;
}

.bar {
   display: flex;
   flex-wrap: wrap;
   align-items: center;
   gap: 12px;
   margin: 0 0 14px;
   padding: 14px 16px;
   border: 1px solid #d7e5db;
   border-radius: 14px;
   background: linear-gradient(180deg, #f8fbf9, #eef7f1);
   box-shadow: 0 12px 30px -26px rgba(15, 23, 42, 0.5);
   color: #14261a;
   font-family: ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
   font-size: 14px;
   line-height: 1.4;
}

.identity {
   display: flex;
   align-items: center;
   gap: 10px;
   min-width: 170px;
}

.mark {
   display: grid;
   flex: 0 0 auto;
   place-items: center;
   width: 34px;
   height: 34px;
   border-radius: 9px;
   background: #15803d;
   color: #ffffff;
   font-size: 15px;
   font-weight: 800;
}

.copy {
   display: flex;
   flex-direction: column;
   gap: 1px;
}

.copy strong {
   font-size: 14px;
   font-weight: 700;
}

.meta {
   color: #5b6b60;
   font-size: 12px;
}

.controls {
   display: flex;
   flex-wrap: wrap;
   align-items: center;
   gap: 8px;
   margin-left: auto;
}

.clone,
.settings {
   border-radius: 9px;
   font: inherit;
   font-weight: 700;
   cursor: pointer;
}

.clone {
   padding: 10px 14px;
   border: 0;
   background: #15803d;
   color: #ffffff;
}

.clone:hover:not(:disabled) {
   background: #166534;
}

.clone:disabled {
   opacity: 0.6;
   cursor: default;
}

.settings {
   padding: 9px 12px;
   border: 1px solid #cfdcd3;
   background: #ffffff;
   color: #14261a;
}

.settings:hover {
   background: #f3f7f4;
}

.deck {
   max-width: 240px;
   overflow: hidden;
   color: #15803d;
   font-weight: 700;
   text-decoration: underline;
   text-overflow: ellipsis;
   text-underline-offset: 3px;
   white-space: nowrap;
}

.status {
   flex-basis: 100%;
   margin: 0;
   padding: 9px 11px;
   border-radius: 8px;
   font-size: 13px;
   line-height: 1.5;
   overflow-wrap: anywhere;
}

.status[data-tone="info"] {
   background: #eef6ff;
   color: #1d4ed8;
}

.status[data-tone="success"] {
   background: #e9f9ef;
   color: #166534;
}

.status[data-tone="error"] {
   background: #fef2f2;
   color: #b91c1c;
}

@media (max-width: 700px) {
   .controls {
      margin-left: 0;
   }
}
`;

type Ui = {
   host: HTMLElement;
   meta: HTMLElement;
   clone: HTMLButtonElement;
   settings: HTMLButtonElement;
   deck: HTMLAnchorElement;
   status: HTMLElement;
};

export default defineContentScript({
   matches: ['*://quizlet.com/*', '*://*.quizlet.com/*'],
   runAt: 'document_idle',

   main(ctx) {
      let ui: Ui | null = null;
      let timer: number | undefined;
      let diagnosticTimer: number | undefined;
      let lastUrl = location.href;
      let lastStatusLog = '';
      let pairCount = 0;
      let busy = false;
      let connectionStatus: ConnectionStatus | null = null;

      log.info('Content script started.', {
         url: location.href,
         host: location.hostname,
         readyState: document.readyState,
      });

      function logMissingTermsList(): void {
         if (ui) return;
         const termsList = document.querySelector('[data-testid="terms-list"]');
         const sections = Array.from(document.querySelectorAll('section'));

         log.warn('No terms list found; clone button was not injected.', {
            url: location.href,
            host: location.hostname,
            readyState: document.readyState,
            termsListElement: Boolean(termsList),
            termTextCount: document.querySelectorAll('.TermText').length,
            termTextFallbackCount: document.querySelectorAll('[class*="TermText"]').length,
            sectionCount: sections.length,
            firstSections: sections.slice(0, 5).map((section) => ({
               testId: section.getAttribute('data-testid'),
               termTexts: section.querySelectorAll('.TermText').length,
            })),
         });
      }

      async function send(message: Message): Promise<MessageResponse> {
         try {
            const response = (await browser.runtime.sendMessage(message)) as
               MessageResponse | undefined;
            if (response) return response;
         } catch {
            // The background worker can be gone after an extension reload.
         }

         return {
            ok: false,
            code: 'EXTENSION_UNAVAILABLE',
            message: 'The Takhtabush extension is unavailable. Reload the page and try again.',
         };
      }

      function setStatus(message: string, tone: 'info' | 'success' | 'error' = 'info'): void {
         if (!ui) return;
         ui.status.hidden = !message;
         ui.status.textContent = message;
         ui.status.dataset.tone = tone;
      }

      function setBusy(value: boolean): void {
         busy = value;
         if (!ui) return;
         ui.clone.disabled = value;
         ui.clone.textContent = value ? 'Cloning…' : 'Clone this to my Takhtabush account';
      }

      function updateMeta(): void {
         if (!ui) return;
         const pairs =
            pairCount === 1
               ? '1 term/definition pair found'
               : `${pairCount} term/definition pairs found`;
         const suffix = connectionStatus
            ? connectionStatus.connected
               ? ' · connected'
               : ' · not connected'
            : '';
         ui.meta.textContent = `${pairs}${suffix}`;
      }

      async function checkStatus(): Promise<void> {
         const response = await send({ type: 'status' });
         if (!ui) return;
         connectionStatus = response.ok
            ? ((response.data as ConnectionStatus | undefined) ?? null)
            : null;

         if (!response.ok) {
            log.warn('Connection status check failed.', {
               code: response.code,
               message: response.message,
            });
         }

         const statusLabel = connectionStatus
            ? connectionStatus.connected
               ? 'connected'
               : 'not connected'
            : 'unknown';
         if (statusLabel !== lastStatusLog) {
            lastStatusLog = statusLabel;
            log.info('Connection status:', statusLabel, connectionStatus?.origin ?? '');
         }

         if (connectionStatus && !connectionStatus.connected) ui.settings.hidden = false;
         updateMeta();
      }

      async function clone(): Promise<void> {
         if (busy) return;

         const set = parseQuizletSet(document);
         if (!set) {
            log.warn('Clone aborted: no terms list found.');
            setStatus('Could not find a terms list on this page.', 'error');
            return;
         }
         if (set.cards.length === 0) {
            log.warn('Clone aborted: no term/definition pairs parsed.', {
               url: location.href,
               termTextCount: document.querySelectorAll('.TermText').length,
            });
            setStatus('No term/definition pairs were found yet.', 'error');
            return;
         }
         if (set.cards.length > MAX_CARDS_PER_DECK) {
            log.warn('Clone aborted: deck card limit exceeded.', {
               pairs: set.cards.length,
               max: MAX_CARDS_PER_DECK,
            });
            setStatus(
               `This set has ${set.cards.length} cards, but a Takhtabush deck holds at most ${MAX_CARDS_PER_DECK}.`,
               'error',
            );
            return;
         }

         log.info('Clone requested.', {
            url: location.href,
            title: set.title,
            pairs: set.cards.length,
         });

         setBusy(true);
         setStatus('Cloning this set…', 'info');
         const response = await send({
            type: 'clone',
            payload: { ...set, sourceUrl: location.href },
         });
         setBusy(false);

         if (!response.ok) {
            log.error('Clone failed.', { code: response.code, message: response.message });
            setStatus(response.message, 'error');
            if (
               response.code === 'NOT_CONNECTED' ||
               response.code === 'AUTH_FAILED' ||
               response.code === 'PERMISSION_DENIED'
            ) {
               ui!.settings.hidden = false;
               void checkStatus();
            }
            return;
         }

         const result = response.data as CloneResult;
         log.info('Clone completed.', {
            deckId: result.deckId,
            imported: result.imported,
            updated: result.updated,
            skipped: result.skipped,
         });

         ui!.settings.hidden = true;
         ui!.deck.hidden = false;
         ui!.deck.href = `${result.origin}/decks/${result.deckId}`;
         ui!.deck.textContent = `Open ${result.deckTitle}`;

         const duplicates = set.cards.length - result.imported;
         const duplicateNote =
            duplicates > 0 ? ` ${duplicates} duplicate front(s) were skipped.` : '';
         setStatus(
            `Cloned ${result.imported} card${result.imported === 1 ? '' : 's'} to Takhtabush.${duplicateNote}`,
            'success',
         );
      }

      function mount(list: Element): Ui {
         document.querySelector(`[${HOST_ATTRIBUTE}]`)?.remove();

         const host = document.createElement('div');
         host.setAttribute(HOST_ATTRIBUTE, '');

         const shadow = host.attachShadow({ mode: 'open' });
         shadow.innerHTML = `
            <style>${STYLES}</style>
            <div class="bar">
               <div class="identity">
                  <span class="mark" aria-hidden="true">T</span>
                  <span class="copy">
                     <strong>Takhtabush</strong>
                     <span class="meta" data-meta>Reading this set…</span>
                  </span>
               </div>
               <div class="controls">
                  <button class="settings" type="button" data-settings hidden>Open settings</button>
                  <a class="deck" data-deck target="_blank" rel="noreferrer" hidden>Open deck</a>
                  <button class="clone" type="button" data-clone>Clone this to my Takhtabush account</button>
               </div>
               <p class="status" data-status role="status" hidden></p>
            </div>
         `;

         const mounted: Ui = {
            host,
            meta: shadow.querySelector<HTMLElement>('[data-meta]')!,
            clone: shadow.querySelector<HTMLButtonElement>('[data-clone]')!,
            settings: shadow.querySelector<HTMLButtonElement>('[data-settings]')!,
            deck: shadow.querySelector<HTMLAnchorElement>('[data-deck]')!,
            status: shadow.querySelector<HTMLElement>('[data-status]')!,
         };

         mounted.clone.addEventListener('click', () => void clone());
         mounted.settings.addEventListener('click', () => void send({ type: 'open-options' }));

         if (list.parentElement) {
            list.parentElement.insertBefore(host, list);
         } else {
            list.insertAdjacentElement('beforebegin', host);
         }
         return mounted;
      }

      function ensure(): void {
         const list = findTermsList(document);
         if (!list) return;

         if (!ui) {
            const set = parseQuizletSet(document);
            ui = mount(list);
            pairCount = set?.cards.length ?? 0;
            if (diagnosticTimer !== undefined) {
               clearTimeout(diagnosticTimer);
               diagnosticTimer = undefined;
            }
            updateMeta();
            log.info('Clone button inserted.', {
               url: location.href,
               title: set?.title ?? null,
               pairs: pairCount,
               termsListTag: list.tagName,
               termsListTestId: list.getAttribute('data-testid'),
               parentTag: list.parentElement?.tagName ?? null,
            });
            void checkStatus();
            return;
         }

         if (!ui.host.isConnected || ui.host.nextElementSibling !== list) {
            list.insertAdjacentElement('beforebegin', ui.host);
            log.info('Clone button reinserted after a page re-render.', {
               url: location.href,
            });
         }

         pairCount = parseQuizletSet(document)?.cards.length ?? 0;
         updateMeta();
      }

      function schedule(): void {
         if (location.href !== lastUrl) {
            lastUrl = location.href;
            log.info('Page URL changed.', lastUrl);
            if (!ui) {
               if (diagnosticTimer !== undefined) clearTimeout(diagnosticTimer);
               diagnosticTimer = window.setTimeout(logMissingTermsList, 5000);
            }
         }

         if (timer !== undefined) clearTimeout(timer);
         timer = window.setTimeout(() => {
            timer = undefined;
            ensure();
         }, 200);
      }

      const observer = new MutationObserver(schedule);
      observer.observe(document.documentElement, { childList: true, subtree: true });

      const unwatch = connectionStorage.watch(() => {
         void checkStatus();
      });

      diagnosticTimer = window.setTimeout(logMissingTermsList, 5000);

      ctx.onInvalidated(() => {
         log.info('Content script invalidated.');
         observer.disconnect();
         if (timer !== undefined) clearTimeout(timer);
         if (diagnosticTimer !== undefined) clearTimeout(diagnosticTimer);
         unwatch();
         ui?.host.remove();
      });

      browser.runtime.onMessage.addListener((message, _sender, sendResponse) => {
         if ((message as PagePingMessage | undefined)?.type !== 'page-ping') return false;

         const set = parseQuizletSet(document);
         const diagnostics: PageDiagnostics = {
            url: location.href,
            hasTermsList: Boolean(findTermsList(document)),
            pairCount: set?.cards.length ?? 0,
            title: set?.title ?? null,
            buttonInjected: Boolean(ui?.host.isConnected),
         };
         log.info('Page diagnostic requested.', diagnostics);
         sendResponse({ ok: true, data: diagnostics });
         return true;
      });

      window.addEventListener('popstate', schedule);
      ctx.onInvalidated(() => window.removeEventListener('popstate', schedule));

      ensure();
   },
});
