import { describe, expect, it } from 'vitest';
import {
  compareFormatVersions,
  isNewerVersion,
  noRetained,
  parseFormatVersion,
} from './retained';

describe('Format Versions', () => {
  it('compares numerically, major first', () => {
    const v = (text: string) => parseFormatVersion(text)!;
    expect(compareFormatVersions(v('1.10'), v('1.9'))).toBeGreaterThan(0);
    expect(compareFormatVersions(v('1.0'), v('1.0'))).toBe(0);
    expect(compareFormatVersions(v('1.9'), v('2.0'))).toBeLessThan(0);
  });

  it.each(['1', '1.x', '01.0', '1.00', '', '1.0.0'])('rejects %j', (text) =>
    expect(parseFormatVersion(text)).toBeNull(),
  );

  it('calls only versions above the implemented one newer', () => {
    const at = (minor: number) => ({
      ...noRetained,
      version: { major: 1, minor },
    });
    expect(isNewerVersion(at(0))).toBe(false);
    expect(isNewerVersion(at(1))).toBe(true);
    expect(isNewerVersion(at(10))).toBe(true);
  });
});
