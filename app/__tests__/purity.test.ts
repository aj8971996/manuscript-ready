/**
 * Purity boundary lint.
 *
 * Static check on the repo: the engine must not depend on any app, React,
 * React Native, or Expo module; validation must only import from the engine's
 * public surface. Lives in the app-pure Jest project as a boundary guard.
 */
import * as fs from 'node:fs';
import * as path from 'node:path';

const REPO_ROOT = path.resolve(__dirname, '..', '..');

const FORBIDDEN_IN_ENGINE = [
  /(^|['"])react(['"\/]|$)/,
  /(^|['"])react-native(['"\/]|$)/,
  /(^|['"])expo(['"\/-]|$)/,
  /(^|['"])@expo\//,
  /(^|['"])nativewind(['"\/]|$)/,
  /(^|['"])zustand(['"\/]|$)/,
  /from\s+['"][^'"]*\/app\//,
  /from\s+['"][^'"]*\/app-lib\//,
];

const ALLOWED_VALIDATION_IMPORT_PREFIXES = [
  '../engine/parsers',
  '../engine/ir/prose',
  './',
];

function walk(dir: string, out: string[] = []): string[] {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === '__tests__' || entry.name === 'node_modules') continue;
      walk(full, out);
    } else if (entry.isFile() && /\.tsx?$/.test(entry.name)) {
      out.push(full);
    }
  }
  return out;
}

function extractImports(source: string): string[] {
  const results: string[] = [];
  const re = /(?:import|export)\s+(?:[^'"]+\s+from\s+)?['"]([^'"]+)['"]/g;
  let m;
  while ((m = re.exec(source)) !== null) {
    if (m[1]) results.push(m[1]);
  }
  return results;
}

describe('purity — src/engine has no app/RN/Expo imports', () => {
  const engineDir = path.join(REPO_ROOT, 'src', 'engine');
  const files = walk(engineDir);

  it('engine source tree is non-empty (sanity)', () => {
    expect(files.length).toBeGreaterThan(0);
  });

  it.each(files)('%s contains no forbidden imports', (file) => {
    const src = fs.readFileSync(file, 'utf8');
    const imports = extractImports(src);
    for (const imp of imports) {
      for (const pattern of FORBIDDEN_IN_ENGINE) {
        if (pattern.test(`'${imp}'`)) {
          throw new Error(
            `Engine purity violated in ${path.relative(REPO_ROOT, file)}: import "${imp}" matches ${pattern}`,
          );
        }
      }
    }
  });
});

describe('purity — src/validation imports only from engine/parsers and engine/ir/prose', () => {
  const valDir = path.join(REPO_ROOT, 'src', 'validation');
  const files = walk(valDir);

  it('validation source tree is non-empty (sanity)', () => {
    expect(files.length).toBeGreaterThan(0);
  });

  it.each(files)('%s imports only from allowed prefixes', (file) => {
    const src = fs.readFileSync(file, 'utf8');
    const imports = extractImports(src).filter((i) => i.startsWith('.'));
    for (const imp of imports) {
      const ok = ALLOWED_VALIDATION_IMPORT_PREFIXES.some((p) => imp.startsWith(p));
      if (!ok) {
        throw new Error(
          `Validation purity violated in ${path.relative(REPO_ROOT, file)}: import "${imp}" is outside the allowed surface`,
        );
      }
    }
  });
});