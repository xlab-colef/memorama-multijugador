// ==========================================================================
// Memorama Cucapá - Cliente Web Multijugador
// ==========================================================================

// --- Catálogo de Parejas Base (Respaldo offline y glosario) ---
const DEFAULT_PAIRS = [
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

let pairsCatalog = [...DEFAULT_PAIRS];

// Intentar actualizar catálogo desde la API del servidor
fetch("/api/pairs")
  .then((res) => (res.ok ? res.json() : Promise.reject()))
  .then((data) => {
    if (Array.isArray(data) && data.length > 0) pairsCatalog = data;
    renderGlossary();
  })
  .catch(() => renderGlossary());

// ==========================================================================
// 1. Motor de Audio Sintetizado (Web Audio API - Sin archivos externos)
// ==========================================================================
class SoundFX {
  constructor() {
    this.ctx = null;
    this.enabled = localStorage.getItem("cucapa_sound") !== "false";
  }

  init() {
    if (!this.ctx) {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (AudioCtx) this.ctx = new AudioCtx();
    }
    if (this.ctx && this.ctx.state === "suspended") {
      this.ctx.resume();
    }
  }

  toggle() {
    this.enabled = !this.enabled;
    localStorage.setItem("cucapa_sound", this.enabled);
    return this.enabled;
  }

  playFlip() {
    if (!this.enabled) return;
    this.init();
    if (!this.ctx) return;

    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    const now = this.ctx.currentTime;

    osc.type = "sine";
    osc.frequency.setValueAtTime(360, now);
    osc.frequency.exponentialRampToValueAtTime(140, now + 0.08);

    gain.gain.setValueAtTime(0.12, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.08);

    osc.connect(gain);
    gain.connect(this.ctx.destination);

    osc.start(now);
    osc.stop(now + 0.09);
  }

  playMatch() {
    if (!this.enabled) return;
    this.init();
    if (!this.ctx) return;

    const notes = [523.25, 659.25, 783.99]; // C5, E5, G5 (Acorde Mayor)
    notes.forEach((freq, i) => {
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      const now = this.ctx.currentTime + i * 0.08;

      osc.type = "triangle";
      osc.frequency.setValueAtTime(freq, now);

      gain.gain.setValueAtTime(0.15, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.45);

      osc.connect(gain);
      gain.connect(this.ctx.destination);

      osc.start(now);
      osc.stop(now + 0.5);
    });
  }

  playMismatch() {
    if (!this.enabled) return;
    this.init();
    if (!this.ctx) return;

    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    const now = this.ctx.currentTime;

    osc.type = "sawtooth";
    osc.frequency.setValueAtTime(220, now);
    osc.frequency.exponentialRampToValueAtTime(160, now + 0.18);

    gain.gain.setValueAtTime(0.08, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.2);

    osc.connect(gain);
    gain.connect(this.ctx.destination);

    osc.start(now);
    osc.stop(now + 0.22);
  }

  playVictory() {
    if (!this.enabled) return;
    this.init();
    if (!this.ctx) return;

    const arpeggio = [261.63, 329.63, 392.00, 523.25, 659.25, 783.99, 1046.50];
    arpeggio.forEach((freq, idx) => {
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      const now = this.ctx.currentTime + idx * 0.09;

      osc.type = "triangle";
      osc.frequency.setValueAtTime(freq, now);

      gain.gain.setValueAtTime(0.2, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.6);

      osc.connect(gain);
      gain.connect(this.ctx.destination);

      osc.start(now);
      osc.stop(now + 0.65);
    });
  }

  playTick() {
    if (!this.enabled) return;
    this.init();
    if (!this.ctx) return;

    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    const now = this.ctx.currentTime;

    osc.type = "sine";
    osc.frequency.setValueAtTime(800, now);

    gain.gain.setValueAtTime(0.05, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.04);

    osc.connect(gain);
    gain.connect(this.ctx.destination);

    osc.start(now);
    osc.stop(now + 0.05);
  }
}

const Sound = new SoundFX();

// ==========================================================================
// 2. Efecto de Confeti (Canvas Nativo)
// ==========================================================================
class ConfettiEngine {
  constructor(canvasId) {
    this.canvas = document.getElementById(canvasId);
    this.ctx = this.canvas.getContext("2d");
    this.particles = [];
    this.animId = null;
    this.resize();
    window.addEventListener("resize", () => this.resize());
  }

  resize() {
    this.canvas.width = window.innerWidth;
    this.canvas.height = window.innerHeight;
  }

  burst(count = 100) {
    this.particles = [];
    const colors = ["#d97736", "#06b6d4", "#f59e0b", "#fefae0", "#10b981", "#ec4899"];

    for (let i = 0; i < count; i++) {
      this.particles.push({
        x: this.canvas.width / 2,
        y: this.canvas.height / 2,
        w: Math.random() * 9 + 4,
        h: Math.random() * 6 + 3,
        color: colors[Math.floor(Math.random() * colors.length)],
        vx: (Math.random() - 0.5) * 16,
        vy: (Math.random() - 0.7) * 16,
        rot: Math.random() * 360,
        rotSpeed: (Math.random() - 0.5) * 10,
        gravity: 0.35,
        alpha: 1,
        decay: Math.random() * 0.008 + 0.005
      });
    }

    if (!this.animId) this.animate();
  }

  animate() {
    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];
      p.x += p.vx;
      p.y += p.vy;
      p.vy += p.gravity;
      p.rot += p.rotSpeed;
      p.alpha -= p.decay;

      if (p.alpha <= 0) {
        this.particles.splice(i, 1);
        continue;
      }

      this.ctx.save();
      this.ctx.globalAlpha = p.alpha;
      this.ctx.translate(p.x, p.y);
      this.ctx.rotate((p.rot * Math.PI) / 180);
      this.ctx.fillStyle = p.color;
      this.ctx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h);
      this.ctx.restore();
    }

    if (this.particles.length > 0) {
      this.animId = requestAnimationFrame(() => this.animate());
    } else {
      this.animId = null;
      this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    }
  }

  clear() {
    if (this.animId) cancelAnimationFrame(this.animId);
    this.animId = null;
    this.particles = [];
    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
  }
}

const Confetti = new ConfettiEngine("confetti-canvas");

// ==========================================================================
// 3. Estado de la Aplicación
// ==========================================================================
const socket = io();

const state = {
  mode: "online", // "online" | "local" | "solo"
  
  // Online
  roomId: null,
  myIndex: null,
  roomData: null,
  onlineTimerSeconds: 30,

  // Local
  localPlayers: [
    { name: "Jugador 1", avatar: "🐺", score: 0 },
    { name: "Jugador 2", avatar: "🌊", score: 0 }
  ],
  localTurn: 0,
  localDeck: [],
  localFlipped: [],
  localIsBusy: false,

  // Solo
  soloDeck: [],
  soloFlipped: [],
  soloFlips: 0,
  soloStartTime: null,
  soloTimerInterval: null,
  soloMatchedPairs: 0,
  soloTotalPairs: 0,
  soloIsBusy: false
};

// ==========================================================================
// 4. Elementos del DOM
// ==========================================================================
const DOM = {
  // Pantallas
  screenMenu: document.getElementById("screen-menu"),
  screenLobby: document.getElementById("screen-lobby"),
  screenGame: document.getElementById("screen-game"),

  // Audio & Header
  btnSoundToggle: document.getElementById("btn-sound-toggle"),
  soundIcon: document.getElementById("sound-icon"),
  btnOpenGlossary: document.getElementById("btn-open-glossary"),
  btnOpenCredits: document.getElementById("btn-open-credits"),

  // Tabs
  tabOnline: document.getElementById("tab-online"),
  tabLocal: document.getElementById("tab-local"),
  tabSolo: document.getElementById("tab-solo"),
  panelOnline: document.getElementById("panel-online"),
  panelLocal: document.getElementById("panel-local"),
  panelSolo: document.getElementById("panel-solo"),

  // Form Online
  createName: document.getElementById("create-name"),
  createAvatarDisplay: document.getElementById("create-avatar-display"),
  createAvatarPicker: document.getElementById("create-avatar-picker"),
  createPairs: document.getElementById("create-pairs"),
  createTimer: document.getElementById("create-timer"),
  btnCreateRoom: document.getElementById("btn-create-room"),

  joinCode: document.getElementById("join-code"),
  joinName: document.getElementById("join-name"),
  joinAvatarDisplay: document.getElementById("join-avatar-display"),
  joinAvatarPicker: document.getElementById("join-avatar-picker"),
  btnJoinRoom: document.getElementById("btn-join-room"),

  // Form Local
  localP1Name: document.getElementById("local-p1-name"),
  localP2Name: document.getElementById("local-p2-name"),
  localPairs: document.getElementById("local-pairs"),
  btnStartLocal: document.getElementById("btn-start-local"),

  // Form Solo
  soloPairs: document.getElementById("solo-pairs"),
  soloBestTime: document.getElementById("solo-best-time"),
  btnStartSolo: document.getElementById("btn-start-solo"),

  // Lobby
  lobbyCodeDisplay: document.getElementById("lobby-code-display"),
  btnCopyCode: document.getElementById("btn-copy-code"),
  btnCopyLink: document.getElementById("btn-copy-link"),
  copyStatus: document.getElementById("copy-status"),
  lobbyPlayer0: document.getElementById("lobby-player-0"),
  lobbyPlayer1: document.getElementById("lobby-player-1"),
  lobbyPairsDisplay: document.getElementById("lobby-pairs-display"),
  lobbyTimerDisplay: document.getElementById("lobby-timer-display"),
  btnLeaveLobby: document.getElementById("btn-leave-lobby"),
  btnStartOnlineMatch: document.getElementById("btn-start-online-match"),

  // Countdown
  countdownOverlay: document.getElementById("countdown-overlay"),
  countdownNumber: document.getElementById("countdown-number"),

  // HUD
  hudP1: document.getElementById("hud-p1"),
  hudP1Avatar: document.getElementById("hud-p1-avatar"),
  hudP1Name: document.getElementById("hud-p1-name"),
  hudP1Score: document.getElementById("hud-p1-score"),

  hudP2: document.getElementById("hud-p2"),
  hudP2Avatar: document.getElementById("hud-p2-avatar"),
  hudP2Name: document.getElementById("hud-p2-name"),
  hudP2Score: document.getElementById("hud-p2-score"),

  turnBanner: document.getElementById("turn-banner"),
  turnText: document.getElementById("turn-text"),
  timerContainer: document.getElementById("timer-container"),
  timerBarFill: document.getElementById("timer-bar-fill"),
  timerText: document.getElementById("timer-text"),

  soloStats: document.getElementById("solo-stats"),
  soloStopwatch: document.getElementById("solo-stopwatch"),
  soloFlipsCount: document.getElementById("solo-flips-count"),

  gameBoard: document.getElementById("game-board"),
  pairsLeftCount: document.getElementById("pairs-left-count"),
  btnQuitGame: document.getElementById("btn-quit-game"),

  // Toast
  matchToast: document.getElementById("match-toast"),
  toastCucapa: document.getElementById("toast-cucapa"),
  toastSpanish: document.getElementById("toast-spanish"),

  // Modales
  modalGameover: document.getElementById("modal-gameover"),
  gameoverTitle: document.getElementById("gameover-title"),
  gameoverSubtitle: document.getElementById("gameover-subtitle"),
  gameoverScores: document.getElementById("gameover-scores"),
  rematchStatusMsg: document.getElementById("rematch-status-msg"),
  btnRequestRematch: document.getElementById("btn-request-rematch"),
  btnExitToMenu: document.getElementById("btn-exit-to-menu"),

  modalGlossary: document.getElementById("modal-glossary"),
  glossaryGrid: document.getElementById("glossary-grid"),
  glossarySearch: document.getElementById("glossary-search"),
  btnCloseGlossary: document.getElementById("btn-close-glossary"),

  modalCredits: document.getElementById("modal-credits"),
  btnCloseCredits: document.getElementById("btn-close-credits")
};

// ==========================================================================
// 5. Configuración de Avatares y Dropdowns
// ==========================================================================
const AVATARS = ["🐺", "☀️", "🌊", "🐍", "🌙", "🚣", "🐏", "⭐", "🌾", "🔥", "🦅", "🌽"];

function setupAvatarPickers() {
  const configs = [
    { display: DOM.createAvatarDisplay, picker: DOM.createAvatarPicker },
    { display: DOM.joinAvatarDisplay, picker: DOM.joinAvatarPicker }
  ];

  configs.forEach(({ display, picker }) => {
    picker.innerHTML = "";
    AVATARS.forEach((emoji) => {
      const opt = document.createElement("div");
      opt.className = "avatar-option";
      opt.textContent = emoji;
      opt.onclick = (e) => {
        e.stopPropagation();
        display.textContent = emoji;
        picker.classList.remove("open");
      };
      picker.appendChild(opt);
    });

    display.onclick = (e) => {
      e.stopPropagation();
      document.querySelectorAll(".avatar-dropdown").forEach((d) => {
        if (d !== picker) d.classList.remove("open");
      });
      picker.classList.toggle("open");
    };
  });

  document.addEventListener("click", () => {
    document.querySelectorAll(".avatar-dropdown").forEach((d) => d.classList.remove("open"));
  });
}

// ==========================================================================
// 6. Navegación entre Pantallas
// ==========================================================================
function switchScreen(screenName) {
  [DOM.screenMenu, DOM.screenLobby, DOM.screenGame].forEach((s) => s.classList.remove("active"));
  Confetti.clear();

  if (screenName === "menu") DOM.screenMenu.classList.add("active");
  if (screenName === "lobby") DOM.screenLobby.classList.add("active");
  if (screenName === "game") DOM.screenGame.classList.add("active");
}

function switchTab(mode) {
  state.mode = mode;
  [DOM.tabOnline, DOM.tabLocal, DOM.tabSolo].forEach((t) => {
    t.classList.remove("active");
    t.setAttribute("aria-selected", "false");
  });
  [DOM.panelOnline, DOM.panelLocal, DOM.panelSolo].forEach((p) => p.classList.remove("active"));

  if (mode === "online") {
    DOM.tabOnline.classList.add("active");
    DOM.tabOnline.setAttribute("aria-selected", "true");
    DOM.panelOnline.classList.add("active");
  } else if (mode === "local") {
    DOM.tabLocal.classList.add("active");
    DOM.tabLocal.setAttribute("aria-selected", "true");
    DOM.panelLocal.classList.add("active");
  } else if (mode === "solo") {
    DOM.tabSolo.classList.add("active");
    DOM.tabSolo.setAttribute("aria-selected", "true");
    DOM.panelSolo.classList.add("active");
    updateSoloBestTimeDisplay();
  }
}

// ==========================================================================
// 7. Toast Educativo Cucapá (Bilingüe)
// ==========================================================================
let toastTimer = null;
function showMatchToast(cucapa, spanish) {
  DOM.toastCucapa.textContent = cucapa;
  DOM.toastSpanish.textContent = spanish;
  DOM.matchToast.classList.add("show");

  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => {
    DOM.matchToast.classList.remove("show");
  }, 2400);
}

// ==========================================================================
// 8. Construcción del Tablero con Tarjetas 3D
// ==========================================================================
function buildBoard(deckSize) {
  DOM.gameBoard.innerHTML = "";
  DOM.pairsLeftCount.textContent = Math.floor(deckSize / 2);

  for (let i = 0; i < deckSize; i++) {
    const card = document.createElement("div");
    card.className = "card";
    card.dataset.index = i;

    card.innerHTML = `
      <div class="card-inner">
        <div class="card-face card-back">
          <span class="back-emblem">🎴</span>
          <span class="back-text">Cucapá</span>
        </div>
        <div class="card-face card-front">
          <img src="" alt="Carta Memorama" loading="lazy" />
        </div>
      </div>
    `;

    card.onclick = () => onCardClicked(i);
    DOM.gameBoard.appendChild(card);
  }
}

function onCardClicked(index) {
  if (state.mode === "online") {
    if (state.myIndex !== state.roomData?.turn) return;
    const cardEl = DOM.gameBoard.querySelector(`[data-index='${index}']`);
    if (!cardEl || cardEl.classList.contains("flipped") || cardEl.classList.contains("matched")) return;

    Sound.playFlip();
    socket.emit("flipCard", { roomId: state.roomId, index });
  } else if (state.mode === "local") {
    handleLocalCardClick(index);
  } else if (state.mode === "solo") {
    handleSoloCardClick(index);
  }
}

// ==========================================================================
// 9. Lógica Multijugador ONLINE (Socket.IO)
// ==========================================================================
function setupOnlineHandlers() {
  // Crear Sala
  DOM.btnCreateRoom.onclick = () => {
    const name = DOM.createName.value.trim() || "Anfitrión";
    const avatar = DOM.createAvatarDisplay.textContent;
    const pairCount = Number(DOM.createPairs.value);
    const timerSeconds = Number(DOM.createTimer.value);

    socket.emit("createRoom", { name, avatar, pairCount, timerSeconds }, (res) => {
      if (res.success) {
        state.roomId = res.roomId;
        state.myIndex = 0;
        state.roomData = res.room;
        updateLobbyUI(res.room);
        switchScreen("lobby");
      }
    });
  };

  // Unirse a Sala
  DOM.btnJoinRoom.onclick = () => {
    const code = DOM.joinCode.value.trim().toUpperCase();
    const name = DOM.joinName.value.trim() || "Invitado";
    const avatar = DOM.joinAvatarDisplay.textContent;

    if (!code) {
      alert("Por favor ingresa un código de sala.");
      DOM.joinCode.focus();
      return;
    }

    socket.emit("joinRoom", { roomId: code, name, avatar }, (res) => {
      if (res.error) {
        alert(res.error);
      } else {
        state.roomId = res.roomId;
        state.myIndex = 1;
        state.roomData = res.room;
        updateLobbyUI(res.room);
        switchScreen("lobby");
      }
    });
  };

  // Copiar Código y Enlace
  DOM.btnCopyCode.onclick = () => {
    if (!state.roomId) return;
    navigator.clipboard.writeText(state.roomId).then(() => {
      DOM.copyStatus.textContent = "¡Código copiado al portapapeles!";
      setTimeout(() => (DOM.copyStatus.textContent = ""), 2500);
    });
  };

  DOM.btnCopyLink.onclick = () => {
    if (!state.roomId) return;
    const url = `${window.location.origin}${window.location.pathname}?sala=${state.roomId}`;
    navigator.clipboard.writeText(url).then(() => {
      DOM.copyStatus.textContent = "¡Enlace copiado al portapapeles!";
      setTimeout(() => (DOM.copyStatus.textContent = ""), 2500);
    });
  };

  // Salir de Lobby
  DOM.btnLeaveLobby.onclick = () => {
    if (state.roomId) {
      socket.emit("leaveRoom", { roomId: state.roomId });
      state.roomId = null;
      state.roomData = null;
      switchScreen("menu");
    }
  };

  // Iniciar Partida Online (Host)
  DOM.btnStartOnlineMatch.onclick = () => {
    if (!state.roomId) return;
    socket.emit("startGame", { roomId: state.roomId }, (res) => {
      if (res && res.error) alert(res.error);
    });
  };

  // Solicitud de Revancha
  DOM.btnRequestRematch.onclick = () => {
    if (state.mode === "online") {
      socket.emit("requestRematch", { roomId: state.roomId });
      DOM.btnRequestRematch.disabled = true;
      DOM.rematchStatusMsg.textContent = "Solicitud enviada. Esperando al rival...";
    } else if (state.mode === "local") {
      DOM.modalGameover.close();
      startLocalGame();
    } else if (state.mode === "solo") {
      DOM.modalGameover.close();
      startSoloGame();
    }
  };

  DOM.btnExitToMenu.onclick = () => {
    if (DOM.modalGameover.open) DOM.modalGameover.close();
    if (state.roomId) socket.emit("leaveRoom", { roomId: state.roomId });
    switchScreen("menu");
  };

  DOM.btnQuitGame.onclick = () => {
    if (confirm("¿Estás seguro de que deseas salir de la partida?")) {
      if (state.mode === "online" && state.roomId) {
        socket.emit("leaveRoom", { roomId: state.roomId });
      }
      if (state.soloTimerInterval) clearInterval(state.soloTimerInterval);
      switchScreen("menu");
    }
  };

  // --- Eventos de Socket.IO ---

  socket.on("roomUpdated", (room) => {
    state.roomData = room;
    updateLobbyUI(room);
  });

  socket.on("gameCountdown", ({ seconds }) => {
    DOM.countdownOverlay.classList.add("active");
    DOM.countdownNumber.textContent = seconds;

    let current = seconds;
    const interval = setInterval(() => {
      current--;
      if (current > 0) {
        DOM.countdownNumber.textContent = current;
      } else {
        clearInterval(interval);
        DOM.countdownOverlay.classList.remove("active");
      }
    }, 1000);
  });

  socket.on("gameStarted", ({ room }) => {
    DOM.countdownOverlay.classList.remove("active");
    if (DOM.modalGameover.open) DOM.modalGameover.close();

    state.roomData = room;
    state.onlineTimerSeconds = room.timerSeconds;

    setupOnlineHUD(room);
    buildBoard(room.deckSize);
    updateTurnHUD(room.turn);
    switchScreen("game");
  });

  socket.on("cardFlipped", ({ index, img }) => {
    const cardEl = DOM.gameBoard.querySelector(`[data-index='${index}']`);
    if (!cardEl) return;

    const imgEl = cardEl.querySelector(".card-front img");
    if (imgEl) imgEl.src = img;

    cardEl.classList.add("flipped");
    Sound.playFlip();
  });

  socket.on("matchResult", ({ i1, i2, scores, turn, pairInfo }) => {
    Sound.playMatch();
    showMatchToast(pairInfo.cucapa, pairInfo.spanish);

    const c1 = DOM.gameBoard.querySelector(`[data-index='${i1}']`);
    const c2 = DOM.gameBoard.querySelector(`[data-index='${i2}']`);
    if (c1) c1.classList.add("matched");
    if (c2) c2.classList.add("matched");

    DOM.hudP1Score.textContent = scores[0];
    DOM.hudP2Score.textContent = scores[1];

    updatePairsLeftCount();
    updateTurnHUD(turn);
  });

  socket.on("noMatch", ({ i1, i2 }) => {
    Sound.playMismatch();

    const c1 = DOM.gameBoard.querySelector(`[data-index='${i1}']`);
    const c2 = i2 !== null ? DOM.gameBoard.querySelector(`[data-index='${i2}']`) : null;

    if (c1) c1.classList.add("mismatch-shake");
    if (c2) c2.classList.add("mismatch-shake");

    setTimeout(() => {
      if (c1 && !c1.classList.contains("matched")) {
        c1.classList.remove("flipped", "mismatch-shake");
      }
      if (c2 && !c2.classList.contains("matched")) {
        c2.classList.remove("flipped", "mismatch-shake");
      }
    }, 1000);
  });

  socket.on("turnChanged", ({ turn, scores }) => {
    if (state.roomData) state.roomData.turn = turn;
    DOM.hudP1Score.textContent = scores[0];
    DOM.hudP2Score.textContent = scores[1];
    updateTurnHUD(turn);
  });

  socket.on("timerTick", ({ timeLeft }) => {
    const total = state.onlineTimerSeconds || 30;
    if (total <= 0) return;

    const pct = Math.max(0, (timeLeft / total) * 100);
    DOM.timerBarFill.style.width = `${pct}%`;
    DOM.timerText.textContent = `${timeLeft}s`;

    if (timeLeft <= 5) {
      DOM.timerBarFill.classList.add("warning");
      Sound.playTick();
    } else {
      DOM.timerBarFill.classList.remove("warning");
    }
  });

  socket.on("turnTimeout", ({ nextTurn }) => {
    if (state.roomData) state.roomData.turn = nextTurn;
    updateTurnHUD(nextTurn);
  });

  socket.on("gameOver", ({ scores, winner, isDraw, players }) => {
    Sound.playVictory();
    Confetti.burst(150);

    DOM.gameoverTitle.textContent = isDraw ? "¡Empate Técnico!" : `¡Victoria de ${winner}!`;
    DOM.gameoverSubtitle.textContent = isDraw
      ? "¡Ambos jugadores demostraron un gran conocimiento de la lengua Cucapá!"
      : `¡Felicidades por recordar la mayor cantidad de palabras tradicionales!`;

    DOM.gameoverScores.innerHTML = `
      <div class="score-card ${winner === players[0].name ? 'winner' : ''}">
        <div class="score-avatar">${players[0].avatar}</div>
        <div class="score-player-name">${players[0].name}</div>
        <div class="score-number">${scores[0]} pts</div>
      </div>
      <div class="score-card ${winner === players[1].name ? 'winner' : ''}">
        <div class="score-avatar">${players[1].avatar}</div>
        <div class="score-player-name">${players[1].name}</div>
        <div class="score-number">${scores[1]} pts</div>
      </div>
    `;

    DOM.btnRequestRematch.disabled = false;
    DOM.rematchStatusMsg.textContent = "";
    DOM.modalGameover.showModal();
  });

  socket.on("rematchRequested", ({ requesterName, votesCount }) => {
    DOM.rematchStatusMsg.textContent = `${requesterName} ha solicitado revancha (${votesCount}/2)`;
  });

  socket.on("playerLeftMatch", ({ message, winner }) => {
    alert(`${message} ${winner ? `\n¡Ganaste por abandono!` : ""}`);
    switchScreen("menu");
  });

  socket.on("playerLeftLobby", ({ message }) => {
    alert(message);
    switchScreen("menu");
  });
}

function updateLobbyUI(room) {
  DOM.lobbyCodeDisplay.textContent = room.id;
  DOM.lobbyPairsDisplay.textContent = `${room.pairCount} pares (${room.pairCount * 2} cartas)`;
  DOM.lobbyTimerDisplay.textContent = room.timerSeconds > 0 ? `${room.timerSeconds} segundos` : "Sin límite";

  const p0 = room.players[0];
  const p1 = room.players[1];

  // Jugador 1 (Anfitrión)
  if (p0) {
    DOM.lobbyPlayer0.className = "player-slot active";
    DOM.lobbyPlayer0.querySelector(".slot-avatar").textContent = p0.avatar;
    DOM.lobbyPlayer0.querySelector(".slot-name").textContent = p0.name;
    DOM.lobbyPlayer0.querySelector(".slot-status").textContent = "✓ Listo";
  }

  // Jugador 2 (Invitado)
  if (p1) {
    DOM.lobbyPlayer1.className = "player-slot active";
    DOM.lobbyPlayer1.querySelector(".slot-avatar").textContent = p1.avatar;
    DOM.lobbyPlayer1.querySelector(".slot-name").textContent = p1.name;
    DOM.lobbyPlayer1.querySelector(".slot-status").className = "slot-status ready";
    DOM.lobbyPlayer1.querySelector(".slot-status").textContent = "✓ Conectado";
  } else {
    DOM.lobbyPlayer1.className = "player-slot empty";
    DOM.lobbyPlayer1.querySelector(".slot-avatar").textContent = "⏳";
    DOM.lobbyPlayer1.querySelector(".slot-name").textContent = "Esperando rival...";
    DOM.lobbyPlayer1.querySelector(".slot-status").className = "slot-status waiting";
    DOM.lobbyPlayer1.querySelector(".slot-status").textContent = "Comparte el código";
  }

  // Habilitar botón de inicio si eres el anfitrión y hay 2 jugadores
  if (state.myIndex === 0) {
    DOM.btnStartOnlineMatch.style.display = "inline-flex";
    if (room.players.length >= 2) {
      DOM.btnStartOnlineMatch.disabled = false;
      DOM.btnStartOnlineMatch.textContent = "🚀 Iniciar Partida Ahora";
    } else {
      DOM.btnStartOnlineMatch.disabled = true;
      DOM.btnStartOnlineMatch.textContent = "Esperando al 2º jugador...";
    }
  } else {
    DOM.btnStartOnlineMatch.style.display = "inline-flex";
    DOM.btnStartOnlineMatch.disabled = true;
    DOM.btnStartOnlineMatch.textContent = "Esperando a que el anfitrión inicie...";
  }
}

function setupOnlineHUD(room) {
  DOM.soloStats.style.display = "none";
  DOM.timerContainer.style.display = room.timerSeconds > 0 ? "flex" : "none";

  DOM.hudP1Avatar.textContent = room.players[0].avatar;
  DOM.hudP1Name.textContent = room.players[0].name;
  DOM.hudP1Score.textContent = "0";

  DOM.hudP2Avatar.textContent = room.players[1].avatar;
  DOM.hudP2Name.textContent = room.players[1].name;
  DOM.hudP2Score.textContent = "0";
}

function updateTurnHUD(turn) {
  const isP1 = turn === 0;
  DOM.hudP1.classList.toggle("active-turn", isP1);
  DOM.hudP2.classList.toggle("active-turn", !isP1);

  if (state.mode === "online") {
    const isMyTurn = turn === state.myIndex;
    const currentName = state.roomData?.players[turn]?.name || `Jugador ${turn + 1}`;
    DOM.turnText.textContent = isMyTurn ? "✨ ¡Es tu turno de voltear!" : `Turno de: ${currentName}`;
  } else if (state.mode === "local") {
    const p = state.localPlayers[turn];
    DOM.turnText.textContent = `Turno de: ${p.name} (${p.avatar})`;
  }
}

function updatePairsLeftCount() {
  const totalCards = DOM.gameBoard.querySelectorAll(".card").length;
  const matchedCards = DOM.gameBoard.querySelectorAll(".card.matched").length;
  DOM.pairsLeftCount.textContent = Math.floor((totalCards - matchedCards) / 2);
}

// ==========================================================================
// 10. Lógica Multijugador LOCAL (Mismo Dispositivo)
// ==========================================================================
function setupLocalHandlers() {
  DOM.btnStartLocal.onclick = () => {
    state.mode = "local";
    state.localPlayers = [
      { name: DOM.localP1Name.value.trim() || "Jugador 1", avatar: "🐺", score: 0 },
      { name: DOM.localP2Name.value.trim() || "Jugador 2", avatar: "🌊", score: 0 }
    ];
    startLocalGame();
  };
}

function startLocalGame() {
  const pairCount = Number(DOM.localPairs.value) || 8;
  const selectedPairs = shuffle([...pairsCatalog]).slice(0, pairCount);

  const rawDeck = [];
  selectedPairs.forEach((p) => {
    rawDeck.push({ pairId: p.id, img: p.img1, cucapa: p.cucapa, spanish: p.spanish });
    rawDeck.push({ pairId: p.id, img: p.img2, cucapa: p.cucapa, spanish: p.spanish });
  });

  state.localDeck = shuffle(rawDeck);
  state.localTurn = 0;
  state.localFlipped = [];
  state.localIsBusy = false;
  state.localPlayers[0].score = 0;
  state.localPlayers[1].score = 0;

  DOM.soloStats.style.display = "none";
  DOM.timerContainer.style.display = "none";

  DOM.hudP1Avatar.textContent = state.localPlayers[0].avatar;
  DOM.hudP1Name.textContent = state.localPlayers[0].name;
  DOM.hudP1Score.textContent = "0";

  DOM.hudP2Avatar.textContent = state.localPlayers[1].avatar;
  DOM.hudP2Name.textContent = state.localPlayers[1].name;
  DOM.hudP2Score.textContent = "0";

  buildBoard(state.localDeck.length);
  updateTurnHUD(state.localTurn);
  switchScreen("game");
}

function handleLocalCardClick(index) {
  if (state.localIsBusy) return;

  const card = state.localDeck[index];
  const cardEl = DOM.gameBoard.querySelector(`[data-index='${index}']`);
  if (!cardEl || cardEl.classList.contains("flipped") || cardEl.classList.contains("matched")) return;

  Sound.playFlip();
  cardEl.classList.add("flipped");
  cardEl.querySelector(".card-front img").src = card.img;
  state.localFlipped.push({ index, card, el: cardEl });

  if (state.localFlipped.length === 2) {
    state.localIsBusy = true;
    const [f1, f2] = state.localFlipped;

    if (f1.card.pairId === f2.card.pairId) {
      // MATCH
      Sound.playMatch();
      showMatchToast(f1.card.cucapa, f1.card.spanish);

      f1.el.classList.add("matched");
      f2.el.classList.add("matched");

      state.localPlayers[state.localTurn].score++;
      DOM.hudP1Score.textContent = state.localPlayers[0].score;
      DOM.hudP2Score.textContent = state.localPlayers[1].score;

      state.localFlipped = [];
      state.localIsBusy = false;
      updatePairsLeftCount();

      const matchedTotal = DOM.gameBoard.querySelectorAll(".card.matched").length;
      if (matchedTotal === state.localDeck.length) {
        finishLocalGame();
      }
    } else {
      // NO MATCH
      Sound.playMismatch();
      f1.el.classList.add("mismatch-shake");
      f2.el.classList.add("mismatch-shake");

      setTimeout(() => {
        f1.el.classList.remove("flipped", "mismatch-shake");
        f2.el.classList.remove("flipped", "mismatch-shake");

        state.localTurn = state.localTurn === 0 ? 1 : 0;
        state.localFlipped = [];
        state.localIsBusy = false;
        updateTurnHUD(state.localTurn);
      }, 1000);
    }
  }
}

function finishLocalGame() {
  Sound.playVictory();
  Confetti.burst(150);

  const p1 = state.localPlayers[0];
  const p2 = state.localPlayers[1];
  const isDraw = p1.score === p2.score;
  const winner = p1.score > p2.score ? p1 : p2;

  DOM.gameoverTitle.textContent = isDraw ? "¡Empate Fraternal!" : `¡Ganó ${winner.name}!`;
  DOM.gameoverSubtitle.textContent = "Gran partida en el mismo dispositivo.";

  DOM.gameoverScores.innerHTML = `
    <div class="score-card ${!isDraw && winner === p1 ? 'winner' : ''}">
      <div class="score-avatar">${p1.avatar}</div>
      <div class="score-player-name">${p1.name}</div>
      <div class="score-number">${p1.score} pts</div>
    </div>
    <div class="score-card ${!isDraw && winner === p2 ? 'winner' : ''}">
      <div class="score-avatar">${p2.avatar}</div>
      <div class="score-player-name">${p2.name}</div>
      <div class="score-number">${p2.score} pts</div>
    </div>
  `;

  DOM.btnRequestRematch.disabled = false;
  DOM.rematchStatusMsg.textContent = "";
  DOM.modalGameover.showModal();
}

// ==========================================================================
// 11. Lógica Modo SOLITARIO / PRÁCTICA
// ==========================================================================
function setupSoloHandlers() {
  DOM.btnStartSolo.onclick = () => {
    state.mode = "solo";
    startSoloGame();
  };
}

function startSoloGame() {
  const pairCount = Number(DOM.soloPairs.value) || 8;
  const selectedPairs = shuffle([...pairsCatalog]).slice(0, pairCount);

  const rawDeck = [];
  selectedPairs.forEach((p) => {
    rawDeck.push({ pairId: p.id, img: p.img1, cucapa: p.cucapa, spanish: p.spanish });
    rawDeck.push({ pairId: p.id, img: p.img2, cucapa: p.cucapa, spanish: p.spanish });
  });

  state.soloDeck = shuffle(rawDeck);
  state.soloFlipped = [];
  state.soloFlips = 0;
  state.soloMatchedPairs = 0;
  state.soloTotalPairs = pairCount;
  state.soloIsBusy = false;

  DOM.timerContainer.style.display = "none";
  DOM.soloStats.style.display = "flex";
  DOM.turnText.textContent = "Modo Práctica Solitario";
  DOM.hudP1Avatar.textContent = "🎯";
  DOM.hudP1Name.textContent = "Tú";
  DOM.hudP1Score.textContent = "0";
  DOM.hudP2.style.display = "none";

  DOM.soloFlipsCount.textContent = "0";
  DOM.soloStopwatch.textContent = "00:00";

  // Iniciar cronómetro
  state.soloStartTime = Date.now();
  if (state.soloTimerInterval) clearInterval(state.soloTimerInterval);
  state.soloTimerInterval = setInterval(() => {
    const elapsedSecs = Math.floor((Date.now() - state.soloStartTime) / 1000);
    const m = String(Math.floor(elapsedSecs / 60)).padStart(2, "0");
    const s = String(elapsedSecs % 60).padStart(2, "0");
    DOM.soloStopwatch.textContent = `${m}:${s}`;
  }, 1000);

  buildBoard(state.soloDeck.length);
  switchScreen("game");
}

function handleSoloCardClick(index) {
  if (state.soloIsBusy) return;

  const card = state.soloDeck[index];
  const cardEl = DOM.gameBoard.querySelector(`[data-index='${index}']`);
  if (!cardEl || cardEl.classList.contains("flipped") || cardEl.classList.contains("matched")) return;

  Sound.playFlip();
  cardEl.classList.add("flipped");
  cardEl.querySelector(".card-front img").src = card.img;
  state.soloFlipped.push({ index, card, el: cardEl });

  if (state.soloFlipped.length === 2) {
    state.soloFlips++;
    DOM.soloFlipsCount.textContent = state.soloFlips;
    state.soloIsBusy = true;

    const [f1, f2] = state.soloFlipped;

    if (f1.card.pairId === f2.card.pairId) {
      // MATCH
      Sound.playMatch();
      showMatchToast(f1.card.cucapa, f1.card.spanish);

      f1.el.classList.add("matched");
      f2.el.classList.add("matched");

      state.soloMatchedPairs++;
      DOM.hudP1Score.textContent = state.soloMatchedPairs;

      state.soloFlipped = [];
      state.soloIsBusy = false;
      updatePairsLeftCount();

      if (state.soloMatchedPairs === state.soloTotalPairs) {
        finishSoloGame();
      }
    } else {
      // NO MATCH
      Sound.playMismatch();
      f1.el.classList.add("mismatch-shake");
      f2.el.classList.add("mismatch-shake");

      setTimeout(() => {
        f1.el.classList.remove("flipped", "mismatch-shake");
        f2.el.classList.remove("flipped", "mismatch-shake");
        state.soloFlipped = [];
        state.soloIsBusy = false;
      }, 1000);
    }
  }
}

function finishSoloGame() {
  clearInterval(state.soloTimerInterval);
  Sound.playVictory();
  Confetti.burst(150);

  const elapsedSecs = Math.floor((Date.now() - state.soloStartTime) / 1000);
  const timeFormatted = DOM.soloStopwatch.textContent;

  // Récord
  const key = `cucapa_best_${state.soloTotalPairs}`;
  const prevBest = localStorage.getItem(key);
  let isNewRecord = false;

  if (!prevBest || elapsedSecs < Number(prevBest)) {
    localStorage.setItem(key, elapsedSecs);
    isNewRecord = true;
  }

  DOM.gameoverTitle.textContent = isNewRecord ? "🎉 ¡Nuevo Récord Personal!" : "🎯 ¡Desafío Completado!";
  DOM.gameoverSubtitle.textContent = `Has resuelto todos los pares en ${timeFormatted} con ${state.soloFlips} intentos.`;

  DOM.gameoverScores.innerHTML = `
    <div class="score-card winner">
      <div class="score-avatar">⏱️</div>
      <div class="score-player-name">Tiempo Total</div>
      <div class="score-number">${timeFormatted}</div>
    </div>
    <div class="score-card">
      <div class="score-avatar">🔄</div>
      <div class="score-player-name">Intentos</div>
      <div class="score-number">${state.soloFlips}</div>
    </div>
  `;

  DOM.btnRequestRematch.disabled = false;
  DOM.rematchStatusMsg.textContent = "";
  DOM.modalGameover.showModal();
}

function updateSoloBestTimeDisplay() {
  const count = Number(DOM.soloPairs.value) || 8;
  const key = `cucapa_best_${count}`;
  const best = localStorage.getItem(key);

  if (best) {
    const m = String(Math.floor(best / 60)).padStart(2, "0");
    const s = String(best % 60).padStart(2, "0");
    DOM.soloBestTime.textContent = `${m}:${s}`;
  } else {
    DOM.soloBestTime.textContent = "--:--";
  }
}

// ==========================================================================
// 12. Glosario Cultural y Modales
// ==========================================================================
function renderGlossary(filterText = "") {
  DOM.glossaryGrid.innerHTML = "";
  const query = filterText.toLowerCase().trim();

  const filtered = pairsCatalog.filter(
    (p) => p.cucapa.toLowerCase().includes(query) || p.spanish.toLowerCase().includes(query)
  );

  if (filtered.length === 0) {
    DOM.glossaryGrid.innerHTML = `<p class="text-muted" style="grid-column: 1/-1; text-align: center; padding: 20px;">No se encontraron palabras con "${filterText}".</p>`;
    return;
  }

  filtered.forEach((p) => {
    const item = document.createElement("div");
    item.className = "glossary-item";
    item.innerHTML = `
      <div class="glossary-cards">
        <img src="${p.img1}" class="glossary-card-img" alt="${p.cucapa}" loading="lazy" />
        <img src="${p.img2}" class="glossary-card-img" alt="${p.spanish}" loading="lazy" />
      </div>
      <div class="glossary-info">
        <div class="glossary-cucapa">${p.cucapa}</div>
        <div class="glossary-spanish">${p.spanish}</div>
      </div>
    `;
    DOM.glossaryGrid.appendChild(item);
  });
}

function setupModals() {
  // Glosario
  DOM.btnOpenGlossary.onclick = () => {
    renderGlossary();
    DOM.modalGlossary.showModal();
  };
  DOM.btnCloseGlossary.onclick = () => DOM.modalGlossary.close();

  DOM.glossarySearch.oninput = (e) => {
    renderGlossary(e.target.value);
  };

  // Créditos
  DOM.btnOpenCredits.onclick = () => DOM.modalCredits.showModal();
  DOM.btnCloseCredits.onclick = () => DOM.modalCredits.close();

  // Cerrar haciendo clic en el backdrop de dialog
  [DOM.modalGameover, DOM.modalGlossary, DOM.modalCredits].forEach((dlg) => {
    dlg.addEventListener("click", (e) => {
      const rect = dlg.getBoundingClientRect();
      const inDialog =
        rect.top <= e.clientY &&
        e.clientY <= rect.top + rect.height &&
        rect.left <= e.clientX &&
        e.clientX <= rect.left + rect.width;
      if (!inDialog && dlg.open) dlg.close();
    });
  });
}

// ==========================================================================
// 13. Utilidades y Ayudantes
// ==========================================================================
function shuffle(array) {
  const arr = [...array];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

// Detectar enlace de sala directo en la URL (?sala=ABC123 o ?room=ABC123)
function checkUrlRoomParam() {
  const params = new URLSearchParams(window.location.search);
  const code = params.get("sala") || params.get("room");
  if (code) {
    switchTab("online");
    DOM.joinCode.value = code.toUpperCase();
    DOM.joinName.focus();
    DOM.joinName.select();
  }
}

// ==========================================================================
// 14. Inicialización Global
// ==========================================================================
document.addEventListener("DOMContentLoaded", () => {
  setupAvatarPickers();
  setupOnlineHandlers();
  setupLocalHandlers();
  setupSoloHandlers();
  setupModals();

  // Tabs
  DOM.tabOnline.onclick = () => switchTab("online");
  DOM.tabLocal.onclick = () => switchTab("local");
  DOM.tabSolo.onclick = () => switchTab("solo");
  DOM.soloPairs.onchange = () => updateSoloBestTimeDisplay();

  // Sonido
  DOM.btnSoundToggle.onclick = () => {
    const enabled = Sound.toggle();
    DOM.soundIcon.textContent = enabled ? "🔊" : "🔇";
    DOM.btnSoundToggle.title = enabled ? "Silenciar sonido" : "Activar sonido";
  };
  DOM.soundIcon.textContent = Sound.enabled ? "🔊" : "🔇";

  checkUrlRoomParam();
});

