import { ROOM_CODE_LENGTH } from '../config/constants';

export function generateRoomCode(length: number = ROOM_CODE_LENGTH): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  for (let i = 0; i < length; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
}

export function normalizeRoomCode(code: string): string {
  return code.toUpperCase().trim();
}
