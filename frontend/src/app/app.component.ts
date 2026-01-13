import { CommonModule } from '@angular/common';
import { Component, OnDestroy, OnInit } from '@angular/core';
import { ChessBoardComponent } from './components/chess-board/chess-board.component';
import { WebSocketService } from './core/services/websocket.service';

@Component({
  selector: 'app-root',
 imports: [CommonModule, ChessBoardComponent],
  templateUrl: './app.component.html',
  styleUrl: './app.component.scss'
})
export class AppComponent implements OnInit, OnDestroy {
  isConnected = false;
  
  constructor(private wsService: WebSocketService) {}
  
  async ngOnInit() {
    // Connect to WebSocket server
    this.isConnected = await this.wsService.connect();
    
    if (this.isConnected) {
      console.log('Successfully connected to WebSocket server');
    } else {
      console.error('Failed to connect to WebSocket server');
    }
  }
  
  ngOnDestroy() {
    this.wsService.disconnect();
  }
}