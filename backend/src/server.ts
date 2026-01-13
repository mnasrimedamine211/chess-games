import { WebSocketServer, WebSocket } from 'ws';
import { createServer } from 'http';
import express from 'express';
import cors from 'cors';
import { ChessPiece } from './models/ChessPiece';
import { GameState } from './models/GameState';
import { Player } from './models/Player';
import { Message } from './models/Message';
import { ChessRules } from './servicess/ChessRules';

const app = express();
app.use(cors());
app.use(express.json());

const server = createServer(app);
const wss = new WebSocketServer({ server });

const games = new Map<string, GameState>();
const players = new Map<string, { ws: WebSocket; player: Player }>();

// Create initial board with castling rights
function createInitialBoard(): (ChessPiece | null)[][] {
  const board: (ChessPiece | null)[][] = Array(8).fill(null).map(() => Array(8).fill(null));
  
  const pieceOrder: ChessPiece['type'][] = ['rook', 'knight', 'bishop', 'queen', 'king', 'bishop', 'knight', 'rook'];
  
  // Black pieces (row 0)
  pieceOrder.forEach((type, col) => {
    board[0][col] = { 
      type, 
      color: 'black', 
      id: `black_${type}_${col}`,
      hasMoved: false,
      row: 0,
      col: col
    };
  });
  
  // Black pawns (row 1)
  for (let col = 0; col < 8; col++) {
    board[1][col] = { 
      type: 'pawn', 
      color: 'black', 
      id: `black_pawn_${col}`,
      hasMoved: false,
      row: 1,
      col: col
    };
  }
  
  // White pawns (row 6)
  for (let col = 0; col < 8; col++) {
    board[6][col] = { 
      type: 'pawn', 
      color: 'white', 
      id: `white_pawn_${col}`,
      hasMoved: false,
      row: 6,
      col: col
    };
  }
  
  // White pieces (row 7)
  pieceOrder.forEach((type, col) => {
    board[7][col] = { 
      type, 
      color: 'white', 
      id: `white_${type}_${col}`,
      hasMoved: false,
      row: 7,
      col: col
    };
  });
  
  return board;
}

function createGame(gameId: string): GameState {
  const game: GameState = {
    id: gameId,
    players: [],
    board: createInitialBoard(),
    currentTurn: 'white',
    status: 'waiting',
    castlingRights: {
      white: { kingside: true, queenside: true },
      black: { kingside: true, queenside: true }
    },
    halfMoveClock: 0,
    fullMoveNumber: 1
  };
  games.set(gameId, game);
  return game;
}

function broadcastToGame(gameId: string, message: Message, excludePlayerId?: string) {
  const game = games.get(gameId);
  if (!game) return;
  
  game.players.forEach(player => {
    const connection = players.get(player.id);
    if (connection && connection.player.id !== excludePlayerId) {
      if (connection.ws.readyState === WebSocket.OPEN) {
        connection.ws.send(JSON.stringify(message));
      }
    }
  });
}

function updateGameStatus(game: GameState) {
  // Check if king is in check
  const whiteInCheck = ChessRules.isKingInCheck(game.board, 'white');
  const blackInCheck = ChessRules.isKingInCheck(game.board, 'black');
 
  
  // Check for checkmate
  const whiteCheckmate = ChessRules.isCheckmate(game.board, 'white');
  const blackCheckmate = ChessRules.isCheckmate(game.board, 'black');
  
  // Check for stalemate
  const whiteStalemate = ChessRules.isStalemate(game.board, 'white');
  const blackStalemate = ChessRules.isStalemate(game.board, 'black');

  
  if (whiteCheckmate) {
    game.status = 'checkmate';
    game.winner = 'black';
    game.checkmate = true;
    game.check = false;
    game.stalemate = false;
  } else if (blackCheckmate) {
    game.status = 'checkmate';
    game.winner = 'white';
    game.checkmate = true;
    game.check = false;
    game.stalemate = false;
  } else if (whiteStalemate || blackStalemate) {
    game.status = 'stalemate';
    game.stalemate = true;
    game.check = false;
    game.checkmate = false;
    game.winner = undefined;
  } else if (whiteInCheck && game.currentTurn === 'white') {
    game.status = 'check';
    game.check = true;
    game.checkmate = false;
    game.stalemate = false;
  } else if (blackInCheck && game.currentTurn === 'black') {
    game.status = 'check';
    game.check = true;
    game.checkmate = false;
    game.stalemate = false;
  } else {
    game.status = 'playing';
    game.check = false;
    game.checkmate = false;
    game.stalemate = false;
    game.winner = undefined;
  }
  
  // Check 50-move rule (simplified)
  if (game.halfMoveClock >= 100) {
    game.status = 'draw';
    console.log(`  50-move rule triggered! Game is a draw.`);
  }
}
function handleJoin(ws: WebSocket, message: Message) {
  const { playerName, gameId = 'default-game' } = message.payload;
  const playerId = `player_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  
  // Get or create game
  let game = games.get(gameId);
  if (!game) {
    game = createGame(gameId);
  }
  
  // Check if game is already full
  if (game.players.length >= 2) {
    ws.send(JSON.stringify({
      type: 'error',
      payload: { message: 'Game is full' }
    }));
    return;
  }
  
  // Assign color (first joins white, second joins black)
  const color = game.players.length === 0 ? 'white' : 'black';
  
  const player: Player = {
    id: playerId,
    name: playerName || `Player ${game.players.length + 1}`,
    color,
    connectedAt: new Date()
  };
  
  // Add player to game
  game.players.push(player);
  game.status = game.players.length === 2 ? 'playing' : 'waiting';
  
  // Store connection
  players.set(playerId, { ws, player });
  
  // Send welcome message to player
  const welcomeMessage: Message = {
    type: 'welcome',
    payload: {
      playerId,
      color,
      gameId: game.id,
      board: game.board,
      currentTurn: game.currentTurn,
      players: game.players,
      status: game.status
    }
  };
  
  if (ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify(welcomeMessage));
  }
  
  // Notify other players in the game
  const playerJoinedMessage: Message = {
    type: 'playerJoined',
    payload: { 
      player, 
      totalPlayers: game.players.length 
    }
  };
  
  broadcastToGame(gameId, playerJoinedMessage, playerId);
  
  console.log(`${player.name} joined as ${color}`);
}

function handleMove(message: Message) {
  const { gameId, from, to, piece, promotion } = message.payload;
  const game = games.get(gameId);
  
  if (!game) {
    console.log('❌ Game not found:', gameId);
    return;
  }
  
  if (game.status !== 'playing') {
    console.log(`❌ Game is not in playing state. Current status: ${game.status}`);
    return;
  }
  
  // Check if it's player's turn
  if (piece.color !== game.currentTurn) {
    console.log(`❌ Not player's turn. Current turn: ${game.currentTurn}, Piece color: ${piece.color}`);
    
    // Send error to player
    const playerConnection = players.get(message.playerId!);
    if (playerConnection && playerConnection.ws.readyState === WebSocket.OPEN) {
      playerConnection.ws.send(JSON.stringify({
        type: 'error',
        payload: { 
          message: `It's not your turn. Current turn: ${game.currentTurn}` 
        }
      }));
    }
    return;
  }
  
  // Validate that the piece exists at the from position
  const actualPiece = game.board[from.row][from.col];
  if (!actualPiece) {
    console.log(`❌ No piece at from position: (${from.row},${from.col})`);
    
    const playerConnection = players.get(message.playerId!);
    if (playerConnection && playerConnection.ws.readyState === WebSocket.OPEN) {
      playerConnection.ws.send(JSON.stringify({
        type: 'error',
        payload: { 
          message: `No piece at selected position` 
        }
      }));
    }
    return;
  }
  
  if (actualPiece.id !== piece.id) {
    console.log(`❌ Piece ID mismatch. Expected: ${actualPiece.id}, Got: ${piece.id}`);
    
    const playerConnection = players.get(message.playerId!);
    if (playerConnection && playerConnection.ws.readyState === WebSocket.OPEN) {
      playerConnection.ws.send(JSON.stringify({
        type: 'error',
        payload: { 
          message: `Piece mismatch` 
        }
      }));
    }
    return;
  }
  
  // 🔥 DEBUG: Show move attempt details
  console.log(`\n=== MOVE ATTEMPT ===`);
  console.log(`Game: ${gameId}`);
  console.log(`Player: ${message.playerId}`);
  console.log(`Piece: ${piece.color} ${piece.type} at (${from.row},${from.col})`);
  console.log(`Trying to move to: (${to.row},${to.col})`);
  console.log(`Promotion choice: ${promotion || 'none'}`);
  
  // If it's a king, debug its possible moves
  if (piece.type === 'king') {
    ChessRules.debugKingMoves(game.board, piece, from.row, from.col);
  }
  
  // Validate move using chess rules
  if (!ChessRules.isValidMove(game.board, piece, from.row, from.col, to.row, to.col)) {
    console.log(`❌ Invalid move for ${piece.color} ${piece.type}`);
    
    // More detailed debugging for why move is invalid
    console.log(`Move validation details:`);
    
    // Check basic rules
    if (from.row === to.row && from.col === to.col) {
      console.log(`  - Can't move to same position`);
    }
    
    if (to.row < 0 || to.row > 7 || to.col < 0 || to.col > 7) {
      console.log(`  - Destination outside board`);
    }
    
    const targetPiece = game.board[to.row][to.col];
    if (targetPiece && targetPiece.color === piece.color) {
      console.log(`  - Can't capture own piece (${targetPiece.color} ${targetPiece.type})`);
    }
    
    // Check piece-specific movement
    let pieceMoveValid = false;
    switch (piece.type) {
      case 'pawn':
        pieceMoveValid = ChessRules['isValidPawnMove'](game.board, piece, from.row, from.col, to.row, to.col);
        break;
      case 'rook':
        pieceMoveValid = ChessRules['isValidRookMove'](game.board, piece, from.row, from.col, to.row, to.col);
        break;
      case 'knight':
        pieceMoveValid = ChessRules['isValidKnightMove'](game.board, piece, from.row, from.col, to.row, to.col);
        break;
      case 'bishop':
        pieceMoveValid = ChessRules['isValidBishopMove'](game.board, piece, from.row, from.col, to.row, to.col);
        break;
      case 'queen':
        pieceMoveValid = ChessRules['isValidQueenMove'](game.board, piece, from.row, from.col, to.row, to.col);
        break;
      case 'king':
        pieceMoveValid = ChessRules['isValidKingMove'](game.board, piece, from.row, from.col, to.row, to.col);
        break;
    }
    console.log(`  - Piece-specific move valid: ${pieceMoveValid}`);
    
    // Check if move leaves king in check
    const simulatedBoard = ChessRules['simulateMove'](game.board, from.row, from.col, to.row, to.col, piece);
    const kingInCheckAfter = ChessRules.isKingInCheck(simulatedBoard, piece.color);
    console.log(`  - Would leave king in check: ${kingInCheckAfter}`);
    
    // If it's a king move, show attacked squares
    if (piece.type === 'king') {
      const attackedSquares = ChessRules['getAttackedSquares'](game.board, piece.color);
      console.log(`  - Is destination attacked? ${attackedSquares[to.row]?.[to.col]}`);
      
      // Show all attacked squares around king
      console.log(`  Attacked squares around destination:`);
      for (let r = Math.max(0, to.row-1); r <= Math.min(7, to.row+1); r++) {
        let rowStr = '    ';
        for (let c = Math.max(0, to.col-1); c <= Math.min(7, to.col+1); c++) {
          if (r === to.row && c === to.col) {
            rowStr += 'K ';
          } else {
            rowStr += attackedSquares[r][c] ? 'X ' : 'O ';
          }
        }
        console.log(rowStr);
      }
    }
    
    // Get all valid moves for this piece
    const allValidMoves = ChessRules.getValidMoves(game.board, piece, from.row, from.col);
    console.log(`  All valid moves for this ${piece.type}:`, allValidMoves);
    
    // Send detailed error to player
    const playerConnection = players.get(message.playerId!);
    if (playerConnection && playerConnection.ws.readyState === WebSocket.OPEN) {
      playerConnection.ws.send(JSON.stringify({
        type: 'error',
        payload: { 
          message: `Invalid move for ${piece.type}`,
          debug: {
            pieceType: piece.type,
            from,
            to,
            validMoves: allValidMoves,
            pieceMoveValid,
            wouldLeaveKingInCheck: kingInCheckAfter
          }
        }
      }));
    }
    return;
  }
  
  console.log(`✅ Move is valid! Proceeding...`);
  
  // Handle special moves
  
  // 1. Handle castling
  if (piece.type === 'king' && Math.abs(to.col - from.col) === 2) {
    console.log(`🏰 Castling move detected`);
    handleCastling(game, from, to, piece);
  } 
  
  // 2. Handle en passant
  else if (piece.type === 'pawn' && from.col !== to.col && !game.board[to.row][to.col]) {
    console.log(`🎯 En passant capture detected`);
    const capturedPawnRow = piece.color === 'white' ? to.row + 1 : to.row - 1;
    game.board[capturedPawnRow][to.col] = null;
    console.log(`  Captured pawn at (${capturedPawnRow},${to.col})`);
  }
  
  // 3. Handle pawn promotion
  else if (piece.type === 'pawn' && ChessRules.canPromotePawn(piece, to.row)) {
    console.log(`👑 Pawn promotion detected`);
    const promotionType = promotion || 'queen'; // Default to queen
    console.log(`  Promoting to: ${promotionType}`);
    
    piece.type = promotionType;
    piece.id = `${piece.color}_${promotionType}_promoted_${Date.now()}`;
    
    // Add promotion to last move
    if (game.lastMove) {
      game.lastMove.promotion = promotionType;
    }
  }
  
  // Update piece position and moved status
  piece.row = to.row;
  piece.col = to.col;
  
  // Mark piece as moved (affects castling and pawn double move)
  if (!piece.hasMoved) {
    piece.hasMoved = true;
    console.log(`  Piece marked as moved`);
  }
  
  // Update castling rights if king or rook moves
  updateCastlingRights(game, piece, from);
  
  // Update board
  console.log(`  Updating board...`);
  console.log(`  Moving piece from (${from.row},${from.col}) to (${to.row},${to.col})`);
  
  game.board[to.row][to.col] = piece;
  game.board[from.row][from.col] = null;
  
  // Update half-move clock (for 50-move rule)
  if (piece.type === 'pawn' || game.board[to.row][to.col]) {
    game.halfMoveClock = 0; // Reset on pawn move or capture
    console.log(`  Reset half-move clock (pawn move or capture)`);
  } else {
    game.halfMoveClock++;
    console.log(`  Incremented half-move clock to: ${game.halfMoveClock}`);
  }
  
  // Update full move number after black's move
  if (game.currentTurn === 'black') {
    game.fullMoveNumber++;
    console.log(`  Incremented full move number to: ${game.fullMoveNumber}`);
  }
  
  // Switch turn
  const previousTurn = game.currentTurn;
  game.currentTurn = game.currentTurn === 'white' ? 'black' : 'white';
  console.log(`  Turn changed: ${previousTurn} → ${game.currentTurn}`);
  
  // Update game status (check, checkmate, stalemate)
  updateGameStatus(game);
  console.log(`  Game status updated to: ${game.status}`);
  
  if (game.check) {
    console.log(`  ⚡ CHECK! ${game.currentTurn === 'white' ? 'Black' : 'White'} king is in check!`);
  }
  if (game.checkmate) {
    console.log(`  👑 CHECKMATE! ${game.winner} wins!`);
  }
  if (game.stalemate) {
    console.log(`  🤝 STALEMATE! Game is a draw.`);
  }
  
  // Update last move
  game.lastMove = {
    from,
    to,
    piece: {...piece}, // Copy of piece
    playerId: message.playerId!,
    timestamp: new Date(),
    promotion: promotion
  };
  
  // Broadcast move to all players in game
  console.log(`  Broadcasting move to all players...`);
  const moveMessage: Message = {
    type: 'move',
    payload: {
      from,
      to,
      piece: {...piece}, // Send copy
      currentTurn: game.currentTurn,
      board: game.board,
      status: game.status,
      check: game.check,
      checkmate: game.checkmate,
      stalemate: game.stalemate,
      winner: game.winner
    }
  };
  
  broadcastToGame(gameId, moveMessage);
  
  console.log(`✅ Move completed: ${piece.color} ${piece.type} from (${from.row},${from.col}) to (${to.row},${to.col})`);
  
  // Log board state for debugging
  console.log(`\n📊 Current board state:`);
  for (let row = 0; row < 8; row++) {
    let rowStr = '';
    for (let col = 0; col < 8; col++) {
      const p = game.board[row][col];
      if (!p) {
        rowStr += '. ';
      } else {
        const pieceChar = p.type === 'knight' ? 'N' : p.type.charAt(0).toUpperCase();
        rowStr += p.color === 'white' ? pieceChar : pieceChar.toLowerCase();
        rowStr += ' ';
      }
    }
    console.log(`${8-row}: ${rowStr}`);
  }
  console.log(`   a b c d e f g h`);
  console.log(`=== MOVE COMPLETE ===\n`);
}

// Helper functions used in handleMove:


function handleCastling(game: GameState, from: {row: number, col: number}, to: {row: number, col: number}, king: ChessPiece) {
  const isKingside = to.col > from.col;
  const rookFromCol = isKingside ? 7 : 0;
  const rookToCol = isKingside ? to.col - 1 : to.col + 1;

  
  // Move the rook
  const rook = game.board[from.row][rookFromCol];
  if (rook && rook.type === 'rook') {
    rook.row = from.row;
    rook.col = rookToCol;
    rook.hasMoved = true;
    game.board[from.row][rookToCol] = rook;
    game.board[from.row][rookFromCol] = null;
    
 
    
    // Update last move to indicate castling
    if (game.lastMove) {
      game.lastMove.isCastle = true;
    }
  } else {
    console.log(`  ❌ ERROR: Rook not found at (${from.row},${rookFromCol})`);
  }
}


function updateCastlingRights(game: GameState, piece: ChessPiece, from: {row: number, col: number}) {
  if (piece.type === 'king') {
    if (piece.color === 'white') {
 
      game.castlingRights.white.kingside = false;
      game.castlingRights.white.queenside = false;
 
    } else {

      game.castlingRights.black.kingside = false;
      game.castlingRights.black.queenside = false;
     
    }
  } else if (piece.type === 'rook') {
    if (piece.color === 'white') {
      if (from.col === 0 && game.castlingRights.white.queenside) {
        game.castlingRights.white.queenside = false;

      }
      if (from.col === 7 && game.castlingRights.white.kingside) {
        game.castlingRights.white.kingside = false;
    
      }
    } else {
      if (from.col === 0 && game.castlingRights.black.queenside) {
        game.castlingRights.black.queenside = false;
 
      }
      if (from.col === 7 && game.castlingRights.black.kingside) {
        game.castlingRights.black.kingside = false;
       
      }
    }
  }
}

function handleGetValidMoves(message: Message) {
  const { gameId, row, col } = message.payload;
  const game = games.get(gameId);
  
  if (!game) return;
  
  const piece = game.board[row][col];
  if (!piece || piece.color !== game.currentTurn) {
    return;
  }
  
  const validMoves = ChessRules.getValidMoves(game.board, piece, row, col);
  
  // Send valid moves back to requesting player
  const playerConnection = players.get(message.playerId!);
  if (playerConnection && playerConnection.ws.readyState === WebSocket.OPEN) {
    playerConnection.ws.send(JSON.stringify({
      type: 'validMoves',
      payload: {
        piece,
        validMoves
      }
    }));
  }
}

function handlePromotion(message: Message) {
  const { gameId, row, col, promotionType } = message.payload;
  const game = games.get(gameId);
  
  if (!game) return;
  
  const piece = game.board[row][col];
  if (piece && piece.type === 'pawn') {
    piece.type = promotionType;
    piece.id = `${piece.color}_${promotionType}_promoted_${Date.now()}`;
    
    // Update game status
    updateGameStatus(game);
    
    // Broadcast updated board
    broadcastToGame(gameId, {
      type: 'promotion',
      payload: {
        row,
        col,
        piece,
        board: game.board,
        status: game.status
      }
    });
  }
}

function handleChat(message: Message) {
  const { gameId, text } = message.payload;
  broadcastToGame(gameId, {
    type: 'chat',
    payload: {
      playerId: message.playerId,
      text,
      timestamp: new Date().toISOString()
    }
  });
}

function handleMessage(ws: WebSocket, message: Message) {
  switch (message.type) {
    case 'join':
      handleJoin(ws, message);
      break;
    case 'move':
      handleMove(message);
      break;
    case 'chat':
      handleChat(message);
      break;
    case 'getValidMoves':
      handleGetValidMoves(message);
      break;
    case 'promotion':
      handlePromotion(message);
      break;
  }
}

wss.on('connection', (ws: WebSocket) => {
  console.log('New client connected');
  
  ws.on('message', (data: string) => {
    try {
      const message: Message = JSON.parse(data);
      handleMessage(ws, message);
    } catch (error) {
      console.error('Error parsing message:', error);
    }
  });
  
  ws.on('close', () => {
    // Find and remove disconnected player
    let disconnectedPlayerId: string | null = null;
    for (const [playerId, connection] of players.entries()) {
      if (connection.ws === ws) {
        disconnectedPlayerId = playerId;
        break;
      }
    }
    
    if (disconnectedPlayerId) {
      players.delete(disconnectedPlayerId);
      console.log(`Player ${disconnectedPlayerId} disconnected`);
    }
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
  console.log(`WebSocket server ready on ws://localhost:${PORT}`);
});