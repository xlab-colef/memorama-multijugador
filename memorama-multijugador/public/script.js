const socket = io();

let myIndex = null;
let myName = "";
let players = []; // [{name, ready}, ...]
let scores = [0, 0];
let turn = 0;
let deckState = []; // estados: hidden/flipped/matched
let deckSize = 0;
let clickable = true; // evita clicks masivos

const joinBtn = document.getElementById("joinBtn");
const playerInput = document.getElementById("playerName");
const joinHint = document.getElementById("joinHint");
const startScreen = document.getElementById("start-screen");
const scoreboard = document.getElementById("scoreboard");
const turnIndicator = document.getElementById("turnIndicator");
const score1 = document.getElementById("score1");
const score2 = document.getElementById("score2");
const board = document.getElementById("game-board");

joinBtn.addEventListener("click", () => {
  myName = playerInput.value.trim() || `Jugador`;
  socket.emit("join", { name: myName });
  joinHint.textContent = "Esperando que el otro jugador presione Unirme...";
  joinBtn.disabled = true;
  playerInput.disabled = true;
});

// welcome -> te asigna índice
socket.on("welcome", (data) => {
  myIndex = data.index;
  console.log("Bienvenido:", data.name, "index:", myIndex);
});

// playersUpdated -> lista de jugadores y ready
socket.on("playersUpdated", (pl) => {
  players = pl;
  updateJoinUI();
});

// start -> servidor indica que la partida inicia
socket.on("start", (data) => {
  players = data.players.map(p => ({ name: p.name, ready: true }));
  turn = data.turn;
  deckSize = data.deckSize;
  startScreen.style.display = "none";
  scoreboard.style.display = "block";
  updateScoreboard();
  buildBoard(deckSize);
});

// estado general (cartas states, scores, turno)
socket.on("state", (s) => {
  if (s) {
    players = s.players;
    scores = s.scores;
    turn = s.turn;
    deckState = s.deckState;
    updateScoreboard();
    reconcileBoard(); // aplicar estados actuales a UI
  }
});

// cuando el servidor indica que una carta se volteó
socket.on("cardFlipped", ({ index, img }) => {
  const card = document.querySelector(`[data-index='${index}']`);
  if (!card) return;
  card.classList.add("flipped");
  card.innerHTML = `<img src="${img}" style="width:80%; height:80%;">`;
});

// matchResult -> servidor confirma match y actualiza puntajes
socket.on("matchResult", ({ i1, i2, scores: s, turn: currentTurn }) => {
  scores = s;
  turn = currentTurn;
  const c1 = document.querySelector(`[data-index='${i1}']`);
  const c2 = document.querySelector(`[data-index='${i2}']`);
  if (c1) c1.classList.add("matched");
  if (c2) c2.classList.add("matched");
  updateScoreboard();
});

// noMatch -> servidor ordena ocultar después de un tiempo en ambos clientes
socket.on("noMatch", ({ i1, i2 }) => {
  // dejar visible un rato (servidor ya espera 900ms antes de ocultar en su estado)
  setTimeout(() => {
    const c1 = document.querySelector(`[data-index='${i1}']`);
    const c2 = document.querySelector(`[data-index='${i2}']`);
    if (c1 && !c1.classList.contains("matched")) {
      c1.classList.remove("flipped"); c1.innerHTML = "";
    }
    if (c2 && !c2.classList.contains("matched")) {
      c2.classList.remove("flipped"); c2.innerHTML = "";
    }
  }, 900);
});

// turnChanged -> cambio de turno
socket.on("turnChanged", ({ turn: newTurn }) => {
  turn = newTurn;
  updateScoreboard();
});

// gameOver
socket.on("gameOver", ({ scores: s, winner }) => {
  scores = s;
  updateScoreboard();
  alert(`Fin de la partida. ${winner}`);
  // volver a pantalla de inicio para nueva partida
  startScreen.style.display = "block";
  scoreboard.style.display = "none";
  document.getElementById("joinBtn").disabled = false;
  document.getElementById("playerName").disabled = false;
  board.innerHTML = "";
});

// reset por desconexión
socket.on("reset", (msg) => {
  alert(msg || "Partida reiniciada.");
  startScreen.style.display = "block";
  scoreboard.style.display = "none";
  document.getElementById("joinBtn").disabled = false;
  document.getElementById("playerName").disabled = false;
  board.innerHTML = "";
});

// full
socket.on("full", (msg) => {
  alert(msg);
});

// Construye el tablero con N cartas (vacías)
function buildBoard(n) {
  board.innerHTML = "";
  for (let i = 0; i < n; i++) {
    const card = document.createElement("div");
    card.className = "card";
    card.dataset.index = i;
    card.onclick = () => tryFlip(i);
    board.appendChild(card);
  }
}

// Aplicar estados del servidor a las cartas actuales
function reconcileBoard() {
  const cards = document.querySelectorAll(".card");
  if (!deckState) return;
  deckState.forEach((st, i) => {
    const c = cards[i];
    if (!c) return;
    if (st === "hidden") {
      c.classList.remove("flipped", "matched");
      c.innerHTML = "";
    } else if (st === "flipped") {
      // si ya está, dejamos (img llega por cardFlipped)
      c.classList.add("flipped");
    } else if (st === "matched") {
      c.classList.add("flipped", "matched");
    }
  });
}

// Intento de voltear: el cliente solicita al servidor
function tryFlip(index) {
  if (turn !== myIndex) return;
  // evitar clicks rápidos en la misma carta
  const card = document.querySelector(`[data-index='${index}']`);
  if (!card || card.classList.contains("flipped") || card.classList.contains("matched")) return;
  socket.emit("flip", { index });
}

// UI helpers
function updateScoreboard() {
  turnIndicator.textContent = `Turno de: ${players[turn]?.name || "..."}`;
  score1.textContent = `${players[0]?.name || "Jugador 1"}: ${scores[0] ?? 0}`;
  score2.textContent = `${players[1]?.name || "Jugador 2"}: ${scores[1] ?? 0}`;
}

function updateJoinUI() {
  // muestra nombres y estado ready
  if (players.length > 0) {
    joinHint.textContent = players.map((p, i) => `${p.name} ${p.ready ? "(listo)" : "(no listo)"}`).join(" — ");
  } else {
    joinHint.textContent = "Esperando jugadores...";
  }
}
