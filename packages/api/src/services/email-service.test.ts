import { describe, expect, it, vi } from 'vitest';
import type { AppEnv } from '../env';
import { sendSignInEmail } from './email-service';

function envWith(send?: (message: unknown) => Promise<{ messageId: string }>): AppEnv {
   return {
      EMAIL_FROM: 'no-reply@test.local',
      ...(send ? { EMAIL: { send } } : {}),
   } as unknown as AppEnv;
}

describe('email service', () => {
   it('sends the code and link through the binding and returns the message id', async () => {
      const send = vi.fn(async (_message: unknown) => ({ messageId: 'msg_1' }));
      const result = await sendSignInEmail(
         envWith(send as never),
         'a@b.com',
         'https://x/login?token=t',
         '123456',
      );
      expect(result).toEqual({ delivered: true, messageId: 'msg_1' });
      expect(send).toHaveBeenCalledOnce();
      const message = send.mock.calls[0]?.[0] as { subject: string; html: string; text: string };
      expect(message.subject).toContain('sign-in code');
      expect(message.html).toContain('123456');
      expect(message.text).toContain('123456');
      expect(message.html).toContain('https://x/login?token=t');
   });

   it('reports binding errors without throwing', async () => {
      const send = vi.fn(async () => {
         throw Object.assign(new Error('sender not verified'), { code: 'E_SENDER_NOT_VERIFIED' });
      });
      const result = await sendSignInEmail(
         envWith(send as never),
         'a@b.com',
         'https://x',
         '123456',
      );
      expect(result.delivered).toBe(false);
      expect(result.error?.code).toBe('E_SENDER_NOT_VERIFIED');
   });

   it('handles a missing binding', async () => {
      const result = await sendSignInEmail(envWith(), 'a@b.com', 'https://x', '123456');
      expect(result.delivered).toBe(false);
      expect(result.error?.code).toBe('E_NO_BINDING');
   });

   it('handles a missing sender address', async () => {
      const send = vi.fn(async (_message: unknown) => ({ messageId: 'msg_1' }));
      const env = { EMAIL: { send } } as unknown as AppEnv;
      const result = await sendSignInEmail(env, 'a@b.com', 'https://x', '123456');
      expect(result.delivered).toBe(false);
      expect(result.error?.code).toBe('E_NO_SENDER');
      expect(send).not.toHaveBeenCalled();
   });
});
