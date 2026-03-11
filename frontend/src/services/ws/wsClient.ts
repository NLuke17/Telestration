/**
 * WebSocket client for real-time communication with the backend
 */

import type { WSClientMessage, WSServerMessage, WSMessageHandler } from '../../types/ws';

const WS_URL = import.meta.env.VITE_WS_URL || 'ws://localhost:8000/ws';
const RECONNECT_DELAY = 3000; // 3 seconds
const HEARTBEAT_INTERVAL = 30000; // 30 seconds

export type ConnectionStatus = 'disconnected' | 'connecting' | 'connected' | 'error';

export class WSClient {
  private ws: WebSocket | null = null;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private heartbeatTimer: ReturnType<typeof setInterval> | null = null;
  private handlers: Map<string, Set<WSMessageHandler>> = new Map();
  private status: ConnectionStatus = 'disconnected';
  private shouldReconnect = true;
  private statusListeners: Set<(status: ConnectionStatus) => void> = new Set();

  /**
   * Connect to WebSocket server
   */
  connect(): void {
    if (this.ws?.readyState === WebSocket.OPEN || this.ws?.readyState === WebSocket.CONNECTING) {
      console.log('[WSClient] Already connected or connecting');
      return;
    }

    this.setStatus('connecting');
    console.log('[WSClient] Connecting to', WS_URL);

    try {
      this.ws = new WebSocket(WS_URL);

      this.ws.onopen = () => {
        console.log('[WSClient] Connected');
        this.setStatus('connected');
        this.startHeartbeat();
        this.clearReconnectTimer();
      };

      this.ws.onmessage = (event) => {
        this.handleMessage(event.data);
      };

      this.ws.onerror = (error) => {
        console.error('[WSClient] WebSocket error:', error);
        this.setStatus('error');
      };

      this.ws.onclose = () => {
        console.log('[WSClient] Disconnected');
        this.setStatus('disconnected');
        this.stopHeartbeat();
        
        if (this.shouldReconnect) {
          this.scheduleReconnect();
        }
      };
    } catch (error) {
      console.error('[WSClient] Failed to create WebSocket:', error);
      this.setStatus('error');
      
      if (this.shouldReconnect) {
        this.scheduleReconnect();
      }
    }
  }

  /**
   * Disconnect from WebSocket server
   */
  disconnect(): void {
    console.log('[WSClient] Disconnecting...');
    this.shouldReconnect = false;
    this.clearReconnectTimer();
    this.stopHeartbeat();

    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }

    this.setStatus('disconnected');
  }

  /**
   * Send a message to the server
   */
  send(type: string, payload?: Record<string, any>): void {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      console.error('[WSClient] Cannot send message - not connected');
      return;
    }

    const message: WSClientMessage = { type, ...payload } as WSClientMessage;
    
    try {
      this.ws.send(JSON.stringify(message));
      console.log('[WSClient] Sent:', type, payload);
    } catch (error) {
      console.error('[WSClient] Failed to send message:', error);
    }
  }

  /**
   * Subscribe to a specific message type
   */
  subscribe<T extends WSServerMessage = WSServerMessage>(
    type: string,
    handler: WSMessageHandler<T>
  ): () => void {
    if (!this.handlers.has(type)) {
      this.handlers.set(type, new Set());
    }

    // Type assertion needed here due to generic constraint
    this.handlers.get(type)!.add(handler as unknown as WSMessageHandler);
    console.log('[WSClient] Subscribed to:', type);

    // Return unsubscribe function
    return () => this.unsubscribe(type, handler as unknown as WSMessageHandler);
  }

  /**
   * Unsubscribe from a specific message type
   */
  unsubscribe(type: string, handler: WSMessageHandler): void {
    const handlers = this.handlers.get(type);
    if (handlers) {
      handlers.delete(handler);
      console.log('[WSClient] Unsubscribed from:', type);

      if (handlers.size === 0) {
        this.handlers.delete(type);
      }
    }
  }

  /**
   * Subscribe to connection status changes
   */
  onStatusChange(listener: (status: ConnectionStatus) => void): () => void {
    this.statusListeners.add(listener);
    // Immediately call with current status
    listener(this.status);

    // Return unsubscribe function
    return () => {
      this.statusListeners.delete(listener);
    };
  }

  /**
   * Get current connection status
   */
  getStatus(): ConnectionStatus {
    return this.status;
  }

  /**
   * Check if connected
   */
  isConnected(): boolean {
    return this.ws?.readyState === WebSocket.OPEN;
  }

  // Private methods

  private handleMessage(data: string): void {
    try {
      const message = JSON.parse(data) as WSServerMessage;
      console.log('[WSClient] Received:', message.type, message);

      // Call handlers for this message type
      const handlers = this.handlers.get(message.type);
      if (handlers) {
        handlers.forEach((handler) => {
          try {
            handler(message);
          } catch (error) {
            console.error('[WSClient] Handler error:', error);
          }
        });
      }

      // Also call wildcard handlers (if any)
      const wildcardHandlers = this.handlers.get('*');
      if (wildcardHandlers) {
        wildcardHandlers.forEach((handler) => {
          try {
            handler(message);
          } catch (error) {
            console.error('[WSClient] Wildcard handler error:', error);
          }
        });
      }
    } catch (error) {
      console.error('[WSClient] Failed to parse message:', error);
    }
  }

  private setStatus(status: ConnectionStatus): void {
    if (this.status !== status) {
      this.status = status;
      console.log('[WSClient] Status changed to:', status);
      
      // Notify all status listeners
      this.statusListeners.forEach((listener) => {
        try {
          listener(status);
        } catch (error) {
          console.error('[WSClient] Status listener error:', error);
        }
      });
    }
  }

  private scheduleReconnect(): void {
    if (this.reconnectTimer) {
      return;
    }

    console.log(`[WSClient] Reconnecting in ${RECONNECT_DELAY}ms...`);
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      this.connect();
    }, RECONNECT_DELAY);
  }

  private clearReconnectTimer(): void {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
  }

  private startHeartbeat(): void {
    this.stopHeartbeat();
    
    this.heartbeatTimer = setInterval(() => {
      if (this.isConnected()) {
        this.send('ping');
      }
    }, HEARTBEAT_INTERVAL);
  }

  private stopHeartbeat(): void {
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer);
      this.heartbeatTimer = null;
    }
  }
}

// Singleton instance
let wsClientInstance: WSClient | null = null;

/**
 * Get the singleton WebSocket client instance
 */
export function getWSClient(): WSClient {
  if (!wsClientInstance) {
    wsClientInstance = new WSClient();
  }
  return wsClientInstance;
}

/**
 * Create a new WebSocket client instance (for testing or multiple connections)
 */
export function createWSClient(): WSClient {
  return new WSClient();
}
