# 🪽 Flyer — Chidiya Udd

A digital version of the classic Indian playground game **Chidiya Udd**
("bird, fly!"). A word pops up on screen — if the thing can fly, hit **FLY**;
if it can't, hit **GROUND**. You have a shrinking time window, and one
mistake (or one timeout) ends the game. Your score is how many words you
survived, plus your average and fastest reaction times.

Play **solo**, or **with friends**: create a room, share the link, and up to
5 players race through the same words at the same moment — last one
standing wins.

## How to run

### Full version (solo + multiplayer)

Requires Node.js 18+.

```bash
cd "Flyer App"
npm install
npm start
# then open http://localhost:8642  (override with PORT=xxxx npm start)
```

### Solo only (no Node needed)

The solo game is a pure static site — any HTTP server works:

```bash
python3 -m http.server 8000
# then open http://localhost:8000
```

("Play with Friends" will show a friendly error in this mode, since
multiplayer needs the Node server.)

## Multiplayer

1. One player clicks **Play with Friends**, enters a name, and gets a room
   code + shareable link (`…/?room=CODE`).
2. Up to **5 players** (see `maxPlayers` below) open the link, enter their
   names, and appear in the lobby.
3. The host starts the game. Every player sees the **same word at the same
   moment**. Answer wrong — or too slow — and you're **out** (your name
   turns red in the strip; survivors stay green and show their reaction
   time each round). Eliminated players keep watching as spectators.
4. Last player alive wins. The final report shows, for everyone: correct
   answers, average reaction, fastest reaction, and the word they fell on.
   The host can restart from the report screen.

### How multiplayer works (design notes)

- The server is **authoritative**: it deals the words, collects answers,
  judges, and eliminates. Clients can't advance the game on their own.
- **Reaction time is measured on each client** (word rendered → button
  pressed) and sent with the answer. Network lag therefore never punishes
  a player; the server just adds a small grace period (`graceMs`) before
  judging so answers have time to arrive.
- Rooms live **in server memory** and vanish when the last player leaves —
  no database.
- Disconnecting mid-game counts as elimination (marked 🔌 in the report).

## Controls

| Action | Button | Keyboard |
| ------ | ------ | -------- |
| It flies | FLY 🪽 | `↑` or `W` |
| It doesn't | GROUND ⬇ | `↓` or `S` |
| Start / restart | Play | `Space` / `Enter` |
| Mute | 🔊 in navbar | — |

## Game rules

1. A word pops up at the horizon. The timer bar below the buttons starts
   draining.
2. Answer before the bar empties:
   - **Correct FLY** → green flash, word soars into the sky. 🎉
   - **Correct GROUND** → green flash, word settles onto the ground.
   - **Wrong FLY** → the word tries to jump, stalls, and bursts. Game over.
   - **Wrong GROUND** → the word is dragged down and bursts. Game over.
   - **No answer** → counts as a failure. Game over.
3. The time window starts at **2000 ms** and shrinks by **50 ms per word**,
   down to a floor of **700 ms** — so the game always ends eventually.
4. Best score (words survived) is saved in `localStorage`.

## Code structure

```
index.html          Page skeleton: navbar, stage (sky/ground), buttons,
                    timer, start & game-over overlays.
css/style.css       All styling: cartoon sky, clouds, ground, chunky
                    buttons, overlay panels, particles.
words.json          The word data — edit this to change the words, NO
                    code needed. Two lists: "fly" and "ground".
js/words.js         Loads words.json and normalizes it to { text, flies }.
                    Swap the source here to migrate to a Google Sheet/API.
js/game.js          Game engine. Pure logic, zero DOM. Deck shuffling,
                    round loop, shrinking timer, reaction-time stats.
js/sfx.js           Sound effects synthesized with the Web Audio API
                    (no audio files needed): chime, whoosh, pop, jingles.
js/ui.js            DOM layer: word rendering, result animations
                    (Web Animations API), timer bar, flashes, particles,
                    HUD and overlay screens.
js/main.js          Glue: wires game hooks to UI + sounds, handles
                    button/keyboard input, mute toggle, high score,
                    and routes into multiplayer when asked.
js/multiplayer.js   Multiplayer controller: drives the same UI, but
                    words come from the server. Measures reaction
                    time locally, renders lobby/strip/report.
server/index.js     Express + Socket.IO server. Serves the static
                    game and manages rooms (create/join/answer).
server/room.js      One game room: lobby → rounds → report. All
                    game rules + GAME_CONFIG (incl. maxPlayers).
server/words.js     Server-side loader for the same words.json.
```

### How the pieces talk

`game.js` knows nothing about the DOM. It communicates through three hooks
that `main.js` provides:

- `onWord(word, windowMs, round)` — a new word is live; UI shows it and
  starts the timer. Reaction time is measured from this moment.
- `onResult(result)` — the round was judged (`correct`, `action`, `word`,
  `reactionMs`). UI plays the matching animation + sound, then calls
  `game.proceed()`.
- `onGameOver(stats)` — sudden death triggered; UI shows the final screen
  with `survived`, `avgMs`, `bestMs`.

This separation is what makes multiplayer work: `js/multiplayer.js` drives
the exact same UI, but its "engine" is the server on the other end of a
Socket.IO connection instead of the local `game.js`.

## Tuning

Solo difficulty knobs live in `CONFIG` at the top of `js/game.js`:

```js
export const CONFIG = {
  startWindowMs: 2000, // time allowed for the first word
  shrinkPerWordMs: 50, // window shrinks this much every word
  minWindowMs: 700,    // window never goes below this
};
```

Multiplayer knobs live in `GAME_CONFIG` at the top of `server/room.js` —
including **`maxPlayers: 5`**. To allow bigger rooms, change that one
number; nothing else in the codebase assumes a specific count.

## Editing the words

Open **`words.json`** and edit the two lists — no code involved:

```json
{
  "fly":    ["Bird", "Butterfly", "Airplane", "..."],
  "ground": ["Elephant", "Car", "Table", "..."]
}
```

Add a word by typing it (in quotes) into the right list; remove one by
deleting it. Keep the words unambiguous — the game tests reaction time, not
trivia, so avoid tricky cases like penguin or ostrich. Try to keep both
lists roughly the same length so flying and non-flying words show up equally.

Because the game fetches this file over HTTP, changes appear on the next
page reload. (This is also why the game must be *served*, not opened as a
`file://` — see "How to run" above.)

## Roadmap

- [x] Multiplayer rooms (up to 5 players over a shared link, Socket.IO,
      server-authoritative rounds, last one standing wins)
- [ ] Deploy: static solo build on GitHub Pages + game server on
      Render/Railway/Fly.io
- [ ] Reconnect/rejoin mid-game (currently a disconnect = elimination)
- [ ] Tricky mode (penguin, ostrich, Superman…)
- [ ] Hindi / Hinglish word packs
