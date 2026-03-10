import { WebSocket, WebSocketServer } from "ws";
import { wsArcjet } from "../arcjet.js";

/**
 * Send a JavaScript value as JSON over a WebSocket if the socket is open.
 * Serializes `payload` with JSON.stringify and sends it on `socket`; no action is taken when the socket is not open.
 * @param {WebSocket} socket - The WebSocket to send the message on.
 * @param {*} payload - The value to serialize and send as JSON.
 */
function sendJson(socket, payload) {
    if (socket.readyState !== WebSocket.OPEN) return;

    socket.send(JSON.stringify(payload))
}


/**
 * Send a JSON-serialized payload to every connected client whose socket is open.
 * @param {import("ws").WebSocketServer} wss - The WebSocket server whose clients will receive the payload.
 * @param {*} payload - A value that can be JSON-stringified; sent to each open client as the message body.
 */
function broadcast(wss, payload) {
    for (const client of wss.clients) {
        if (client.readyState !== WebSocket.OPEN) continue;
        client.send(JSON.stringify(payload))
    }
}

/**
 * Attach a WebSocket server to the given HTTP server on path "/ws" and return helpers for broadcasting events.
 *
 * If a global wsArcjet protector is available, new connections are authorized and denied connections are closed with an appropriate code and reason. For accepted connections, the socket is initialized for heartbeat pings/pongs, a welcome message is sent, and socket errors are forwarded to the console. A keepalive interval pings clients every 30 seconds and terminates dead connections; the interval is cleared when the WebSocket server closes.
 *
 * @param {import('http').Server} server - The HTTP server to bind the WebSocket server to.
 * @returns {{ broadcastMatchCreated(match: any): void }} An object exposing broadcastMatchCreated, which notifies all connected clients that a match was created by sending a `{ type: "match_created", data: match }` message.
 */
export function attachWebSocketServer(server) {
    const wss = new WebSocketServer({ server, path: "/ws", maxPayload: 1024 * 1024 })
    wss.on("connection", async (socket, req) => {
        if (wsArcjet) {
            try {
                const decision = await wsArcjet.protect(req)
                if (decision.isDenied()) {
                    const code = decision.reason.isRateLimit() ? 1013 : 1008;
                    const reason = decision.reason.isRateLimit() ? "Rate limit exceeded" : "Access denied";
                    socket.close(code, reason);
                    return;
                }
            } catch (error) {
                console.error("ws connection error", error)
                socket.close(1011, "Server security error")
                return;
            }
        }
        socket.isAlive = true;
        socket.on("pong", () => { socket.isAlive = true })
        sendJson(socket, { type: "welcome" })
        socket.on("error", console.error)
    })

    const interval = setInterval(() => {
        wss.clients.forEach((ws) => {
            if (ws.isAlive === false) return ws.terminate;
            ws.isAlive = false;
            ws.ping()
        })
    }, 30000)
    wss.on("close", () => clearInterval(interval))
    function broadcastMatchCreated(match) {
        broadcast(wss, { type: "match_created", data: match })
    }

    return { broadcastMatchCreated }
}