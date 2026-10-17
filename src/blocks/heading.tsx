import { useEffect, useRef } from 'react';
import { defineBlockType, type BlockViewProps } from './types';

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
  const ref = useRef<HTMLHeadingElement>(null);

  // Uncontrolled: the DOM owns the text while typing; seed it once on mount.
  useEffect(() => {
    const element = ref.current;
    if (!element) return;
    element.textContent = data.text;
    if (autoFocus) element.focus();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const Tag = `h${data.level}` as const;

  return (
    <Tag
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

export const headingBlockType = defineBlockType<HeadingData>({
  label: 'Heading',
  icon: <span aria-hidden="true">H</span>,
  defaultData: () => ({ text: '', level: 1 }),
  View: HeadingView,
});
