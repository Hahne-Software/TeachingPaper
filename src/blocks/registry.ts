import { headingBlockType } from './heading';
import type { BlockTypeDefinition } from './types';

export const blockTypes: Record<string, BlockTypeDefinition> = {
  heading: headingBlockType,
};
