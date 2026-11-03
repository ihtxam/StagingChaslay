import { useCallback, useEffect, useRef } from 'react';
import { Bold, Italic, Link2, List } from 'lucide-react';

type Props = {
  value: string;
  onChange: (html: string) => void;
  minHeight?: number;
  placeholder?: string;
};

function exec(cmd: string, value?: string) {
  document.execCommand(cmd, false, value);
}

export default function PlatformHtmlEditor({
  value,
  onChange,
  minHeight = 220,
  placeholder,
}: Props) {
  const editorRef = useRef<HTMLDivElement>(null);
  const lastEmitted = useRef(value);

  const syncFromDom = useCallback(() => {
    const el = editorRef.current;
    if (!el) return;
    const html = el.innerHTML;
    if (html !== lastEmitted.current) {
      lastEmitted.current = html;
      onChange(html);
    }
  }, [onChange]);

  useEffect(() => {
    const el = editorRef.current;
    if (!el) return;
    if (value !== lastEmitted.current && el.innerHTML !== value) {
      el.innerHTML = value || '';
      lastEmitted.current = value;
    }
  }, [value]);

  const addLink = () => {
    const url = window.prompt('Link URL (https://…)');
    if (!url?.trim()) return;
    exec('createLink', url.trim());
    syncFromDom();
  };

  return (
    <div className="rounded-lg border border-[var(--border)] bg-[var(--surface)]">
      <div className="flex flex-wrap items-center gap-1 border-b border-[var(--border)] px-2 py-1.5">
        <button
          type="button"
          className="rounded p-1.5 text-[var(--text-muted)] hover:bg-[var(--bg-muted)] hover:text-[var(--text)]"
          title="Bold"
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => {
            exec('bold');
            syncFromDom();
          }}
        >
          <Bold className="h-4 w-4" />
        </button>
        <button
          type="button"
          className="rounded p-1.5 text-[var(--text-muted)] hover:bg-[var(--bg-muted)] hover:text-[var(--text)]"
          title="Italic"
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => {
            exec('italic');
            syncFromDom();
          }}
        >
          <Italic className="h-4 w-4" />
        </button>
        <button
          type="button"
          className="rounded p-1.5 text-[var(--text-muted)] hover:bg-[var(--bg-muted)] hover:text-[var(--text)]"
          title="Bullet list"
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => {
            exec('insertUnorderedList');
            syncFromDom();
          }}
        >
          <List className="h-4 w-4" />
        </button>
        <button
          type="button"
          className="rounded p-1.5 text-[var(--text-muted)] hover:bg-[var(--bg-muted)] hover:text-[var(--text)]"
          title="Insert link"
          onMouseDown={(e) => e.preventDefault()}
          onClick={addLink}
        >
          <Link2 className="h-4 w-4" />
        </button>
      </div>
      <div
        ref={editorRef}
        contentEditable
        role="textbox"
        aria-multiline="true"
        data-placeholder={placeholder}
        className="prose prose-sm max-w-none px-3 py-3 text-[var(--text)] outline-none [&:empty]:before:text-[var(--text-muted)] [&:empty]:before:content-[attr(data-placeholder)]"
        style={{ minHeight }}
        onInput={syncFromDom}
        onBlur={syncFromDom}
      />
    </div>
  );
}
