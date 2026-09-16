import { useMemo } from 'react';
import { Editor } from '@hugerte/hugerte-react';
import 'hugerte/skins/ui/oxide/skin.min.css';
import 'hugerte/skins/content/default/content.min.css';

type HugeRteEditorProps = {
  value: string;
  onChange: (html: string) => void;
  placeholder?: string;
  minHeight?: number;
  disabled?: boolean;
};

/** Shared rich-text editor (HugeRTE) for newsletters, reminders, and CMS copy. */
export default function HugeRteEditor({
  value,
  onChange,
  placeholder,
  minHeight = 220,
  disabled = false,
}: HugeRteEditorProps) {
  const init = useMemo(
    () => ({
      height: minHeight,
      menubar: false,
      statusbar: false,
      branding: false,
      promotion: false,
      placeholder: placeholder || '',
      plugins: ['lists', 'link', 'autolink', 'code'],
      toolbar:
        'undo redo | bold italic underline | bullist numlist | link | removeformat | code',
      content_style:
        'body { font-family: -apple-system, BlinkMacSystemFont, Segoe UI, Roboto, sans-serif; font-size: 14px; color: #1c1917; }',
    }),
    [minHeight, placeholder]
  );

  return (
    <div className={disabled ? 'pointer-events-none opacity-60' : undefined}>
      <Editor
        licenseKey="gpl"
        value={value}
        onEditorChange={(content) => onChange(content)}
        init={init}
        disabled={disabled}
      />
    </div>
  );
}
