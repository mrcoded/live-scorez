import AgentAPI from "apminsight";
AgentAPI.config();

import http from "http";
import express, { Request, Response } from "express";
import cors, { CorsOptions } from "cors";

import { matchRouter } from "./routes/matches";
import { attachWebSocketServer } from "./websocket/server";
import { securityMiddleware } from "./config/arcjet";
import { commentaryRouter } from "./routes/commentary";

const PORT = Number(process.env.PORT || 8000);
const HOST = process.env.HOST || "0.0.0.0";
const hostedFrontendOrigin = (
  process.env.FRONTEND_ORIGIN ||
  process.env.FRONTEND_URL ||
  ""
).trim();
const allowedOrigins = new Set<string>(
  ["http://localhost:5137", hostedFrontendOrigin].filter(Boolean),
);

const app = express();
const server = http.createServer(app);

const corsOptions: CorsOptions = {
  origin: (origin, callback) => {
    if (!origin || allowedOrigins.has(origin)) {
      callback(null, true);
      return;
    }

    callback(new Error(`CORS blocked origin: ${origin}`));
  },
  credentials: true,
};

app.use(cors(corsOptions));

// Use JSON middleware to parse incoming JSON request bodies
app.use(express.json());

// Root GET route
app.get("/", (req: Request, res: Response) => {
  res.json({ message: "Welcome to the live-scorez API!" });
});

// Health check GET route
app.get("/health", (req: Request, res: Response) => {
  res.status(200).json({ status: "ok", timestamp: new Date().toISOString() });
});

// apply security middleware on all the routes
app.use(securityMiddleware());

app.use("/matches", matchRouter);
app.use("/matches/:id/commentary", commentaryRouter);

// attach websocket server
const { broadcastMatchCreated, broadcastCommentary } =
  attachWebSocketServer(server);
app.locals.broadcastMatchCreated = broadcastMatchCreated;
app.locals.broadcastCommentary = broadcastCommentary;

// Start server
server.listen(PORT, HOST, () => {
  const baseUrl =
    HOST === "0.0.0.0" ? `http://localhost:${PORT}` : `http://${HOST}:${PORT}`;

  //server is running at
  console.log(`Server is running at ${baseUrl}`);
  //websocket is running at
  console.log(`WebSocket is running at ${baseUrl.replace("http", "ws")}/ws`);
});
