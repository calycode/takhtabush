import type { QuizletCard, QuizletSet } from './messages';

const TERMS_LIST_SELECTOR = '[data-testid="terms-list"]';
const TERM_TEXT_SELECTOR = '.TermText';
const TERM_TEXT_FALLBACK_SELECTOR = '[class*="TermText"]';

type TextItem = {
   element: Element;
   text: string;
};

function textOf(element: Element | null): string {
   return (element?.textContent ?? '').replace(/\s+/g, ' ').trim();
}

function attributeOf(root: ParentNode, selector: string, attribute: string): string {
   return root.querySelector(selector)?.getAttribute(attribute)?.trim() ?? '';
}

function cleanTitle(value: string): string {
   return value
      .replace(/\s*[|–—-]\s*Quizlet\s*$/i, '')
      .replace(/^Quizlet\s*[|–—-]\s*/i, '')
      .trim();
}

function findTitle(root: ParentNode): string {
   for (const selector of ['[data-testid="set-page-title"]', '[data-testid="set-title"]', 'h1']) {
      const value = cleanTitle(textOf(root.querySelector(selector)));
      if (value && value.toLowerCase() !== 'quizlet') return value;
   }

   const ogTitle = cleanTitle(attributeOf(root, 'meta[property="og:title"]', 'content'));
   if (ogTitle && ogTitle.toLowerCase() !== 'quizlet') return ogTitle;

   const documentTitle =
      typeof (root as Document).title === 'string' ? (root as Document).title : '';
   const cleaned = cleanTitle(documentTitle);
   return cleaned.toLowerCase() === 'quizlet' ? '' : cleaned;
}

function findDescription(root: ParentNode): string {
   for (const selector of [
      '[data-testid="set-page-description"]',
      '[data-testid="set-description"]',
   ]) {
      const value = textOf(root.querySelector(selector));
      if (value) return value.slice(0, 2000);
   }

   return '';
}

/** Locate the Quizlet terms list, with a content-based fallback for DOM changes. */
export function findTermsList(root: ParentNode = document): Element | null {
   const direct = root.querySelector(TERMS_LIST_SELECTOR);
   if (direct) return direct;

   const sections = Array.from(root.querySelectorAll('section'));
   return (
      sections.find((section) => section.querySelectorAll(TERM_TEXT_SELECTOR).length >= 2) ?? null
   );
}

function termTextElements(list: Element): HTMLElement[] {
   const exact = Array.from(list.querySelectorAll<HTMLElement>(TERM_TEXT_SELECTOR));
   if (exact.length > 0) return exact;
   return Array.from(list.querySelectorAll<HTMLElement>(TERM_TEXT_FALLBACK_SELECTOR));
}

/**
 * The nearest ancestor that holds exactly one pair of `.TermText` nodes is the
 * card row. Returns null when the DOM does not pair cleanly.
 */
function nearestPairContainer(element: Element, list: Element): Element | null {
   let node = element.parentElement;
   while (node && node !== list) {
      if (node.querySelectorAll(TERM_TEXT_SELECTOR).length === 2) return node;
      node = node.parentElement;
   }
   return null;
}

function sideKind(element: Element): 'term' | 'definition' | null {
   let node: Element | null = element;
   let depth = 0;
   while (node && depth < 8) {
      const testId = node.getAttribute('data-testid') ?? '';
      if (/definition|answer|back/i.test(testId)) return 'definition';
      if (/term-card-term|term-card-side|card-front|term-side/i.test(testId)) return 'term';
      node = node.parentElement;
      depth++;
   }
   return null;
}

/** Quizlet can swap the two columns; put the definition back on the right. */
function orient(first: TextItem, second: TextItem): QuizletCard {
   const firstKind = sideKind(first.element);
   const secondKind = sideKind(second.element);
   if (firstKind === 'definition' && secondKind !== 'definition') {
      return { term: second.text, definition: first.text };
   }
   return { term: first.text, definition: second.text };
}

function pairSequentially(items: TextItem[]): QuizletCard[] {
   const cards: QuizletCard[] = [];
   for (let index = 0; index + 1 < items.length; index += 2) {
      cards.push(orient(items[index], items[index + 1]));
   }
   return cards;
}

function parseCards(list: Element): QuizletCard[] {
   const items = termTextElements(list)
      .map((element) => ({ element, text: textOf(element) }))
      .filter((item) => item.text.length > 0);

   if (items.length < 2) return [];

   const groups = new Map<Element, TextItem[]>();
   for (const item of items) {
      const container = nearestPairContainer(item.element, list);
      if (!container) return pairSequentially(items);

      const group = groups.get(container) ?? [];
      group.push(item);
      groups.set(container, group);
   }

   if (groups.size === 0) return pairSequentially(items);
   for (const group of groups.values()) {
      if (group.length !== 2) return pairSequentially(items);
   }

   return Array.from(groups.values()).map(([first, second]) => orient(first, second));
}

/** Read the visible Quizlet set into plain term/definition pairs. */
export function parseQuizletSet(root: ParentNode = document): QuizletSet | null {
   const list = findTermsList(root);
   if (!list) return null;

   return {
      title: findTitle(root) || 'Quizlet set',
      description: findDescription(root),
      cards: parseCards(list),
   };
}
