import { useEffect, useRef } from 'react';
import {
  defineBlockType,
  type BlockPropertiesProps,
  type BlockViewProps,
} from './types';

export type HeadingData = {
  text: string;
  level: 1 | 2 | 3;
};

const stripLineBreaks = (text: string) => text.replace(/\s*[\r\n]+\s*/g, ' ');

function HeadingView({
  data,
  autoFocus,
  onChange,
}: BlockViewProps<HeadingData>) {
  const ref = useRef<HTMLDivElement>(null);

  // Uncontrolled: the DOM owns the text while typing; seed it once on mount.
  useEffect(() => {
    const element = ref.current;
    if (!element) return;
    element.textContent = data.text;
    if (autoFocus) element.focus();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div
      role="heading"
      aria-level={data.level}
      ref={ref}
      className={`heading heading-level-${data.level}`}
      contentEditable="plaintext-only"
      suppressContentEditableWarning
      data-placeholder="Heading"
      onInput={(event) => {
        const element = event.currentTarget;
        const text = element.textContent ?? '';
        // Browsers can leave a stray <br> behind, which defeats :empty.
        if (text === '') element.replaceChildren();
        onChange({ ...data, text });
      }}
      onKeyDown={(event) => {
        if (event.key === 'Enter') event.preventDefault();
      }}
      onPaste={(event) => {
        event.preventDefault();
        const text = stripLineBreaks(event.clipboardData.getData('text/plain'));
        document.execCommand('insertText', false, text);
      }}
    />
  );
}

const headingLevels: HeadingData['level'][] = [1, 2, 3];

function HeadingProperties({
  data,
  onChange,
}: BlockPropertiesProps<HeadingData>) {
  return (
    <div className="field">
      <span id="heading-level-label">Heading Level</span>
      <div
        role="group"
        aria-labelledby="heading-level-label"
        className="segmented"
      >
        {headingLevels.map((level) => (
          <button
            key={level}
            type="button"
            aria-pressed={data.level === level}
            onClick={() => onChange({ ...data, level })}
          >
            {level}
          </button>
        ))}
      </div>
    </div>
  );
}

export const headingBlockType = defineBlockType<HeadingData>({
  label: 'Heading',
  icon: <span aria-hidden="true">H</span>,
  defaultData: () => ({ text: '', level: 1 }),
  View: HeadingView,
  PropertiesView: HeadingProperties,
});
