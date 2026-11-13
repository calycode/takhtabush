import { E2E_EMAIL } from '../support/constants';
import { expect, test } from '../support/fixtures';

test.use({ storageState: { cookies: [], origins: [] } });

test.describe('authentication', () => {
   test('@smoke guards a private route and signs in with the development code', async ({
      page,
   }) => {
      await test.step('an anonymous visit to a private route is redirected', async () => {
         await page.goto('/settings');

         await expect(
            page,
            'the guard should send anonymous visitors to /login with the target preserved',
         ).toHaveURL(/\/login\?next=%2Fsettings/);
      });

      await test.step('request a sign-in code for the owner account', async () => {
         await page.getByLabel('Email').fill(E2E_EMAIL);
         await page.getByRole('button', { name: 'Send sign-in code' }).click();

         await expect(
            page.getByText('Check your email', { exact: true }),
            'the form should switch to the code-entry phase',
         ).toBeVisible();
      });

      await test.step('the development code signs in and restores the target', async () => {
         await page.getByRole('button', { name: 'Use code' }).click();
         await page.getByRole('button', { name: 'Sign in with code' }).click();

         await expect(page, 'a successful sign-in should honour the ?next target').toHaveURL(
            '/settings',
         );
         await expect(page.getByRole('heading', { name: 'Settings' })).toBeVisible();
      });

      await test.step('signing out ends this session', async () => {
         // Signing out revokes only this test's session; the shared storageState
         // session created by the global setup stays valid for the rest of the run.
         await page.getByRole('button', { name: 'Sign out' }).click();

         await expect(page, 'signing out should land on the login page').toHaveURL('/login');

         await page.goto('/settings');
         await expect(page, 'the revoked session should no longer reach private routes').toHaveURL(
            /\/login\?next=%2Fsettings/,
         );
      });
   });
});
