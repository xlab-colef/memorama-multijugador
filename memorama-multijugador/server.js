const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const path = require("path");

const app = express();
const server = http.createServer(app);
const io = new Server(server);

// Assets estáticos
app.use(express.static(path.join(__dirname, "public")));

// --- CONFIG ---
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
// totalPairs = IMAGES.length / 2
// -----------------

// Estado global por sala (simplificado: 1 sala / 1 partida)
let players = []; // { id, name, ready }
let scores = [0, 0];
let turn = 0; // índice del jugador que tiene el turno
let deck = []; // array de objetos { img, pairKey, state: 'hidden'|'flipped'|'matched' }
let flippedThisTurn = []; // índices de cartas volteadas (0,1) en la comprobación
let totalPairs = IMAGES.length / 2;

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
  deck = shuffled.map((img) => ({
    img,
    pairKey: getPairKey(img),
    state: "hidden"
  }));
}

// Reinicia todo para una nueva partida (sin desconectar jugadores)
function resetGameState() {
  scores = [0, 0];
  turn = 0;
  flippedThisTurn = [];
  buildDeck();
  totalPairs = IMAGES.length / 2;
}

// Emitir estado parcial (sin exponer nada sensible) a todos
function emitState() {
  io.emit("state", {
    players: players.map(p => ({ name: p.name, ready: p.ready })),
    scores,
    turn,
    deckState: deck.map(c => c.state) // solo estados: hidden/flipped/matched
  });
}

io.on("connection", (socket) => {
  console.log("Conexión:", socket.id);

  // Limitar a 2 jugadores
  if (players.length >= 2) {
    socket.emit("full", "Sala llena");
    return;
  }

  const newPlayer = { id: socket.id, name: `Jugador ${players.length + 1}`, ready: false };
  players.push(newPlayer);
  socket.emit("welcome", { index: players.length - 1, name: newPlayer.name });

  // enviar estado actual (posible jugador 1 conectado)
  emitState();

  // El cliente envía su nombre cuando el jugador hace click en 'Unirme'
  socket.on("join", ({ name }) => {
    const idx = players.findIndex(p => p.id === socket.id);
    if (idx !== -1) {
      players[idx].name = name || players[idx].name;
      players[idx].ready = true;
      io.emit("playersUpdated", players.map(p => ({ name: p.name, ready: p.ready })));

      // Si ambos están listos, iniciar partida
      if (players.length === 2 && players.every(p => p.ready)) {
        resetGameState();
        // elegir inicio aleatorio
        turn = Math.floor(Math.random() * 2);
        io.emit("start", {
          players: players.map(p => ({ name: p.name })),
          turn,
          deckSize: deck.length
        });
        // enviar estado inicial (cartas ocultas)
        emitState();
      }
    }
  });

  // Voltear carta solicitada por cliente
  socket.on("flip", ({ index }) => {
    const playerIdx = players.findIndex(p => p.id === socket.id);
    if (playerIdx === -1) return;
    if (playerIdx !== turn) return; // no es su turno
    if (!deck[index]) return;
    if (deck[index].state !== "hidden") return; // ya volteada o emparejada

    // Voltear en el servidor y notificar a todos
    deck[index].state = "flipped";
    flippedThisTurn.push(index);
    io.emit("cardFlipped", { index, img: deck[index].img });

    // Si ya hay 2 volteadas, comprobar
    if (flippedThisTurn.length === 2) {
      const [i1, i2] = flippedThisTurn;
      const c1 = deck[i1], c2 = deck[i2];

      if (c1.pairKey === c2.pairKey) {
        // Match
        c1.state = "matched";
        c2.state = "matched";
        scores[turn] += 1;

        // Notificar match (mantener visibles)
        io.emit("matchResult", { i1, i2, scores, turn });
        flippedThisTurn = [];

        // Verificar fin de juego
        const matchedCount = deck.filter(c => c.state === "matched").length;
        if (matchedCount === deck.length) {
          // fin de juego
          let winner;
          if (scores[0] > scores[1]) winner = players[0].name;
          else if (scores[1] > scores[0]) winner = players[1].name;
          else winner = "Empate";
          io.emit("gameOver", { scores, winner });
          // resetear listo para nueva partida (mantener nombres)
          players.forEach(p => p.ready = false);
          io.emit("playersUpdated", players.map(p => ({ name: p.name, ready: p.ready })));
          // no reset inmediato del deck; espera que los jugadores vuelvan a Unirse
        } else {
          // actualizar estado
          emitState();
        }
      } else {
        // No match: esperar un poco para que los clientes vean y luego ocultar
        io.emit("noMatch", { i1, i2 });
        setTimeout(() => {
          // asegurarse de que las cartas sigan en estado flipped (nadie las cambió)
          if (deck[i1].state === "flipped") deck[i1].state = "hidden";
          if (deck[i2].state === "flipped") deck[i2].state = "hidden";

          // cambiar turno
          turn = turn === 0 ? 1 : 0;
          flippedThisTurn = [];
          io.emit("turnChanged", { turn });
          emitState();
        }, 900);
      }
    } else {
      // Solo 1 carta volteada por ahora: actualizar estado
      emitState();
    }
  });

  socket.on("disconnect", () => {
    console.log("Desconexión:", socket.id);
    players = players.filter(p => p.id !== socket.id);
    // resetear todo
    scores = [0, 0];
    deck = [];
    flippedThisTurn = [];
    players.forEach(p => p.ready = false);
    io.emit("reset", "Jugador desconectado, partida reiniciada");
    emitState();
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Servidor corriendo en puerto ${PORT}`);
});
