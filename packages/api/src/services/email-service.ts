import type { AppEnv } from '../env';

export type EmailDelivery = {
   delivered: boolean;
   messageId?: string;
   error?: { code?: string; message: string };
};

function magicLinkBodies(link: string): { html: string; text: string } {
   const text = [
      'Sign in to Takhtabush',
      '',
      link,
      '',
      'This link expires in 15 minutes.',
      'If you did not request it, you can safely ignore this email.',
   ].join('\n');

   const html = `<!doctype html>
<html>
   <body style="margin:0;padding:24px;font-family:system-ui,-apple-system,sans-serif;color:#111">
      <h1 style="font-size:20px;margin:0 0 12px">Sign in to Takhtabush</h1>
      <p style="margin:0 0 20px">Click the button below to sign in. This link expires in 15 minutes.</p>
      <p style="margin:0 0 24px">
         <a href="${link}" style="display:inline-block;padding:10px 18px;border-radius:8px;background:#15803d;color:#fff;text-decoration:none">Sign in</a>
      </p>
      <p style="margin:0;color:#666;font-size:12px">If you did not request this email, you can safely ignore it.</p>
   </body>
</html>`;

   return { html, text };
}

/**
 * Deliver a magic link through the Cloudflare Email Service `EMAIL` binding
 * (SPEC §3.2). Never throws — delivery failures are reported so the caller can
 * decide whether to fall back to a dev token or surface an error.
 */
export async function sendMagicLink(
   env: AppEnv,
   email: string,
   link: string,
): Promise<EmailDelivery> {
   const { html, text } = magicLinkBodies(link);

   if (!env.EMAIL) {
      console.log(JSON.stringify({ event: 'magic_link', email, link }));
      return {
         delivered: false,
         error: { code: 'E_NO_BINDING', message: 'EMAIL binding is not configured' },
      };
   }

   if (!env.EMAIL_FROM) {
      console.log(JSON.stringify({ event: 'magic_link', email, link }));
      return {
         delivered: false,
         error: { code: 'E_NO_SENDER', message: 'EMAIL_FROM is not configured' },
      };
   }

   try {
      const result = await env.EMAIL.send({
         from: env.EMAIL_FROM,
         to: email,
         subject: 'Your Takhtabush sign-in link',
         html,
         text,
      });
      return { delivered: true, messageId: result.messageId };
   } catch (cause) {
      const code = (cause as { code?: string } | undefined)?.code;
      const message = cause instanceof Error ? cause.message : 'Email delivery failed';
      console.error(JSON.stringify({ event: 'magic_link_send_failed', email, code, message }));
      return { delivered: false, error: { code, message } };
   }
}
