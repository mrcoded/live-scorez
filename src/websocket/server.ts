import { Server } from "http";
import WebSocket, { WebSocketServer } from "ws";

import { Match, Commentary } from "@/types";
import { WSMessage } from "@/types/ws";
import { wsArcjet } from "@/config/arcjet";

interface ExtendedWebSocket extends WebSocket {
    isAlive?: boolean;
    subscriptions?: Set<number>;
}

const matchSubscriber = new Map<number, Set<ExtendedWebSocket>>();

function subscribeToMatch(matchId: number, socket: ExtendedWebSocket): void {
    if (!matchSubscriber.has(matchId)) {
        matchSubscriber.set(matchId, new Set<ExtendedWebSocket>());
    }
    matchSubscriber.get(matchId)!.add(socket);
}

function unsubscribeFromMatch(matchId: number, socket: ExtendedWebSocket): void {
    const subscribers = matchSubscriber.get(matchId);

    if (!subscribers) return;

    subscribers.delete(socket);

    if (subscribers.size === 0) {
        matchSubscriber.delete(matchId);
    }
}

function cleanupSubscription(socket: ExtendedWebSocket): void {
    if (!socket.subscriptions) return;
    for (const matchId of socket.subscriptions) {
        unsubscribeFromMatch(matchId, socket);
    }
}

function broadcastToMatch(matchId: number, payload: WSMessage): void {
    const subscribers = matchSubscriber.get(matchId);
    if (!subscribers || subscribers.size === 0) return;

    const message = JSON.stringify(payload);

    for (const client of subscribers) {
        if (client.readyState === WebSocket.OPEN) {
            client.send(message);
        }
    }
}

// send message to one client
function sendJSON(socket: ExtendedWebSocket, payload: WSMessage): void {
    if (socket.readyState !== WebSocket.OPEN) return;

    try {
        socket.send(JSON.stringify(payload));
    } catch (error) {
        console.log("Failed to send JSON", error);
    }
}

// send message to all
function broadcastToAll(wss: WebSocketServer, payload: WSMessage): void {
    for (const client of wss.clients) {
        const socket = client as ExtendedWebSocket;
        if (socket.readyState !== WebSocket.OPEN) continue;

        socket.send(JSON.stringify(payload));
    }
}

function handleMessage(socket: ExtendedWebSocket, data: WebSocket.Data): void {
    let message: { type?: string; matchId?: number } | undefined;
    try {
        message = JSON.parse(data.toString());
    } catch (error) {
        sendJSON(socket, { type: "error", message: "Invalid JSON" });
        return;
    }

    if (message?.type === "subscribe" && typeof message.matchId === "number") {
        subscribeToMatch(message.matchId, socket);
        socket.subscriptions?.add(message.matchId);
        sendJSON(socket, { type: "subscribed", matchId: message.matchId });
        return;
    }

    if (message?.type === "unsubscribe" && typeof message.matchId === "number") {
        unsubscribeFromMatch(message.matchId, socket);
        socket.subscriptions?.delete(message.matchId);
        sendJSON(socket, { type: "unsubscribed", matchId: message.matchId });
    }
}

// attach websocket server to http server
export function attachWebSocketServer(server: Server) {
    const wss = new WebSocketServer({ noServer: true, path: '/ws', maxPayload: 1024 * 1024 });

    server.on("upgrade", async (req, socket, head) => {
        const { pathname } = new URL(req.url || "", `http://${req.headers.host}`);

        if (pathname !== "/ws") {
            socket.destroy();
            return;
        }

        if (wsArcjet) {
            try {
                const decision = await wsArcjet.protect(req);

                if (decision.isDenied()) {
                    if (decision.reason.isRateLimit()) {
                        socket.write("HTTP/1.1 429 Too Many Requests\r\nConnection: close\r\nContent-Type: text/plain\r\n\r\nToo Many Requests\r\n");
                    } else {
                        socket.write("HTTP/1.1 403 Forbidden\r\nConnection: close\r\nContent-Type: text/plain\r\n\r\nForbidden\r\n");
                    }
                    socket.destroy();
                    return;
                }
            } catch (error) {
                console.error("WS upgrade middleware error", error);
                socket.write("HTTP/1.1 500 Internal Server Error\r\nConnection: close\r\nContent-Type: text/plain\r\n\r\nInternal Server Error\r\n");
                socket.destroy();
                return;
            }
        }

        wss.handleUpgrade(req, socket, head, (ws) => {
            wss.emit("connection", ws, req);
        });
    });

    // on new connection
    wss.on("connection", async (socket, req) => {
        const ws = socket as ExtendedWebSocket;

        ws.isAlive = true;
        ws.on('pong', () => { ws.isAlive = true; });

        ws.subscriptions = new Set<number>();

        sendJSON(ws, { type: "welcome" });

        ws.on("message", (data) => {
            handleMessage(ws, data);
        });

        ws.on("error", () => {
            ws.terminate();
        });

        ws.on("close", () => {
            cleanupSubscription(ws);
        });
    });

    // check if client is alive
    const interval = setInterval(() => {
        wss.clients.forEach((client) => {
            const ws = client as ExtendedWebSocket;
            if (ws.isAlive === false) return ws.terminate();

            ws.isAlive = false;
            ws.ping();
        });
    }, 30000);

    // Clean up interval on server close
    wss.on("close", () => clearInterval(interval));

    function broadcastMatchCreated(match: Match): void {
        broadcastToAll(wss, { type: "match.created", data: match });
    }

    function broadcastCommentary(matchId: number, comment: Commentary): void {
        broadcastToMatch(matchId, { type: "commentary", data: comment });
    }

    return { broadcastMatchCreated, broadcastCommentary };
}