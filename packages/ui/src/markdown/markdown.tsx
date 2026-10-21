import type { ComponentChildren } from 'preact';

import { parseMarkdown, type MarkdownBlock, type MarkdownInline } from '@caly/shared';

import { cn } from '#lib/utils';

function Inline({ nodes }: { nodes: MarkdownInline[] }): ComponentChildren {
   return nodes.map((node, index) => {
      switch (node.type) {
         case 'text':
            return node.value;
         case 'strong':
            return (
               <strong key={index}>
                  <Inline nodes={node.children} />
               </strong>
            );
         case 'em':
            return (
               <em key={index}>
                  <Inline nodes={node.children} />
               </em>
            );
         case 'code':
            return <code key={index}>{node.value}</code>;
         case 'link':
            return (
               <a
                  key={index}
                  href={node.href}
                  target='_blank'
                  rel='noreferrer'
               >
                  <Inline nodes={node.children} />
               </a>
            );
         case 'break':
            return <br key={index} />;
         default:
            return null;
      }
   });
}

function Block({ node }: { node: MarkdownBlock }): ComponentChildren {
   switch (node.type) {
      case 'paragraph':
         return (
            <p>
               <Inline nodes={node.children} />
            </p>
         );
      case 'heading': {
         const Tag = `h${node.level}` as 'h1' | 'h2' | 'h3';
         return (
            <Tag>
               <Inline nodes={node.children} />
            </Tag>
         );
      }
      case 'codeBlock':
         return (
            <pre>
               <code>{node.value}</code>
            </pre>
         );
      case 'blockquote':
         return (
            <blockquote>
               {node.children.map((child, index) => (
                  <Block
                     key={index}
                     node={child}
                  />
               ))}
            </blockquote>
         );
      case 'list': {
         const Tag = node.ordered ? 'ol' : 'ul';
         return (
            <Tag>
               {node.items.map((item, index) => (
                  <li key={index}>
                     <Inline nodes={item} />
                  </li>
               ))}
            </Tag>
         );
      }
      case 'rule':
         return <hr />;
      default:
         return null;
   }
}

export type MarkdownProps = {
   source: string;
   className?: string;
};

/** Render a raw markdown string. Parsing happens here; nothing is stored. */
export function Markdown({ source, className }: MarkdownProps) {
   const blocks = parseMarkdown(source);
   if (!blocks.length) return null;
   return (
      <div className={cn('caly-markdown', className)}>
         {blocks.map((block, index) => (
            <Block
               key={index}
               node={block}
            />
         ))}
      </div>
   );
}
