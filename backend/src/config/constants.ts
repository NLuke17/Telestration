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
/** Auto-advance each flipbook during the end-of-game recap (client may also advance manually). */
export const RECAP_FLIPBOOK_DURATION_MS = 14000;

/**
 * After `phaseDeadline`, wait this long before server-side auto-fill + phase advance.
 * Lets slow clients finish uploading large drawing payloads (WS) when the UI timer hits zero.
 * Keep long enough for large paths + mobile WS; shorter values make the round feel more responsive.
 */
export const PHASE_DEADLINE_SUBMISSION_GRACE_MS = 8000;

// Game configuration
export const MIN_PLAYERS_TO_START = 2;
export const MAX_ROUNDS = 5;
/** Max flipbooks each user may copy into their library (JWT accounts). */
export const MAX_SAVED_FLIPBOOKS_PER_USER = 10;
