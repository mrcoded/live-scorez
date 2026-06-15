import { Server } from "http";
import WebSocket, { WebSocketServer } from "ws";

import { Match } from "@/types";
import { WSMessage } from "@/types/ws";

interface ExtendedWebSocket extends WebSocket {
    isAlive?: boolean;
}

// send message to one client
function sendJSON(socket: ExtendedWebSocket, payload: WSMessage): void {
    if (socket.readyState !== WebSocket.OPEN) return;

    try {
        socket.send(JSON.stringify(payload));
    } catch (error) {
        console.log("Failed to send JSON", error)
    }
}

// send message to all
function broadcast(wss: WebSocketServer, payload: WSMessage): void {
    for (const client of wss.clients) {
        const socket = client as ExtendedWebSocket;
        if (socket.readyState !== WebSocket.OPEN) continue;

        socket.send(JSON.stringify(payload));
    }
}

// attach websocket server to http server
export function attachWebSocketServer(server: Server) {
    const wss = new WebSocketServer({ server, path: "/ws", maxPayload: 1024 ^ 1024 })

    // on new connection
    wss.on("connection", (socket) => {
        const ws = socket as ExtendedWebSocket;
        ws.isAlive = true;
        ws.on('pong', () => { ws.isAlive = true });

        sendJSON(ws, { type: "welcome" });

        //handle error
        ws.on("error", console.error);
    })

    // check if client is alive
    const interval = setInterval(() => {
        wss.clients.forEach((client) => {
            const ws = client as ExtendedWebSocket;
            if (ws.isAlive === false) return ws.terminate();

            ws.isAlive = false;
            ws.ping();
        });
    }, 30000)

    // Clean up interval on server close
    wss.on("close", () => clearInterval(interval))

    function broadcastMatchCreated(match: Match) {
        broadcast(wss, { type: "match.created", data: match })
    }

    // function broadcastMatchUpdate(match){
    //     broadcast(wss,{type:"match.updated", match})
    // }

    return { broadcastMatchCreated, }
}