import type { UnsupportedData } from '../worksheet/unsupported';
import { defineBlockType, type BlockViewProps } from './types';

const LABEL = 'Unsupported Block';

function UnsupportedView({ data }: BlockViewProps<UnsupportedData>) {
  return (
    <div className="unsupported-block" role="note">
      <strong>{LABEL}</strong>
      <span>
        &lt;{data.name}&gt; needs a newer TeachingPaper. It is kept unchanged
        when you save, and you can move or delete it.
      </span>
    </div>
  );
}

/** A Block this version does not understand: shown read-only, never offered in the Block Palette. */
export const unsupportedBlockType = defineBlockType<UnsupportedData>({
  label: LABEL,
  icon: null,
  defaultData: () => ({ name: '', xml: '' }),
  View: UnsupportedView,
  PropertiesView: () => (
    <p className="muted">This Block cannot be edited in this version.</p>
  ),
});
