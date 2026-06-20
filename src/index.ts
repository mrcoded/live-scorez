import http from 'http'
import express, { Request, Response } from 'express';

import { matchRouter } from './routes/matches';
import { attachWebSocketServer } from './websocket/server';

const PORT = Number(process.env.PORT || 8000);
const HOST = process.env.HOST || "0.0.0.0";

const app = express();
const server = http.createServer(app);


// Use JSON middleware to parse incoming JSON request bodies
app.use(express.json());


// Root GET route
app.get('/api', (req: Request, res: Response) => {
  res.json({ message: 'Welcome to the live-scorez API!' });
});

app.use("/api/matches", matchRouter)

// attach websocket server
const { broadcastMatchCreated } = attachWebSocketServer(server)
app.locals.broadcastMatchCreated = broadcastMatchCreated

// Start server
server.listen(PORT, HOST, () => {
  const baseUrl = HOST === '0.0.0.0' ? `http://localhost:${PORT}` : `http://${HOST}:${PORT}`;

  //server is running at 
  console.log(`Server is running at ${baseUrl}`);
  //websocket is running at 
  console.log(`WebSocket is running at ${baseUrl.replace('http', 'ws')}/ws`);
});
