export interface Message {
  type: 'join' | 'move' | 'chat' | 'leave' | 'state' | 'error' | 'welcome' | 'playerJoined' | 'getValidMoves' | 'promotion';
  payload: any;
  playerId?: string;
}