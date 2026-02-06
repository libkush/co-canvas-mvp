import { WebSocketServer } from 'ws';
import * as Y from 'yjs';
import { setupWSConnection } from 'y-websocket/bin/utils';

const WS_PORT = process.env.WS_PORT ? parseInt(process.env.WS_PORT) : 1234;

// Create WebSocket server for Yjs
const wss = new WebSocketServer({ port: WS_PORT });

wss.on('connection', (ws, req) => {
  console.log(`📡 New WebSocket connection from ${req.socket.remoteAddress}`);
  
  // Setup Yjs WebSocket connection
  // The 'co-canvas' is the room/document name
  setupWSConnection(ws, req, {
    docName: 'co-canvas',
    gc: true, // Enable garbage collection
  });
});

wss.on('error', (error) => {
  console.error('WebSocket server error:', error);
});

console.log(`🔌 Yjs WebSocket server running on ws://localhost:${WS_PORT}`);

export { wss };
