const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const path = require("path");
const crypto = require("crypto");

const app = express();
const server = http.createServer(app);

const io = new Server(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  },
  pingInterval: 25000,
  pingTimeout: 20000
});

app.use(express.static(path.join(__dirname, "public")));

// --- Catálogo de las 15 parejas Cucapá - Español ---
const ALL_PAIRS = [
  { id: "borrego",  cucapa: "mu",          spanish: "borrego",          img1: "img/borrego1.png",  img2: "img/borrego2.png" },
  { id: "coyote",   cucapa: "pei",         spanish: "coyote",           img1: "img/coyote1.png",   img2: "img/coyote2.png" },
  { id: "estrella", cucapa: "klaxp",       spanish: "estrella",         img1: "img/estrella1.png", img2: "img/estrella2.png" },
  { id: "lluvia",   cucapa: "eyp",         spanish: "lluvia",           img1: "img/lluvia1.png",   img2: "img/lluvia2.png" },
  { id: "luna",     cucapa: "lx'aa",       spanish: "luna",             img1: "img/luna1.jpeg",    img2: "img/luna2.png" },
  { id: "mar",      cucapa: "jacshilx",     spanish: "mar",              img1: "img/mar.png",       img2: "img/mar2.png" },
  { id: "matate",   cucapa: "wi-jmulx",    spanish: "matate / metate",  img1: "img/matate.png",    img2: "img/matate2.png" },
  { id: "panga",    cucapa: "kilju",       spanish: "panga / canoa",    img1: "img/panga.png",     img2: "img/panga2.png" },
  { id: "pescador", cucapa: "siilx arrar", spanish: "pescador",         img1: "img/pescardor1.png",img2: "img/pescador2.png" },
  { id: "rio",      cucapa: "jawilx",      spanish: "río",              img1: "img/rio1.png",      img2: "img/rio2.png" },
  { id: "semilla",  cucapa: "yes",         spanish: "semilla",          img1: "img/semilla1.png",  img2: "img/semilla2.png" },
  { id: "sol",      cucapa: "ñaj",         spanish: "sol",              img1: "img/sol1.png",      img2: "img/sol2.png" },
  { id: "sonaja",   cucapa: "joelma",      spanish: "sonaja",           img1: "img/sonaja1.png",   img2: "img/sonaja2.png" },
  { id: "tierra",   cucapa: "mat",         spanish: "tierra",           img1: "img/tierra1.png",   img2: "img/tierra2.png" },
  { id: "vibora",   cucapa: "awi",         spanish: "víbora",           img1: "img/vibora1.png",   img2: "img/vibora2.png" }
];

// Endpoint de salud para Render
app.get("/health", (req, res) => res.status(200).send("OK"));

// Endpoint para obtener catálogo de parejas (para glosario o juego local/solitario)
app.get("/api/pairs", (req, res) => res.json(ALL_PAIRS));

// Partidas activas en memoria
const games = {};

// --- Helpers ---
function shuffleArray(arr) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function buildDeck(pairCount = 8) {
  const count = Math.min(Math.max(4, pairCount), ALL_PAIRS.length);
  const selectedPairs = shuffleArray(ALL_PAIRS).slice(0, count);

  const rawDeck = [];
  selectedPairs.forEach((pair) => {
    rawDeck.push({
      pairId: pair.id,
      img: pair.img1,
      cucapa: pair.cucapa,
      spanish: pair.spanish,
      type: "cucapa",
      state: "hidden"
    });
    rawDeck.push({
      pairId: pair.id,
      img: pair.img2,
      cucapa: pair.cucapa,
      spanish: pair.spanish,
      type: "spanish",
      state: "hidden"
    });
  });

  return shuffleArray(rawDeck).map((card, idx) => ({ ...card, index: idx }));
}

function createRoomId() {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let code = "";
  for (let i = 0; i < 5; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
}

function getSanitizedRoom(game) {
  return {
    id: game.id,
    status: game.status,
    pairCount: game.pairCount,
    timerSeconds: game.timerSeconds,
    turn: game.turn,
    players: game.players.map((p) => ({
      id: p.id,
      name: p.name,
      avatar: p.avatar,
      isHost: p.isHost,
      score: p.score,
      connected: p.connected
    })),
    deckSize: game.deck ? game.deck.length : 0,
    rematchVotes: Object.keys(game.rematchVotes || {}).length
  };
}

function stopTurnTimer(game) {
  if (game.turnTimerInterval) {
    clearInterval(game.turnTimerInterval);
    game.turnTimerInterval = null;
  }
}

function startTurnTimer(roomId) {
  const game = games[roomId];
  if (!game || game.status !== "playing" || !game.timerSeconds || game.timerSeconds <= 0) return;

  stopTurnTimer(game);
  game.timeLeft = game.timerSeconds;
  io.to(roomId).emit("timerTick", { timeLeft: game.timeLeft });

  game.turnTimerInterval = setInterval(() => {
    const g = games[roomId];
    if (!g || g.status !== "playing") {
      if (g) stopTurnTimer(g);
      return;
    }

    g.timeLeft--;
    io.to(roomId).emit("timerTick", { timeLeft: g.timeLeft });

    if (g.timeLeft <= 0) {
      stopTurnTimer(g);
      handleTurnTimeout(roomId);
    }
  }, 1000);
}

function handleTurnTimeout(roomId) {
  const game = games[roomId];
  if (!game || game.status !== "playing") return;

  // Si había una carta volteada por este jugador, se vuelve a voltear
  if (game.flippedThisTurn.length === 1) {
    const idx = game.flippedThisTurn[0];
    if (game.deck[idx] && game.deck[idx].state === "flipped") {
      game.deck[idx].state = "hidden";
      io.to(roomId).emit("noMatch", { i1: idx, i2: null });
    }
  }
  game.flippedThisTurn = [];

  // Pasar turno
  game.turn = game.turn === 0 ? 1 : 0;
  io.to(roomId).emit("turnTimeout", {
    nextTurn: game.turn,
    message: "¡Se agotó el tiempo! Cambio de turno."
  });

  startTurnTimer(roomId);
}

function startMatch(roomId) {
  const game = games[roomId];
  if (!game) return;

  game.deck = buildDeck(game.pairCount);
  game.status = "playing";
  game.turn = Math.floor(Math.random() * 2);
  game.flippedThisTurn = [];
  game.rematchVotes = {};
  game.players.forEach((p) => (p.score = 0));

  io.to(roomId).emit("gameStarted", {
    room: getSanitizedRoom(game)
  });

  startTurnTimer(roomId);
}

// --- Socket.IO Handlers ---
io.on("connection", (socket) => {
  console.log(`[Socket] Conectado: ${socket.id}`);

  // 1. Crear Sala
  socket.on("createRoom", ({ name, avatar, pairCount, timerSeconds }, cb) => {
    let roomId = createRoomId();
    while (games[roomId]) {
      roomId = createRoomId();
    }

    const hostPlayer = {
      id: socket.id,
      name: (name || "Anfitrión").trim().slice(0, 16),
      avatar: avatar || "🐺",
      isHost: true,
      score: 0,
      connected: true
    };

    const validPairCount = [6, 8, 12, 15].includes(Number(pairCount)) ? Number(pairCount) : 8;
    const validTimer = [0, 15, 30, 45, 60].includes(Number(timerSeconds)) ? Number(timerSeconds) : 30;

    games[roomId] = {
      id: roomId,
      status: "lobby",
      pairCount: validPairCount,
      timerSeconds: validTimer,
      players: [hostPlayer],
      deck: [],
      turn: 0,
      flippedThisTurn: [],
      rematchVotes: {},
      createdAt: Date.now()
    };

    socket.join(roomId);
    socket.roomId = roomId;

    cb({
      success: true,
      roomId,
      playerIndex: 0,
      room: getSanitizedRoom(games[roomId])
    });
  });

  // 2. Unirse a Sala
  socket.on("joinRoom", ({ roomId, name, avatar }, cb) => {
    const code = (roomId || "").toUpperCase().trim();
    const game = games[code];

    if (!game) {
      return cb({ error: "No se encontró la sala. Revisa el código." });
    }
    if (game.status === "playing") {
      return cb({ error: "La partida ya está en curso." });
    }
    if (game.players.length >= 2) {
      return cb({ error: "La sala ya está llena (máximo 2 jugadores)." });
    }

    const guestPlayer = {
      id: socket.id,
      name: (name || "Jugador 2").trim().slice(0, 16),
      avatar: avatar || "☀️",
      isHost: false,
      score: 0,
      connected: true
    };

    game.players.push(guestPlayer);
    socket.join(code);
    socket.roomId = code;

    cb({
      success: true,
      roomId: code,
      playerIndex: 1,
      room: getSanitizedRoom(game)
    });

    // Notificar a todos en la sala
    io.to(code).emit("roomUpdated", getSanitizedRoom(game));
  });

  // 3. Actualizar Ajustes (Solo Host en Lobby)
  socket.on("updateSettings", ({ roomId, pairCount, timerSeconds }) => {
    const game = games[roomId];
    if (!game || game.status !== "lobby") return;
    const player = game.players.find((p) => p.id === socket.id);
    if (!player || !player.isHost) return;

    if (pairCount && [6, 8, 12, 15].includes(Number(pairCount))) {
      game.pairCount = Number(pairCount);
    }
    if (timerSeconds !== undefined && [0, 15, 30, 45, 60].includes(Number(timerSeconds))) {
      game.timerSeconds = Number(timerSeconds);
    }

    io.to(roomId).emit("roomUpdated", getSanitizedRoom(game));
  });

  // 4. Iniciar Partida (Host)
  socket.on("startGame", ({ roomId }, cb) => {
    const game = games[roomId];
    if (!game || game.status !== "lobby") return cb && cb({ error: "Sala no lista" });
    const player = game.players.find((p) => p.id === socket.id);
    if (!player || !player.isHost) return cb && cb({ error: "Solo el anfitrión puede iniciar" });
    if (game.players.length < 2) return cb && cb({ error: "Se necesitan 2 jugadores para jugar online" });

    game.status = "countdown";
    io.to(roomId).emit("gameCountdown", { seconds: 3 });

    setTimeout(() => {
      if (games[roomId] && games[roomId].status === "countdown") {
        startMatch(roomId);
      }
    }, 3000);

    if (cb) cb({ success: true });
  });

  // 5. Voltear Carta
  socket.on("flipCard", ({ roomId, index }) => {
    const game = games[roomId];
    if (!game || game.status !== "playing") return;

    const playerIndex = game.players.findIndex((p) => p.id === socket.id);
    if (playerIndex !== game.turn) return; // No es su turno

    if (game.flippedThisTurn.length >= 2) return; // Animación en proceso

    const card = game.deck[index];
    if (!card || card.state !== "hidden") return;

    card.state = "flipped";
    game.flippedThisTurn.push(index);

    io.to(roomId).emit("cardFlipped", {
      index,
      img: card.img,
      cucapa: card.cucapa,
      spanish: card.spanish,
      pairId: card.pairId
    });

    if (game.flippedThisTurn.length === 2) {
      stopTurnTimer(game);

      const [i1, i2] = game.flippedThisTurn;
      const c1 = game.deck[i1];
      const c2 = game.deck[i2];

      if (c1.pairId === c2.pairId) {
        // MATCH ENCONTRADO
        c1.state = "matched";
        c2.state = "matched";
        game.players[game.turn].score++;

        const scores = game.players.map((p) => p.score);
        io.to(roomId).emit("matchResult", {
          i1,
          i2,
          scores,
          turn: game.turn,
          pairInfo: {
            cucapa: c1.cucapa,
            spanish: c1.spanish
          }
        });

        game.flippedThisTurn = [];

        // Verificar si se completó el tablero
        const matchedCount = game.deck.filter((c) => c.state === "matched").length;
        if (matchedCount === game.deck.length) {
          game.status = "gameOver";
          stopTurnTimer(game);

          let winner = null;
          let isDraw = false;
          if (game.players[0].score > game.players[1].score) {
            winner = game.players[0].name;
          } else if (game.players[1].score > game.players[0].score) {
            winner = game.players[1].name;
          } else {
            isDraw = true;
          }

          io.to(roomId).emit("gameOver", {
            scores,
            winner,
            isDraw,
            players: game.players
          });
        } else {
          // El jugador continúa jugando
          startTurnTimer(roomId);
        }
      } else {
        // NO HUBO MATCH
        io.to(roomId).emit("noMatch", { i1, i2 });

        setTimeout(() => {
          if (!games[roomId] || games[roomId].status !== "playing") return;
          c1.state = "hidden";
          c2.state = "hidden";
          game.turn = game.turn === 0 ? 1 : 0;
          game.flippedThisTurn = [];

          io.to(roomId).emit("turnChanged", {
            turn: game.turn,
            scores: game.players.map((p) => p.score)
          });

          startTurnTimer(roomId);
        }, 1100);
      }
    }
  });

  // 6. Solicitud de Revancha
  socket.on("requestRematch", ({ roomId }) => {
    const game = games[roomId];
    if (!game || game.status !== "gameOver") return;

    game.rematchVotes[socket.id] = true;
    const player = game.players.find((p) => p.id === socket.id);
    const requestingName = player ? player.name : "Jugador";

    io.to(roomId).emit("rematchRequested", {
      requesterId: socket.id,
      requesterName: requestingName,
      votesCount: Object.keys(game.rematchVotes).length
    });

    // Si ambos votaron, reiniciar partida de inmediato
    if (Object.keys(game.rematchVotes).length >= 2) {
      startMatch(roomId);
    }
  });

  // 7. Salir de Sala
  socket.on("leaveRoom", ({ roomId }) => {
    handlePlayerExit(socket, roomId);
  });

  // 8. Desconexión
  socket.on("disconnect", () => {
    console.log(`[Socket] Desconectado: ${socket.id}`);
    if (socket.roomId) {
      handlePlayerExit(socket, socket.roomId);
    }
  });
});

function handlePlayerExit(socket, roomId) {
  const game = games[roomId];
  if (!game) return;

  const leavingIndex = game.players.findIndex((p) => p.id === socket.id);
  if (leavingIndex === -1) return;

  const leavingPlayer = game.players[leavingIndex];
  stopTurnTimer(game);

  if (game.status === "lobby") {
    // Si estaba en lobby, removerlo y actualizar o cerrar si no queda nadie
    game.players.splice(leavingIndex, 1);
    if (game.players.length === 0) {
      delete games[roomId];
    } else {
      // Si el host salió, ceder host al otro
      if (leavingPlayer.isHost && game.players[0]) {
        game.players[0].isHost = true;
      }
      io.to(roomId).emit("roomUpdated", getSanitizedRoom(game));
    }
  } else if (game.status === "playing") {
    // Si la partida estaba en curso, notificar victoria por desconexión
    const remainingPlayer = game.players.find((p) => p.id !== socket.id);
    io.to(roomId).emit("playerLeftMatch", {
      message: `${leavingPlayer.name} ha salido de la partida.`,
      winner: remainingPlayer ? remainingPlayer.name : null
    });
    delete games[roomId];
  } else if (game.status === "gameOver") {
    // En fin de juego, limpiar
    io.to(roomId).emit("playerLeftLobby", {
      message: `${leavingPlayer.name} ha abandonado la sala.`
    });
    delete games[roomId];
  }
}

// Limpieza periódica de salas huérfanas o inactivas (> 3 horas)
setInterval(() => {
  const now = Date.now();
  for (const [id, game] of Object.entries(games)) {
    if (now - game.createdAt > 3 * 60 * 60 * 1000) {
      stopTurnTimer(game);
      delete games[id];
    }
  }
}, 30 * 60 * 1000);

const PORT = process.env.PORT || 3000;
server.listen(PORT, "0.0.0.0", () => {
  console.log(`===============================================`);
  console.log(`🎮 Memorama Cucapá - Servidor Activo`);
  console.log(`📡 Puerto: ${PORT} (0.0.0.0)`);
  console.log(`🌍 Entorno: ${process.env.NODE_ENV || "development"}`);
  console.log(`===============================================`);
});

