import { ChessPiece } from '../models/ChessPiece';

export class ChessRules {
  
  // Check if a move is valid
  static isValidMove(board: (ChessPiece | null)[][], piece: ChessPiece, fromRow: number, fromCol: number, toRow: number, toCol: number): boolean {
    // Can't move to the same position
    if (fromRow === toRow && fromCol === toCol) return false;
    
    // Can't move outside the board
    if (toRow < 0 || toRow > 7 || toCol < 0 || toCol > 7) return false;
    
    // Can't capture your own piece
    const targetPiece = board[toRow][toCol];
    if (targetPiece && targetPiece.color === piece.color) return false;
    
    // Check specific piece movement rules
    let isValid = false;
    switch (piece.type) {
      case 'pawn':
        isValid = this.isValidPawnMove(board, piece, fromRow, fromCol, toRow, toCol);
        break;
      case 'rook':
        isValid = this.isValidRookMove(board, piece, fromRow, fromCol, toRow, toCol);
        break;
      case 'knight':
        isValid = this.isValidKnightMove(board, piece, fromRow, fromCol, toRow, toCol);
        break;
      case 'bishop':
        isValid = this.isValidBishopMove(board, piece, fromRow, fromCol, toRow, toCol);
        break;
      case 'queen':
        isValid = this.isValidQueenMove(board, piece, fromRow, fromCol, toRow, toCol);
        break;
      case 'king':
        isValid = this.isValidKingMove(board, piece, fromRow, fromCol, toRow, toCol);
        break;
    }
    
    if (!isValid) return false;
    
    // Simulate the move to check if it leaves king in check
    const simulatedBoard = this.simulateMove(board, fromRow, fromCol, toRow, toCol, piece);
    if (this.isKingInCheck(simulatedBoard, piece.color)) {
      return false; // Can't make a move that leaves king in check
    }
    
    return true;
  }
  
  // Get all valid moves for a piece (considering check)
  static getValidMoves(board: (ChessPiece | null)[][], piece: ChessPiece, row: number, col: number): {row: number, col: number}[] {
    const validMoves: {row: number, col: number}[] = [];
    
    // 🔥 NEW: Special handling for king (more efficient)
    if (piece.type === 'king') {
      return this.getKingValidMoves(board, piece, row, col);
    }
    
    // For other pieces, check all possible squares
    for (let toRow = 0; toRow < 8; toRow++) {
      for (let toCol = 0; toCol < 8; toCol++) {
        if (this.isValidMove(board, piece, row, col, toRow, toCol)) {
          validMoves.push({row: toRow, col: toCol});
        }
      }
    }
    
    return validMoves;
  }
  
  // 🔥 NEW: Get valid moves specifically for king
  private static getKingValidMoves(board: (ChessPiece | null)[][], king: ChessPiece, row: number, col: number): {row: number, col: number}[] {
    const validMoves: {row: number, col: number}[] = [];
    const attackedSquares = this.getAttackedSquares(board, king.color);
    
    // Check adjacent squares (king moves 1 square)
    for (let rowDiff = -1; rowDiff <= 1; rowDiff++) {
      for (let colDiff = -1; colDiff <= 1; colDiff++) {
        if (rowDiff === 0 && colDiff === 0) continue;
        
        const toRow = row + rowDiff;
        const toCol = col + colDiff;
        
        // Check if within board
        if (toRow < 0 || toRow >= 8 || toCol < 0 || toCol >= 8) continue;
        
        // Check if occupied by friendly piece
        const targetPiece = board[toRow][toCol];
        if (targetPiece && targetPiece.color === king.color) continue;
        
        // Check if square is attacked
        if (attackedSquares[toRow][toCol]) continue;
        
        // Simulate move to check for check
        const tempBoard = this.simulateMove(board, row, col, toRow, toCol, king);
        if (!this.isKingInCheck(tempBoard, king.color)) {
          validMoves.push({row: toRow, col: toCol});
        }
      }
    }
    
    // Check castling
    if (!king.hasMoved && !this.isKingInCheck(board, king.color)) {
      // Kingside castling
      if (this.isValidCastling(board, king, row, col, col + 2)) {
        validMoves.push({row: row, col: col + 2});
      }
      
      // Queenside castling
      if (this.isValidCastling(board, king, row, col, col - 2)) {
        validMoves.push({row: row, col: col - 2});
      }
    }
    
    return validMoves;
  }
  
  // Check if king is in check - FIXED VERSION
  static isKingInCheck(board: (ChessPiece | null)[][], kingColor: 'white' | 'black'): boolean {
    // Find the king
    let kingRow = -1, kingCol = -1;
    for (let row = 0; row < 8; row++) {
      for (let col = 0; col < 8; col++) {
        const piece = board[row][col];
        if (piece && piece.type === 'king' && piece.color === kingColor) {
          kingRow = row;
          kingCol = col;
          break;
        }
      }
      if (kingRow !== -1) break;
    }
    
    if (kingRow === -1) return false; // King not found (shouldn't happen)
    
    // Check if any opponent piece can attack the king
    const opponentColor = kingColor === 'white' ? 'black' : 'white';
    
    for (let row = 0; row < 8; row++) {
      for (let col = 0; col < 8; col++) {
        const piece = board[row][col];
        if (piece && piece.color === opponentColor) {
          // Check if this piece can attack the king's square
          if (this.canPieceAttackSquare(board, piece, row, col, kingRow, kingCol)) {
            return true;
          }
        }
      }
    }
    
    return false;
  }
  
  // 🔥 NEW: Check if a piece can attack a specific square (considering path blocking)
  private static canPieceAttackSquare(board: (ChessPiece | null)[][], piece: ChessPiece, fromRow: number, fromCol: number, toRow: number, toCol: number): boolean {
    // Can't attack same square
    if (fromRow === toRow && fromCol === toCol) return false;
    
    // Different checks for each piece type
    switch (piece.type) {
      case 'pawn':
        return this.canPawnAttackSquare(piece, fromRow, fromCol, toRow, toCol);
      case 'rook':
        return this.canRookAttackSquare(board, fromRow, fromCol, toRow, toCol);
      case 'knight':
        return this.canKnightAttackSquare(fromRow, fromCol, toRow, toCol);
      case 'bishop':
        return this.canBishopAttackSquare(board, fromRow, fromCol, toRow, toCol);
      case 'queen':
        return this.canQueenAttackSquare(board, fromRow, fromCol, toRow, toCol);
      case 'king':
        return this.canKingAttackSquare(fromRow, fromCol, toRow, toCol);
      default:
        return false;
    }
  }
  
  // 🔥 NEW: Pawn attack (diagonal only)
  private static canPawnAttackSquare(piece: ChessPiece, fromRow: number, fromCol: number, toRow: number, toCol: number): boolean {
    const direction = piece.color === 'white' ? -1 : 1;
    return Math.abs(toCol - fromCol) === 1 && toRow === fromRow + direction;
  }
  
  // 🔥 NEW: Rook attack (straight lines, checking path)
  private static canRookAttackSquare(board: (ChessPiece | null)[][], fromRow: number, fromCol: number, toRow: number, toCol: number): boolean {
    // Must be in same row or column
    if (fromRow !== toRow && fromCol !== toCol) return false;
    
    // Check if path is clear
    return this.isPathClear(board, fromRow, fromCol, toRow, toCol);
  }
  
  // 🔥 NEW: Knight attack (L-shape, can jump)
  private static canKnightAttackSquare(fromRow: number, fromCol: number, toRow: number, toCol: number): boolean {
    const rowDiff = Math.abs(toRow - fromRow);
    const colDiff = Math.abs(toCol - fromCol);
    return (rowDiff === 2 && colDiff === 1) || (rowDiff === 1 && colDiff === 2);
  }
  
  // 🔥 NEW: Bishop attack (diagonal, checking path)
  private static canBishopAttackSquare(board: (ChessPiece | null)[][], fromRow: number, fromCol: number, toRow: number, toCol: number): boolean {
    // Must be diagonal
    if (Math.abs(toRow - fromRow) !== Math.abs(toCol - fromCol)) return false;
    
    // Check if path is clear
    return this.isPathClear(board, fromRow, fromCol, toRow, toCol);
  }
  
  // 🔥 NEW: Queen attack (straight or diagonal, checking path)
  private static canQueenAttackSquare(board: (ChessPiece | null)[][], fromRow: number, fromCol: number, toRow: number, toCol: number): boolean {
    // Must be straight or diagonal
    const isRookMove = (fromRow === toRow || fromCol === toCol);
    const isBishopMove = (Math.abs(toRow - fromRow) === Math.abs(toCol - fromCol));
    
    if (!isRookMove && !isBishopMove) return false;
    
    // Check if path is clear
    return this.isPathClear(board, fromRow, fromCol, toRow, toCol);
  }
  
  // 🔥 NEW: King attack (1 square in any direction)
  private static canKingAttackSquare(fromRow: number, fromCol: number, toRow: number, toCol: number): boolean {
    const rowDiff = Math.abs(toRow - fromRow);
    const colDiff = Math.abs(toCol - fromCol);
    return rowDiff <= 1 && colDiff <= 1;
  }
  
  // Check for checkmate
  static isCheckmate(board: (ChessPiece | null)[][], color: 'white' | 'black'): boolean {
    // King must be in check
    if (!this.isKingInCheck(board, color)) return false;
    
    // Check if any piece of this color has a valid move
    for (let row = 0; row < 8; row++) {
      for (let col = 0; col < 8; col++) {
        const piece = board[row][col];
        if (piece && piece.color === color) {
          const validMoves = this.getValidMoves(board, piece, row, col);
          if (validMoves.length > 0) {
            return false; // There's at least one legal move
          }
        }
      }
    }
    
    return true; // No legal moves and king is in check
  }
  
  // Check for stalemate
  static isStalemate(board: (ChessPiece | null)[][], color: 'white' | 'black'): boolean {
    // King must NOT be in check
    if (this.isKingInCheck(board, color)) return false;
    
    // Check if any piece of this color has a valid move
    for (let row = 0; row < 8; row++) {
      for (let col = 0; col < 8; col++) {
        const piece = board[row][col];
        if (piece && piece.color === color) {
          const validMoves = this.getValidMoves(board, piece, row, col);
          if (validMoves.length > 0) {
            return false; // There's at least one legal move
          }
        }
      }
    }
    
    return true; // No legal moves and king is not in check
  }
  
  // Pawn movement rules
  private static isValidPawnMove(board: (ChessPiece | null)[][], piece: ChessPiece, fromRow: number, fromCol: number, toRow: number, toCol: number): boolean {
    const direction = piece.color === 'white' ? -1 : 1;
    const startRow = piece.color === 'white' ? 6 : 1;
    
    // Moving forward
    if (toCol === fromCol) {
      // Single move forward
      if (toRow === fromRow + direction && !board[toRow][toCol]) {
        return true;
      }
      
      // Double move from starting position
      if (fromRow === startRow && 
          toRow === fromRow + 2 * direction && 
          !board[fromRow + direction][fromCol] && 
          !board[toRow][toCol]) {
        return true;
      }
    }
    
    // Diagonal capture
    if (Math.abs(toCol - fromCol) === 1 && toRow === fromRow + direction) {
      const targetPiece = board[toRow][toCol];
      if (targetPiece && targetPiece.color !== piece.color) {
        return true;
      }
    }
    
    return false;
  }
  
  // Rook movement rules
  private static isValidRookMove(board: (ChessPiece | null)[][], piece: ChessPiece, fromRow: number, fromCol: number, toRow: number, toCol: number): boolean {
    // Must move in straight line
    if (fromRow !== toRow && fromCol !== toCol) return false;
    
    // Check if path is clear
    return this.isPathClear(board, fromRow, fromCol, toRow, toCol);
  }
  
  // Knight movement rules (L-shape)
  private static isValidKnightMove(board: (ChessPiece | null)[][], piece: ChessPiece, fromRow: number, fromCol: number, toRow: number, toCol: number): boolean {
    const rowDiff = Math.abs(toRow - fromRow);
    const colDiff = Math.abs(toCol - fromCol);
    
    // Knight moves in L-shape: (2,1) or (1,2)
    return (rowDiff === 2 && colDiff === 1) || (rowDiff === 1 && colDiff === 2);
  }
  
  // Bishop movement rules
  private static isValidBishopMove(board: (ChessPiece | null)[][], piece: ChessPiece, fromRow: number, fromCol: number, toRow: number, toCol: number): boolean {
    // Must move diagonally
    if (Math.abs(toRow - fromRow) !== Math.abs(toCol - fromCol)) return false;
    
    // Check if path is clear
    return this.isPathClear(board, fromRow, fromCol, toRow, toCol);
  }
  
  // Queen movement rules
  private static isValidQueenMove(board: (ChessPiece | null)[][], piece: ChessPiece, fromRow: number, fromCol: number, toRow: number, toCol: number): boolean {
    // Queen moves like rook OR bishop
    const isRookMove = (fromRow === toRow || fromCol === toCol);
    const isBishopMove = (Math.abs(toRow - fromRow) === Math.abs(toCol - fromCol));
    
    if (!isRookMove && !isBishopMove) return false;
    
    // Check if path is clear
    return this.isPathClear(board, fromRow, fromCol, toRow, toCol);
  }
  
  // 🔥 NEW: King movement rules (FIXED VERSION)
  private static isValidKingMove(board: (ChessPiece | null)[][], piece: ChessPiece, fromRow: number, fromCol: number, toRow: number, toCol: number): boolean {
    const rowDiff = Math.abs(toRow - fromRow);
    const colDiff = Math.abs(toCol - fromCol);
    
    // Normal king move (1 square in any direction)
    if (rowDiff <= 1 && colDiff <= 1) {
      // Check if destination is occupied by friendly piece
      const targetPiece = board[toRow][toCol];
      if (targetPiece && targetPiece.color === piece.color) {
        return false;
      }
      
      // Get all squares attacked by opponent
      const attackedSquares = this.getAttackedSquares(board, piece.color);
      
      // Check if destination is attacked
      if (attackedSquares[toRow][toCol]) {
        return false;
      }
      
      // Simulate the move to double-check
      const tempBoard = this.simulateMove(board, fromRow, fromCol, toRow, toCol, piece);
      return !this.isKingInCheck(tempBoard, piece.color);
    }
    
    // Castling
    if (rowDiff === 0 && colDiff === 2 && !piece.hasMoved) {
      return this.isValidCastling(board, piece, fromRow, fromCol, toCol);
    }
    
    return false;
  }
  
  // Castling validation
  private static isValidCastling(board: (ChessPiece | null)[][], king: ChessPiece, fromRow: number, fromCol: number, toCol: number): boolean {
    // Can't castle while in check
    if (this.isKingInCheck(board, king.color)) return false;
    
    const isKingside = toCol > fromCol;
    const rookCol = isKingside ? 7 : 0;
    const rook = board[fromRow][rookCol];
    
    // Check if rook exists, hasn't moved, and is same color
    if (!rook || rook.type !== 'rook' || rook.color !== king.color || rook.hasMoved) {
      return false;
    }
    
    // Check if squares between king and rook are empty
    const startCol = Math.min(fromCol, rookCol) + 1;
    const endCol = Math.max(fromCol, rookCol) - 1;
    for (let col = startCol; col <= endCol; col++) {
      if (board[fromRow][col] !== null) return false;
    }
    
    // Check if king doesn't pass through check
    const attackedSquares = this.getAttackedSquares(board, king.color);
    const step = isKingside ? 1 : -1;
    
    // Check squares king moves through
    for (let col = fromCol; col !== toCol; col += step) {
      if (attackedSquares[fromRow][col]) {
        return false;
      }
    }
    
    // Also check the square king ends up on
    if (attackedSquares[fromRow][toCol]) {
      return false;
    }
    
    return true;
  }
  
  // 🔥 NEW: Get ALL squares attacked by opponent pieces
  private static getAttackedSquares(board: (ChessPiece | null)[][], color: 'white' | 'black'): boolean[][] {
    const attacked = Array(8).fill(null).map(() => Array(8).fill(false));
    const opponentColor = color === 'white' ? 'black' : 'white';
    
    for (let row = 0; row < 8; row++) {
      for (let col = 0; col < 8; col++) {
        const piece = board[row][col];
        if (piece && piece.color === opponentColor) {
          // Mark all squares this piece attacks
          this.markAttackedSquares(board, piece, row, col, attacked);
        }
      }
    }
    
    return attacked;
  }
  
  // 🔥 NEW: Mark all squares a piece can attack
  private static markAttackedSquares(board: (ChessPiece | null)[][], piece: ChessPiece, fromRow: number, fromCol: number, attacked: boolean[][]) {
    switch (piece.type) {
      case 'pawn':
        this.markPawnAttacks(piece, fromRow, fromCol, attacked);
        break;
      case 'rook':
        this.markRookAttacks(board, fromRow, fromCol, attacked);
        break;
      case 'knight':
        this.markKnightAttacks(fromRow, fromCol, attacked);
        break;
      case 'bishop':
        this.markBishopAttacks(board, fromRow, fromCol, attacked);
        break;
      case 'queen':
        this.markQueenAttacks(board, fromRow, fromCol, attacked);
        break;
      case 'king':
        this.markKingAttacks(fromRow, fromCol, attacked);
        break;
    }
  }
  
  // 🔥 NEW: Pawn attacks (diagonal only)
  private static markPawnAttacks(piece: ChessPiece, fromRow: number, fromCol: number, attacked: boolean[][]) {
    const direction = piece.color === 'white' ? -1 : 1;
    
    // Left diagonal
    if (fromCol > 0) {
      const leftRow = fromRow + direction;
      const leftCol = fromCol - 1;
      if (leftRow >= 0 && leftRow < 8 && leftCol >= 0 && leftCol < 8) {
        attacked[leftRow][leftCol] = true;
      }
    }
    
    // Right diagonal
    if (fromCol < 7) {
      const rightRow = fromRow + direction;
      const rightCol = fromCol + 1;
      if (rightRow >= 0 && rightRow < 8 && rightCol >= 0 && rightCol < 8) {
        attacked[rightRow][rightCol] = true;
      }
    }
  }
  
  // 🔥 NEW: Rook attacks (straight lines)
  private static markRookAttacks(board: (ChessPiece | null)[][], fromRow: number, fromCol: number, attacked: boolean[][]) {
    // Up
    for (let row = fromRow - 1; row >= 0; row--) {
      attacked[row][fromCol] = true;
      if (board[row][fromCol] !== null) break; // Stop at first piece
    }
    
    // Down
    for (let row = fromRow + 1; row < 8; row++) {
      attacked[row][fromCol] = true;
      if (board[row][fromCol] !== null) break;
    }
    
    // Left
    for (let col = fromCol - 1; col >= 0; col--) {
      attacked[fromRow][col] = true;
      if (board[fromRow][col] !== null) break;
    }
    
    // Right
    for (let col = fromCol + 1; col < 8; col++) {
      attacked[fromRow][col] = true;
      if (board[fromRow][col] !== null) break;
    }
  }
  
  // 🔥 NEW: Knight attacks (L-shape)
  private static markKnightAttacks(fromRow: number, fromCol: number, attacked: boolean[][]) {
    const knightMoves = [
      [-2, -1], [-2, 1], [-1, -2], [-1, 2],
      [1, -2], [1, 2], [2, -1], [2, 1]
    ];
    
    for (const [rowDiff, colDiff] of knightMoves) {
      const toRow = fromRow + rowDiff;
      const toCol = fromCol + colDiff;
      
      if (toRow >= 0 && toRow < 8 && toCol >= 0 && toCol < 8) {
        attacked[toRow][toCol] = true;
      }
    }
  }
  
  // 🔥 NEW: Bishop attacks (diagonals)
  private static markBishopAttacks(board: (ChessPiece | null)[][], fromRow: number, fromCol: number, attacked: boolean[][]) {
    // Up-left
    for (let i = 1; fromRow - i >= 0 && fromCol - i >= 0; i++) {
      const row = fromRow - i;
      const col = fromCol - i;
      attacked[row][col] = true;
      if (board[row][col] !== null) break;
    }
    
    // Up-right
    for (let i = 1; fromRow - i >= 0 && fromCol + i < 8; i++) {
      const row = fromRow - i;
      const col = fromCol + i;
      attacked[row][col] = true;
      if (board[row][col] !== null) break;
    }
    
    // Down-left
    for (let i = 1; fromRow + i < 8 && fromCol - i >= 0; i++) {
      const row = fromRow + i;
      const col = fromCol - i;
      attacked[row][col] = true;
      if (board[row][col] !== null) break;
    }
    
    // Down-right
    for (let i = 1; fromRow + i < 8 && fromCol + i < 8; i++) {
      const row = fromRow + i;
      const col = fromCol + i;
      attacked[row][col] = true;
      if (board[row][col] !== null) break;
    }
  }
  
  // 🔥 NEW: Queen attacks (straight + diagonal)
  private static markQueenAttacks(board: (ChessPiece | null)[][], fromRow: number, fromCol: number, attacked: boolean[][]) {
    this.markRookAttacks(board, fromRow, fromCol, attacked);
    this.markBishopAttacks(board, fromRow, fromCol, attacked);
  }
  
  // 🔥 NEW: King attacks (adjacent squares)
  private static markKingAttacks(fromRow: number, fromCol: number, attacked: boolean[][]) {
    for (let rowDiff = -1; rowDiff <= 1; rowDiff++) {
      for (let colDiff = -1; colDiff <= 1; colDiff++) {
        if (rowDiff === 0 && colDiff === 0) continue;
        
        const toRow = fromRow + rowDiff;
        const toCol = fromCol + colDiff;
        
        if (toRow >= 0 && toRow < 8 && toCol >= 0 && toCol < 8) {
          attacked[toRow][toCol] = true;
        }
      }
    }
  }
  
  // Check if the path between two squares is clear
  private static isPathClear(board: (ChessPiece | null)[][], fromRow: number, fromCol: number, toRow: number, toCol: number): boolean {
    const rowStep = toRow > fromRow ? 1 : toRow < fromRow ? -1 : 0;
    const colStep = toCol > fromCol ? 1 : toCol < fromCol ? -1 : 0;
    
    let currentRow = fromRow + rowStep;
    let currentCol = fromCol + colStep;
    
    // Check all squares EXCEPT the destination square
    while (currentRow !== toRow || currentCol !== toCol) {
      if (board[currentRow][currentCol] !== null) {
        return false; // Path is blocked
      }
      currentRow += rowStep;
      currentCol += colStep;
    }
    
    return true;
  }
  
  // Simulate a move on the board (returns new board without modifying original)
  private static simulateMove(board: (ChessPiece | null)[][], fromRow: number, fromCol: number, toRow: number, toCol: number, piece: ChessPiece): (ChessPiece | null)[][] {
    // Create a deep copy of the board
    const newBoard = board.map(row => [...row]);
    
    // Make the move
    newBoard[toRow][toCol] = {...piece, row: toRow, col: toCol};
    newBoard[fromRow][fromCol] = null;
    
    return newBoard;
  }
  
  // Check if pawn can be promoted
  static canPromotePawn(piece: ChessPiece, toRow: number): boolean {
    if (piece.type !== 'pawn') return false;
    
    // White pawn reaches row 0, black pawn reaches row 7
    return (piece.color === 'white' && toRow === 0) || 
           (piece.color === 'black' && toRow === 7);
  }
  
  // Get promotion options
  static getPromotionOptions(): ChessPiece['type'][] {
    return ['queen', 'rook', 'bishop', 'knight'];
  }
  
  // 🔥 NEW: Simple test method to debug king movement
  static debugKingMoves(board: (ChessPiece | null)[][], king: ChessPiece, row: number, col: number) {
    console.log(`\n=== DEBUG KING MOVES ===`);
    console.log(`King at: ${row},${col} (${king.color})`);
    console.log(`Is king in check? ${this.isKingInCheck(board, king.color)}`);
    
    const attackedSquares = this.getAttackedSquares(board, king.color);
    console.log(`\nAttacked squares around king:`);
    
    for (let r = Math.max(0, row-1); r <= Math.min(7, row+1); r++) {
      let rowStr = '';
      for (let c = Math.max(0, col-1); c <= Math.min(7, col+1); c++) {
        if (r === row && c === col) {
          rowStr += 'K ';
        } else {
          rowStr += attackedSquares[r][c] ? 'X ' : 'O ';
        }
      }
      console.log(rowStr);
    }
    
    const validMoves = this.getValidMoves(board, king, row, col);
    console.log(`\nValid moves:`, validMoves);
    console.log(`=== END DEBUG ===\n`);
  }
}