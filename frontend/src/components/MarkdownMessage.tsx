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
      className="markdown-body prose max-w-none overflow-hidden prose-headings:mb-3 prose-headings:mt-6 prose-headings:text-ink prose-p:my-3 prose-p:text-ink prose-li:my-1 prose-li:text-ink prose-ul:my-3 prose-ol:my-3 prose-strong:text-ink prose-blockquote:border-accent prose-blockquote:px-4 prose-blockquote:py-1 prose-table:block prose-table:max-w-full prose-table:overflow-x-auto prose-th:border prose-th:border-line prose-th:px-3 prose-th:py-2 prose-td:border prose-td:border-line prose-td:px-3 prose-td:py-2 prose-pre:m-0 prose-pre:bg-transparent prose-code:break-words prose-code:before:content-none prose-code:after:content-none"
      remarkPlugins={[remarkGfm]}
      rehypePlugins={[rehypeHighlight]}
      components={{
        code({ className, children, ...props }) {
          const text = String(children).replace(/\n$/, '');
          const isBlock = Boolean(className) || text.includes('\n');
          if (!isBlock) {
            return (
              <code className="rounded bg-subtle px-1.5 py-0.5 text-[0.92em] text-ink" {...props}>
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
