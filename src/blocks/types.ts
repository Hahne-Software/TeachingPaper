import type { ComponentType, ReactNode } from 'react';

export type BlockViewProps<D> = {
  data: D;
  autoFocus: boolean;
  onChange: (data: D) => void;
};

export type BlockExportProps<D> = {
  data: D;
};

export type BlockPropertiesProps<D> = {
  data: D;
  onChange: (data: D) => void;
};

export type BlockTypeDefinition<D = unknown> = {
  label: string;
  icon: ReactNode;
  defaultData: () => D;
  View: ComponentType<BlockViewProps<D>>;
  /**
   * The read-only view of the Export: static markup with the same structure and CSS classes as
   * `View`, so both have the same height. No placeholders and no editing affordances.
   */
  ExportView: ComponentType<BlockExportProps<D>>;
  /** The Properties Panel view of this Block Type. */
  PropertiesView: ComponentType<BlockPropertiesProps<D>>;
};

/** Erases the data type so definitions can live in one heterogeneous registry. */
export const defineBlockType = <D>(
  definition: BlockTypeDefinition<D>,
): BlockTypeDefinition => definition as unknown as BlockTypeDefinition;
