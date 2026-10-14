import { headingBlockType } from './heading';
import type { BlockTypeDefinition } from './types';

export const blockTypes: Record<string, BlockTypeDefinition> = {
  heading: headingBlockType,
};

export const blockDefaults = Object.fromEntries(
  Object.entries(blockTypes).map(([id, definition]) => [
    id,
    definition.defaultData,
  ]),
);
