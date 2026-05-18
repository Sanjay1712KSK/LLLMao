import { Check, Copy } from 'lucide-react';
import { useState } from 'react';

type CodeBlockProps = {
  className?: string;
  children: string;
};

export function CodeBlock({ className, children }: CodeBlockProps) {
  const [copied, setCopied] = useState(false);
  const language = className?.replace('language-', '') || 'text';

  const copy = async () => {
    await navigator.clipboard.writeText(children);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1300);
  };

  return (
    <div className="group my-4 max-w-full overflow-hidden rounded-xl border border-line bg-code shadow-sm">
      <div className="flex items-center justify-between gap-3 border-b border-line bg-subtle px-3 py-2 text-xs text-muted">
        <span className="min-w-0 truncate font-medium">{language}</span>
        <button
          className="inline-flex h-8 shrink-0 items-center gap-2 rounded-md px-2 text-muted opacity-90 hover:bg-hover hover:text-ink group-hover:opacity-100"
          onClick={copy}
          type="button"
          title="Copy code"
        >
          {copied ? <Check size={15} /> : <Copy size={15} />}
          {copied ? 'Copied' : 'Copy'}
        </button>
      </div>
      <pre className="max-h-[70vh] max-w-full overflow-auto p-4 text-[13px] leading-6 sm:text-sm">
        <code className={className}>{children}</code>
      </pre>
    </div>
  );
}
