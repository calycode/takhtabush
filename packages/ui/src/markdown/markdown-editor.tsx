import type { ComponentChildren } from 'preact';
import { useEffect, useRef } from 'react';
import { Bold, Code, Heading3, Italic, Link2, List, ListOrdered, Quote } from 'lucide-react';

import { parseMarkdown, sanitizeHref, type MarkdownBlock, type MarkdownInline } from '@caly/shared';

import { Button } from '#components/button';
import { cn } from '#lib/utils';

function escapeHtml(value: string): string {
   return value.replace(
      /[&<>"']/g,
      (char) =>
         ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char] as string,
   );
}

function escapeInlineText(value: string): string {
   return value.replace(/\\/g, '\\\\').replace(/`/g, '\\`');
}

function inlineToHtml(nodes: MarkdownInline[]): string {
   return nodes
      .map((node) => {
         switch (node.type) {
            case 'text':
               return escapeHtml(node.value);
            case 'strong':
               return `<strong>${inlineToHtml(node.children)}</strong>`;
            case 'em':
               return `<em>${inlineToHtml(node.children)}</em>`;
            case 'code':
               return `<code>${escapeHtml(node.value)}</code>`;
            case 'link':
               return `<a href="${escapeHtml(node.href)}">${inlineToHtml(node.children)}</a>`;
            case 'break':
               return '<br>';
            default:
               return '';
         }
      })
      .join('');
}

function blockToHtml(block: MarkdownBlock): string {
   switch (block.type) {
      case 'paragraph':
         return `<p>${inlineToHtml(block.children)}</p>`;
      case 'heading':
         return `<h${block.level}>${inlineToHtml(block.children)}</h${block.level}>`;
      case 'codeBlock':
         return `<pre><code>${escapeHtml(block.value)}</code></pre>`;
      case 'blockquote':
         return `<blockquote>${block.children.map(blockToHtml).join('')}</blockquote>`;
      case 'list': {
         const tag = block.ordered ? 'ol' : 'ul';
         const items = block.items.map((item) => `<li>${inlineToHtml(item)}</li>`).join('');
         return `<${tag}>${items}</${tag}>`;
      }
      case 'rule':
         return '<hr>';
      default:
         return '';
   }
}

/** Seed the editor DOM from a raw markdown string. */
export function markdownToHtml(source: string): string {
   return parseMarkdown(source).map(blockToHtml).join('');
}

function inlineFromDom(nodes: ChildNode[]): string {
   let out = '';
   for (const node of nodes) {
      if (node.nodeType === Node.TEXT_NODE) {
         out += escapeInlineText(node.textContent ?? '');
         continue;
      }
      if (node.nodeType !== Node.ELEMENT_NODE) continue;
      const element = node as HTMLElement;
      const inner = inlineFromDom([...element.childNodes]);
      switch (element.tagName) {
         case 'BR':
            out += '\n';
            break;
         case 'STRONG':
         case 'B':
            out += `**${inner}**`;
            break;
         case 'EM':
         case 'I':
            out += `*${inner}*`;
            break;
         case 'CODE':
            out += `\`${element.textContent ?? ''}\``;
            break;
         case 'A':
            out += `[${inner}](${element.getAttribute('href') ?? ''})`;
            break;
         default:
            out += inner;
      }
   }
   return out;
}

function blocksFromDom(nodes: ChildNode[]): string[] {
   const blocks: string[] = [];
   let buffer: ChildNode[] = [];

   const flush = () => {
      if (!buffer.length) return;
      const text = inlineFromDom(buffer).replace(/\n+$/, '').trim();
      if (text) blocks.push(text);
      buffer = [];
   };

   for (const node of nodes) {
      if (node.nodeType === Node.TEXT_NODE) {
         buffer.push(node);
         continue;
      }
      if (node.nodeType !== Node.ELEMENT_NODE) continue;
      const element = node as HTMLElement;
      const tag = element.tagName;

      if (tag === 'BR') {
         buffer.push(node);
         continue;
      }
      if (tag === 'UL' || tag === 'OL') {
         flush();
         const ordered = tag === 'OL';
         const items = [...element.children]
            .filter((child) => child.tagName === 'LI')
            .map((item) =>
               inlineFromDom([...item.childNodes])
                  .replace(/\n+$/, '')
                  .trim(),
            );
         if (items.length) {
            blocks.push(
               items
                  .map((item, index) => (ordered ? `${index + 1}. ${item}` : `- ${item}`))
                  .join('\n'),
            );
         }
         continue;
      }
      if (/^H[1-6]$/.test(tag)) {
         flush();
         const level = Math.min(3, Number(tag[1]));
         blocks.push(`${'#'.repeat(level)} ${inlineFromDom([...element.childNodes]).trim()}`);
         continue;
      }
      if (tag === 'BLOCKQUOTE') {
         flush();
         const inner = blocksFromDom([...element.childNodes]).join('\n\n');
         if (inner)
            blocks.push(
               inner
                  .split('\n')
                  .map((line) => `> ${line}`)
                  .join('\n'),
            );
         continue;
      }
      if (tag === 'PRE') {
         flush();
         blocks.push(`\`\`\`\n${(element.textContent ?? '').replace(/\n$/, '')}\n\`\`\``);
         continue;
      }
      if (tag === 'HR') {
         flush();
         blocks.push('---');
         continue;
      }
      if (tag === 'P' || tag === 'DIV') {
         flush();
         const text = inlineFromDom([...element.childNodes])
            .replace(/\n+$/, '')
            .trim();
         if (text) blocks.push(text);
         continue;
      }
      buffer.push(node);
   }

   flush();
   return blocks;
}

/** Serialize editor DOM back to raw markdown. Only markdown is ever stored. */
export function domToMarkdown(element: HTMLElement): string {
   return blocksFromDom([...element.childNodes])
      .filter(Boolean)
      .join('\n\n');
}

function closestTag(node: Node | null, tag: string): HTMLElement | null {
   let current: Node | null = node;
   while (current && current.nodeType === Node.ELEMENT_NODE) {
      const element = current as HTMLElement;
      if (element.tagName === tag) return element;
      current = element.parentNode;
   }
   return null;
}

function ToolButton({
   label,
   onClick,
   children,
}: {
   label: string;
   onClick: () => void;
   children: ComponentChildren;
}) {
   return (
      <Button
         type='button'
         variant='ghost'
         size='icon-sm'
         title={label}
         aria-label={label}
         onMouseDown={(event) => event.preventDefault()}
         onClick={onClick}
      >
         {children}
      </Button>
   );
}

export type MarkdownEditorProps = {
   id?: string;
   value: string;
   onChange: (markdown: string) => void;
   placeholder?: string;
   className?: string;
};

/** Tiny WYSIWYG markdown editor: source of truth is the raw markdown string. */
export function MarkdownEditor({
   id,
   value,
   onChange,
   placeholder,
   className,
}: MarkdownEditorProps) {
   const ref = useRef<HTMLDivElement>(null);
   const committed = useRef(value);

   useEffect(() => {
      const element = ref.current;
      if (!element) return;
      element.innerHTML = markdownToHtml(value);
      committed.current = value;
   }, []);

   useEffect(() => {
      const element = ref.current;
      if (!element || value === committed.current) return;
      committed.current = value;
      if (domToMarkdown(element) !== value) element.innerHTML = markdownToHtml(value);
   }, [value]);

   function emit() {
      const element = ref.current;
      if (!element) return;
      const next = domToMarkdown(element);
      if (next === committed.current) return;
      committed.current = next;
      onChange(next);
   }

   function run(command: string, argument?: string) {
      ref.current?.focus();
      document.execCommand(command, false, argument);
      emit();
   }

   function toggleHeading() {
      const element = ref.current;
      if (!element) return;
      const anchor = window.getSelection()?.anchorNode ?? null;
      let block: HTMLElement | null =
         anchor instanceof Element ? (anchor as HTMLElement) : (anchor?.parentElement ?? null);
      while (
         block &&
         block !== element &&
         !/^H[1-6]$|^P$|^DIV$|^BLOCKQUOTE$|^LI$/.test(block.tagName)
      ) {
         block = block.parentElement;
      }
      run('formatBlock', block?.tagName === 'H3' ? 'p' : 'h3');
   }

   function toggleCode() {
      const element = ref.current;
      if (!element) return;
      element.focus();
      const selection = window.getSelection();
      if (!selection || selection.rangeCount === 0 || !element.contains(selection.anchorNode))
         return;
      const range = selection.getRangeAt(0);
      const existing = closestTag(range.startContainer, 'CODE');
      if (existing?.parentNode) {
         while (existing.firstChild)
            existing.parentNode.insertBefore(existing.firstChild, existing);
         existing.parentNode.removeChild(existing);
         emit();
         return;
      }
      document.execCommand('insertHTML', false, `<code>${escapeHtml(selection.toString())}</code>`);
      emit();
   }

   function addLink() {
      const element = ref.current;
      if (!element) return;
      element.focus();
      const text = window.getSelection()?.toString() ?? '';
      const url = window.prompt('Link URL', 'https://');
      if (url === null) return;
      const href = sanitizeHref(url);
      if (!href) return;
      element.focus();
      if (text) {
         document.execCommand('createLink', false, href);
      } else {
         document.execCommand(
            'insertHTML',
            false,
            `<a href="${escapeHtml(href)}">${escapeHtml(href)}</a>`,
         );
      }
      emit();
   }

   return (
      <div
         className={cn(
            'rounded-md border border-input bg-transparent transition-[color,box-shadow] focus-within:border-ring focus-within:ring-2 focus-within:ring-ring/30',
            className,
         )}
      >
         <div className='flex flex-wrap items-center gap-0.5 border-b p-1'>
            <ToolButton
               label='Bold'
               onClick={() => run('bold')}
            >
               <Bold />
            </ToolButton>
            <ToolButton
               label='Italic'
               onClick={() => run('italic')}
            >
               <Italic />
            </ToolButton>
            <ToolButton
               label='Heading'
               onClick={toggleHeading}
            >
               <Heading3 />
            </ToolButton>
            <ToolButton
               label='Bullet list'
               onClick={() => run('insertUnorderedList')}
            >
               <List />
            </ToolButton>
            <ToolButton
               label='Numbered list'
               onClick={() => run('insertOrderedList')}
            >
               <ListOrdered />
            </ToolButton>
            <ToolButton
               label='Quote'
               onClick={() => run('formatBlock', 'blockquote')}
            >
               <Quote />
            </ToolButton>
            <ToolButton
               label='Inline code'
               onClick={toggleCode}
            >
               <Code />
            </ToolButton>
            <ToolButton
               label='Link'
               onClick={addLink}
            >
               <Link2 />
            </ToolButton>
         </div>

         <div className='relative'>
            {value.length === 0 && placeholder && (
               <span className='pointer-events-none absolute top-1.5 left-2 text-xs text-muted-foreground'>
                  {placeholder}
               </span>
            )}
            <div
               id={id}
               ref={ref}
               role='textbox'
               aria-multiline='true'
               aria-label={placeholder}
               contentEditable
               spellcheck
               onInput={emit}
               onBlur={emit}
               className='caly-markdown caly-markdown-editor min-h-20 px-2 py-1.5 text-xs outline-none'
            />
         </div>
      </div>
   );
}
