/* MiniRed · Data Detective
   Juego estático: usa portal.json y conserva el progreso sólo en este navegador. */

const STORAGE_KEY = "minired-data-detective-v1";
const MAX_XP = 1000;
const $ = (selector, context = document) => context.querySelector(selector);

let DATA;
let missions = [];
let game = loadGame();

const QUESTION_HELP = {
  valor: "Los tipos analíticos describen qué representa un dato, no cómo se almacena en SQL. Una medición monetaria puede contener decimales y admite operaciones como suma, promedio y comparación.",
  zona: "Una variable categórica identifica grupos. Es nominal cuando sus valores no tienen un orden natural: Centro no es mayor ni menor que Norte, Oeste o Sur.",
  quiebre: "Una variable binaria tiene sólo dos estados. En Fact_Stock, EsQuiebre vale 1 cuando no hay stock disponible y 0 cuando sí lo hay.",
  cantidad: "Una variable discreta representa conteos separados, normalmente enteros. Podemos vender 8 o 9 unidades; en este modelo no se registra una fracción de unidad.",
  fecha: "Una variable temporal ubica cada hecho en el tiempo. En el cubo permite navegar la jerarquía Año → Trimestre → Mes → Fecha y comparar períodos.",
  dimensions: "Una dimensión responde desde qué perspectiva se analiza un hecho: tiempo, territorio, producto o sucursal. Una medida es el valor numérico observado, como unidades, quiebres o inventario.",
  formula: "Cada fila de Fact_Stock es una observación: un día, una sucursal y un producto. Quiebres cuenta cuántas de esas observaciones tuvieron stock cero. Si un grupo tiene 20/100 y otro 90/900, juntos son 110/1000 = 11 %, no el promedio 15 %.",
  hotspot: "Para comparar zona y categoría, el cubo agrupa sus registros. Dentro de cada combinación suma las observaciones y los quiebres, y recién después calcula Quiebres ÷ Observaciones × 100.",
  stock: "Agregar significa resumir varios registros con una operación como SUM, COUNT o AVG. El stock es un estado capturado cada día: sumar 20 del lunes, 15 del martes y 12 del miércoles daría 47, aunque al cierre sólo quedan 12.",
  lift: "El lift compara la confianza de una regla con la frecuencia normal del resultado. Lift = 1 indica que el antecedente no cambia la probabilidad; cuanto más supera 1, mayor es la asociación relativa.",
  holdout: "El hold-out separa períodos: se descubre el patrón con 2024 y se comprueba con 2025. Una diferencia pequeña entre ambas confianzas sugiere que la regla es estable y no memorizó un único período.",
  confounder: "Una variable de confusión puede hacer que atribuyamos el problema al proveedor cuando en realidad está concentrado en una zona. Por eso se recalcula la tasa excluyendo Oeste y se compara cuánto cambia.",
  confidence: "La confianza es P(resultado | antecedente): la proporción de casos con antecedente que también presentan el resultado. No demuestra causalidad ni garantiza qué ocurrirá en cada caso futuro.",
  close: "Un total por zona es un punto de partida, no una causa. El drill-down del cubo permite abrir el dato por categoría, sucursal, producto y fecha antes de recomendar una acción costosa.",
  "historic-stock": "El stock es semi-aditivo: puede sumarse entre productos y sucursales en una misma fecha, pero no entre fechas. Para un período se usa el último snapshot con datos, llamado LastNonEmpty.",
  action: "El aprendizaje inductivo convierte observaciones particulares en una regla general y luego en una acción. La recomendación debe responder al patrón concreto y conservar su alcance temporal, territorial y de producto."
};

function loadGame() {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY));
    if (saved?.version === 1 && Array.isArray(saved.results)) return saved;
  } catch { /* El modo privado puede impedir localStorage. */ }
  return { version: 1, current: 0, results: [null, null, null, null] };
}

function saveGame() {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(game)); } catch { /* progreso sólo en memoria */ }
}

function esc(value) {
  return String(value ?? "").replace(/[&<>'"]/g, char => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;"
  })[char]);
}

function pct(value) {
  return new Intl.NumberFormat("es-AR", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(value) + "%";
}

function initTheme() {
  const saved = (() => { try { return localStorage.getItem("minired-tema"); } catch { return null; } })();
  if (saved) document.documentElement.setAttribute("data-theme", saved);
  $("#tema").addEventListener("click", () => {
    const current = document.documentElement.getAttribute("data-theme");
    const dark = current ? current === "dark" : matchMedia("(prefers-color-scheme: dark)").matches;
    const next = dark ? "light" : "dark";
    document.documentElement.setAttribute("data-theme", next);
    try { localStorage.setItem("minired-tema", next); } catch { /* modo privado */ }
  });
}

async function loadData() {
  try {
    const response = await fetch("data/portal.json", { cache: "no-store" });
    if (response.ok) {
      const data = JSON.parse((await response.text()).replace(/^\uFEFF/, ""));
      if (data?.meta && data?.reglas) return { data, source: "archivo local" };
    }
  } catch { /* file:// bloquea el JSON; se usa la semilla. */ }
  if (window.__MINIRED_SEED__?.meta) return { data: window.__MINIRED_SEED__, source: "copia embebida" };
  throw new Error("No se encontró el dataset del juego.");
}

function aggregateHotspot(rows) {
  const groups = new Map();
  rows.forEach(row => {
    const key = `${row.zona}|${row.categoria}`;
    const item = groups.get(key) || { key, zona: row.zona, categoria: row.categoria, quiebres: 0, observaciones: 0 };
    item.quiebres += Number(row.quiebres) || 0;
    item.observaciones += Number(row.observaciones) || 0;
    groups.set(key, item);
  });
  return [...groups.values()]
    .map(item => ({ ...item, tasa: item.observaciones ? item.quiebres * 100 / item.observaciones : 0 }))
    .sort((a, b) => b.tasa - a.tasa)[0];
}

function buildMissions(data) {
  const hotspot = aggregateHotspot(data.sucursales);
  const strongest = [...data.reglas].sort((a, b) => b.lift - a.lift)[0];
  const mostStable = [...data.reglas].sort((a, b) =>
    Math.abs(a.conf2024 - a.conf2025) - Math.abs(b.conf2024 - b.conf2025))[0];
  const confounded = [...data.proveedores].sort((a, b) =>
    (b.tasaGlobal - b.tasaSinOeste) - (a.tasaGlobal - a.tasaSinOeste))[0];
  const rule3 = data.reglas.find(rule => rule.id === "R3") || strongest;

  const commonRules = data.reglas.map(rule => ({ value: rule.id, label: `${rule.id} · ${rule.regla}` }));
  const supplierOptions = [confounded, ...data.proveedores.filter(item => item.proveedor !== confounded.proveedor)]
    .slice(0, 4).map(item => ({ value: item.proveedor, label: item.proveedor }));

  return [
    {
      id: "audit", name: "Data Audit", reward: 100,
      subtitle: "Clasificá las variables antes de analizar.",
      briefing: "Una clasificación correcta determina qué operaciones tienen sentido. No se promedia una categoría ni se trata un indicador binario como dinero.",
      questions: [
        q("valor", "¿Qué tipo de variable es ValorInventario?", [
          o("continua", "Cuantitativa continua"), o("categorica", "Categórica"), o("binaria", "Binaria")
        ], "continua", "Representa un monto monetario y admite valores dentro de una escala numérica."),
        q("zona", "¿Qué tipo de variable es Zona?", [
          o("continua", "Cuantitativa continua"), o("categorica", "Categórica nominal"), o("temporal", "Temporal")
        ], "categorica", "Centro, Norte, Oeste y Sur son categorías sin un orden numérico natural."),
        q("quiebre", "¿Qué tipo de variable es EsQuiebre?", [
          o("binaria", "Binaria"), o("continua", "Continua"), o("texto", "Texto libre")
        ], "binaria", "Sólo toma 0 o 1: hubo o no hubo quiebre para esa observación."),
        q("cantidad", "¿Qué tipo de variable es CantidadVendida?", [
          o("discreta", "Cuantitativa discreta"), o("categorica", "Categórica ordinal"), o("binaria", "Binaria")
        ], "discreta", "Cuenta unidades vendidas; sus valores representan cantidades enteras."),
        q("fecha", "¿Qué tipo de variable es Fecha?", [
          o("temporal", "Temporal"), o("continua", "Continua monetaria"), o("categorica", "Categórica nominal")
        ], "temporal", "Permite ordenar observaciones y navegar las jerarquías Año → Trimestre → Mes → Fecha.")
      ]
    },
    {
      id: "cube", name: "Cube Master", reward: 200,
      subtitle: "Elegí dimensiones, medidas y agregaciones válidas.",
      briefing: `El cubo detectó como foco principal a ${hotspot.zona} · ${hotspot.categoria}, con una tasa de quiebre de ${pct(hotspot.tasa)}. Reconstruí correctamente ese análisis.`,
      questions: [
        q("dimensions", "¿Qué dimensiones permiten comparar el problema por territorio y familia de productos?", [
          o("zona-categoria", "Zona y Categoría"), o("importe-ticket", "Importe y Ticket"), o("stock-ventas", "Stock y Ventas")
        ], "zona-categoria", "Zona y Categoría son atributos de dimensiones. Stock y Ventas son grupos de medidas."),
        q("formula", "¿Cómo se calcula correctamente la tasa de quiebre al reagrupar datos?", [
          o("ratio-sumas", "SUM(Quiebres) / SUM(Observaciones)"), o("promedio", "AVG(TasaDeCadaFila)"), o("solo-quiebres", "SUM(Quiebres)")
        ], "ratio-sumas", "Se suman primero numerador y denominador. Promediar tasas de grupos de distinto tamaño introduce sesgo."),
        q("hotspot", "Según el dataset, ¿qué combinación tiene la mayor tasa de quiebre?", [
          o(hotspot.key, `${hotspot.zona} · ${hotspot.categoria}`), o("Norte|Lacteos", "Norte · Lácteos"), o("Sur|Limpieza", "Sur · Limpieza"), o("Centro|Bebidas", "Centro · Bebidas")
        ], hotspot.key, `El resultado surge de ${hotspot.quiebres.toLocaleString("es-AR")} quiebres sobre ${hotspot.observaciones.toLocaleString("es-AR")} observaciones.`),
        q("stock", "Para mostrar el stock disponible al cierre, ¿qué agregación corresponde sobre el tiempo?", [
          o("last", "LastNonEmpty"), o("sum", "Sum"), o("distinct", "DistinctCount"), o("average", "AverageOfChildren")
        ], "last", "El stock es semi-aditivo: puede sumarse entre productos o sucursales, pero no entre fechas. Se toma el último snapshot disponible.")
      ]
    },
    {
      id: "patterns", name: "Pattern Hunter", reward: 300,
      subtitle: "Separá patrones útiles de correlaciones engañosas.",
      briefing: "La confianza aislada no alcanza. Contrastá cada regla con su tasa base, lift, estabilidad temporal y posibles variables de confusión.",
      evidence: "rules",
      questions: [
        q("lift", "¿Qué regla muestra la asociación relativa más fuerte según su lift?", commonRules, strongest.id,
          `${strongest.id} alcanza un lift de ${strongest.lift.toFixed(2)}: el resultado es ${strongest.lift.toFixed(2)} veces más probable bajo su antecedente que en la población base.`),
        q("holdout", "¿Qué regla es la más estable entre 2024 y 2025?", commonRules, mostStable.id,
          `${mostStable.id} cambia sólo ${pct(Math.abs(mostStable.conf2024 - mostStable.conf2025))} entre entrenamiento y hold-out.`),
        q("confounder", "¿Qué proveedor parece problemático globalmente, pero mejora más al excluir la zona Oeste?", supplierOptions, confounded.proveedor,
          `${confounded.proveedor} pasa de ${pct(confounded.tasaGlobal)} a ${pct(confounded.tasaSinOeste)}. La zona es una explicación más fuerte que el proveedor por sí solo.`)
      ]
    },
    {
      id: "director", name: "Director MiniRed", reward: 400,
      subtitle: "Defendé el análisis ante un cliente difícil.",
      briefing: "El Director quiere decisiones rápidas. Tu tarea es responder con evidencia sin convertir asociaciones en causalidad.",
      questions: [
        q("confidence", `“Una regla con ${pct(rule3.confianza)} de confianza acierta siempre, ¿verdad?”`, [
          o("no-base", "No. Debemos compararla con la tasa base, el lift y el hold-out."), o("yes", "Sí. Una confianza alta demuestra causalidad."), o("sample", "Sí, siempre que tenga muchos casos.")
        ], "no-base", "La confianza es una frecuencia condicional, no una garantía ni una prueba causal."),
        q("close", "“Oeste tiene muchos quiebres. ¿Cierro una sucursal?”", [
          o("investigate", "No todavía: segmentaría por categoría, día y sucursal antes de decidir."), o("close", "Sí: la zona explica por sí sola toda la pérdida."), o("ignore", "No: los quiebres nunca afectan ventas.")
        ], "investigate", "El cubo permite hacer drill-down. El foco puede estar concentrado en una categoría o patrón temporal y requerir reposición, no cierre."),
        q("historic-stock", "“Sumemos el stock de los 731 días para saber cuánto tenemos.”", [
          o("snapshot", "Eso duplica snapshots: para el cierre usamos LastNonEmpty."), o("sum", "Correcto: todo inventario histórico es aditivo."), o("tickets", "Conviene usar DistinctCount de tickets.")
        ], "snapshot", "Sumar existencias diarias mezcla estados sucesivos del mismo inventario y produce un total sin significado operativo."),
        q("action", `“¿Qué acción concreta propone la regla ${rule3.id}?”`, [
          o("seasonal", "Ajustar estacionalmente el nivel objetivo de congelados en verano."), o("supplier", "Cambiar todos los proveedores de bebidas."), o("close-branch", "Cerrar San Justo durante diciembre.")
        ], "seasonal", `${rule3.regla} se traduce en una política preventiva: ${rule3.accion}.`)
      ]
    }
  ];
}

function q(id, prompt, options, correct, explanation) { return { id, prompt, options, correct, explanation }; }
function o(value, label) { return { value, label }; }

function totalXp() {
  return game.results.reduce((sum, result) => sum + (result?.score || 0), 0);
}

function completedCount() {
  return game.results.filter(Boolean).length;
}

function firstPending() {
  const index = game.results.findIndex(result => !result);
  return index === -1 ? missions.length - 1 : index;
}

function rankFor(xp) {
  if (xp >= 851) return "Data Detective de MiniRed";
  if (xp >= 601) return "Especialista OLAP";
  if (xp >= 301) return "Investigador de datos";
  return "Analista junior";
}

function renderMap() {
  const unlocked = firstPending();
  $("#mission-map").innerHTML = missions.map((mission, index) => {
    const done = Boolean(game.results[index]);
    const locked = index > unlocked;
    return `<button class="mission-tab" type="button" data-index="${index}" data-done="${done}" ${locked ? "disabled" : ""} ${index === game.current ? 'aria-current="step"' : ""}>
      <span class="mission-no">Misión ${index + 1}${done ? " · resuelta" : locked ? " · bloqueada" : ""}</span>
      <span class="mission-name">${esc(mission.name)}</span>
      <span class="mission-xp">${mission.reward} XP</span>
    </button>`;
  }).join("");

  $("#mission-map").querySelectorAll("button:not(:disabled)").forEach(button => {
    button.addEventListener("click", () => {
      game.current = Number(button.dataset.index);
      saveGame();
      render();
      $("#mission-stage").scrollIntoView({ behavior: "smooth", block: "start" });
    });
  });
}

function evidenceTable() {
  return `<div class="evidence-table">
    <table>
      <caption>Evidencia obtenida del cubo</caption>
      <thead><tr><th>Regla</th><th class="num">Soporte</th><th class="num">Confianza</th><th class="num">Base</th><th class="num">Lift</th><th class="num">2024</th><th class="num">2025</th></tr></thead>
      <tbody>${DATA.reglas.map(rule => `<tr>
        <td class="name">${esc(rule.id)} · ${esc(rule.regla)}</td><td class="num">${pct(rule.soporte)}</td><td class="num">${pct(rule.confianza)}</td>
        <td class="num">${pct(rule.base)}</td><td class="num">${rule.lift.toFixed(2)}</td>
        <td class="num">${pct(rule.conf2024)}</td><td class="num">${pct(rule.conf2025)}</td>
      </tr>`).join("")}</tbody>
    </table>
  </div>`;
}

function renderMission() {
  const mission = missions[game.current];
  const result = game.results[game.current];
  const answers = result?.answers || {};
  const pointsPerQuestion = mission.reward / mission.questions.length;

  const questions = mission.questions.map((question, index) => {
    const selected = answers[question.id];
    const options = question.options.map(option => {
      const checked = selected === option.value;
      const stateClass = result ? option.value === question.correct ? " is-correct" : checked ? " is-wrong" : "" : "";
      return `<label class="answer-option${stateClass}">
        <input type="radio" name="q-${esc(question.id)}" value="${esc(option.value)}" ${checked ? "checked" : ""} ${result ? "disabled" : ""}>
        <span>${esc(option.label)}</span>
      </label>`;
    }).join("");
    const correct = selected === question.correct;
    const feedback = result ? `<p class="answer-feedback"><strong>${correct ? "✓ Correcto." : "✕ Revisá este concepto."}</strong> ${esc(question.explanation)}</p>` : "";
    return `<fieldset class="question">
      <legend><span class="question-index">${String(index + 1).padStart(2, "0")}</span>${esc(question.prompt)}</legend>
      <details class="concept-help">
        <summary>Ver ayuda conceptual</summary>
        <p>${esc(QUESTION_HELP[question.id] || question.explanation)}</p>
      </details>
      <div class="answer-list">${options}</div>${feedback}
    </fieldset>`;
  }).join("");

  const action = result
    ? `<span class="score-summary">Resultado: <strong>${result.score}</strong> / ${mission.reward} XP</span>
       ${game.current < missions.length - 1 ? '<button class="primary-button" id="next-mission" type="button">Siguiente misión →</button>' : '<a class="primary-button finish-link" href="#final-report">Ver informe final</a>'}`
    : `<span class="score-summary">${mission.questions.length} desafíos · ${pointsPerQuestion} XP cada uno</span>
       <button class="primary-button" id="submit-mission" type="button">Cerrar misión</button>`;

  $("#mission-stage").innerHTML = `<article class="mission-panel">
    <header class="mission-header">
      <div><p class="eyebrow">Misión ${game.current + 1} de ${missions.length}</p><h2>${esc(mission.name)}</h2><p>${esc(mission.subtitle)}</p></div>
      <span class="mission-reward">+ ${mission.reward} XP</span>
    </header>
    <div class="mission-body">
      <p class="briefing">${esc(mission.briefing)}</p>
      ${mission.evidence === "rules" ? evidenceTable() : ""}
      <form id="mission-form"><div class="questions">${questions}</div></form>
      <div class="mission-actions">${action}</div>
    </div>
  </article>`;

  $("#submit-mission")?.addEventListener("click", submitMission);
  $("#next-mission")?.addEventListener("click", () => {
    game.current = Math.min(game.current + 1, missions.length - 1);
    saveGame();
    render();
    $("#mission-stage").scrollIntoView({ behavior: "smooth", block: "start" });
  });
}

function submitMission() {
  const mission = missions[game.current];
  const form = $("#mission-form");
  const formData = new FormData(form);
  const answers = {};
  mission.questions.forEach(question => {
    const value = formData.get(`q-${question.id}`);
    if (value !== null) answers[question.id] = value;
  });

  if (Object.keys(answers).length !== mission.questions.length) {
    showNotice("Respondé todos los desafíos antes de cerrar la misión.");
    const unanswered = mission.questions.find(question => !answers[question.id]);
    form.elements[`q-${unanswered.id}`]?.[0]?.focus();
    return;
  }

  const correct = mission.questions.filter(question => answers[question.id] === question.correct).length;
  const score = Math.round(correct * mission.reward / mission.questions.length);
  game.results[game.current] = { score, max: mission.reward, answers };
  saveGame();
  hideNotice();
  render();
}

function renderFinal() {
  const final = $("#final-report");
  if (completedCount() !== missions.length) {
    final.hidden = true;
    final.innerHTML = "";
    return;
  }
  const xp = totalXp();
  const rank = rankFor(xp);
  final.hidden = false;
  final.innerHTML = `<p class="eyebrow">Caso cerrado · informe DD-2025</p>
    <h2 id="final-title">${esc(rank)}</h2>
    <p>Completaste las cuatro etapas del proceso: auditaste variables, razonaste sobre el cubo, validaste patrones y defendiste decisiones de negocio sin confundir asociación con causalidad.</p>
    <span class="final-score">${xp} / ${MAX_XP} XP</span>`;
}

function showNotice(message, kind = "warning") {
  const notice = $("#game-notice");
  notice.textContent = message;
  notice.dataset.kind = kind;
  notice.hidden = false;
}

function hideNotice() { $("#game-notice").hidden = true; }

function render() {
  const unlocked = firstPending();
  if (game.current > unlocked || game.current < 0) game.current = unlocked;
  const xp = totalXp();
  const completed = completedCount();
  $("#xp-total").textContent = xp;
  $("#rank-label").textContent = rankFor(xp);
  $("#progress-fill").style.width = `${completed * 25}%`;
  $("#progress-text").textContent = `${completed} de 4 misiones resueltas`;
  renderMap();
  renderMission();
  renderFinal();
}

async function main() {
  initTheme();
  $("#restart-game").addEventListener("click", () => {
    if (!confirm("¿Reiniciar la investigación y borrar el XP guardado en este navegador?")) return;
    game = { version: 1, current: 0, results: [null, null, null, null] };
    saveGame();
    hideNotice();
    render();
    window.scrollTo({ top: 0, behavior: "smooth" });
  });

  try {
    const loaded = await loadData();
    DATA = loaded.data;
    $("#data-source").textContent = loaded.source;
    missions = buildMissions(DATA);
    if (game.results.length !== missions.length) game = { version: 1, current: 0, results: missions.map(() => null) };
    render();
  } catch (error) {
    showNotice(error.message, "error");
    $("#mission-stage").innerHTML = '<div class="mission-panel"><div class="mission-body"><h2>No se pudo iniciar el caso</h2><p>Verificá que <code>data/portal.json</code> o <code>seed-data.js</code> estén junto a esta página.</p></div></div>';
  }
}

main();
