import { bodyTextBlockType } from './body-text';
import { headingBlockType } from './heading';
import { UNSUPPORTED_BLOCK } from '../worksheet/unsupported';
import type { BlockTypeDefinition } from './types';
import { unsupportedBlockType } from './unsupported';

export const blockTypes: Record<string, BlockTypeDefinition> = {
  heading: headingBlockType,
  'body-text': bodyTextBlockType,
};

/** How to show and edit a Block of the given type; Unsupported Blocks are not in the Block Palette. */
export const definitionFor = (type: string): BlockTypeDefinition | undefined =>
  type === UNSUPPORTED_BLOCK ? unsupportedBlockType : blockTypes[type];

export const blockDefaults = Object.fromEntries(
  Object.entries(blockTypes).map(([id, definition]) => [
    id,
    definition.defaultData,
  ]),
);
