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
    <div className="group my-4 overflow-hidden rounded-lg border border-line bg-[#090b0f] shadow-sm">
      <div className="flex items-center justify-between border-b border-line bg-white/[0.035] px-3 py-2 text-xs text-muted">
        <span className="font-medium">{language}</span>
        <button
          className="inline-flex h-8 items-center gap-2 rounded-md px-2 text-muted hover:bg-white/5 hover:text-ink"
          onClick={copy}
          type="button"
          title="Copy code"
        >
          {copied ? <Check size={15} /> : <Copy size={15} />}
          {copied ? 'Copied' : 'Copy'}
        </button>
      </div>
      <pre className="max-h-[70vh] overflow-auto p-4 text-sm leading-6">
        <code className={className}>{children}</code>
      </pre>
    </div>
  );
}
