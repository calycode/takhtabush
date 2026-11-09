import { browser } from 'wxt/browser';
import { connectionStorage, getConnection } from './connection';
import { log } from './logger';
import type { PagePingMessage, PagePingResponse } from './messages';

export function mountPopup(root: HTMLElement): void {
   root.innerHTML = `
      <main class="tk-popup">
         <header class="tk-header">
            <div class="tk-mark" aria-hidden="true">T</div>
            <div>
               <h1>Takhtabush Extension</h1>
               <p id="popup-summary">Checking connection…</p>
            </div>
         </header>
         <div class="tk-actions tk-actions-stack">
            <button id="open-settings" class="tk-button tk-button-primary" type="button">Open settings</button>
            <button id="check-page" class="tk-button tk-button-secondary" type="button">Check this page</button>
            <a id="open-app" class="tk-button tk-button-secondary" target="_blank" rel="noreferrer" hidden>Open Takhtabush</a>
         </div>
         <div id="page-diagnostics" class="tk-status" data-tone="info" hidden></div>
         <p class="tk-hint">Open a Quizlet set page and use the green clone button above the terms list.</p>
      </main>
   `;

   const summary = root.querySelector<HTMLElement>('#popup-summary')!;
   const openSettings = root.querySelector<HTMLButtonElement>('#open-settings')!;
   const checkPageButton = root.querySelector<HTMLButtonElement>('#check-page')!;
   const pageDiagnostics = root.querySelector<HTMLElement>('#page-diagnostics')!;
   const openApp = root.querySelector<HTMLAnchorElement>('#open-app')!;

   function setDiagnostics(message: string, tone: 'info' | 'success' | 'error' = 'info'): void {
      pageDiagnostics.hidden = !message;
      pageDiagnostics.textContent = message;
      pageDiagnostics.dataset.tone = tone;
   }

   async function refresh(): Promise<void> {
      const connection = await getConnection();
      if (!connection) {
         summary.textContent = 'Not connected yet.';
         openApp.hidden = true;
         return;
      }

      summary.textContent = `Connected to ${connection.origin}.`;
      openApp.hidden = false;
      openApp.href = connection.origin;
   }

   async function checkPage(): Promise<void> {
      setDiagnostics('Checking this tab…', 'info');
      try {
         const [tab] = await browser.tabs.query({ active: true, currentWindow: true });
         if (!tab?.id) {
            setDiagnostics('No active tab to inspect.', 'error');
            return;
         }

         const response = (await browser.tabs.sendMessage(tab.id, {
            type: 'page-ping',
         } satisfies PagePingMessage)) as PagePingResponse | undefined;

         if (!response) {
            setDiagnostics('No response from the content script.', 'error');
            return;
         }
         if (!response.ok) {
            setDiagnostics(response.message, 'error');
            return;
         }

         const data = response.data;
         log.info('Popup page diagnostic.', data);

         if (!data.hasTermsList) {
            setDiagnostics(
               `Content script is running on ${data.url}, but no terms list was found.`,
               'error',
            );
            return;
         }

         const pairs = `${data.pairCount} term/definition pair${data.pairCount === 1 ? '' : 's'}`;
         setDiagnostics(
            `Content script is running. Found ${pairs}. Button injected: ${
               data.buttonInjected ? 'yes' : 'no'
            }.`,
            data.buttonInjected ? 'success' : 'error',
         );
      } catch (cause) {
         log.warn('Content script did not respond to the page diagnostic.', {
            message: cause instanceof Error ? cause.message : String(cause),
         });
         setDiagnostics(
            'Content script is NOT running on this tab. Reload the extension, then refresh the Quizlet page.',
            'error',
         );
      }
   }

   openSettings.addEventListener('click', () => {
      void browser.runtime.openOptionsPage().catch(() => undefined);
   });
   checkPageButton.addEventListener('click', () => void checkPage());

   connectionStorage.watch(() => {
      void refresh();
   });

   void refresh();
   void checkPage();
}
