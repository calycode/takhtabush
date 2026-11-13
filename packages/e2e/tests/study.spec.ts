import { createDeckWithCards } from '../support/api';
import { uniqueName } from '../support/constants';
import { expect, test } from '../support/fixtures';

test.describe('study', () => {
   test('auto-grades a multiple-choice session', async ({ page, api }) => {
      const deck = await api.createDeck({ title: uniqueName('choice deck') });
      await api.createCard(deck.id, {
         type: 'multiple_choice',
         front: 'Pick the greeting',
         choices: ['Goodbye', 'Hello'],
         correctChoice: 1,
      });
      await api.createCard(deck.id, {
         type: 'multiple_choice',
         front: 'Pick the animal',
         choices: ['Cat', 'Table'],
         correctChoice: 0,
      });

      await test.step('start a multiple-choice session', async () => {
         await page.goto(`/decks/${deck.id}`);
         await page.getByRole('button', { name: 'Study' }).click();
         const dialog = page.getByRole('dialog');
         await dialog.getByRole('button', { name: 'Multiple choice' }).click();
         await expect(
            dialog.getByText('This session: about 2 cards'),
            'the preview should count the two choice cards',
         ).toBeVisible();
         await dialog.getByRole('button', { name: 'Start' }).click();
      });

      await test.step('a correct pick is auto-graded and advances', async () => {
         await page.getByRole('button', { name: /^Hello/ }).click();
         await expect(
            page.getByText(/^Correct · /),
            'picking the correct option should report a Correct grade',
         ).toBeVisible();
         await expect(
            page.getByText('1 / 2'),
            'the session should advance to the second card',
         ).toBeVisible();
      });

      await test.step('the last correct pick completes the session', async () => {
         await page.getByRole('button', { name: /^Cat/ }).click();
         await expect(
            page.getByRole('heading', { name: 'Session complete' }),
            'answering every card should complete the session',
         ).toBeVisible();
      });
   });

   test('abandons a session and removes it from the dashboard', async ({ page, api }) => {
      const { deck } = await createDeckWithCards(api, {
         title: uniqueName('abandon deck'),
      });
      let sessionId = '';

      await test.step('start a session, then abandon it from the exit dialog', async () => {
         await page.goto(`/decks/${deck.id}`);
         await page.getByRole('button', { name: 'Study' }).click();
         await page.getByRole('dialog').getByRole('button', { name: 'Start' }).click();
         await expect(page, 'starting a session should open the study route').toHaveURL(
            /\/study\//,
         );
         sessionId = page.url().split('/study/')[1]?.split('?')[0] ?? '';

         await page.getByRole('button', { name: 'Exit' }).click();
         await page.getByRole('button', { name: 'Abandon session' }).click();
         await expect(page, 'abandoning should return to the deck').toHaveURL(`/decks/${deck.id}`);
      });

      await test.step('the dashboard no longer lists the abandoned session', async () => {
         await page.goto('/');
         await expect(
            page.locator(`a[href="/study/${sessionId}"]`),
            'an abandoned session must not be offered for resume',
         ).toHaveCount(0);
      });
   });
});
