import { describe, expect, it } from 'vitest';
import { findMismatches, readVersion, replaceVersion } from './version.mjs';

const toml = /(\[package\][^[]*?\nversion\s*=\s*")([^"]+)(")/;
const lock = /(name = "teaching-paper"\nversion = ")([^"]+)(")/;

describe('version files', () => {
  it('only touches the package version in Cargo.toml', () => {
    const text =
      '[package]\nname = "x"\nversion = "0.1.0"\n\n[dependencies]\nserde = { version = "1" }\n';
    expect(readVersion(text, toml)).toBe('0.1.0');
    expect(replaceVersion(text, toml, '0.2.0')).toBe(
      text.replace('0.1.0', '0.2.0'),
    );
  });

  it('only touches the app entry in Cargo.lock', () => {
    const text =
      'name = "other"\nversion = "1.0.0"\n\nname = "teaching-paper"\nversion = "0.1.0"\n';
    expect(replaceVersion(text, lock, '0.2.0')).toBe(
      'name = "other"\nversion = "1.0.0"\n\nname = "teaching-paper"\nversion = "0.2.0"\n',
    );
  });
});

describe('findMismatches', () => {
  it('accepts files that agree', () => {
    expect(findMismatches({ a: '0.1.0', b: '0.1.0' })).toEqual([]);
  });

  it('reports files that differ from each other', () => {
    expect(findMismatches({ a: '0.2.0', b: '0.1.0' })).toEqual([
      { path: 'b', found: '0.1.0', expected: '0.2.0' },
    ]);
  });

  it('compares against the expected tag version', () => {
    expect(findMismatches({ a: '0.1.0', b: '0.1.0' }, '0.2.0')).toHaveLength(2);
  });

  it('reports a missing version', () => {
    expect(findMismatches({ a: '0.1.0', b: undefined })[0].found).toBe(
      'missing',
    );
  });
});
