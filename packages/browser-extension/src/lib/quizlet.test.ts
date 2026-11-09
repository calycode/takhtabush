import { parseHTML } from 'linkedom';
import { describe, expect, it } from 'vitest';
import { parseQuizletSet } from './quizlet';

function documentFrom(html: string) {
   return parseHTML(`<!doctype html><html><head></head><body>${html}</body></html>`).document;
}

describe('parseQuizletSet', () => {
   it('reads title, description, terms, and definitions', () => {
      const document = documentFrom(`
         <main id="setPageSetDetails">
            <h1>Cell Biology | Quizlet</h1>
            <p data-testid="set-page-description">The building blocks of life.</p>
            <section data-testid="terms-list">
               <div class="row">
                  <div data-testid="set-page-term-card-side">
                     <div><div class="sroqzxt"><div><div><span class="TermText">Mitochondria</span></div></div></div></div>
                  </div>
                  <div data-testid="set-page-term-card-definition">
                     <div><div class="h5swuer"><span class="TermText">Powerhouse of the cell</span></div></div>
                  </div>
               </div>
               <div class="row">
                  <div data-testid="set-page-term-card-side">
                     <span class="TermText">Nucleus</span>
                  </div>
                  <div data-testid="set-page-term-card-definition">
                     <span class="TermText">Stores DNA</span>
                  </div>
               </div>
            </section>
         </main>
      `);

      expect(parseQuizletSet(document)).toEqual({
         title: 'Cell Biology',
         description: 'The building blocks of life.',
         cards: [
            { term: 'Mitochondria', definition: 'Powerhouse of the cell' },
            { term: 'Nucleus', definition: 'Stores DNA' },
         ],
      });
   });

   it('swaps the columns when the definition side renders first', () => {
      const document = documentFrom(`
         <section data-testid="terms-list">
            <div class="row">
               <div data-testid="set-page-term-card-definition"><span class="TermText">A cell</span></div>
               <div data-testid="set-page-term-card-side"><span class="TermText">Cell</span></div>
            </div>
         </section>
      `);

      expect(parseQuizletSet(document)?.cards).toEqual([{ term: 'Cell', definition: 'A cell' }]);
   });

   it('falls back to pairing all TermText nodes in order', () => {
      const document = documentFrom(`
         <section data-testid="terms-list">
            <span class="TermText">one</span>
            <span class="TermText">1</span>
            <span class="TermText">two</span>
            <span class="TermText">2</span>
         </section>
      `);

      expect(parseQuizletSet(document)?.cards).toEqual([
         { term: 'one', definition: '1' },
         { term: 'two', definition: '2' },
      ]);
   });

   it('returns null when the page has no terms list', () => {
      const document = documentFrom('<main><h1>Not a set</h1></main>');
      expect(parseQuizletSet(document)).toBeNull();
   });
});
