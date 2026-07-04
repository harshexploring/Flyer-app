// Loads the same words.json the browser uses, so solo and
// multiplayer always play with an identical word bank.

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');

export function loadWords() {
  const data = JSON.parse(readFileSync(path.join(ROOT, 'words.json'), 'utf8'));
  const fly = (data.fly || []).map((text) => ({ text: String(text).trim(), flies: true }));
  const ground = (data.ground || []).map((text) => ({ text: String(text).trim(), flies: false }));
  const words = [...fly, ...ground].filter((w) => w.text.length > 0);
  if (words.length === 0) throw new Error('words.json has no words');
  return words;
}
