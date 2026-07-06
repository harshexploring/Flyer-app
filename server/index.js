// ============================================================
// Flyer game server.
// - Serves the static game (same files as the solo version).
// - Hosts Socket.IO multiplayer rooms (see room.js).
//
// Run with: npm start   (default port 8642, override with PORT)
// ============================================================

import { createServer } from 'node:http';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import express from 'express';
import { Server } from 'socket.io';
import { Room, GAME_CONFIG } from './room.js';
import { loadWords } from './words.js';

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const PORT = process.env.PORT || 8642;

const app = express();
app.use(express.static(ROOT));

const httpServer = createServer(app);
// Open CORS so the mobile app (and any other origin) can connect —
// the game has no credentials or private data to protect.
const io = new Server(httpServer, { cors: { origin: '*' } });

const words = loadWords();
const rooms = new Map(); // code → Room

// 6-character room codes; the alphabet avoids look-alike
// characters (0/O, 1/I/L) so codes are easy to read out loud.
const CODE_ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';

function newRoomCode() {
  let code;
  do {
    code = Array.from({ length: 6 }, () =>
      CODE_ALPHABET[Math.floor(Math.random() * CODE_ALPHABET.length)],
    ).join('');
  } while (rooms.has(code));
  return code;
}

function cleanupRoom(code) {
  const room = rooms.get(code);
  if (room && room.isEmpty) {
    room.destroy();
    rooms.delete(code);
  }
}

io.on('connection', (socket) => {
  let joinedCode = null;

  socket.on('room:create', ({ name } = {}, ack) => {
    const code = newRoomCode();
    const room = new Room(io, code, words);
    rooms.set(code, room);
    room.addPlayer(socket, name);
    joinedCode = code;
    ack?.({ ok: true, code, players: room.publicPlayers(), maxPlayers: GAME_CONFIG.maxPlayers });
  });

  socket.on('room:join', ({ code, name } = {}, ack) => {
    const room = rooms.get(String(code || '').trim().toUpperCase());
    if (!room) {
      return ack?.({ ok: false, error: 'Room not found. Check the code and try again.' });
    }
    if (room.phase === 'playing') {
      return ack?.({ ok: false, error: 'This game has already started — ask for a new round!' });
    }
    if (room.connectedPlayers.length >= GAME_CONFIG.maxPlayers) {
      return ack?.({ ok: false, error: `Room is full (${GAME_CONFIG.maxPlayers} players max).` });
    }
    room.addPlayer(socket, name);
    joinedCode = room.code;
    ack?.({ ok: true, code: room.code, players: room.publicPlayers(), maxPlayers: GAME_CONFIG.maxPlayers });
  });

  socket.on('game:start', () => {
    rooms.get(joinedCode)?.start(socket.id);
  });

  socket.on('round:answer', (payload) => {
    rooms.get(joinedCode)?.onAnswer(socket.id, payload);
  });

  socket.on('disconnect', () => {
    if (!joinedCode) return;
    const room = rooms.get(joinedCode);
    if (!room) return;
    if (room.creatorId === socket.id) {
      // The creator left → the room dies with them, and every
      // remaining player is notified and sent back home.
      room.close('The room creator left, so this room was closed.');
      rooms.delete(joinedCode);
    } else {
      room.removePlayer(socket.id);
      cleanupRoom(joinedCode);
    }
  });
});

httpServer.listen(PORT, () => {
  console.log(`Flyer server running → http://localhost:${PORT}`);
});
