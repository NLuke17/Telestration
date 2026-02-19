import { WSClientMessage, isWSClientMessage } from '../../types/ws';
import { logWarn } from '../../utils/logger';

export function parseEnvelope(raw: Buffer): WSClientMessage | null {
  try {
    const parsed = JSON.parse(raw.toString('utf8'));
    if (!isWSClientMessage(parsed)) {
      logWarn('Invalid message format', { parsed });
      return null;
    }
    return parsed;
  } catch (error) {
    logWarn('Failed to parse message', { error });
    return null;
  }
}

export type MessageHandler = (msg: WSClientMessage) => void | Promise<void>;

/**
 * Route message to appropriate handler
 */
export function routeMessage(
  msg: WSClientMessage,
  handlers: Map<string, MessageHandler>
): void {
  const handler = handlers.get(msg.type);
  if (!handler) {
    logWarn('No handler for message type', { type: msg.type });
    return;
  }

  try {
    const result = handler(msg);
    if (result instanceof Promise) {
      result.catch((error) => {
        logWarn('Handler error', { type: msg.type, error });
      });
    }
  } catch (error) {
    logWarn('Handler error', { type: msg.type, error });
  }
}
