// ============================================================
// Word source. Words now live in a Supabase `words` table so the
// admin can add/remove them without code changes. We read from the
// DB first; if that's unconfigured, empty, or unreachable, we fall
// back to the bundled words.json — so the game always has words.
// Shape returned: [{ text, flies }, ...].
// ============================================================

import { SUPABASE_URL, SUPABASE_ANON_KEY } from '../config/supabase.js';

const WORDS_URL = new URL('../words.json', import.meta.url);

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
    return null; // network/config issue → fall back to the file
  }
}

async function fromJson() {
  const res = await fetch(WORDS_URL);
  if (!res.ok) throw new Error(`Could not load words.json (${res.status})`);
  const data = await res.json();
  const fly = (data.fly || []).map((text) => ({ text: String(text).trim(), flies: true }));
  const ground = (data.ground || []).map((text) => ({ text: String(text).trim(), flies: false }));
  const words = [...fly, ...ground].filter((w) => w.text.length > 0);
  if (words.length === 0) throw new Error('words.json has no words');
  return words;
}

export async function loadWords() {
  return (await fromDb()) || (await fromJson());
}
