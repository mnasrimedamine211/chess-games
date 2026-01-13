
export interface WebSocketMessage {
  type: 'join' | 'move' | 'chat' | 'leave' | 'state' | 'error' | 'welcome' | 'playerJoined' | 'getValidMoves' | 'validMoves' | 'promotion';
  payload: any;
  playerId?: string;
}