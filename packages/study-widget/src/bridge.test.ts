import { MCP_APPS_PROTOCOL_VERSION } from '@caly/shared';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createBridge } from './bridge';

type BridgeMessage = {
   jsonrpc?: string;
   id?: number | null;
   method?: string;
   params?: unknown;
};

function setupWindow() {
   const messages: BridgeMessage[] = [];
   const listeners: Array<(event: MessageEvent) => void> = [];
   const parent = { postMessage: (message: BridgeMessage) => messages.push(message) };
   const fakeWindow = {
      parent,
      postMessage: (message: BridgeMessage) => messages.push(message),
      addEventListener: (_type: string, listener: (event: MessageEvent) => void) => {
         listeners.push(listener);
      },
   };
   return { fakeWindow, parent, messages, listeners };
}

function receive(listeners: Array<(event: MessageEvent) => void>, source: unknown, data: unknown) {
   for (const listener of listeners) listener({ source, data } as MessageEvent);
}

const SNAPSHOT = {
   sessionId: 'stu_1',
   deckId: 'deck_1',
   deckTitle: 'Spanish A1',
   mode: 'flashcards',
   status: 'active',
   total: 0,
   reviewed: 0,
   reviewedCardIds: [],
   cards: [],
   fallbackStudyPath: '/study/stu_1',
};

describe('MCP Apps bridge', () => {
   beforeEach(() => {
      vi.useFakeTimers();
   });

   afterEach(() => {
      vi.useRealTimers();
      vi.unstubAllGlobals();
   });

   it('sends a request-shaped ui/initialize and waits for the host response', () => {
      const { fakeWindow, messages, listeners } = setupWindow();
      vi.stubGlobal('window', fakeWindow);

      createBridge();

      const init = messages.find((message) => message.method === 'ui/initialize');
      expect(init).toBeDefined();
      expect(typeof init?.id).toBe('number');
      expect(init?.params).toMatchObject({
         protocolVersion: MCP_APPS_PROTOCOL_VERSION,
         appInfo: { name: 'takhtabush-study-widget' },
         appCapabilities: { availableDisplayModes: ['inline'] },
      });
      expect(messages.some((message) => message.method === 'ui/notifications/initialized')).toBe(
         false,
      );

      receive(listeners, fakeWindow.parent, { jsonrpc: '2.0', id: init?.id, result: {} });

      const initialized = messages.find(
         (message) => message.method === 'ui/notifications/initialized',
      );
      expect(initialized).toBeDefined();
      // JSON-RPC notifications must omit `id` entirely; the host rejects one.
      expect(initialized).not.toHaveProperty('id');
   });

   it('replays a tool result that arrives before the widget subscribes', () => {
      const { fakeWindow, messages, listeners } = setupWindow();
      vi.stubGlobal('window', fakeWindow);

      const bridge = createBridge();
      const init = messages.find((message) => message.method === 'ui/initialize');
      receive(listeners, fakeWindow.parent, { jsonrpc: '2.0', id: init?.id, result: {} });

      const params = { structuredContent: SNAPSHOT };
      receive(listeners, fakeWindow.parent, {
         jsonrpc: '2.0',
         method: 'ui/notifications/tool-result',
         params,
      });

      const onSnapshot = vi.fn();
      const unsubscribe = bridge.onSnapshot(onSnapshot);

      expect(onSnapshot).toHaveBeenCalledWith(params);
      unsubscribe();
   });
});
