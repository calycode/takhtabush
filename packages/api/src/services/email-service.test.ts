import { describe, expect, it, vi } from 'vitest';
import type { AppEnv } from '../env';
import { sendMagicLink } from './email-service';

function envWith(send?: (message: unknown) => Promise<{ messageId: string }>): AppEnv {
   return {
      EMAIL_FROM: 'no-reply@test.local',
      ...(send ? { EMAIL: { send } } : {}),
   } as unknown as AppEnv;
}

describe('email service', () => {
   it('sends through the binding and returns the message id', async () => {
      const send = vi.fn(async () => ({ messageId: 'msg_1' }));
      const result = await sendMagicLink(
         envWith(send as never),
         'a@b.com',
         'https://x/login?token=t',
      );
      expect(result).toEqual({ delivered: true, messageId: 'msg_1' });
      expect(send).toHaveBeenCalledOnce();
   });

   it('reports binding errors without throwing', async () => {
      const send = vi.fn(async () => {
         throw Object.assign(new Error('sender not verified'), { code: 'E_SENDER_NOT_VERIFIED' });
      });
      const result = await sendMagicLink(envWith(send as never), 'a@b.com', 'https://x');
      expect(result.delivered).toBe(false);
      expect(result.error?.code).toBe('E_SENDER_NOT_VERIFIED');
   });

   it('handles a missing binding', async () => {
      const result = await sendMagicLink(envWith(), 'a@b.com', 'https://x');
      expect(result.delivered).toBe(false);
      expect(result.error?.code).toBe('E_NO_BINDING');
   });

   it('handles a missing sender address', async () => {
      const send = vi.fn(async () => ({ messageId: 'msg_1' }));
      const env = { EMAIL: { send } } as unknown as AppEnv;
      const result = await sendMagicLink(env, 'a@b.com', 'https://x');
      expect(result.delivered).toBe(false);
      expect(result.error?.code).toBe('E_NO_SENDER');
      expect(send).not.toHaveBeenCalled();
   });
});
