export const ROOM_CODE_LENGTH = 6;
export const WS_MAX_PAYLOAD_BYTES = 1024 * 1024; // 1MB
export const LOBBY_MAX_PLAYERS = 8;
export const LOBBY_IDLE_TTL_SECONDS = 3600; // 1 hour
export const WS_HEARTBEAT_INTERVAL_MS = 30000; // 30 seconds
export const WS_RECONNECT_GRACE_MS = 10000; // 10 seconds

// Game phase timers (in milliseconds)
export const DRAWING_PHASE_DURATION_MS = 90000; // 90 seconds
export const GUESSING_PHASE_DURATION_MS = 45000; // 45 seconds
export const VOTING_PHASE_DURATION_MS = 30000; // 30 seconds

// Game configuration
export const MIN_PLAYERS_TO_START = 2;
export const MAX_ROUNDS = 5;
