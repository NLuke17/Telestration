/**
 * Custom React hooks for managing game state and WebSocket connections
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { getWSClient, type ConnectionStatus } from '../services/ws/wsClient';
import type { LobbySnapshot } from '../types/dto';
import type { WSServerMessage } from '../types/ws';

/**
 * Hook for managing WebSocket connection
 */
export function useWebSocket() {
  const [status, setStatus] = useState<ConnectionStatus>('disconnected');
  const wsClient = useRef(getWSClient());

  useEffect(() => {
    const client = wsClient.current;
    
    // Subscribe to status changes
    const unsubscribe = client.onStatusChange(setStatus);

    // Connect if not already connected
    if (!client.isConnected()) {
      client.connect();
    }

    return () => {
      unsubscribe();
    };
  }, []);

  const send = useCallback((type: string, payload?: Record<string, any>) => {
    wsClient.current.send(type, payload);
  }, []);

  const subscribe = useCallback(<T extends WSServerMessage = WSServerMessage>(
    type: string,
    handler: (message: T) => void
  ) => {
    return wsClient.current.subscribe(type, handler);
  }, []);

  return {
    status,
    isConnected: status === 'connected',
    send,
    subscribe,
    client: wsClient.current,
  };
}

/**
 * Hook for managing lobby state with WebSocket
 */
export function useLobby(roomCode: string, userId?: string) {
  const [lobby, setLobby] = useState<LobbySnapshot | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [connectedUserIds, setConnectedUserIds] = useState<string[]>([]);
  const ws = useWebSocket();

  useEffect(() => {
    if (!ws.isConnected || !roomCode) {
      return;
    }

    const client = getWSClient();

    // Connect to lobby
    client.send('lobby:connect', { roomCode, userId });

    // Subscribe to lobby events
    const unsubscribers = [
      client.subscribe<{ type: 'lobby:connected'; roomCode: string; lobbyId: string }>(
        'lobby:connected',
        (msg) => {
          if (!msg.lobbyId || !msg.roomCode) {
            return;
          }
          setIsConnected(true);
          setError(null);
        }
      ),

      client.subscribe<{ type: 'lobby:snapshot'; snapshot: LobbySnapshot }>(
        'lobby:snapshot',
        (msg) => {
          setLobby(msg.snapshot);
        }
      ),

      client.subscribe<{ type: 'lobby:presence'; connectedUserIds: string[] }>(
        'lobby:presence',
        (msg) => {
          setConnectedUserIds(msg.connectedUserIds);
        }
      ),

      client.subscribe<{ type: 'lobby:deleted'; lobbyId: string }>(
        'lobby:deleted',
        () => {
          setError('Lobby has been deleted');
          setIsConnected(false);
        }
      ),

      client.subscribe<{ type: 'error'; error: string; message?: string }>(
        'error',
        (msg) => {
          console.error('WebSocket error:', msg.error, msg.message);
          setError(msg.message || msg.error);
        }
      ),
    ];

    // Cleanup
    return () => {
      unsubscribers.forEach((unsub) => unsub());
      client.send('lobby:disconnect');
    };
  }, [ws.isConnected, roomCode, userId]);

  useEffect(() => {
    if (!roomCode) {
      return;
    }
    const client = getWSClient();
    const notifyLeave = () => {
      if (client.isConnected()) {
        client.send('lobby:disconnect');
      }
    };
    window.addEventListener('pagehide', notifyLeave);
    return () => {
      window.removeEventListener('pagehide', notifyLeave);
    };
  }, [roomCode]);

  const submitPrompt = useCallback((prompt: string) => {
    ws.send('lobby:submit_prompt', { prompt });
  }, [ws]);

  const setReady = useCallback((ready: boolean) => {
    ws.send('lobby:ready', { ready });
  }, [ws]);

  return {
    lobby,
    isConnected,
    error,
    connectedUserIds,
    wsStatus: ws.status,
    submitPrompt,
    setReady,
  };
}

export type GameStateSync = { roomCode: string; userId: string };

/**
 * Hook for managing game state during gameplay
 * @param sync Optional HTTP poll to hydrate `phase` / `phaseEndsAt` / `roundId` (e.g. after refresh or if WS missed `phase_changed`).
 */
export function useGameState(lobbyId?: string, sync?: GameStateSync) {
  const [roundId, setRoundId] = useState<string | null>(null);
  const [roundNumber, setRoundNumber] = useState<number>(0);
  const [phase, setPhase] = useState<'DRAWING' | 'GUESSING' | 'RECAP' | 'VOTING' | null>(null);
  const [phaseEndsAt, setPhaseEndsAt] = useState<number | null>(null);
  const [chainWave, setChainWave] = useState<number | null>(null);
  const [maxChainWave, setMaxChainWave] = useState<number | null>(null);
  const [isPhaseComplete, setIsPhaseComplete] = useState(false);
  const ws = useWebSocket();

  useEffect(() => {
    // Poll must not depend on lobby?.id — that snapshot can arrive after game start, which would
    // block phase/endsAt hydration and leave players stuck on GUESSING with no timer.
    if (!ws.isConnected || !sync?.roomCode || !sync.userId) {
      return;
    }

    let cancelled = false;

    const tick = async () => {
      try {
        const { getGameState } = await import('../services/api/lobbyApi');
        const s = await getGameState(sync.roomCode, sync.userId);
        if (cancelled) return;
        if (s.state !== 'IN_PROGRESS' || !s.roundId) {
          return;
        }
        setRoundId(s.roundId);
        if (typeof s.roundNumber === 'number') {
          setRoundNumber(s.roundNumber);
        }
        if (s.phase === 'DRAWING' || s.phase === 'GUESSING' || s.phase === 'RECAP' || s.phase === 'VOTING') {
          setPhase(s.phase);
        }
        if (typeof s.endsAt === 'number') {
          setPhaseEndsAt(s.endsAt);
        } else if (s.endsAt === null) {
          setPhaseEndsAt(null);
        }
        if (typeof s.chainWave === 'number') {
          setChainWave(s.chainWave);
        }
        if (typeof s.maxChainWave === 'number') {
          setMaxChainWave(s.maxChainWave);
        }
      } catch {
        /* ignore */
      }
    };

    void tick();
    const id = setInterval(tick, 1500);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, [ws.isConnected, sync?.roomCode, sync?.userId]);

  useEffect(() => {
    if (!ws.isConnected) {
      return;
    }
    if (!lobbyId && !sync?.roomCode) {
      return;
    }

    const client = getWSClient();

    // Subscribe to game events (use singleton + stable deps — `ws` object identity changes every render
    // and was re-registering handlers so one server broadcast hit multiple listeners.)
    const unsubscribers = [
      client.subscribe<{ type: 'game:started'; roundId: string; roundNumber: number }>(
        'game:started',
        (msg) => {
          setRoundId(msg.roundId);
          setRoundNumber(msg.roundNumber);
          setIsPhaseComplete(false);
        }
      ),

      client.subscribe<{
        type: 'game:phase_changed';
        phase: 'DRAWING' | 'GUESSING' | 'RECAP' | 'VOTING';
        endsAt: number | null;
      }>('game:phase_changed', (msg) => {
        setPhase(msg.phase);
        setPhaseEndsAt(typeof msg.endsAt === 'number' ? msg.endsAt : null);
        setIsPhaseComplete(false);
      }),

      client.subscribe<{ type: 'game:phase_complete'; phase: 'DRAWING' | 'GUESSING' }>(
        'game:phase_complete',
        () => {
          setIsPhaseComplete(true);
        }
      ),

      client.subscribe<{ type: 'game:round_complete'; roundId: string }>(
        'game:round_complete',
        () => {
          setIsPhaseComplete(true);
        }
      ),
    ];

    return () => {
      unsubscribers.forEach((unsub) => unsub());
    };
  }, [ws.isConnected, lobbyId, sync?.roomCode]);

  const submitDrawing = useCallback((flipbookId: string, drawingData: string) => {
    ws.send('game:submit_drawing', { flipbookId, drawingData });
  }, [ws]);

  const submitGuess = useCallback((flipbookId: string, text: string) => {
    ws.send('game:submit_guess', { flipbookId, text });
  }, [ws]);

  return {
    roundId,
    roundNumber,
    phase,
    phaseEndsAt,
    chainWave,
    maxChainWave,
    isPhaseComplete,
    submitDrawing,
    submitGuess,
  };
}

/**
 * Hook for countdown timer based on phase end time
 */
export function usePhaseTimer(phaseEndsAt: number | null) {
  const [timeRemaining, setTimeRemaining] = useState<number>(0);

  useEffect(() => {
    if (!phaseEndsAt) {
      setTimeRemaining(0);
      return;
    }

    let timeoutId: ReturnType<typeof setTimeout> | undefined;

    const tick = () => {
      const now = Date.now();
      const remaining = Math.max(0, phaseEndsAt - now);
      setTimeRemaining(remaining);
      if (remaining <= 0) {
        return;
      }
      const delay = remaining <= 3000 ? 200 : 1000;
      timeoutId = window.setTimeout(tick, delay);
    };

    tick();

    return () => {
      if (timeoutId !== undefined) {
        clearTimeout(timeoutId);
      }
    };
  }, [phaseEndsAt]);

  const minutes = Math.floor(timeRemaining / 60000);
  const seconds = Math.floor((timeRemaining % 60000) / 1000);

  return {
    timeRemaining,
    minutes,
    seconds,
    isExpired: timeRemaining === 0,
  };
}

/**
 * Hook for tracking prompt submissions in lobby
 */
export function usePromptTracker(lobbyId?: string) {
  const [submittedUserIds, setSubmittedUserIds] = useState<Set<string>>(new Set());
  const [allPromptsReady, setAllPromptsReady] = useState(false);
  const ws = useWebSocket();

  useEffect(() => {
    if (!ws.isConnected || !lobbyId) {
      return;
    }

    const client = getWSClient();

    const unsubscribers = [
      client.subscribe<{ type: 'lobby:prompt_submitted'; userId: string; username: string }>(
        'lobby:prompt_submitted',
        (msg) => {
          setSubmittedUserIds((prev) => new Set(prev).add(msg.userId));
        }
      ),

      client.subscribe<{ type: 'lobby:all_prompts_ready'; promptCount: number }>(
        'lobby:all_prompts_ready',
        () => {
          setAllPromptsReady(true);
        }
      ),

      client.subscribe<{ type: 'game:started'; roundId: string; roundNumber: number }>(
        'game:started',
        () => {
          setSubmittedUserIds(new Set());
          setAllPromptsReady(false);
        }
      ),
    ];

    return () => {
      unsubscribers.forEach((unsub) => unsub());
    };
  }, [ws.isConnected, lobbyId]);

  return {
    submittedUserIds,
    allPromptsReady,
    hasSubmitted: (userId: string) => submittedUserIds.has(userId),
  };
}
