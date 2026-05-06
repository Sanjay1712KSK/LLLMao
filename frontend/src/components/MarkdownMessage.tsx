import { memo } from 'react';
import ReactMarkdown from 'react-markdown';
import rehypeHighlight from 'rehype-highlight';
import remarkGfm from 'remark-gfm';

import { CodeBlock } from './CodeBlock';

type MarkdownMessageProps = {
  content: string;
};

function MarkdownMessageComponent({ content }: MarkdownMessageProps) {
  return (
    <ReactMarkdown
      className="prose prose-invert max-w-none overflow-hidden prose-headings:mb-3 prose-headings:mt-6 prose-p:my-3 prose-li:my-1 prose-ul:my-3 prose-ol:my-3 prose-blockquote:border-accent prose-blockquote:bg-white/[0.035] prose-blockquote:px-4 prose-blockquote:py-1 prose-table:block prose-table:max-w-full prose-table:overflow-x-auto prose-th:border prose-th:border-line prose-th:px-3 prose-th:py-2 prose-td:border prose-td:border-line prose-td:px-3 prose-td:py-2 prose-pre:m-0 prose-pre:bg-transparent prose-code:break-words prose-code:before:content-none prose-code:after:content-none"
      remarkPlugins={[remarkGfm]}
      rehypePlugins={[rehypeHighlight]}
      components={{
        code({ className, children, ...props }) {
          const text = String(children).replace(/\n$/, '');
          const isBlock = Boolean(className) || text.includes('\n');
          if (!isBlock) {
            return (
              <code className="rounded bg-white/[0.08] px-1.5 py-0.5 text-[0.92em] text-ink" {...props}>
                {children}
              </code>
            );
          }
          return <CodeBlock className={className}>{text}</CodeBlock>;
        },
      }}
    >
      {content}
    </ReactMarkdown>
  );
}

export const MarkdownMessage = memo(MarkdownMessageComponent);
