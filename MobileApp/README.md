# 🪽 Flyer Mobile App (React Native + Expo)

Native Android/iOS version of the Flyer game. Built with **Expo SDK 54**
(matches the Expo Go client). Same look, sounds and rules as the web app,
and multiplayer connects to the **same Node server** — mobile and web
players can share a room.

## Run it (development)

```bash
cd flyer-mobile
npm install
npm start          # then scan the QR with Expo Go (same Wi-Fi)
```

For multiplayer during development, also start the game server from the
main project folder (`npm start` there → port 8642).

## Where everything lives

```
flyer-mobile/
├── App.js                        Entry: fonts + sounds, preloader,
│                                 state-based navigation (no nav lib)
├── screens/
│   ├── PreloaderScreen.js        Bird-flies / elephant-sits intro (2 loops)
│   ├── LoginScreen.js            Username entry (Firebase auth = later)
│   ├── HomeScreen.js             Play Solo / Play with Friends
│   ├── GameScreen.js             Solo game (sudden death)
│   ├── GameOverScreen.js         Solo results
│   ├── MultiplayerLobbyScreen.js Create/join with 6-char code + lobby
│   └── MultiplayerGameScreen.js  Server-driven rounds, strip, report
├── components/
│   ├── Stage.js                  Sky/ground/sun/clouds backdrop
│   ├── Playfield.js              Word card + FLY/SIT buttons + timer +
│   │                             flash; all word animations live here
│   ├── PlayersStrip.js           Green/red multiplayer chips
│   └── ui.js                     TopBar (back button!), Panel, buttons,
│                                 pills, input — the cartoon look
├── utils/
│   ├── gameLogic.js              Solo engine (same rules as web js/game.js)
│   ├── words.js                  Same 100 words as the web app
│   ├── theme.js                  Colors + Fredoka font names
│   ├── sfx.js                    Plays the baked WAVs via expo-audio
│   └── net.js                    SERVER_URL + socket connection helper
├── assets/sounds/*.wav           Generated sound effects
├── scripts/generate-sounds.js    Regenerates the WAVs (node this file)
└── config/firebaseConfig.js      Placeholder for future Firebase auth
```

## The server URL (important)

`utils/net.js` holds `SERVER_URL`:

- **Local testing:** `http://<your-mac-ip>:8642` — the Node server must be
  running (`npm start` in the main project) and the phone must be on the
  same Wi-Fi. Re-check the IP with `ipconfig getifaddr en0`.
- **Production:** your Render URL (`https://….onrender.com`) — multiplayer
  then works from anywhere with no local server.

## How multiplayer works

Identical protocol to the web client (see the main project README's
diagrams): the app connects with Socket.IO, creates/joins a room by
6-character code, the server broadcasts each word to everyone at once,
the app measures your reaction time locally and sends it with your
answer, and the server judges/eliminates. The room dies when its
creator leaves.

## Building for the Play Store (when ready)

```bash
npm install -g eas-cli
eas login                    # free Expo account
eas build --platform android --profile preview   # APK for sideloading
eas build --platform android                     # AAB for Play Store
```

Then in [Google Play Console](https://play.google.com/console): create the
app, upload the AAB, fill the store listing, submit for review. The
`android.package` id is already set (`com.harshjha.flyer`) in app.json.

## Not done yet

- Firebase phone/email auth (login is username-only; `config/firebaseConfig.js`
  is a placeholder)
- Persistent best score (in-memory per session; needs async-storage)
- iOS testing
