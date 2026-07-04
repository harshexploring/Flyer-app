// ============================================================
// Word source. The actual words live in ../words.json so you
// can edit them with ZERO code — just add/remove strings in
// that file's "fly" and "ground" lists.
//
// loadWords() fetches that file and normalizes it into the
// shape the game engine wants: [{ text, flies }, ...].
//
// Migration note: if you later move the words to a Google
// Sheet (published as JSON) or a real API, only this file
// changes — swap the fetch URL and adjust the mapping. The
// rest of the game keeps working unchanged.
// ============================================================

const WORDS_URL = new URL('../words.json', import.meta.url);

export async function loadWords() {
  const res = await fetch(WORDS_URL);
  if (!res.ok) throw new Error(`Could not load words.json (${res.status})`);
  const data = await res.json();

  const fly = (data.fly || []).map((text) => ({ text: String(text).trim(), flies: true }));
  const ground = (data.ground || []).map((text) => ({ text: String(text).trim(), flies: false }));
  const words = [...fly, ...ground].filter((w) => w.text.length > 0);

  if (words.length === 0) throw new Error('words.json has no words');
  return words;
}
