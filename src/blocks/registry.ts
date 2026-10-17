import { bodyTextBlockType } from './body-text';
import { headingBlockType } from './heading';
import type { BlockTypeDefinition } from './types';

export const blockTypes: Record<string, BlockTypeDefinition> = {
  heading: headingBlockType,
  'body-text': bodyTextBlockType,
};

export const blockDefaults = Object.fromEntries(
  Object.entries(blockTypes).map(([id, definition]) => [
    id,
    definition.defaultData,
  ]),
);
