/** Socket.io event names shared between client and server. */
export const SocketEvents = {
  ROOM_CREATE: 'room:create',
  ROOM_JOIN: 'room:join',
  ROOM_LEAVE: 'room:leave',
  ROOM_STATE: 'room:state',
  ROOM_ERROR: 'room:error',

  GAME_MOVE: 'game:move',
  GAME_RESIGN: 'game:resign',
  GAME_OFFER_DRAW: 'game:offerDraw',
  GAME_DRAW_RESPONSE: 'game:drawResponse',
  GAME_OVER: 'game:over',

  CHAT_MESSAGE: 'chat:message',
  CHAT_HISTORY: 'chat:history',

  WEBRTC_SIGNAL: 'webrtc:signal',

  PLAYER_READY: 'player:ready',
  PLAYER_DISCONNECTED: 'player:disconnected',

  ICE_SERVERS: 'ice:servers',
} as const;

export type SocketEventName = (typeof SocketEvents)[keyof typeof SocketEvents];
