import { E2E_EMAIL } from '../support/constants';
import { expect, test } from '../support/fixtures';

test.describe('settings', () => {
   test('persists the theme toggle across a reload', async ({ page }) => {
      await test.step('toggle the theme from the profile menu', async () => {
         await page.goto('/');
         await page.getByText(E2E_EMAIL).first().click();
         await page.getByRole('button', { name: /^Theme/ }).click();

         await expect(
            page.locator('html'),
            'choosing Dark should apply the dark class to the document root',
         ).toHaveClass(/dark/);
      });

      await test.step('the preference survives a reload', async () => {
         await page.reload();
         await expect(
            page.locator('html'),
            'the saved theme should be restored on the next page load',
         ).toHaveClass(/dark/);
      });

      await page.evaluate(() => localStorage.removeItem('takhtabush-theme'));
   });
});
