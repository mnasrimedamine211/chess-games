import { Injectable } from '@angular/core';
import { Observable, Subject } from 'rxjs';
import { WebSocketMessage } from '../models/message.model';

@Injectable({
  providedIn: 'root'
})
export class WebSocketService {
  private socket!: WebSocket;
  private messageSubject = new Subject<WebSocketMessage>();
  public messages$ = this.messageSubject.asObservable();
  
  private isConnected = false;
  
  // Initialize connection immediately
  constructor() {
    this.connect();
  }
  
  connect(): Promise<boolean> {
    return new Promise((resolve) => {
      const wsUrl = `ws://localhost:3000`;
      this.socket = new WebSocket(wsUrl);
      
      this.socket.onopen = () => {
        console.log('WebSocket connected');
        this.isConnected = true;
        resolve(true);
      };
      
      this.socket.onmessage = (event) => {
        try {
          const message: WebSocketMessage = JSON.parse(event.data);
          console.log('WebSocket message received:', message);
          this.messageSubject.next(message);
        } catch (error) {
          console.error('Error parsing WebSocket message:', error);
        }
      };
      
      this.socket.onerror = (error) => {
        console.error('WebSocket error:', error);
        this.isConnected = false;
        resolve(false);
      };
      
      this.socket.onclose = () => {
        console.log('WebSocket disconnected');
        this.isConnected = false;
        // Try to reconnect after 3 seconds
        setTimeout(() => this.connect(), 3000);
      };
    });
  }
  
  send(message: WebSocketMessage): void {
    if (this.isConnected && this.socket.readyState === WebSocket.OPEN) {
      console.log('Sending WebSocket message:', message);
      this.socket.send(JSON.stringify(message));
    } else {
      console.error('WebSocket is not connected');
      // Try to reconnect
      this.connect().then(() => {
        if (this.isConnected) {
          this.socket.send(JSON.stringify(message));
        }
      });
    }
  }
  
  disconnect(): void {
    if (this.socket) {
      this.socket.close();
      this.isConnected = false;
    }
  }
  
  isConnectedToServer(): boolean {
    return this.isConnected && this.socket.readyState === WebSocket.OPEN;
  }
}