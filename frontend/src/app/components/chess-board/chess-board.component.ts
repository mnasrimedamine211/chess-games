import { Component, OnInit } from '@angular/core';
import { ChessPiece } from '../../core/models/chess-piece.model';
import { GameState } from '../../core/models/game-state.model';
import { GameService } from '../../core/services/game.service';
import { CommonModule } from '@angular/common';
import { ChessPieceComponent } from '../chess-piece/chess-piece.component';
import { ReactiveFormsModule } from '@angular/forms';
import { WebSocketService } from '../../core/services/websocket.service';
import { PromotionDialogComponent } from '../promotion-dialog/promotion-dialog.component';

@Component({
  selector: 'app-chess-board',
  imports: [CommonModule, ChessPieceComponent, ReactiveFormsModule, PromotionDialogComponent],
  templateUrl: './chess-board.component.html',
  styleUrl: './chess-board.component.scss'
})
export class ChessBoardComponent implements OnInit {
  gameState: GameState | null = null;
  currentPlayer: any = null;
  selectedPiece: { row: number; col: number; piece: ChessPiece } | null = null;
  validMoves: {row: number, col: number}[] = [];
  chatMessages: {time: string, text: string}[] = [];
  
  // Promotion properties
  showPromotionDialog = false;
  promotionSquare: {row: number, col: number} | null = null;
  promotionColor: 'white' | 'black' = 'white';
  
  constructor(
    private gameService: GameService, 
    private websocketService: WebSocketService
  ) {}
  
  ngOnInit() {
    this.websocketService.connect().then(connected => {
      if (connected) {
        console.log('WebSocket connected successfully');
      } else {
        console.error('Failed to connect to WebSocket');
      }
    });

    this.gameService.gameState$.subscribe(state => {
      this.gameState = state;
    });
    
    this.gameService.currentPlayer$.subscribe(player => {
      this.currentPlayer = player;
    });
    
    this.gameService.validMoves$.subscribe(moves => {
      this.validMoves = moves;
    });
    
    this.gameService.selectedPiece$.subscribe(selectedPiece => {
      this.selectedPiece = selectedPiece;
    });
  }
  
  joinGame(playerName: string) {
    this.gameService.joinGame(playerName);
    this.addChatMessage(`Joined as ${playerName}`);
  }
  
  getPiece(row: number, col: number): ChessPiece | null {
    return this.gameState?.board?.[row]?.[col] || null;
  }
  
  onCellClick(row: number, col: number) {
    console.log(`Cell clicked: ${row},${col} (${this.getPositionLabel(row, col)})`);
    
    // If promotion dialog is showing, don't process clicks
    if (this.showPromotionDialog) return;
    
    // SIMPLE AND CLEAR LOGIC:
    
    // If we have a selected piece
    if (this.selectedPiece) {
      // Check if we're clicking on a valid move
      if (this.isValidMoveTarget(row, col)) {
        // Check if this is a pawn promotion move
        const piece = this.selectedPiece.piece;
        const isPawnPromotion = piece.type === 'pawn' && 
          ((piece.color === 'white' && row === 0) || 
           (piece.color === 'black' && row === 7));
        
        if (isPawnPromotion) {
          // Show promotion dialog
          this.promotionSquare = { row, col };
          this.promotionColor = piece.color;
          this.showPromotionDialog = true;
        } else {
          // Regular move
          console.log(`Moving selected piece to ${row},${col}`);
          this.gameService.movePiece(row, col);
        }
      } 
      // If clicking on the same selected piece, deselect it
      else if (this.selectedPiece.row === row && this.selectedPiece.col === col) {
        console.log('Deselecting same piece');
        this.gameService.deselectPiece();
      }
      // If clicking on another selectable piece, select it
      else {
        const clickedPiece = this.getPiece(row, col);
        if (clickedPiece && this.canSelect(row, col)) {
          console.log('Selecting different piece');
          this.gameService.selectPiece(row, col, clickedPiece);
        } else {
          // Clicking elsewhere - deselect
          console.log('Deselecting piece (clicked elsewhere)');
          this.gameService.deselectPiece();
        }
      }
    } 
    // If no selected piece, try to select one
    else {
      const clickedPiece = this.getPiece(row, col);
      if (clickedPiece && this.canSelect(row, col)) {
        console.log('Selecting piece');
        this.gameService.selectPiece(row, col, clickedPiece);
      }
    }
  }
  
  onPromotionSelected(promotionType: 'queen' | 'rook' | 'bishop' | 'knight') {
    if (!this.promotionSquare || !this.selectedPiece) return;
    
    // Send move with promotion
    this.gameService.movePiece(
      this.promotionSquare.row, 
      this.promotionSquare.col, 
      promotionType
    );
    
    // Close dialog
    this.showPromotionDialog = false;
    this.promotionSquare = null;
  }
  
  isSelected(row: number, col: number): boolean {
    return this.selectedPiece ? 
      this.selectedPiece.row === row && this.selectedPiece.col === col : false;
  }
  
  canSelect(row: number, col: number): boolean {
    const piece = this.getPiece(row, col);
    if (!piece || !this.currentPlayer || !this.gameState) return false;
    
    // Can select if:
    // 1. It's your piece
    // 2. It's your turn
    return piece.color === this.currentPlayer.color && 
           piece.color === this.gameState.currentTurn;
  }
  
  isValidMoveTarget(row: number, col: number): boolean {
    return this.validMoves.some(move => move.row === row && move.col === col);
  }
  
  getColumnLetter(col: number): string {
    return String.fromCharCode(65 + col);
  }
  
  getPositionLabel(row: number, col: number): string {
    return `${this.getColumnLetter(col)}${8 - row}`;
  }
  
  sendChat(text: string) {
    if (text.trim()) {
      this.gameService.sendChatMessage(text);
      this.addChatMessage(`You: ${text}`);
    }
  }
  
  private addChatMessage(text: string) {
    this.chatMessages.push({
      time: new Date().toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}),
      text: text
    });
    
    // Keep only last 20 messages
    if (this.chatMessages.length > 20) {
      this.chatMessages = this.chatMessages.slice(-20);
    }
  }

  getStatusClass(): string {
    if (!this.gameState) return '';
    
    switch (this.gameState.status) {
      case 'check': return 'status-check';
      case 'checkmate': return 'status-checkmate';
      case 'stalemate': return 'status-stalemate';
      case 'playing': return 'status-playing';
      default: return '';
    }
  }

  getStatusIcon(): string {
    if (!this.gameState) return '';
    
    switch (this.gameState.status) {
      case 'check': return '⚡';
      case 'checkmate': return '👑';
      case 'stalemate': return '🤝';
      case 'playing': return '♟️';
      default: return '';
    }
  }

  getStatusText(): string {
    if (!this.gameState) return '';
    
    switch (this.gameState.status) {
      case 'check': return 'CHECK';
      case 'checkmate': return `CHECKMATE - ${this.gameState.winner?.toUpperCase()} WINS!`;
      case 'stalemate': return 'STALEMATE - DRAW';
      case 'playing': return 'IN PROGRESS';
      default: return this.gameState.status.toUpperCase();
    }
  }
}