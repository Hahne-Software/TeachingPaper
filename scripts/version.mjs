// Keeps the app version in sync across every file that carries it.
//   node scripts/version.mjs check [vX.Y.Z]   fail unless all files agree (and match the tag, if given)
//   node scripts/version.mjs set X.Y.Z        write the version into all files
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const SEMVER = /^\d+\.\d+\.\d+(-[0-9A-Za-z.-]+)?$/;

// Each entry reads and rewrites the version while leaving the rest of the file untouched.
const versionFiles = [
  {
    path: 'package.json',
    pattern: /("version":\s*")([^"]+)(")/,
  },
  {
    path: 'src-tauri/tauri.conf.json',
    pattern: /("version":\s*")([^"]+)(")/,
  },
  {
    path: 'src-tauri/Cargo.toml',
    pattern: /(\[package\][^[]*?\nversion\s*=\s*")([^"]+)(")/,
  },
  {
    path: 'src-tauri/Cargo.lock',
    pattern: /(name = "teaching-paper"\nversion = ")([^"]+)(")/,
  },
];

export const readVersion = (text, pattern) => text.match(pattern)?.[2];

export const replaceVersion = (text, pattern, version) =>
  text.replace(pattern, `$1${version}$3`);

export const findMismatches = (versions, expected) => {
  const target = expected ?? Object.values(versions)[0];
  return Object.entries(versions)
    .filter(([, version]) => version !== target)
    .map(([path, version]) => ({
      path,
      found: version ?? 'missing',
      expected: target,
    }));
};

const check = (tag) => {
  const expected = tag?.replace(/^v/, '');
  const versions = Object.fromEntries(
    versionFiles.map(({ path, pattern }) => [
      path,
      readVersion(readFileSync(path, 'utf8'), pattern),
    ]),
  );
  const mismatches = findMismatches(versions, expected);
  mismatches.forEach(({ path, found, expected: want }) =>
    console.error(
      `::error file=${path}::${path} is ${found}, expected ${want}`,
    ),
  );
  if (mismatches.length) process.exit(1);
  console.log(`All versions are ${expected ?? Object.values(versions)[0]}`);
};

const set = (version) => {
  if (!SEMVER.test(version ?? '')) {
    console.error(`"${version}" is not a SemVer version like 0.2.0`);
    process.exit(1);
  }
  versionFiles.forEach(({ path, pattern }) =>
    writeFileSync(
      path,
      replaceVersion(readFileSync(path, 'utf8'), pattern, version),
    ),
  );
  console.log(
    `Set version ${version} in ${versionFiles.map((f) => f.path).join(', ')}`,
  );
};

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const [command, arg] = process.argv.slice(2);
  if (command === 'check') check(arg);
  else if (command === 'set') set(arg);
  else {
    console.error('Usage: version.mjs check [vX.Y.Z] | set X.Y.Z');
    process.exit(1);
  }
}
