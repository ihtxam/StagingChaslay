import { useMemo } from 'react';
import { Editor } from '@hugerte/hugerte-react';
import 'hugerte/skins/ui/oxide/skin.min.css';
import 'hugerte/skins/content/default/content.min.css';
import { uploadPageBuilderImage } from '@/lib/chaslay-pagebuilder/upload-image';

type HugeRteVariant = 'full' | 'email' | 'compact';

type HugeRteEditorProps = {
  value: string;
  onChange: (html: string) => void;
  placeholder?: string;
  minHeight?: number;
  disabled?: boolean;
  /** `email` adds image + sizes for Advanced Editor blocks. `compact` is heading/button. */
  variant?: HugeRteVariant;
};

async function uploadRteImage(blobInfo: { blob: () => Blob; filename: () => string }): Promise<string> {
  const blob = blobInfo.blob();
  const name = blobInfo.filename() || 'image.png';
  const file = new File([blob], name, { type: blob.type || 'image/png' });
  return uploadPageBuilderImage(file, {
    maxBytes: 500 * 1024,
    targetBytes: 320 * 1024,
    maxWidth: 1400,
  });
}

function toolbarFor(variant: HugeRteVariant): { plugins: string[]; toolbar: string; forcedRoot: string } {
  if (variant === 'compact') {
    return {
      plugins: ['link'],
      toolbar: 'bold italic underline | fontsize | removeformat',
      forcedRoot: '',
    };
  }
  if (variant === 'email') {
    return {
      plugins: ['lists', 'link', 'autolink', 'image', 'code'],
      toolbar:
        'undo redo | blocks fontsize | bold italic underline | bullist numlist | link image | removeformat | code',
      forcedRoot: 'p',
    };
  }
  return {
    plugins: ['lists', 'link', 'autolink', 'code'],
    toolbar: 'undo redo | bold italic underline | bullist numlist | link | removeformat | code',
    forcedRoot: 'p',
  };
}

/** Shared rich-text editor (HugeRTE) for newsletters, reminders, and CMS copy. */
export default function HugeRteEditor({
  value,
  onChange,
  placeholder,
  minHeight = 220,
  disabled = false,
  variant = 'full',
}: HugeRteEditorProps) {
  const init = useMemo(() => {
    const { plugins, toolbar, forcedRoot } = toolbarFor(variant);
    return {
      height: minHeight,
      menubar: false,
      statusbar: false,
      branding: false,
      promotion: false,
      placeholder: placeholder || '',
      plugins,
      toolbar,
      forced_root_block: forcedRoot,
      font_size_formats: '12px 14px 16px 18px 22px 28px 32px',
      block_formats: 'Paragraph=p; Heading large=h1; Heading medium=h2; Heading small=h3',
      automatic_uploads: true,
      images_reuse_filename: true,
      convert_urls: false,
      images_file_types: 'jpg,jpeg,png,gif,webp',
      file_picker_types: variant === 'email' ? 'image' : '',
      images_upload_handler: variant === 'email' ? uploadRteImage : undefined,
      content_style:
        'body { font-family: -apple-system, BlinkMacSystemFont, Segoe UI, Roboto, sans-serif; font-size: 14px; color: #1c1917; } img { max-width: 100%; height: auto; }',
    };
  }, [minHeight, placeholder, variant]);

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
