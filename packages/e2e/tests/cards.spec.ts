import { createDeckWithCards } from '../support/api';
import { uniqueName } from '../support/constants';
import { expect, test } from '../support/fixtures';

test.describe('cards', () => {
   test('imports pasted CSV after previewing it', async ({ page, api }) => {
      const deck = await api.createDeck({ title: uniqueName('import deck') });

      await test.step('paste CSV and check the preview', async () => {
         await page.goto(`/decks/${deck.id}/import`);
         await page
            .getByLabel('Or paste content')
            .fill('front,back,tags\nhola,hello,spanish\ngato,cat,animals');

         await expect(
            page.getByText('Parsed 2 row(s).'),
            'the preview should report both data rows',
         ).toBeVisible();
      });

      await test.step('import and confirm the rows land in the deck', async () => {
         await page.getByRole('button', { name: 'Import', exact: true }).click();
         await expect(
            page.getByText('Imported 2, updated 0, skipped 0.'),
            'the import should report two new cards and nothing skipped',
         ).toBeVisible();

         await page.getByRole('link', { name: 'Back to deck' }).click();
         await expect(
            page.getByRole('cell', { name: 'hola' }),
            'the first imported card should be listed in the deck',
         ).toBeVisible();
         await expect(
            page.getByRole('cell', { name: 'gato' }),
            'the second imported card should be listed in the deck',
         ).toBeVisible();
      });
   });

   test('edits a card and persists the change', async ({ page, api }) => {
      const { deck, cards } = await createDeckWithCards(api, {
         title: uniqueName('edit deck'),
         cards: [{ front: 'Old front', back: 'Old back' }],
      });

      await page.goto(`/decks/${deck.id}/cards/${cards[0].id}`);
      await page.getByLabel('Front').fill('New front');
      await page.getByRole('button', { name: 'Save', exact: true }).click();
      await expect(
         page.getByText('Saved.'),
         'saving a card should show the confirmation alert',
      ).toBeVisible();

      await page.goto(`/decks/${deck.id}`);
      await expect(
         page.getByRole('cell', { name: 'New front' }),
         'the deck table should show the edited front',
      ).toBeVisible();
      await expect(
         page.getByRole('cell', { name: 'Old front' }),
         'the original front should no longer appear',
      ).toHaveCount(0);
   });

   test('deletes a card and can undo it', async ({ page, api }) => {
      const { deck, cards } = await createDeckWithCards(api, {
         title: uniqueName('delete card deck'),
         cards: [{ front: 'Delete me', back: 'Gone' }],
      });

      await page.goto(`/decks/${deck.id}/cards/${cards[0].id}`);
      await page.getByRole('button', { name: 'Delete card' }).click();
      await page.getByRole('button', { name: 'Delete', exact: true }).click();
      await expect(
         page.getByText('Card deleted.'),
         'deleting a card should confirm and offer Undo',
      ).toBeVisible();

      await page.goto(`/decks/${deck.id}`);
      await expect(
         page.getByText('No cards yet'),
         'the deck should fall back to the empty state after its last card is deleted',
      ).toBeVisible();
   });

   test('filters the card table by tag', async ({ page, api }) => {
      const { deck, cards } = await createDeckWithCards(api, {
         title: uniqueName('tag deck'),
         cards: [
            { front: 'Hola', back: 'Hello', tags: ['spanish'] },
            { front: 'Bonjour', back: 'Hello', tags: ['french'] },
         ],
      });

      await page.goto(`/decks/${deck.id}`);
      await expect(
         page.getByRole('cell', { name: cards[0].front }),
         'both cards should be listed before filtering',
      ).toBeVisible();
      await expect(
         page.getByRole('cell', { name: cards[1].front }),
         'both cards should be listed before filtering',
      ).toBeVisible();

      await page.getByRole('button', { name: /^spanish/ }).click();

      await expect(
         page.getByRole('cell', { name: cards[0].front }),
         'the card carrying the selected tag should remain visible',
      ).toBeVisible();
      await expect(
         page.getByRole('cell', { name: cards[1].front }),
         'the card without the selected tag should be filtered out',
      ).toHaveCount(0);
   });

   test('renders raw HTML in card content as text', async ({ page, api }) => {
      const front = '<script>window.__e2ePwned = true</script>';
      const { deck } = await createDeckWithCards(api, {
         title: uniqueName('markdown deck'),
         cards: [{ front, back: '**bold**' }],
      });

      await page.goto(`/decks/${deck.id}`);
      await expect(
         page.getByRole('cell', { name: front }),
         'raw HTML in a card front should be shown as literal text',
      ).toBeVisible();

      const scriptRan = await page.evaluate(() => (window as { __e2ePwned?: boolean }).__e2ePwned);
      expect(scriptRan, 'a <script> tag in card content must never execute').toBeUndefined();
   });
});
