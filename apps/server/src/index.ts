import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { createServer } from 'http';
import { tidyEndpoint } from './tidy.js';

// Load environment variables
dotenv.config();

// Import and start WebSocket server for Yjs
import './ws-server.js';

const app = express();
const httpServer = createServer(app);

// Middleware
app.use(cors());
app.use(express.json());

// Health check endpoint
app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', message: 'Co-Canvas Server is running' });
});

// Smart Tidy endpoint - AI-powered clustering
app.post('/api/tidy', tidyEndpoint);

const PORT = process.env.PORT || 4000;

httpServer.listen(PORT, () => {
  console.log(`🚀 Server running on http://localhost:${PORT}`);
  console.log(`📡 API available at http://localhost:${PORT}/api`);
});

export default app;
