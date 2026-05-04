/**
 * Resolves the user id sent to lobby/game APIs and WebSocket `lobby:connect`.
 * Authenticated users use their account id; guests use a stable id in localStorage.
 */
const GUEST_LOBBY_USER_ID_KEY = 'userId';

export function getOrCreateLobbyUserId(
  isAuthenticated: boolean,
  user: { id: string } | null | undefined
): string {
  if (isAuthenticated && user) {
    return user.id;
  }
  const stored = localStorage.getItem(GUEST_LOBBY_USER_ID_KEY);
  if (stored) {
    return stored;
  }
  const id = crypto.randomUUID();
  localStorage.setItem(GUEST_LOBBY_USER_ID_KEY, id);
  return id;
}
