import Phaser from "phaser";
import "./style.css";
import { Simulation, type Mode, type State } from "./core/Simulation";
import { ForestScene } from "./game/ForestScene";
import { FRUITS, QUESTIONS, SOURCES, type Question } from "./data/content";
import { Store, validName } from "./data/storage";
const $ = <T extends HTMLElement = HTMLElement>(id: string) =>
  document.getElementById(id) as T;
let local: Storage | null = null;
try {
  local = window.localStorage;
} catch {
  /* Session-only progress remains available. */
}
const store = new Store(local);
const sim = new Simulation();
const dialog = $<HTMLDialogElement>("dialog");
const content = $("dialogContent");
const player = $<HTMLInputElement>("player");
const start = $<HTMLButtonElement>("start");
let name = store.data.player;
let ready = false;
let scene: ForestScene | null = null;
let game: Phaser.Game | null = null;
let lastState: State | null = null;
let extra: string | null = null;
let rankingMode: Mode | "legacy" = "learn";
player.value = name;
const prefersReduced = window.matchMedia(
  "(prefers-reduced-motion: reduce)",
).matches;
store.data.reducedMotion ||= prefersReduced;
const escape = (value: string) =>
  value.replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ]!,
  );
const modeName = (mode: Mode | "legacy") =>
  mode === "learn" ? "Aprender" : mode === "challenge" ? "Desafio" : "Clássico";
function storageStatus() {
  $("storageStatus").textContent = store.available
    ? ""
    : "O progresso está disponível nesta sessão. Não foi possível ler ou salvar todos os dados neste navegador.";
}
function validate() {
  start.disabled = !ready || !validName(player.value);
}
function focusGame() {
  $("game").focus({ preventScroll: true });
}
function close() {
  if (dialog.open) dialog.close();
  extra = null;
}
function modal(title: string, html: string, closable = false) {
  $("dialogTitle").textContent = title;
  content.innerHTML = html;
  $("closeDialog").hidden = !closable;
  if (!dialog.open) dialog.showModal();
  const focus = content.querySelector<HTMLElement>("button,input,a");
  if (focus) focus.focus({ preventScroll: true });
}
function source(q: Question) {
  const s = SOURCES[q.source];
  return `<p class="source">Referência: <a href="${s.url}" target="_blank" rel="noopener noreferrer">${s.label} ↗</a></p>`;
}
function begin() {
  const valid = validName(player.value);
  if (!ready || !valid || sim.state !== "menu") return;
  name = valid;
  store.data.player = valid;
  store.save();
  const selected = document.querySelector<HTMLInputElement>(
    "input[name=mode]:checked",
  )?.value;
  sim.start(selected === "challenge" ? "challenge" : "learn");
  scene?.resetClock();
  close();
  sync();
  focusGame();
}
function endDialog() {
  const won = sim.state === "won";
  modal(
    won ? "Um voo para celebrar!" : "Cada voo é um recomeço.",
    `<p>${escape(name)}, ${won ? "você chegou aos 200 pontos. Continue levando essas descobertas para além da floresta!" : "a floresta ainda tem muito para contar. Que tal tentar mais uma vez?"}</p><div class="big-score">${sim.score}<span style="font-size:18px"> pontos</span></div><div class="stats"><span><b>${sim.collected}</b>coletas</span><span><b>${sim.correct}</b>respostas certas</span><span><b>${modeName(sim.mode)}</b>modo</span></div><div class="dialog-actions"><button class="primary" data-action="retry">Voar novamente</button><button class="secondary" data-open="ranking">Ver ranking</button><button class="secondary" data-action="home">Início</button></div>${store.data.mistakes.length ? "<p>Suas perguntas para revisar estão na Chauapédia.</p>" : ""}`,
  );
}
function quizDialog() {
  const q = sim.question;
  if (!q) return;
  const fruit = FRUITS.find((f) => f.id === sim.quizFruit)!;
  if (sim.state === "quiz")
    modal(
      "Uma descoberta pelo caminho",
      `<div class="quiz-fruit"><img src="assets/v3/fruit-${fruit.id}.webp" alt="">${fruit.name} coletada · +3 pontos</div><p class="eyebrow" style="margin-top:20px">${q.topic}</p><p class="quiz-text">${q.text}</p><p>Verdadeiro ou falso? O voo está pausado.</p><div class="answer-buttons"><button data-answer="true">V · Verdadeiro</button><button data-answer="false">F · Falso</button></div>`,
    );
  else
    modal(
      sim.answerCorrect ? "Isso mesmo! +2 pontos" : "Vamos descobrir juntos",
      `<div class="feedback ${sim.answerCorrect ? "" : "wrong"}"><p><b>A afirmação é ${q.answer ? "verdadeira" : "falsa"}.</b></p><p>${q.explanation}</p></div>${source(q)}<p>${!sim.answerCorrect && sim.mode === "challenge" ? "No modo Desafio, a resposta errada encerra o voo." : "Leve essa descoberta com você e continue a aventura."}</p><button class="primary" data-action="continue">${!sim.answerCorrect && sim.mode === "challenge" ? "Ver resultado" : sim.score >= 200 ? "Celebrar o voo" : "Continuar o voo"}</button>`,
    );
}
function sync() {
  $("score").textContent = String(sim.score);
  $("collectionCount").textContent =
    `${store.data.unlocked.length} / 7 descobertas`;
  $("modeLabel").textContent =
    sim.state === "menu"
      ? "EXPEDIÇÃO CHAUÁ"
      : `MODO ${modeName(sim.mode).toUpperCase()}`;
  $("welcome").hidden = sim.state !== "menu";
  $("countdown").hidden = sim.state !== "countdown";
  $("countdownLabel").textContent = sim.resuming
    ? "Retomando o voo"
    : "Prepare as asas";
  $("count").textContent = String(Math.max(1, Math.ceil(sim.countdown)));
  $<HTMLButtonElement>("pause").disabled =
    sim.state !== "playing" && sim.state !== "countdown";
  $<HTMLButtonElement>("flap").disabled = sim.state !== "playing";
  if (lastState === sim.state) return;
  lastState = sim.state;
  if (extra) return;
  if (sim.state === "quiz" || sim.state === "feedback") quizDialog();
  else if (sim.state === "paused")
    modal(
      "Uma pausa para respirar",
      `<p>Seu voo está guardado aqui. Continue quando estiver pronto.</p><div class="dialog-actions"><button class="primary" data-action="resume">Continuar voo</button><button class="secondary" data-action="home">Voltar ao início</button></div>`,
    );
  else if (sim.state === "over" || sim.state === "won") endDialog();
  else close();
}
function encyclopedia() {
  const cards = FRUITS.map((f) => {
    const unlocked = store.data.unlocked.includes(f.id);
    return `<div class="fruit-card ${unlocked ? "" : "locked"}"><img src="assets/v3/fruit-${f.id}.webp" alt="">${f.name}<small>${unlocked ? "Descoberta registrada" : "Colete para desbloquear"}</small></div>`;
  }).join("");
  const mistakes = QUESTIONS.filter((q) => store.data.mistakes.includes(q.id));
  modal(
    "Seu caderno da floresta",
    `<p>Sete itens para descobrir durante seus voos. A coleção usa os elementos do jogo original; não é um guia de alimentação de aves.</p><div class="collection-grid">${cards}</div><h3 style="margin-top:26px">${mistakes.length ? "Revisar suas descobertas" : "Conheça e proteja o chauá"}</h3>${(mistakes.length ? mistakes : QUESTIONS.filter((q) => ["habitat", "captura", "protecao"].includes(q.id))).map((q) => `<article class="knowledge"><h3>${q.topic}</h3><p>${q.explanation}</p>${source(q)}</article>`).join("")}`,
    true,
  );
}
function ranking() {
  modal(
    "Voos que ficaram na história",
    `<p>Melhor pontuação de cada jogador neste navegador. Os modos têm classificações separadas.</p><div class="ranking-tabs">${(["learn", "challenge", "legacy"] as const).map((m) => `<button data-rank="${m}" aria-pressed="${m === rankingMode}">${modeName(m)}</button>`).join("")}</div><table><thead><tr><th>Posição</th><th>Jogador</th><th>Pontos</th></tr></thead><tbody id="rankingBody"></tbody></table><p id="emptyRanking"></p>${rankingMode === "legacy" ? '<p class="source">Histórico preservado da versão original, com regras de pontuação diferentes.</p>' : ""}`,
    true,
  );
  const scores = store.data.scores
    .filter((s) => s.mode === rankingMode)
    .sort((a, b) => b.score - a.score);
  for (const [i, s] of scores.entries()) {
    const row = document.createElement("tr");
    for (const value of [String(i + 1), s.name, String(s.score)]) {
      const cell = document.createElement("td");
      cell.textContent = value;
      row.append(cell);
    }
    $("rankingBody").append(row);
  }
  $("emptyRanking").textContent = scores.length
    ? ""
    : "Seu primeiro voo pode inaugurar este ranking.";
}
function openExtra(which: string) {
  if (sim.state === "quiz" || sim.state === "feedback") return;
  sim.pause();
  extra = which;
  sync();
  if (which === "encyclopedia") encyclopedia();
  if (which === "ranking") ranking();
  if (which === "settings")
    modal(
      "Do seu jeito",
      `<label class="setting"><input type="checkbox" id="muteSetting" ${store.data.muted ? "checked" : ""}> Silenciar os efeitos sonoros</label><label class="setting"><input type="checkbox" id="motionSetting" ${store.data.reducedMotion ? "checked" : ""}> Reduzir efeitos e movimento do cenário</label><p>Use Espaço ou ↑ para voar; Esc para pausar. No celular, toque na floresta ou no botão “Bater as asas”.</p><p>Meta: 200 pontos. Obstáculo: +1. Coleta: +3. Resposta correta: +2. No modo Aprender, erros no quiz permitem continuar; colisões encerram o voo nos dois modos.</p>`,
      true,
    );
  if (which === "credits")
    modal(
      "Uma história feita em conjunto",
      `<p>Chauá Educa é um jogo educativo sobre o papagaio-chauá e a conservação da Mata Atlântica.</p><p class="credits-text"><b>Desenvolvedor:</b> <a href="https://github.com/SilvAlisson" target="_blank" rel="noopener noreferrer">Alisson Silva</a><br><b>Contribuidor original:</b> <a href="https://github.com/CodeLPrime" target="_blank" rel="noopener noreferrer">CodeLPrime</a><br><b>Imagens e áudio:</b> Lívia Teodosio e Alisson Silva<br><b>Perguntas originais:</b> Marilia Teodosio Costa e Flávia Gomes Ramos Araújo<br><b>Instituto Federal de Alagoas — IFAL</b><br>Programa de Pós-Graduação em Tecnologias Ambientais — PPGTEC<br>Mestrado Profissional em Tecnologias Ambientais<br><b>Alunas:</b> Marilia Teodosio Costa e Flávia Gomes Ramos Araújo</p><p class="credits-text">A versão 2.0 preserva os recursos do projeto original. O novo banco de perguntas usa as referências abaixo e deve receber revisão pedagógica antes de uso institucional.</p>${Object.values(
        SOURCES,
      )
        .map(
          (s) =>
            `<p class="source"><a href="${s.url}" target="_blank" rel="noopener noreferrer">${s.label} ↗</a></p>`,
        )
        .join(
          "",
        )}<div class="logos"><img src="assets/images/Logo-1.png" alt="Logo institucional original 1"><img src="assets/images/Logo-2.png" alt="Logo institucional original 2"></div>`,
      true,
    );
  if (which === "guide")
    modal(
      "Como voar e descobrir",
      `<div class="guide-modal">
        <p><b>Controles:</b> Pressione <kbd>Espaço</kbd>, <kbd>↑</kbd> ou toque na tela para bater as asas e subir. Cada toque dá um impulso; entre os toques, a gravidade faz o chauá descer.</p>
        <p><b>Atalhos:</b> <kbd>Esc</kbd> para pausar · <kbd>F</kbd> para alternar tela cheia.</p>
        <p><b>Objetivo:</b> Voe pela floresta, desvie dos troncos e colete os 7 itens da coleção (+3 pts cada) para atingir 200 pontos.</p>
        <p><b>Quiz Educativo:</b> O voo pausa em perguntas sobre o papagaio-chauá e a Mata Atlântica (+2 pts por acerto).</p>
      </div>`,
      true,
    );
}
function closeExtra() {
  if (!extra) return;
  close();
  lastState = null;
  sync();
  if (sim.state === "menu") player.focus();
}
function toggleFullscreen() {
  if (!document.fullscreenElement) {
    document.documentElement.requestFullscreen?.().catch(() => {});
  } else {
    document.exitFullscreen?.().catch(() => {});
  }
}
try {
  scene = new ForestScene({
    sim,
    reducedMotion: () => store.data.reducedMotion,
    muted: () => store.data.muted,
    ready: () => {
      ready = true;
      start.textContent = "Começar a aventura →";
      validate();
    },
    failed: () => {
      start.textContent = "Não foi possível carregar";
      $("loadStatus").textContent =
        "Atualize a página para tentar novamente. Confira sua conexão.";
    },
    frame: sync,
    event: (e) => {
      if (e.type === "fruit") store.unlock(e.kind);
      if (e.type === "answer") store.answer(e.id, e.correct);
      if (e.type === "end") store.score(name, sim.score, sim.mode);
      storageStatus();
    },
  });

  game = new Phaser.Game({
    type: Phaser.AUTO,
    parent: "game",
    width: 960,
    height: 540,
    backgroundColor: "#091710",
    scene: [scene],
    scale: { mode: Phaser.Scale.FIT, autoCenter: Phaser.Scale.CENTER_BOTH },
    render: { antialias: true, roundPixels: false },
    audio: { disableWebAudio: false },
    banner: false,
  });
} catch {
  $("loadStatus").textContent =
    "Não foi possível iniciar o jogo neste navegador. Tente atualizar a página ou usar outro navegador.";
}
$("startForm").addEventListener("submit", (e) => {
  e.preventDefault();
  begin();
});
player.addEventListener("input", validate);
$("pause").addEventListener("click", () => {
  sim.pause();
  sync();
});
$("flap").addEventListener("pointerdown", (e) => {
  e.preventDefault();
  sim.flap();
});
$("fullscreenBtn")?.addEventListener("click", toggleFullscreen);
document.addEventListener("fullscreenchange", () => {
  const isFull = !!document.fullscreenElement;
  const btn = document.getElementById("fullscreenBtn");
  if (btn) {
    btn.innerHTML = isFull
      ? `🗗 <span class="btn-text">Sair</span>`
      : `⛶ <span class="btn-text">Tela Cheia</span>`;
  }
  setTimeout(() => {
    game?.scale.refresh();
  }, 100);
});
window.addEventListener("resize", () => {
  game?.scale.refresh();
});
$("closeDialog").addEventListener("click", closeExtra);
dialog.addEventListener("cancel", (e) => {
  e.preventDefault();
  closeExtra();
});
document.addEventListener("click", (e) => {
  const target = (e.target as HTMLElement).closest<HTMLElement>(
    "[data-open],[data-answer],[data-action],[data-rank]",
  );
  if (!target) return;
  if (target.dataset.open) openExtra(target.dataset.open);
  if (target.dataset.answer) {
    sim.answer(target.dataset.answer === "true");
    sync();
  }
  if (target.dataset.rank) {
    rankingMode = target.dataset.rank as Mode | "legacy";
    ranking();
  }
  switch (target.dataset.action) {
    case "resume":
      close();
      sim.resume();
      scene?.resetClock();
      sync();
      focusGame();
      break;
    case "continue":
      close();
      sim.continueQuiz();
      scene?.resetClock();
      sync();
      if (sim.state === "playing" || sim.state === "countdown") focusGame();
      break;
    case "home":
      close();
      sim.home();
      sync();
      player.focus();
      break;
    case "retry":
      close();
      sim.start(sim.mode);
      scene?.resetClock();
      sync();
      focusGame();
      break;
  }
});
document.addEventListener("change", (e) => {
  const el = e.target as HTMLInputElement;
  if (el.id === "muteSetting") store.data.muted = el.checked;
  if (el.id === "motionSetting") store.data.reducedMotion = el.checked;
  document.body.classList.toggle("reduce-motion", store.data.reducedMotion);
  store.save();
  storageStatus();
});
document.addEventListener("keydown", (e) => {
  if (e.repeat) return;
  if (sim.state === "quiz" && ["v", "f"].includes(e.key.toLowerCase())) {
    e.preventDefault();
    sim.answer(e.key.toLowerCase() === "v");
    sync();
    return;
  }
  if ((e.target as HTMLElement).matches("input,textarea,select") || dialog.open)
    return;
  if (e.key === "Escape") {
    sim.pause();
    sync();
  }
  if (e.key === "f" || e.key === "F") {
    e.preventDefault();
    toggleFullscreen();
    return;
  }
  if (e.code === "Space" || e.key === "ArrowUp") {
    if (sim.state === "playing") {
      e.preventDefault();
      sim.flap();
    }
  }
});
document.addEventListener("visibilitychange", () => {
  if (document.hidden) {
    sim.pause();
    scene?.resetClock();
    sync();
  }
});
window.addEventListener("blur", () => {
  sim.pause();
  scene?.resetClock();
  sync();
});
document.body.classList.toggle("reduce-motion", store.data.reducedMotion);
storageStatus();
sync();
validate();
