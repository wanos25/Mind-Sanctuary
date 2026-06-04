#!/usr/bin/env node
/**
 * Locale parity verifier. Emits a JSON report at
 * scripts/.locale-parity-report.json (used as a CI artifact) and exits
 * non-zero when any locale is missing or has extra keys vs. the base.
 */
import { readFileSync, readdirSync, writeFileSync, mkdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const LOCALES_DIR = join(__dirname, '..', 'src', 'locales');
const REPORT_DIR = join(__dirname, '..', 'artifacts');
const REPORT_PATH = join(REPORT_DIR, 'locale-parity-report.json');
const BASE = 'en';

function flatten(obj, prefix = '', out = new Set()) {
  for (const [k, v] of Object.entries(obj)) {
    const key = prefix ? `${prefix}.${k}` : k;
    if (v && typeof v === 'object' && !Array.isArray(v)) flatten(v, key, out);
    else out.add(key);
  }
  return out;
}

const files = readdirSync(LOCALES_DIR).filter((f) => f.endsWith('.json'));
const load = (code) =>
  flatten(JSON.parse(readFileSync(join(LOCALES_DIR, `${code}.json`), 'utf8')));

const baseKeys = load(BASE);
const report = { base: BASE, generatedAt: new Date().toISOString(), locales: {} };
let failed = false;

for (const f of files) {
  const code = f.replace(/\.json$/, '');
  if (code === BASE) continue;
  const keys = load(code);
  const missing = [...baseKeys].filter((k) => !keys.has(k)).sort();
  const extra = [...keys].filter((k) => !baseKeys.has(k)).sort();
  const ok = missing.length === 0 && extra.length === 0;
  report.locales[code] = { ok, missing, extra };
  const status = ok ? 'OK' : 'FAIL';
  console.log(`[${status}] ${code}: missing=${missing.length}, extra=${extra.length}`);
  if (missing.length) console.log('  missing:', missing.join(', '));
  if (extra.length) console.log('  extra  :', extra.join(', '));
  if (!ok) failed = true;
}

mkdirSync(REPORT_DIR, { recursive: true });
writeFileSync(REPORT_PATH, JSON.stringify(report, null, 2));
console.log(`\nReport written to ${REPORT_PATH}`);

if (failed) {
  console.error('Locale parity check failed.');
  process.exit(1);
}
console.log(`All locales at parity with base: ${BASE}`);
