/**
 * Portable MCP Apps bridge (SPEC §9.8, [R6]).
 *
 * JSON-RPC 2.0 over `postMessage` between the widget iframe and the host. The
 * widget is a presentation surface only: every write goes back through the host
 * to `tools/call`, and the server stays authoritative.
 */

type Pending = { resolve: (value: unknown) => void; reject: (error: Error) => void };

type IncomingMessage = {
   id?: number | string;
   method?: string;
   params?: unknown;
   result?: unknown;
   error?: { message?: string };
};

const INITIALIZE_TIMEOUT_MS = 5000;

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
   const pending = new Map<number, Pending>();
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
      pending.set(id, { resolve: finishInitialize, reject: finishInitialize });
      post('ui/initialize', id, {
         protocolVersion: '2025-06-18',
         appInfo: { name: 'takhtabush-study-widget', version: '1' },
         appCapabilities: {},
      });
      setTimeout(() => {
         if (pending.has(id)) {
            pending.delete(id);
            finishInitialize();
         }
      }, INITIALIZE_TIMEOUT_MS);
   }

   function callTool(name: string, args: unknown): Promise<unknown> {
      const id = ++seq;
      return new Promise((resolve, reject) => {
         pending.set(id, { resolve, reject });
         post('tools/call', id, { name, arguments: args });
         setTimeout(() => {
            if (pending.has(id)) {
               pending.delete(id);
               reject(new Error('MCP tool call timed out'));
            }
         }, 15000);
      });
   }

   window.addEventListener('message', (event) => {
      if (isHosted && event.source !== host) return;
      const data = event.data as IncomingMessage | null;
      if (!data || typeof data !== 'object') return;

      if (data.id !== undefined && typeof data.id === 'number' && pending.has(data.id)) {
         const entry = pending.get(data.id) as Pending;
         pending.delete(data.id);
         if (data.error) entry.reject(new Error(data.error.message ?? 'rpc error'));
         else entry.resolve(data.result);
         return;
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
         pending.set(id, { resolve: () => {}, reject: () => {} });
         post('ui/update-model-context', id, { content: [{ type: 'text', text }] });
         setTimeout(() => pending.delete(id), 15000);
      },
      onSnapshot(cb) {
         listeners.add(cb);
         if (hasSnapshot) cb(latestSnapshot);
         return () => listeners.delete(cb);
      },
   };
}
