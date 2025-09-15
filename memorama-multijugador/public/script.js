const socket = io();

let playerIndex = null;
let players = [];
let scores = [0, 0];
let turn = 0;

const images = [
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

let cards = [];
let flippedCards = [];

function shuffle(array) {
  return array.sort(() => Math.random() - 0.5);
}

function getPairKey(path) {
  const file = path.split("/").pop();
  return file.replace(/\d+(?=\.\w+$)/, "");
}

function setPlayerName() {
  const name = document.getElementById("playerName").value || "Jugador";
  socket.emit("setName", { index: playerIndex, name });
}

socket.on("welcome", (data) => {
  playerIndex = data.index;
  console.log("Soy", data.name);
});

socket.on("start", (data) => {
  players = data.players;
  scores = data.scores;
  turn = data.turn;
  document.getElementById("start-screen").style.display = "none";
  document.getElementById("scoreboard").style.display = "block";
  updateScoreboard();
  startGame();
});

socket.on("updatePlayers", (p) => {
  players = p;
  updateScoreboard();
});

socket.on("cardFlipped", (data) => {
  const card = document.querySelector(`[data-index='${data.index}']`);
  card.classList.add("flipped");
  card.innerHTML = `<img src="${data.img}" style="width:80%; height:80%;">`;
});

socket.on("updateScores", (data) => {
  scores = data.scores;
  turn = data.turn;
  updateScoreboard();
});

socket.on("nextTurn", (t) => {
  turn = t;
  updateScoreboard();
});

socket.on("gameOver", ({ scores, winner }) => {
  alert(`🏆 ${winner}`);
});

socket.on("reset", () => {
  document.getElementById("game-board").innerHTML = "";
});

function updateScoreboard() {
  document.getElementById("turn-indicator").textContent = "Turno de: " + (players[turn]?.name || "Esperando...");
  document.getElementById("score1").textContent = `${players[0]?.name || "Jugador 1"}: ${scores[0]}`;
  document.getElementById("score2").textContent = `${players[1]?.name || "Jugador 2"}: ${scores[1]}`;
}

function startGame() {
  cards = shuffle(images);
  const board = document.getElementById("game-board");
  board.innerHTML = "";

  cards.forEach((img, i) => {
    const card = document.createElement("div");
    card.classList.add("card");
    card.dataset.index = i;
    card.dataset.pair = getPairKey(img);
    card.onclick = () => playTurn(card, img);
    board.appendChild(card);
  });
}

function playTurn(card, img) {
  if (turn !== playerIndex || card.classList.contains("flipped")) return;

  socket.emit("flip", { index: card.dataset.index, img });
  flippedCards.push(card);

  if (flippedCards.length === 2) {
    const [c1, c2] = flippedCards;
    if (c1.dataset.pair === c2.dataset.pair) {
      c1.classList.add("matched");
      c2.classList.add("matched");
      socket.emit("match");
    } else {
      setTimeout(() => {
        c1.classList.remove("flipped");
        c1.innerHTML = "";
        c2.classList.remove("flipped");
        c2.innerHTML = "";
      }, 800);
      socket.emit("fail");
    }
    flippedCards = [];
  }
}
