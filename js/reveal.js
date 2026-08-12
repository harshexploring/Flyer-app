// ============================================================
// reveal.js — the game-over "picture" of the word that beat you.
//
// Goal: when you lose, actually SEE what the word looks like, so
// next time you remember that a heron is a bird (it flies) or a
// tortoise is not (it sits).
//
//  getReveal(word) → { emoji, caption, imagePromise }
//    emoji        : shows instantly (placeholder + fallback)
//    caption      : one friendly learning line
//    imagePromise : resolves to a real photo URL, or null
//
// Real organisms/objects get a real photo from Wikipedia (their
// API sends CORS headers, so this works from the browser). For
// fictional characters we deliberately DON'T fetch a photo (those
// stills are copyrighted) — the emoji stands in instead.
// ============================================================

// Popular characters mixed into the word list. We show an emoji
// for these, never a fetched photo.
const CHARACTER_EMOJI = {
  'Superman': '🦸', 'Iron Man': '🦾', 'Peter Pan': '🧚‍♂️',
  'Buzz Lightyear': '🚀', 'Tinker Bell': '🧚', 'Hedwig': '🦉',
  'Pikachu': '⚡', 'Shrek': '👹', 'SpongeBob': '🧽',
  'Mickey Mouse': '🐭', 'Jon Snow': '🗡️', 'Mowgli': '🧒',
};

// A few nice emoji for common words (used as the instant placeholder
// while the photo loads, and as the fallback if it never does).
const WORD_EMOJI = {
  Bird: '🐦', Crow: '🐦‍⬛', Owl: '🦉', Eagle: '🦅', Parrot: '🦜',
  Duck: '🦆', Swan: '🦢', Dove: '🕊️', Flamingo: '🦩', Peacock: '🦚',
  Butterfly: '🦋', Bee: '🐝', Bumblebee: '🐝', Ladybug: '🐞', Bat: '🦇',
  Airplane: '✈️', Helicopter: '🚁', Jet: '🛩️', Rocket: '🚀', UFO: '🛸',
  Kite: '🪁', Balloon: '🎈', 'Hot Air Balloon': '🎈', Dragon: '🐉',
  Fairy: '🧚', Angel: '👼',
  Elephant: '🐘', Lion: '🦁', Tiger: '🐅', Cow: '🐄', Dog: '🐕',
  Cat: '🐈', Horse: '🐎', Goat: '🐐', Sheep: '🐑', Monkey: '🐒',
  Pig: '🐖', Rabbit: '🐇', Deer: '🦌', Bear: '🐻', Fox: '🦊',
  Wolf: '🐺', Camel: '🐫', Giraffe: '🦒', Zebra: '🦓', Hippo: '🦛',
  Rhino: '🦏', Kangaroo: '🦘', Squirrel: '🐿️', Cheetah: '🐆',
  Leopard: '🐆', Panda: '🐼', Koala: '🐨', Sloth: '🦥', Otter: '🦦',
  Hedgehog: '🦔', Raccoon: '🦝', Llama: '🦙', Snake: '🐍',
  Crocodile: '🐊', Tortoise: '🐢', Turtle: '🐢', Fish: '🐟',
  Frog: '🐸', Lizard: '🦎', Rat: '🐀', Snail: '🐌', Crab: '🦀',
  Octopus: '🐙', Jellyfish: '🪼', Shark: '🦈', Whale: '🐋',
  Dolphin: '🐬', Scorpion: '🦂', Spider: '🕷️', Ant: '🐜',
  Car: '🚗', Bus: '🚌', Truck: '🚚', Train: '🚂', Bicycle: '🚲',
  Boat: '⛵', Tractor: '🚜', Scooter: '🛵', Ship: '🚢',
  Table: '🪑', Chair: '🪑', House: '🏠', Tree: '🌳', Stone: '🪨',
  Book: '📖', Shoe: '👟', Fridge: '🧊',
};

// Words whose Wikipedia page title differs from the word we show.
const TITLE_OVERRIDE = {
  UFO: 'Unidentified flying object',
  Jet: 'Jet aircraft',
  Drone: 'Unmanned aerial vehicle',
  Kite: 'Kite',
  'Hot Air Balloon': 'Hot air balloon',
  Bat: 'Bat',
  Swift: 'Swift (bird)',
  Swallow: 'Swallow',
  Crane: 'Crane (bird)',
  Panther: 'Black panther',
  Boat: 'Boat',
  Stone: 'Rock (geology)',
};

const isCharacter = (word) => word in CHARACTER_EMOJI;

function emojiFor(word, flies) {
  return CHARACTER_EMOJI[word] || WORD_EMOJI[word] || (flies ? '🕊️' : '🐾');
}

// Real people / proper names kept verbatim (no "A" in front).
const NAMES = new Set(['Narendra Modi']);

// Short and plain: "A camel can't fly." / "An eagle can fly."
function captionFor(word, flies) {
  const verb = flies ? 'can fly.' : "can't fly.";
  if (isCharacter(word) || NAMES.has(word)) return `${word} ${verb}`;
  const an = /^[aeio]/i.test(word) ? 'An' : 'A'; // skip 'u' (e.g. "a UFO")
  return `${an} ${word} ${verb}`;
}

// In-memory + localStorage cache so repeats are instant and offline-friendly.
const memCache = new Map();
const LS_KEY = 'flyer-image-cache';

function lsGet(word) {
  try {
    const all = JSON.parse(localStorage.getItem(LS_KEY) || '{}');
    return all[word];
  } catch { return undefined; }
}

function lsSet(word, url) {
  try {
    const all = JSON.parse(localStorage.getItem(LS_KEY) || '{}');
    all[word] = url;
    localStorage.setItem(LS_KEY, JSON.stringify(all));
  } catch { /* storage full / disabled — fine */ }
}

async function fetchImage(word) {
  if (isCharacter(word)) return null;          // copyright: emoji only
  if (memCache.has(word)) return memCache.get(word);
  const cached = lsGet(word);
  if (cached !== undefined) { memCache.set(word, cached); return cached; }

  const title = TITLE_OVERRIDE[word] || word;
  const url =
    'https://en.wikipedia.org/w/api.php?action=query&format=json&origin=*' +
    '&prop=pageimages&piprop=thumbnail&pithumbsize=420&redirects=1&titles=' +
    encodeURIComponent(title);

  let result = null;
  try {
    const controller = new AbortController();
    const t = setTimeout(() => controller.abort(), 5000);
    const res = await fetch(url, { signal: controller.signal });
    clearTimeout(t);
    const data = await res.json();
    const pages = data?.query?.pages || {};
    const page = Object.values(pages)[0];
    result = page?.thumbnail?.source || null;
  } catch {
    result = null; // offline / blocked / no image — caller falls back to emoji
  }

  memCache.set(word, result);
  lsSet(word, result);
  return result;
}

// The one call the UI makes.
export function getReveal(wordObj) {
  const { text, flies } = wordObj;
  return {
    emoji: emojiFor(text, flies),
    caption: captionFor(text, flies),
    imagePromise: fetchImage(text),
  };
}
