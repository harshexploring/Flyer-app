// Server connection for multiplayer.
//
// SERVER_URL options:
//  - Local testing: your Mac's IP with the Node server running
//    (from the main project: npm start). Re-check the IP with
//    `ipconfig getifaddr en0` — it can change when Wi-Fi reconnects.
//  - Production: your Render URL, e.g. 'https://flyer-app.onrender.com'
//    — then multiplayer works from anywhere, no local server needed.

import { io } from 'socket.io-client';

export const SERVER_URL = 'http://192.168.1.8:8642';

// Resolves with a connected socket, or rejects with a clear error
// (instead of hanging forever like the old version did).
export function connectToServer(timeoutMs = 8000) {
  return new Promise((resolve, reject) => {
    const socket = io(SERVER_URL, {
      transports: ['websocket'],
      reconnection: true,
    });
    const timer = setTimeout(() => {
      socket.disconnect();
      reject(new Error(
        `Could not reach the game server at ${SERVER_URL}. ` +
        'Make sure the server is running and the URL in utils/net.js is right.',
      ));
    }, timeoutMs);
    socket.once('connect', () => {
      clearTimeout(timer);
      resolve(socket);
    });
  });
}

export function emitAck(socket, event, payload) {
  return new Promise((resolve) => socket.emit(event, payload, resolve));
}
