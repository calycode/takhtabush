import { uniqueName } from '../support/constants';
import { expect, test } from '../support/fixtures';

test.describe('decks', () => {
   test('renames a deck from the settings page', async ({ page, api }) => {
      const deck = await api.createDeck({ title: uniqueName('rename me') });
      const renamed = uniqueName('renamed deck');

      await page.goto(`/decks/${deck.id}/edit`);
      await page.getByLabel('Title').fill(renamed);
      await page.getByRole('button', { name: 'Save', exact: true }).click();
      await expect(
         page.getByText('Saved.'),
         'saving deck settings should show the confirmation alert',
      ).toBeVisible();

      await page.goto(`/decks/${deck.id}`);
      await expect(
         page.getByRole('heading', { name: renamed }),
         'the deck page should render the new title after saving',
      ).toBeVisible();
   });

   test('deletes a deck and clears it from the library', async ({ page, api }) => {
      const deck = await api.createDeck({ title: uniqueName('delete me') });

      await page.goto(`/decks/${deck.id}/edit`);
      await page.getByRole('button', { name: 'Delete deck' }).click();

      await expect(page, 'deleting a deck should return to the dashboard').toHaveURL('/');
      await expect(
         page.getByRole('link', { name: `Open deck ${deck.title}` }),
         'the deleted deck should be gone from the library',
      ).toHaveCount(0);
   });

   test('moves a deck into a collection', async ({ page, api }) => {
      const collectionName = uniqueName('collection');
      const deck = await api.createDeck({ title: uniqueName('filed deck') });

      await test.step('create a collection', async () => {
         await page.goto('/');
         await page.getByRole('button', { name: 'New collection' }).click();
         const createDialog = page.getByRole('dialog');
         await createDialog.getByLabel('Name').fill(collectionName);
         await createDialog.getByRole('button', { name: 'Create' }).click();

         await expect(
            page.getByRole('button', { name: new RegExp(`^${collectionName}`) }),
            'the new collection should appear as a library filter',
         ).toBeVisible();
      });

      await test.step('file the deck through its actions menu', async () => {
         // Creating a collection can switch the library filter to it; the deck is
         // still unfiled, so go back to the full list before moving it.
         await page.getByRole('button', { name: 'All decks' }).click();

         // The deck menu is a plain popover; "Move to collection" is a details/summary.
         const deckCard = page.locator('[data-slot="card"]').filter({ hasText: deck.title });
         await deckCard.getByRole('button', { name: 'Deck actions' }).click();
         await deckCard.getByText('Move to collection').click();
         await deckCard.getByRole('button', { name: collectionName, exact: true }).click();
      });

      await test.step('the collection filter lists the deck', async () => {
         const collectionChip = page.getByRole('button', {
            name: new RegExp(`^${collectionName}`),
         });
         await collectionChip.click();

         await expect(
            page.getByRole('link', { name: `Open deck ${deck.title}` }),
            'the moved deck should be listed inside the collection',
         ).toBeVisible();
         await expect(
            collectionChip,
            'the collection filter should become the active one',
         ).toHaveAttribute('data-selected', 'true');
      });
   });
});
