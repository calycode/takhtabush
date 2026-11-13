import { createDeckWithCards } from '../support/api';
import { uniqueName } from '../support/constants';
import { expect, test } from '../support/fixtures';

const DECK_CARD = '[data-slot="card"]';

test.describe('@smoke', () => {
   test('boots into the dashboard without page errors', async ({ page }) => {
      const pageErrors: string[] = [];
      page.on('pageerror', (error) => pageErrors.push(error.message));

      await page.goto('/');

      await expect(page.getByRole('heading', { name: 'Dashboard' })).toBeVisible();
      await expect(page.getByRole('heading', { name: 'Your decks' })).toBeVisible();
      expect(pageErrors, 'the built SPA must boot without uncaught exceptions').toEqual([]);
   });

   test('creates a deck from the library dialog', async ({ page }) => {
      const title = uniqueName('created deck');

      await page.goto('/');
      await page.getByRole('button', { name: 'New deck' }).first().click();

      const dialog = page.getByRole('dialog');
      await dialog.getByLabel('Title').fill(title);
      await dialog.getByRole('button', { name: 'Create' }).click();

      await expect(
         page.getByRole('link', { name: `Open deck ${title}` }),
         'the new deck should appear in the library without a reload',
      ).toBeVisible();
   });

   test('adds a card from the deck page', async ({ page, api }) => {
      const { deck } = await createDeckWithCards(api, {
         title: uniqueName('empty deck'),
         cards: [],
      });

      await page.goto(`/decks/${deck.id}`);
      await page.getByRole('button', { name: 'Add your first card' }).click();

      const dialog = page.getByRole('dialog');
      await dialog.getByLabel('Front').fill('Capital of France');
      await dialog
         .getByRole('textbox', { name: 'Write the definition. Markdown is supported.' })
         .fill('Paris');
      await dialog.getByRole('button', { name: 'Add card' }).click();

      await expect(
         page.getByRole('cell', { name: 'Capital of France' }),
         'the card table should list the card that was just added',
      ).toBeVisible();
      await expect(
         page.getByText('1 / 500 cards'),
         'the deck header should count the new card',
      ).toBeVisible();
   });

   test('studies a deck end to end and records the reviews', async ({ page, api }) => {
      const title = uniqueName('study deck');
      const { deck, cards } = await createDeckWithCards(api, { title });

      await test.step('start a session from the deck', async () => {
         await page.goto(`/decks/${deck.id}`);
         await page.getByRole('button', { name: 'Study' }).click();
         const dialog = page.getByRole('dialog');
         await expect(
            dialog.getByText(`This session: about ${cards.length} cards`),
            'the launcher preview should count every card in a cram session',
         ).toBeVisible();
         await dialog.getByRole('button', { name: 'Start' }).click();

         await expect(page, 'starting a session should open the study route').toHaveURL(
            /\/study\//,
         );
      });

      for (const [index, card] of cards.entries()) {
         await test.step(`grade "${card.front}" (${index + 1}/${cards.length}) as Good`, async () => {
            await page.getByRole('button', { name: 'Reveal answer' }).click();
            await page.getByRole('button', { name: /^Good/ }).click();
         });
      }

      await test.step('the completion screen reports the reviewed count', async () => {
         await expect(page.getByRole('heading', { name: 'Session complete' })).toBeVisible();
         await expect(
            page.getByText(`You reviewed ${cards.length} cards.`),
            'the completion summary should match the number of graded cards',
         ).toBeVisible();
      });

      await test.step('statistics record the reviews for this deck', async () => {
         await page.getByRole('link', { name: 'View statistics' }).click();
         await expect(page.getByRole('heading', { name: 'Statistics' })).toBeVisible();
         await expect(
            page.getByText('No reviews yet.'),
            'the empty-review placeholder should be gone after studying',
         ).toHaveCount(0);
         await expect(
            page
               .locator(DECK_CARD)
               .filter({ has: page.getByText('Reviews', { exact: true }) })
               .locator('[data-slot="card-title"]'),
            'the Reviews tile should equal the number of cards just reviewed',
         ).toHaveText(String(cards.length));
      });
   });

   test('pauses a session and resumes it from the dashboard', async ({ page, api }) => {
      const title = uniqueName('resume deck');
      const { deck, cards } = await createDeckWithCards(api, { title });
      let sessionId = '';

      await test.step('review one card, then pause', async () => {
         await page.goto(`/decks/${deck.id}`);
         await page.getByRole('button', { name: 'Study' }).click();
         await page.getByRole('dialog').getByRole('button', { name: 'Start' }).click();
         await expect(page, 'starting a session should open the study route').toHaveURL(
            /\/study\//,
         );
         sessionId = page.url().split('/study/')[1]?.split('?')[0] ?? '';

         await page.getByRole('button', { name: 'Reveal answer' }).click();
         await page.getByRole('button', { name: /^Good/ }).click();

         await page.getByRole('button', { name: 'Exit' }).click();
         await page.getByRole('button', { name: 'Pause & resume later' }).click();
         await expect(
            page,
            'pausing should return to the deck without abandoning the session',
         ).toHaveURL(`/decks/${deck.id}`);
      });

      await test.step('the dashboard offers to resume that exact session', async () => {
         await page.goto('/');
         const resumeLink = page.locator(`a[href="/study/${sessionId}"]`);
         await expect(
            resumeLink,
            'the paused session should be listed under Continue studying',
         ).toBeVisible();
         await expect(resumeLink, 'the session row should offer Resume').toHaveText('Resume');
      });

      await test.step('resuming keeps the reviewed progress', async () => {
         await page.goto(`/study/${sessionId}`);
         await expect(
            page.getByText('resumed'),
            'the session header should mark a session that already has reviews',
         ).toBeVisible();
         await expect(
            page.getByText(`1 / ${cards.length}`),
            'the progress counter should keep the one review made before pausing',
         ).toBeVisible();
      });
   });

   test('serves deep links from the Worker asset fallback', async ({ page, api }) => {
      const { deck } = await createDeckWithCards(api, {
         title: uniqueName('deep link deck'),
      });

      await test.step('a deck URL opened cold renders the deck', async () => {
         const response = await page.goto(`/decks/${deck.id}`);
         expect(
            response?.status(),
            'the Worker must serve the SPA shell for /decks/:id, not a 404',
         ).toBe(200);
         await expect(page.getByRole('heading', { name: deck.title })).toBeVisible();
      });

      await test.step('a stats URL opened cold renders the statistics page', async () => {
         const response = await page.goto(`/stats/${deck.id}`);
         expect(
            response?.status(),
            'the Worker must serve the SPA shell for /stats/:id, not a 404',
         ).toBe(200);
         await expect(page.getByRole('heading', { name: 'Statistics' })).toBeVisible();
      });
   });

   test('renders the SPA not-found page for unknown routes', async ({ page }) => {
      await page.goto('/definitely-not-a-route');

      await expect(
         page.getByRole('heading', { name: 'Not found' }),
         'an unknown route should render the SPA Not found page',
      ).toBeVisible();
      await expect(
         page.getByRole('link', { name: 'Go home' }),
         'the Not found page should offer a way back',
      ).toBeVisible();
   });
});
