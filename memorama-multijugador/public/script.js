const socket = io();

let myIndex = null;
let roomId = null;
let players = [];
let scores = [0, 0];
let turn = 0;
let deckSize = 0;

const createRoomBtn = document.getElementById("createRoomBtn");
const joinRoomBtn = document.getElementById("joinRoomBtn");
const roomCodeInput = document.getElementById("roomCodeInput");
const playerNameInput = document.getElementById("playerNameInput");
const roomInfo = document.getElementById("roomInfo");

const menuScreen = document.getElementById("menu-screen");
const scoreboard = document.getElementById("scoreboard");
const board = document.getElementById("game-board");
const turnIndicator = document.getElementById("turnIndicator");
const score1 = document.getElementById("score1");
const score2 = document.getElementById("score2");

// Crear sala
createRoomBtn.onclick = () => {
  socket.emit("createRoom", (id) => {
    roomId = id;
    roomInfo.textContent = `Sala creada. Código: ${roomId}`;
  });
};

// Unirse a sala
joinRoomBtn.onclick = () => {
  const code = roomCodeInput.value.trim();
  const name = playerNameInput.value.trim() || "Jugador";
  if (!code) return alert("Escribe un código de sala");

  socket.emit("joinRoom", { roomId: code, name }, (res) => {
    if (res.error) {
      alert(res.error);
    } else {
      myIndex = res.playerIndex;
      roomId = code;
      roomInfo.textContent = `Unido a la sala ${roomId}`;
    }
  });
};

// Actualización de jugadores
socket.on("playersUpdated", (pl) => {
  players = pl;
  roomInfo.textContent = `Jugadores en la sala: ${players.map(p => p.name).join(" vs ")}`;
});

// Inicio de partida
socket.on("start", (data) => {
  players = data.players;
  turn = data.turn;
  deckSize = data.deckSize;

  menuScreen.style.display = "none";
  scoreboard.style.display = "block";
  buildBoard(deckSize);
  updateScoreboard();
});

// Carta volteada
socket.on("cardFlipped", ({ index, img }) => {
  const card = document.querySelector(`[data-index='${index}']`);
  if (!card) return;
  card.classList.add("flipped");
  card.innerHTML = `<img src="${img}" style="width:80%; height:80%;">`;
});

// Resultado de match
socket.on("matchResult", ({ i1, i2, scores: s, turn: t }) => {
  scores = s;
  turn = t;
  const c1 = document.querySelector(`[data-index='${i1}']`);
  const c2 = document.querySelector(`[data-index='${i2}']`);
  if (c1) c1.classList.add("matched");
  if (c2) c2.classList.add("matched");
  updateScoreboard();
});

// No hubo match
socket.on("noMatch", ({ i1, i2 }) => {
  setTimeout(() => {
    const c1 = document.querySelector(`[data-index='${i1}']`);
    const c2 = document.querySelector(`[data-index='${i2}']`);
    if (c1 && !c1.classList.contains("matched")) {
      c1.classList.remove("flipped");
      c1.innerHTML = "";
    }
    if (c2 && !c2.classList.contains("matched")) {
      c2.classList.remove("flipped");
      c2.innerHTML = "";
    }
  }, 900);
});

// Cambio de turno
socket.on("turnChanged", ({ turn: t }) => {
  turn = t;
  updateScoreboard();
});

// Fin de partida
socket.on("gameOver", ({ scores: s, winner }) => {
  scores = s;
  updateScoreboard();
  alert(`🏆 Ganador: ${winner}`);
  resetUI();
});

// Reset por desconexión
socket.on("reset", (msg) => {
  alert(msg);
  resetUI();
});

// --- Helpers ---
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

function tryFlip(index) {
  if (turn !== myIndex) return;
  const card = document.querySelector(`[data-index='${index}']`);
  if (!card || card.classList.contains("flipped") || card.classList.contains("matched")) return;
  socket.emit("flip", { roomId, index });
}

function updateScoreboard() {
  turnIndicator.textContent = `Turno de: ${players[turn]?.name || "..."}`;
  score1.textContent = `${players[0]?.name || "Jugador 1"}: ${scores[0]}`;
  score2.textContent = `${players[1]?.name || "Jugador 2"}: ${scores[1]}`;
}

function resetUI() {
  menuScreen.style.display = "block";
  scoreboard.style.display = "none";
  board.innerHTML = "";
  roomId = null;
  myIndex = null;
  scores = [0, 0];
  players = [];
}
