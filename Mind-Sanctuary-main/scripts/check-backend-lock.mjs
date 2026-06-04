#!/usr/bin/env node
/**
 * Backend integrity lock.
 *
 * Fails CI if any deprecated Supabase project ref appears in runtime,
 * config, env, or edge-function files. Historical migration notes under
 * `migration/` are excluded — they describe past state, not active wiring.
 *
 * The sole valid backend is: fsterbxivhhzipfgpvou
 */
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

const DEPRECATED = ['dbgncklwmjjzncukhvgm', 'joqnptgangpdqhkqbfeq', 'fnsabcjkkivzcytwxrsy'];
const ROOT = process.cwd();

const INCLUDE_DIRS = ['src', 'supabase', 'db', 'scripts'];
const INCLUDE_ROOT_FILES = ['.env', '.env.local', '.env.production', 'vite.config.ts', 'index.html'];
const EXCLUDE = ['node_modules', '.git', 'dist', 'build', 'migration', '.lovable'];

function walk(dir, out = []) {
  let entries;
  try { entries = readdirSync(dir); } catch { return out; }
  for (const name of entries) {
    if (EXCLUDE.includes(name)) continue;
    const full = join(dir, name);
    let st;
    try { st = statSync(full); } catch { continue; }
    if (st.isDirectory()) walk(full, out);
    else out.push(full);
  }
  return out;
}

const files = [];
for (const d of INCLUDE_DIRS) files.push(...walk(join(ROOT, d)));
for (const f of INCLUDE_ROOT_FILES) {
  try { statSync(join(ROOT, f)); files.push(join(ROOT, f)); } catch { /* skip */ }
}

const offenders = [];
for (const file of files) {
  if (file.endsWith('check-backend-lock.mjs')) continue;
  let text;
  try { text = readFileSync(file, 'utf8'); } catch { continue; }
  for (const ref of DEPRECATED) {
    if (text.includes(ref)) {
      offenders.push(`${relative(ROOT, file)} :: contains "${ref}"`);
    }
  }
}

if (offenders.length) {
  console.error('\n❌ Backend integrity lock failed.');
  console.error('   The sole valid backend is fsterbxivhhzipfgpvou.\n');
  for (const o of offenders) console.error('   - ' + o);
  console.error('\n   Remove every deprecated ref above before continuing.\n');
  process.exit(1);
}

console.log('✓ Backend lock OK — only fsterbxivhhzipfgpvou is referenced in runtime/config/env.');
