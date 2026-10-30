/**
 * Portable MCP Apps bridge (SPEC §9.8, [R6]).
 *
 * JSON-RPC 2.0 over `postMessage` between the widget iframe and the host. The
 * widget is a presentation surface only: every write goes back through the host
 * to `tools/call`, and the server stays authoritative.
 */

import { MCP_APPS_PROTOCOL_VERSION } from '@caly/shared';

type Pending = { resolve: (value: unknown) => void; reject: (error: Error) => void };

type IncomingMessage = {
   id?: number | string;
   method?: string;
   params?: unknown;
   result?: unknown;
   error?: { message?: string };
};

const INITIALIZE_TIMEOUT_MS = 5000;

/** JSON-RPC ids may be strings or numbers; hosts are free to echo either. */
function requestKey(id: number | string): string {
   return String(id);
}

export type WidgetBridge = {
   /** True when running inside a host iframe rather than standalone. */
   isHosted: boolean;
   callTool: (name: string, args: unknown) => Promise<unknown>;
   updateModelContext: (text: string) => void;
   onSnapshot: (cb: (payload: IncomingMessage['params']) => void) => () => void;
};

export function createBridge(): WidgetBridge {
   const isHosted = window.parent !== window;
   const host = isHosted ? window.parent : window;
   const pending = new Map<string, Pending>();
   const listeners = new Set<(payload: IncomingMessage['params']) => void>();
   let seq = 0;
   let initializeStarted = false;
   let initialized = false;
   let hasSnapshot = false;
   let latestSnapshot: IncomingMessage['params'] = null;

   function post(method: string, id: number | null, params: unknown) {
      const message: Record<string, unknown> = {
         jsonrpc: '2.0',
         method,
         params: params ?? {},
      };
      // JSON-RPC notifications must not carry an `id` key at all (the host's
      // notification schema rejects one); requests always carry a numeric id.
      if (id !== null) message.id = id;
      host.postMessage(message, '*');
   }

   function finishInitialize() {
      if (initialized) return;
      initialized = true;
      post('ui/notifications/initialized', null, {});
   }

   function startInitialize() {
      if (initializeStarted || !isHosted) return;
      initializeStarted = true;
      const id = ++seq;
      const key = requestKey(id);
      pending.set(key, {
         resolve: finishInitialize,
         // A host that rejects the handshake stays uninitialized instead of
         // being told the app finished a protocol it never negotiated.
         reject: () => {},
      });
      post('ui/initialize', id, {
         // The MCP Apps protocol version, not the core MCP version.
         protocolVersion: MCP_APPS_PROTOCOL_VERSION,
         appInfo: { name: 'takhtabush-study-widget', version: '1' },
         appCapabilities: { availableDisplayModes: ['inline'] },
      });
      setTimeout(() => {
         if (pending.has(key)) {
            pending.delete(key);
            finishInitialize();
         }
      }, INITIALIZE_TIMEOUT_MS);
   }

   function callTool(name: string, args: unknown): Promise<unknown> {
      const id = ++seq;
      const key = requestKey(id);
      return new Promise((resolve, reject) => {
         pending.set(key, { resolve, reject });
         post('tools/call', id, { name, arguments: args });
         setTimeout(() => {
            if (pending.has(key)) {
               pending.delete(key);
               reject(new Error('MCP tool call timed out'));
            }
         }, 15000);
      });
   }

   window.addEventListener('message', (event) => {
      if (isHosted && event.source !== host) return;
      const data = event.data as IncomingMessage | null;
      if (!data || typeof data !== 'object') return;

      if (data.id !== undefined && data.id !== null) {
         const key = requestKey(data.id);
         if (pending.has(key)) {
            const entry = pending.get(key) as Pending;
            pending.delete(key);
            if (data.error) entry.reject(new Error(data.error.message ?? 'rpc error'));
            else entry.resolve(data.result);
            return;
         }
      }

      if (data.method === 'ui/notifications/tool-result') {
         hasSnapshot = true;
         latestSnapshot = data.params;
         for (const listener of listeners) listener(data.params);
      }
   });

   startInitialize();

   return {
      isHosted,
      callTool,
      updateModelContext(text) {
         const id = ++seq;
         const key = requestKey(id);
         pending.set(key, { resolve: () => {}, reject: () => {} });
         post('ui/update-model-context', id, { content: [{ type: 'text', text }] });
         setTimeout(() => pending.delete(key), 15000);
      },
      onSnapshot(cb) {
         listeners.add(cb);
         if (hasSnapshot) cb(latestSnapshot);
         return () => listeners.delete(cb);
      },
   };
}
