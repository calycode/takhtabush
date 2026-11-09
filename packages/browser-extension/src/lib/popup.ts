import { browser } from 'wxt/browser';
import { connectionStorage, getConnection } from './connection';

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
            <a id="open-app" class="tk-button tk-button-secondary" target="_blank" rel="noreferrer" hidden>Open Takhtabush</a>
         </div>
         <p class="tk-hint">Open a Quizlet set page and use the green clone button above the terms list.</p>
      </main>
   `;

   const summary = root.querySelector<HTMLElement>('#popup-summary')!;
   const openSettings = root.querySelector<HTMLButtonElement>('#open-settings')!;
   const openApp = root.querySelector<HTMLAnchorElement>('#open-app')!;

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

   openSettings.addEventListener('click', () => {
      void browser.runtime.openOptionsPage().catch(() => undefined);
   });

   connectionStorage.watch(() => {
      void refresh();
   });

   void refresh();
}
