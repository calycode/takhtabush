/**
 * Tiny markdown core for card definitions.
 *
 * Markdown is the only stored form. This module turns a raw markdown string
 * into a small intermediate representation on demand; the IR is never
 * persisted or accepted back from callers.
 */

export type MarkdownInline =
   | { type: 'text'; value: string }
   | { type: 'strong'; children: MarkdownInline[] }
   | { type: 'em'; children: MarkdownInline[] }
   | { type: 'code'; value: string }
   | { type: 'link'; href: string; children: MarkdownInline[] }
   | { type: 'break' };

export type MarkdownBlock =
   | { type: 'paragraph'; children: MarkdownInline[] }
   | { type: 'heading'; level: 1 | 2 | 3; children: MarkdownInline[] }
   | { type: 'codeBlock'; value: string; language: string | null }
   | { type: 'blockquote'; children: MarkdownBlock[] }
   | { type: 'list'; ordered: boolean; items: MarkdownInline[][] }
   | { type: 'rule' };

const ESCAPABLE = new Set('\\`*_{}[]()#+-.!>~|'.split(''));
const WORD = /[\p{L}\p{N}]/u;
const BLOCK_LINE = /^(?:```|#{1,6}\s|>\s?|\s*([-*+]|\d+[.)])\s|(?:-{3,}|\*{3,}|_{3,})\s*$)/;

/** Allow only links that cannot smuggle a scripting scheme. */
export function sanitizeHref(href: string): string | null {
   const value = href.trim();
   if (!value) return null;
   if (/^(?:https?:|mailto:|\/|#|\.{1,2}\/)/i.test(value)) return value;
   return null;
}

function isWhitespace(char: string | undefined): boolean {
   return char === undefined || /\s/.test(char);
}

function parseInline(source: string): MarkdownInline[] {
   const nodes: MarkdownInline[] = [];
   let buffer = '';
   let index = 0;

   const flush = () => {
      if (buffer) {
         nodes.push({ type: 'text', value: buffer });
         buffer = '';
      }
   };

   while (index < source.length) {
      const char = source[index];
      const next = source[index + 1];

      if (char === '\\' && next !== undefined && ESCAPABLE.has(next)) {
         buffer += next;
         index += 2;
         continue;
      }

      if (char === '\n') {
         flush();
         nodes.push({ type: 'break' });
         index += 1;
         continue;
      }

      if (char === '`') {
         const end = source.indexOf('`', index + 1);
         if (end !== -1) {
            flush();
            nodes.push({ type: 'code', value: source.slice(index + 1, end) });
            index = end + 1;
            continue;
         }
      }

      if (char === '[') {
         const match = /^\[([^\]]*)\]\(([^)\s]+)(?:\s+"[^"]*")?\)/.exec(source.slice(index));
         if (match) {
            const href = sanitizeHref(match[2]);
            if (href) {
               flush();
               nodes.push({ type: 'link', href, children: parseInline(match[1]) });
               index += match[0].length;
               continue;
            }
         }
      }

      if (char === '*' || char === '_') {
         const isEmBoundary = char === '*' || !WORD.test(source[index - 1] ?? '');
         if (isEmBoundary && source.startsWith(char + char, index)) {
            const end = source.indexOf(char + char, index + 2);
            if (end > index + 2) {
               flush();
               nodes.push({ type: 'strong', children: parseInline(source.slice(index + 2, end)) });
               index = end + 2;
               continue;
            }
         }
         if (isEmBoundary && !isWhitespace(next)) {
            const end = source.indexOf(char, index + 1);
            if (end > index + 1) {
               flush();
               nodes.push({ type: 'em', children: parseInline(source.slice(index + 1, end)) });
               index = end + 1;
               continue;
            }
         }
      }

      buffer += char;
      index += 1;
   }

   flush();
   return nodes;
}

/** Parse a raw markdown string into blocks. Pure and DOM-free. */
export function parseMarkdown(source: string): MarkdownBlock[] {
   const lines = source.replace(/\r\n?/g, '\n').split('\n');
   const blocks: MarkdownBlock[] = [];
   let index = 0;

   while (index < lines.length) {
      const line = lines[index];

      if (!line.trim()) {
         index += 1;
         continue;
      }

      const fence = /^```\s*([\w-]*)\s*$/.exec(line);
      if (fence) {
         const body: string[] = [];
         index += 1;
         while (index < lines.length && !/^```\s*$/.test(lines[index])) {
            body.push(lines[index]);
            index += 1;
         }
         index += 1;
         blocks.push({
            type: 'codeBlock',
            value: body.join('\n'),
            language: fence[1] || null,
         });
         continue;
      }

      if (/^(?:-{3,}|\*{3,}|_{3,})\s*$/.test(line)) {
         blocks.push({ type: 'rule' });
         index += 1;
         continue;
      }

      const heading = /^(#{1,6})\s+(.*?)\s*#*\s*$/.exec(line);
      if (heading) {
         const level = Math.min(3, heading[1].length) as 1 | 2 | 3;
         blocks.push({ type: 'heading', level, children: parseInline(heading[2]) });
         index += 1;
         continue;
      }

      if (/^>\s?/.test(line)) {
         const quote: string[] = [];
         while (index < lines.length && /^>\s?/.test(lines[index])) {
            quote.push(lines[index].replace(/^>\s?/, ''));
            index += 1;
         }
         blocks.push({ type: 'blockquote', children: parseMarkdown(quote.join('\n')) });
         continue;
      }

      const listItem = /^(\s*)([-*+]|\d+[.)])\s+(.*)$/.exec(line);
      if (listItem) {
         const ordered = /\d/.test(listItem[2]);
         const items: MarkdownInline[][] = [];
         while (index < lines.length) {
            const item = /^(\s*)([-*+]|\d+[.)])\s+(.*)$/.exec(lines[index]);
            if (!item || /\d/.test(item[2]) !== ordered) break;
            let content = item[3];
            index += 1;
            while (index < lines.length && lines[index].trim() && !BLOCK_LINE.test(lines[index])) {
               content += ` ${lines[index].trim()}`;
               index += 1;
            }
            items.push(parseInline(content));
         }
         blocks.push({ type: 'list', ordered, items });
         continue;
      }

      const paragraph: string[] = [line];
      index += 1;
      while (index < lines.length && lines[index].trim() && !BLOCK_LINE.test(lines[index])) {
         paragraph.push(lines[index]);
         index += 1;
      }
      blocks.push({ type: 'paragraph', children: parseInline(paragraph.join('\n')) });
   }

   return blocks;
}

function inlineToText(nodes: MarkdownInline[]): string {
   return nodes
      .map((node) => {
         if (node.type === 'text' || node.type === 'code') return node.value;
         if (node.type === 'break') return ' ';
         return inlineToText(node.children);
      })
      .join('');
}

/** Flatten markdown to plain text (typed grading, table previews). */
export function markdownToText(source: string): string {
   const parts: string[] = [];
   const walk = (blocks: MarkdownBlock[]) => {
      for (const block of blocks) {
         if (block.type === 'paragraph' || block.type === 'heading') {
            parts.push(inlineToText(block.children));
         } else if (block.type === 'codeBlock') {
            parts.push(block.value);
         } else if (block.type === 'blockquote') {
            walk(block.children);
         } else if (block.type === 'list') {
            for (const item of block.items) parts.push(inlineToText(item));
         }
      }
   };
   walk(parseMarkdown(source));
   return parts.join(' ').replace(/\s+/g, ' ').trim();
}
