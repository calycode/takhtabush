import { browser } from 'wxt/browser';
import { connectionStorage, getConnection, normalizeOrigin, permissionPattern } from './connection';
import { AppError } from './errors';
import { verifyConnection } from './mcp';

type StatusTone = 'info' | 'success' | 'error';

function messageOf(cause: unknown): string {
   return cause instanceof Error ? cause.message : 'Something went wrong.';
}

function setBusy(button: HTMLButtonElement, busy: boolean, label: string): void {
   button.disabled = busy;
   button.textContent = busy ? label : (button.dataset.idleLabel ?? label);
}

export function mountSettings(root: HTMLElement): void {
   const logoUrl = browser.runtime.getURL('/icons/128.png');

   root.innerHTML = `
      <main class="tk-settings">
         <header class="tk-header">
            <img class="tk-logo" src="${logoUrl}" alt="" />
            <div>
               <h1>Takhtabush Extension</h1>
               <p>Clone Quizlet sets into your Takhtabush account.</p>
            </div>
         </header>

         <section class="tk-panel">
            <h2>Connection</h2>
            <p id="connection-summary" class="tk-muted">Not connected yet.</p>
            <div id="connected-actions" class="tk-actions" hidden>
               <a id="open-app" class="tk-button tk-button-secondary" target="_blank" rel="noreferrer">Open Takhtabush</a>
               <button id="disconnect" class="tk-button tk-button-ghost" type="button">Disconnect</button>
            </div>
            <form id="connect-form" class="tk-form">
               <label for="instance-url">Takhtabush URL</label>
               <input id="instance-url" type="text" inputmode="url" autocomplete="url" placeholder="https://cards.example.com" spellcheck="false" />
               <p class="tk-hint">You will sign in with your normal Takhtabush account in the next step.</p>
               <p class="tk-hint">If the sign-in window stalls, sign in on your Takhtabush instance in a normal tab, then try again.</p>
               <button id="connect-button" class="tk-button tk-button-primary" type="submit" data-idle-label="Connect Takhtabush">Connect Takhtabush</button>
            </form>
            <div id="status" class="tk-status" role="status" hidden></div>
         </section>

         <details class="tk-panel tk-advanced">
            <summary>Use an API key instead</summary>
            <p class="tk-hint">Create a key on your instance's <code>/mcp</code> page with <code>decks:read</code> and <code>decks:write</code>.</p>
            <form id="manual-form" class="tk-form">
               <label for="manual-origin">Takhtabush URL</label>
               <input id="manual-origin" type="text" inputmode="url" autocomplete="url" placeholder="https://cards.example.com" spellcheck="false" />
               <label for="manual-token">API key</label>
               <input id="manual-token" type="password" autocomplete="off" placeholder="fck_…" spellcheck="false" />
               <button id="manual-button" class="tk-button tk-button-secondary" type="submit" data-idle-label="Save API key">Save API key</button>
            </form>
         </details>

         <footer class="tk-footer">Takhtabush never sees your Quizlet credentials.</footer>
      </main>
   `;

   const summary = root.querySelector<HTMLElement>('#connection-summary')!;
   const connectForm = root.querySelector<HTMLFormElement>('#connect-form')!;
   const instanceInput = root.querySelector<HTMLInputElement>('#instance-url')!;
   const connectButton = root.querySelector<HTMLButtonElement>('#connect-button')!;
   const connectedActions = root.querySelector<HTMLElement>('#connected-actions')!;
   const openApp = root.querySelector<HTMLAnchorElement>('#open-app')!;
   const disconnectButton = root.querySelector<HTMLButtonElement>('#disconnect')!;
   const manualForm = root.querySelector<HTMLFormElement>('#manual-form')!;
   const manualOrigin = root.querySelector<HTMLInputElement>('#manual-origin')!;
   const manualToken = root.querySelector<HTMLInputElement>('#manual-token')!;
   const manualButton = root.querySelector<HTMLButtonElement>('#manual-button')!;
   const status = root.querySelector<HTMLElement>('#status')!;

   function setStatus(message: string, tone: StatusTone = 'info'): void {
      status.hidden = !message;
      status.textContent = message;
      status.dataset.tone = tone;
   }

   async function refresh(): Promise<void> {
      const connection = await getConnection();
      if (!connection) {
         summary.textContent = 'Not connected yet.';
         connectForm.hidden = false;
         connectedActions.hidden = true;
         return;
      }

      summary.textContent = `Connected to ${connection.origin}.`;
      connectForm.hidden = true;
      connectedActions.hidden = false;
      openApp.href = connection.origin;
      instanceInput.value = connection.origin;
      manualOrigin.value = connection.origin;
   }

   async function saveConnection(origin: string, token: string): Promise<void> {
      setStatus('Checking the connection…', 'info');
      const connection = { origin, token, connectedAt: new Date().toISOString() };
      await verifyConnection(connection);
      await connectionStorage.setValue(connection);
      await refresh();
      setStatus(`Connected to ${origin}. Return to Quizlet to clone a set.`, 'success');
   }

   connectForm.addEventListener('submit', async (event) => {
      event.preventDefault();
      setStatus('');

      let origin: string;
      try {
         origin = normalizeOrigin(instanceInput.value);
      } catch (cause) {
         setStatus(messageOf(cause), 'error');
         return;
      }
      instanceInput.value = origin;
      setBusy(connectButton, true, 'Connecting…');

      try {
         const granted = await browser.permissions.request({
            origins: [permissionPattern(origin)],
         });
         if (!granted) {
            throw new AppError(
               'PERMISSION_DENIED',
               'The extension was not granted access to that site.',
            );
         }

         const state = crypto.randomUUID();
         const redirectUri = browser.identity.getRedirectURL('connect');
         const authUrl = new URL(`${origin}/extension`);
         authUrl.searchParams.set('redirect_uri', redirectUri);
         authUrl.searchParams.set('state', state);

         const result = await browser.identity.launchWebAuthFlow({
            url: authUrl.toString(),
            interactive: true,
         });
         if (!result) {
            throw new AppError('CANCELLED', 'The sign-in window closed before connecting.');
         }

         const callback = new URL(result);
         const error = callback.searchParams.get('error');
         const token = callback.searchParams.get('token');

         if (error) {
            throw new AppError(
               'AUTH_DENIED',
               error === 'access_denied' ? 'Connection was cancelled.' : error,
            );
         }
         if (callback.searchParams.get('state') !== state) {
            throw new AppError(
               'STATE_MISMATCH',
               'The sign-in response could not be verified. Try again.',
            );
         }
         if (!token) {
            throw new AppError('MISSING_TOKEN', 'The sign-in response did not include an API key.');
         }

         await saveConnection(origin, token);
      } catch (cause) {
         const message = messageOf(cause);
         setStatus(
            /did not approve|closed|cancel/i.test(message) ? 'Connection was cancelled.' : message,
            'error',
         );
      } finally {
         setBusy(connectButton, false, 'Connect Takhtabush');
      }
   });

   manualForm.addEventListener('submit', async (event) => {
      event.preventDefault();
      setStatus('');

      let origin: string;
      try {
         origin = normalizeOrigin(manualOrigin.value || instanceInput.value);
      } catch (cause) {
         setStatus(messageOf(cause), 'error');
         return;
      }
      const token = manualToken.value.trim();
      if (!token) {
         setStatus('Paste an API key first.', 'error');
         return;
      }

      manualOrigin.value = origin;
      setBusy(manualButton, true, 'Saving…');
      try {
         const granted = await browser.permissions.request({
            origins: [permissionPattern(origin)],
         });
         if (!granted) {
            throw new AppError(
               'PERMISSION_DENIED',
               'The extension was not granted access to that site.',
            );
         }
         await saveConnection(origin, token);
         manualToken.value = '';
      } catch (cause) {
         setStatus(messageOf(cause), 'error');
      } finally {
         setBusy(manualButton, false, 'Save API key');
      }
   });

   disconnectButton.addEventListener('click', async () => {
      await connectionStorage.setValue(null);
      await refresh();
      setStatus('Disconnected.', 'info');
   });

   connectionStorage.watch(() => {
      void refresh();
   });

   void refresh();
}
