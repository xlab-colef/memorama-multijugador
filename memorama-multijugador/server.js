const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const path = require("path");
const crypto = require("crypto");

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(express.static(path.join(__dirname, "public")));

// --- Config ---
const IMAGES = [
  "img/coyote1.png","img/coyote2.png",
  "img/lluvia1.png","img/lluvia2.png",
  "img/sol1.png","img/sol2.png",
  "img/luna1.png","img/luna2.png",
  "img/mar1.png","img/mar2.png",
  "img/matate1.png","img/matate2.png",
  "img/panga1.png","img/panga2.png",
  "img/pescador1.png","img/pescador2.png",
  "img/rio1.png","img/rio2.png",
  "img/sonaja1.png","img/sonaja2.png",
  "img/tierra1.png","img/tierra2.png",
  "img/vibora1.png","img/vibora2.png"
];

// 🔑 Todas las partidas activas
const games = {};

// --- Helpers ---
function getPairKey(path) {
  const file = path.split("/").pop();
  return file.replace(/\d+(?=\.\w+$)/, "");
}

function shuffleArray(arr) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function buildDeck() {
  const shuffled = shuffleArray(IMAGES);
  return shuffled.map((img) => ({
    img,
    pairKey: getPairKey(img),
    state: "hidden"
  }));
}

function createRoomId() {
  return crypto.randomBytes(3).toString("hex"); // ej: "a1b2c3"
}

// --- Socket.IO ---
io.on("connection", (socket) => {
  console.log("Jugador conectado:", socket.id);

  // Crear nueva sala
  socket.on("createRoom", (cb) => {
    const roomId = createRoomId();
    games[roomId] = {
      players: [],
      scores: [0, 0],
      deck: buildDeck(),
      turn: 0,
      flippedThisTurn: []
    };
    socket.join(roomId);
    cb(roomId);
  });

  // Unirse a sala existente
  socket.on("joinRoom", ({ roomId, name }, cb) => {
    const game = games[roomId];
    if (!game) return cb({ error: "Sala no encontrada" });
    if (game.players.length >= 2) return cb({ error: "Sala llena" });

    const playerIndex = game.players.length;
    game.players.push({ id: socket.id, name, ready: false });
    socket.join(roomId);

    cb({ success: true, playerIndex });

    // Notificar estado de jugadores
    io.to(roomId).emit("playersUpdated", game.players);

    // Iniciar si hay 2 jugadores
    if (game.players.length === 2) {
      game.players.forEach(p => (p.ready = true));
      game.turn = Math.floor(Math.random() * 2);
      io.to(roomId).emit("start", {
        players: game.players,
        turn: game.turn,
        deckSize: game.deck.length
      });
    }
  });

  // Voltear carta
  socket.on("flip", ({ roomId, index }) => {
    const game = games[roomId];
    if (!game) return;

    const playerIndex = game.players.findIndex(p => p.id === socket.id);
    if (playerIndex !== game.turn) return;
    const card = game.deck[index];
    if (!card || card.state !== "hidden") return;

    card.state = "flipped";
    game.flippedThisTurn.push(index);
    io.to(roomId).emit("cardFlipped", { index, img: card.img });

    if (game.flippedThisTurn.length === 2) {
      const [i1, i2] = game.flippedThisTurn;
      const c1 = game.deck[i1], c2 = game.deck[i2];

      if (c1.pairKey === c2.pairKey) {
        c1.state = c2.state = "matched";
        game.scores[game.turn]++;
        io.to(roomId).emit("matchResult", {
          i1, i2, scores: game.scores, turn: game.turn
        });
        game.flippedThisTurn = [];

        const matchedCount = game.deck.filter(c => c.state === "matched").length;
        if (matchedCount === game.deck.length) {
          let winner;
          if (game.scores[0] > game.scores[1]) winner = game.players[0].name;
          else if (game.scores[1] > game.scores[0]) winner = game.players[1].name;
          else winner = "Empate";
          io.to(roomId).emit("gameOver", { scores: game.scores, winner });
          delete games[roomId]; // liberar memoria
        }
      } else {
        io.to(roomId).emit("noMatch", { i1, i2 });
        setTimeout(() => {
          c1.state = c2.state = "hidden";
          game.turn = game.turn === 0 ? 1 : 0;
          game.flippedThisTurn = [];
          io.to(roomId).emit("turnChanged", { turn: game.turn });
        }, 900);
      }
    }
  });

  socket.on("disconnect", () => {
    console.log("Jugador desconectado:", socket.id);
    // eliminar jugador de todas las salas
    for (const [roomId, game] of Object.entries(games)) {
      game.players = game.players.filter(p => p.id !== socket.id);
      if (game.players.length < 2) {
        io.to(roomId).emit("reset", "Jugador desconectado, partida cancelada");
        delete games[roomId];
      }
    }
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Servidor corriendo en puerto ${PORT}`);
});
