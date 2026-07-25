# Xadrez3D

Jogo de xadrez 3D online com singleplayer (vs IA), multiplayer em salas, chat escrito, voz e webcam.

## Stack

- **Cliente:** Vite + React + TypeScript + React Three Fiber
- **Servidor:** Express + Socket.io + ranking JSON
- **Regras:** chess.js
- **IA:** motor local (alpha-beta) + Stockfish opcional via `/public/stockfish.js`
- **Mídia:** WebRTC (signaling via Socket.io)
- **Ranking:** JSON file-backed (sem bindings nativos)

## Pré-requisitos

- Node.js 20+
- npm 10+

## Como rodar

```bash
npm install
cp .env.example apps/server/.env
npm run dev:server   # terminal 1 — http://localhost:3001
npm run dev:client   # terminal 2 — http://localhost:5173
```

## Funcionalidades

- Tabuleiro 3D interativo
- Singleplayer vs Stockfish (níveis 1–10)
- Multiplayer: criar/entrar sala por código + nickname
- Espectadores (somente leitura)
- Chat escrito por sala
- Chat por voz e webcam (WebRTC)
- Ranking Elo por nickname
- Relógios de partida e reconexão

## Estrutura

```
apps/client     — frontend React/Three.js
apps/server     — API + Socket.io + ranking JSON
packages/shared — tipos, eventos e helpers de xadrez
```

## WebRTC / TURN

STUN público é usado por padrão. Em redes restritivas, configure no `.env` do servidor:

```
TURN_URL=turn:seu-servidor:3478
TURN_USERNAME=...
TURN_CREDENTIAL=...
```

## Scripts

| Comando | Descrição |
|---------|-----------|
| `npm run dev:client` | Dev server do cliente |
| `npm run dev:server` | Dev server do backend |
| `npm run build` | Build de shared → server → client |
| `npm test` | Testes dos workspaces |
| `npm start` | Sobe o servidor em produção |

## Licença

MIT
