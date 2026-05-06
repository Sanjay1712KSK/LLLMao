import ReactMarkdown from 'react-markdown';
import rehypeHighlight from 'rehype-highlight';
import remarkGfm from 'remark-gfm';

import { CodeBlock } from './CodeBlock';

type MarkdownMessageProps = {
  content: string;
};

export function MarkdownMessage({ content }: MarkdownMessageProps) {
  return (
    <ReactMarkdown
      className="prose prose-invert max-w-none prose-pre:m-0 prose-pre:bg-transparent prose-code:before:content-none prose-code:after:content-none"
      remarkPlugins={[remarkGfm]}
      rehypePlugins={[rehypeHighlight]}
      components={{
        code({ className, children, ...props }) {
          const text = String(children).replace(/\n$/, '');
          const isBlock = Boolean(className);
          if (!isBlock) {
            return (
              <code className="rounded bg-white/8 px-1.5 py-0.5 text-[0.92em] text-ink" {...props}>
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
