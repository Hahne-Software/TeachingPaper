import { describe, expect, it } from 'vitest';
import { validateXML } from 'xmllint-wasm';
import schema from '../../docs/format/worksheet-1.0.xsd?raw';

const examples = (pattern: Record<string, string>) =>
  Object.entries(pattern).map(([path, contents]) => ({
    name: path.split('/').pop() ?? path,
    contents,
  }));

const valid = examples(
  import.meta.glob<string>('../../docs/format/examples/valid/*.xml', {
    query: '?raw',
    import: 'default',
    eager: true,
  }),
);

const invalid = examples(
  import.meta.glob<string>('../../docs/format/examples/invalid/*.xml', {
    query: '?raw',
    import: 'default',
    eager: true,
  }),
);

const validate = (fileName: string, contents: string) =>
  validateXML({
    xml: { fileName, contents },
    schema: { fileName: 'worksheet-1.0.xsd', contents: schema },
  });

describe('worksheet-1.0.xsd', () => {
  it('has examples to check', () => {
    expect(valid.length).toBeGreaterThan(0);
    expect(invalid.length).toBeGreaterThan(0);
  });

  it.each(valid)('accepts valid/$name', async ({ name, contents }) => {
    const result = await validate(name, contents);
    expect(result.errors).toEqual([]);
  });

  it.each(invalid)('rejects invalid/$name', async ({ name, contents }) => {
    const result = await validate(name, contents);
    expect(result.valid).toBe(false);
  });
});
