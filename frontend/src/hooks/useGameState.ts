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

    // Connect to lobby
    ws.send('lobby:connect', { roomCode, userId });

    // Subscribe to lobby events
    const unsubscribers = [
      ws.subscribe<{ type: 'lobby:connected'; roomCode: string; lobbyId: string }>(
        'lobby:connected',
        (msg) => {
          console.log('Connected to lobby:', msg.lobbyId);
          setIsConnected(true);
          setError(null);
        }
      ),

      ws.subscribe<{ type: 'lobby:snapshot'; snapshot: LobbySnapshot }>(
        'lobby:snapshot',
        (msg) => {
          console.log('Lobby snapshot received:', msg.snapshot);
          setLobby(msg.snapshot);
        }
      ),

      ws.subscribe<{ type: 'lobby:presence'; connectedUserIds: string[] }>(
        'lobby:presence',
        (msg) => {
          console.log('Presence updated:', msg.connectedUserIds);
          setConnectedUserIds(msg.connectedUserIds);
        }
      ),

      ws.subscribe<{ type: 'lobby:deleted'; lobbyId: string }>(
        'lobby:deleted',
        (msg) => {
          console.log('Lobby deleted:', msg.lobbyId);
          setError('Lobby has been deleted');
          setIsConnected(false);
        }
      ),

      ws.subscribe<{ type: 'error'; error: string; message?: string }>(
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
      ws.send('lobby:disconnect');
    };
  }, [ws, roomCode, userId]);

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

/**
 * Hook for managing game state during gameplay
 */
export function useGameState(lobbyId?: string) {
  const [roundId, setRoundId] = useState<string | null>(null);
  const [roundNumber, setRoundNumber] = useState<number>(0);
  const [phase, setPhase] = useState<'DRAWING' | 'GUESSING' | 'VOTING' | null>(null);
  const [phaseEndsAt, setPhaseEndsAt] = useState<number | null>(null);
  const [isPhaseComplete, setIsPhaseComplete] = useState(false);
  const ws = useWebSocket();

  useEffect(() => {
    if (!ws.isConnected || !lobbyId) {
      return;
    }

    // Subscribe to game events
    const unsubscribers = [
      ws.subscribe<{ type: 'game:started'; roundId: string; roundNumber: number }>(
        'game:started',
        (msg) => {
          console.log('Game started:', msg);
          setRoundId(msg.roundId);
          setRoundNumber(msg.roundNumber);
          setIsPhaseComplete(false);
        }
      ),

      ws.subscribe<{ type: 'game:phase_changed'; phase: 'DRAWING' | 'GUESSING' | 'VOTING'; endsAt: number }>(
        'game:phase_changed',
        (msg) => {
          console.log('Phase changed:', msg);
          setPhase(msg.phase);
          setPhaseEndsAt(msg.endsAt);
          setIsPhaseComplete(false);
        }
      ),

      ws.subscribe<{ type: 'game:phase_complete'; phase: 'DRAWING' | 'GUESSING' }>(
        'game:phase_complete',
        (msg) => {
          console.log('Phase complete:', msg);
          setIsPhaseComplete(true);
        }
      ),

      ws.subscribe<{ type: 'game:round_complete'; roundId: string }>(
        'game:round_complete',
        (msg) => {
          console.log('Round complete:', msg);
          setIsPhaseComplete(true);
        }
      ),
    ];

    return () => {
      unsubscribers.forEach((unsub) => unsub());
    };
  }, [ws, lobbyId]);

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

    const updateTimer = () => {
      const now = Date.now();
      const remaining = Math.max(0, phaseEndsAt - now);
      setTimeRemaining(remaining);
    };

    // Update immediately
    updateTimer();

    // Update every second
    const interval = setInterval(updateTimer, 1000);

    return () => clearInterval(interval);
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

    // Subscribe to prompt events
    const unsubscribers = [
      ws.subscribe<{ type: 'lobby:prompt_submitted'; userId: string; username: string }>(
        'lobby:prompt_submitted',
        (msg) => {
          console.log('Prompt submitted by:', msg.username);
          setSubmittedUserIds((prev) => new Set(prev).add(msg.userId));
        }
      ),

      ws.subscribe<{ type: 'lobby:all_prompts_ready'; promptCount: number }>(
        'lobby:all_prompts_ready',
        (msg) => {
          console.log('All prompts ready:', msg.promptCount);
          setAllPromptsReady(true);
        }
      ),

      ws.subscribe<{ type: 'game:started' }>(
        'game:started',
        () => {
          // Reset prompt tracker when game starts
          setSubmittedUserIds(new Set());
          setAllPromptsReady(false);
        }
      ),
    ];

    return () => {
      unsubscribers.forEach((unsub) => unsub());
    };
  }, [ws, lobbyId]);

  return {
    submittedUserIds,
    allPromptsReady,
    hasSubmitted: (userId: string) => submittedUserIds.has(userId),
  };
}
