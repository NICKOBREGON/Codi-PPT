// Servidor de sincronización para Trauma Team Board
// - Cada "sala" = un caso. Código corto (6 caracteres).
// - No hay base de datos: el estado vive en memoria mientras la sala esté activa.
// - Cualquier cliente que manda `state` lo retransmite a los demás de su sala (broadcast).
// - Si una sala lleva 6 horas sin actividad, se limpia de memoria (por si acaso).

const http = require("http");
const { WebSocketServer } = require("ws");
const crypto = require("crypto");

const PORT = process.env.PORT || 3000;

// rooms: Map<roomCode, { clients: Set<ws>, lastState: object|null, lastActivity: number }>
const rooms = new Map();

function makeRoomCode() {
  // 6 caracteres, sin caracteres ambiguos (0/O, 1/I/l)
  const alphabet = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
  let code = "";
  for (let i = 0; i < 6; i++) {
    code += alphabet[crypto.randomInt(alphabet.length)];
  }
  return code;
}

function getOrCreateRoom(code) {
  if (!rooms.has(code)) {
    rooms.set(code, { clients: new Set(), lastState: null, lastActivity: Date.now() });
  }
  return rooms.get(code);
}

function broadcast(room, message, exceptWs) {
  const raw = JSON.stringify(message);
  for (const client of room.clients) {
    if (client !== exceptWs && client.readyState === client.OPEN) {
      client.send(raw);
    }
  }
}

// Limpieza periódica de salas inactivas (6h)
setInterval(() => {
  const now = Date.now();
  for (const [code, room] of rooms.entries()) {
    if (room.clients.size === 0 && now - room.lastActivity > 6 * 60 * 60 * 1000) {
      rooms.delete(code);
    }
  }
}, 30 * 60 * 1000);

const server = http.createServer((req, res) => {
  // Endpoint simple para crear una sala nueva desde el cliente (antes de abrir el WebSocket)
  if (req.url === "/new-room") {
    let code = makeRoomCode();
    while (rooms.has(code)) code = makeRoomCode();
    getOrCreateRoom(code);
    res.writeHead(200, { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" });
    res.end(JSON.stringify({ code }));
    return;
  }
  if (req.url === "/health") {
    res.writeHead(200, { "Content-Type": "text/plain" });
    res.end("ok");
    return;
  }
  res.writeHead(404);
  res.end();
});

const wss = new WebSocketServer({ server });

wss.on("connection", (ws, req) => {
  const url = new URL(req.url, "http://localhost");
  const roomCode = (url.searchParams.get("room") || "").toUpperCase().trim();

  if (!roomCode || roomCode.length < 4) {
    ws.close(4000, "room code required");
    return;
  }

  const room = getOrCreateRoom(roomCode);

  if (room.clients.size >= 3) {
    ws.send(JSON.stringify({ type: "error", message: "Sala llena (máximo 3 dispositivos)" }));
    ws.close(4001, "room full");
    return;
  }

  room.clients.add(ws);
  room.lastActivity = Date.now();

  // Al conectar, si ya hay un estado guardado en la sala, se lo mandamos al recién llegado
  if (room.lastState) {
    ws.send(JSON.stringify({ type: "state", state: room.lastState }));
  }

  broadcast(room, { type: "presence", count: room.clients.size }, null);

  ws.on("message", (data) => {
    let msg;
    try {
      msg = JSON.parse(data.toString());
    } catch (e) {
      return;
    }
    room.lastActivity = Date.now();

    if (msg.type === "state") {
      room.lastState = msg.state;
      broadcast(room, { type: "state", state: msg.state }, ws);
    }
  });

  ws.on("close", () => {
    room.clients.delete(ws);
    room.lastActivity = Date.now();
    if (room.clients.size > 0) {
      broadcast(room, { type: "presence", count: room.clients.size }, null);
    }
  });
});

server.listen(PORT, () => {
  console.log(`Trauma sync server escuchando en puerto ${PORT}`);
});
