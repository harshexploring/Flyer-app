// Loads the game's words. Words live in the Supabase `words` table so
// the admin can edit them without code changes; we read from there and
// fall back to the bundled words.json if the DB is unconfigured, empty,
// or unreachable. Same source the browser uses (see js/words.js).

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { SUPABASE_URL, SUPABASE_ANON_KEY } from '../config/supabase.js';

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');

function fromFile() {
  const data = JSON.parse(readFileSync(path.join(ROOT, 'words.json'), 'utf8'));
  const fly = (data.fly || []).map((text) => ({ text: String(text).trim(), flies: true }));
  const ground = (data.ground || []).map((text) => ({ text: String(text).trim(), flies: false }));
  const words = [...fly, ...ground].filter((w) => w.text.length > 0);
  if (words.length === 0) throw new Error('words.json has no words');
  return words;
}

async function fromDb() {
  if (!SUPABASE_URL || SUPABASE_URL.includes('YOUR-PROJECT')) return null;
  try {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/words?select=text,flies`, {
      headers: {
        apikey: SUPABASE_ANON_KEY,
        Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
      },
    });
    if (!res.ok) return null;
    const rows = await res.json();
    if (!Array.isArray(rows) || rows.length === 0) return null;
    return rows
      .map((r) => ({ text: String(r.text).trim(), flies: !!r.flies }))
      .filter((w) => w.text.length > 0);
  } catch {
    return null;
  }
}

export async function loadWords() {
  return (await fromDb()) || fromFile();
}
