import http from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import dotenv from 'dotenv';
import { Server } from 'socket.io';
import type { RTCIceServer } from '@xadrez3d/shared';
import { createApi } from './api.js';
import { RankingStore } from './ranking.js';
import { RoomManager } from './rooms.js';
import { registerSocketHandlers } from './socket.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, '../.env') });

const PORT = Number(process.env.PORT) || 3001;
const CLIENT_ORIGIN = process.env.CLIENT_ORIGIN || 'http://localhost:5173';
const DATABASE_PATH =
  process.env.DATABASE_PATH || path.join(__dirname, '../data/xadrez.db');

const iceServers: RTCIceServer[] = [
  { urls: 'stun:stun.l.google.com:19302' },
  { urls: 'stun:stun1.l.google.com:19302' },
];

if (process.env.TURN_URL) {
  iceServers.push({
    urls: process.env.TURN_URL,
    username: process.env.TURN_USERNAME || undefined,
    credential: process.env.TURN_CREDENTIAL || undefined,
  });
}

const ranking = new RankingStore(DATABASE_PATH);
const rooms = new RoomManager();
const app = createApi(ranking, CLIENT_ORIGIN);

const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: CLIENT_ORIGIN,
    methods: ['GET', 'POST'],
  },
});

registerSocketHandlers(io, rooms, ranking, iceServers);

server.listen(PORT, () => {
  console.log(`Xadrez3D server listening on http://localhost:${PORT}`);
});
