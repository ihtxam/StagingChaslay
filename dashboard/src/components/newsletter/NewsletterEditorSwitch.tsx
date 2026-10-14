type NewsletterEditorSwitchProps = {
  mode: 'simple' | 'visual';
  simpleLabel: string;
  advancedLabel: string;
  simpleHint: string;
  advancedHint: string;
  onChange: (mode: 'simple' | 'visual') => void;
};

/** Segmented Simple / Advanced Editor control. Never labels the visual engine in the UI. */
export default function NewsletterEditorSwitch({
  mode,
  simpleLabel,
  advancedLabel,
  simpleHint,
  advancedHint,
  onChange,
}: NewsletterEditorSwitchProps) {
  return (
    <div className="space-y-1.5">
      <div className="newsletter-editor-switch" role="tablist" aria-label={advancedLabel}>
        <button
          type="button"
          role="tab"
          aria-selected={mode === 'simple'}
          className="newsletter-editor-switch__btn"
          onClick={() => onChange('simple')}
        >
          {simpleLabel}
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={mode === 'visual'}
          className="newsletter-editor-switch__btn"
          onClick={() => onChange('visual')}
        >
          {advancedLabel}
        </button>
      </div>
      <p className="text-[11px] muted">{mode === 'visual' ? advancedHint : simpleHint}</p>
    </div>
  );
}
