const express = require("express");
const http = require("http");
const { Server } = require("socket.io");

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(express.static("public"));

let players = [];
let scores = [0, 0];
let turn = 0;
let matchedPairs = 0;
const totalPairs = 12;

io.on("connection", (socket) => {
  console.log("Jugador conectado:", socket.id);

  if (players.length < 2) {
    const index = players.length;
    players.push({ id: socket.id, name: `Jugador ${index + 1}` });
    socket.emit("welcome", { index, name: players[index].name });

    if (players.length === 2) {
      turn = Math.floor(Math.random() * 2);
      io.emit("start", { players, turn, scores });
    }
  } else {
    socket.emit("full", "La sala está llena");
  }

  socket.on("setName", ({ index, name }) => {
    if (players[index]) {
      players[index].name = name;
      io.emit("updatePlayers", players);
    }
  });

  socket.on("flip", (data) => {
    if (socket.id === players[turn].id) {
      io.emit("cardFlipped", data);
    }
  });

  socket.on("match", () => {
    scores[turn]++;
    matchedPairs++;
    io.emit("updateScores", { scores, turn });

    if (matchedPairs === totalPairs) {
      let winner;
      if (scores[0] > scores[1]) winner = players[0].name;
      else if (scores[1] > scores[0]) winner = players[1].name;
      else winner = "Empate";
      io.emit("gameOver", { scores, winner });
      resetGame();
    }
  });

  socket.on("fail", () => {
    turn = turn === 0 ? 1 : 0;
    io.emit("nextTurn", turn);
  });

  socket.on("disconnect", () => {
    console.log("Jugador desconectado:", socket.id);
    players = players.filter((p) => p.id !== socket.id);
    resetGame();
    io.emit("reset");
  });
});

function resetGame() {
  scores = [0, 0];
  matchedPairs = 0;
  turn = 0;
}

server.listen(3000, () => {
  console.log("Servidor corriendo en puerto 3000");
});
