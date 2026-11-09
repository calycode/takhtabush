import type { AppEnv } from '../env';

export type EmailDelivery = {
   delivered: boolean;
   messageId?: string;
   error?: { code?: string; message: string };
};

function signInBodies(link: string, code: string): { html: string; text: string } {
   const text = [
      'Sign in to Takhtabush',
      '',
      `Your sign-in code: ${code}`,
      '',
      'Enter it on the sign-in page, or open this link:',
      link,
      '',
      'This code and link expire in 15 minutes.',
      'If you did not request them, you can safely ignore this email.',
   ].join('\n');

   const html = `<!doctype html>
<html>
   <body style="margin:0;padding:24px;font-family:system-ui,-apple-system,sans-serif;color:#111">
      <h1 style="font-size:20px;margin:0 0 12px">Sign in to Takhtabush</h1>
      <p style="margin:0 0 8px">Your sign-in code is:</p>
      <p style="margin:0 0 20px;font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:28px;font-weight:600;letter-spacing:6px">${code}</p>
      <p style="margin:0 0 12px">Enter it on the sign-in page, or click the button below. The code and link expire in 15 minutes.</p>
      <p style="margin:0 0 24px">
         <a href="${link}" style="display:inline-block;padding:10px 18px;border-radius:8px;background:#15803d;color:#fff;text-decoration:none">Sign in</a>
      </p>
      <p style="margin:0;color:#666;font-size:12px">If you did not request this email, you can safely ignore it.</p>
   </body>
</html>`;

   return { html, text };
}

/**
 * Deliver the sign-in code and magic link through the Cloudflare Email Service
 * `EMAIL` binding (SPEC §3.2). Never throws — delivery failures are reported so
 * the caller can decide whether to fall back to a dev token or surface an error.
 */
export async function sendSignInEmail(
   env: AppEnv,
   email: string,
   link: string,
   code: string,
): Promise<EmailDelivery> {
   const { html, text } = signInBodies(link, code);

   if (!env.EMAIL) {
      console.log(JSON.stringify({ event: 'magic_link', email, link, code }));
      return {
         delivered: false,
         error: { code: 'E_NO_BINDING', message: 'EMAIL binding is not configured' },
      };
   }

   if (!env.EMAIL_FROM) {
      console.log(JSON.stringify({ event: 'magic_link', email, link, code }));
      return {
         delivered: false,
         error: { code: 'E_NO_SENDER', message: 'EMAIL_FROM is not configured' },
      };
   }

   try {
      const result = await env.EMAIL.send({
         from: env.EMAIL_FROM,
         to: email,
         subject: 'Your Takhtabush sign-in code',
         html,
         text,
      });
      return { delivered: true, messageId: result.messageId };
   } catch (cause) {
      const errorCode = (cause as { code?: string } | undefined)?.code;
      const message = cause instanceof Error ? cause.message : 'Email delivery failed';
      console.error(
         JSON.stringify({ event: 'magic_link_send_failed', email, code: errorCode, message }),
      );
      return { delivered: false, error: { code: errorCode, message } };
   }
}
