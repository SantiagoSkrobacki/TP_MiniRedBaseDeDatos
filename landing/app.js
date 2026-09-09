/* ==========================================================================
   MiniRed · Portal de Operaciones y Abastecimiento
   --------------------------------------------------------------------------
   CAPA DE DATOS
   El portal pide los datos en este orden y se queda con el primero que responde:
     1. API del backend      GET {API_BASE}/dashboard
     2. JSON servido         data/portal.json             (requiere http://)
     3. Semilla embebida     seed-data.js                 (funciona con file://)

   El contrato es el mismo en los tres casos: el documento que devuelve
   MiniRed_DW.dbo.sp_PortalDashboard. Cuando exista el backend no hay que
   tocar nada de este archivo salvo API_BASE.

   Cada fila del contrato trae CONTEOS además de la tasa ya calculada, y por
   eso los filtros pueden reagregar con exactitud: promediar tasas de
   subgrupos de distinto tamaño da un número equivocado; sumar conteos, no.
   ========================================================================== */

/* Ruta de la API.
   - Relativa ("/api"): el backend vive en el mismo origen que la página.
   - Absoluta ("https://mi-api.example.com/api"): backend en otro servidor.
     En ese caso el backend debe permitir CORS para este origen y responder
     por HTTPS, porque una página HTTPS no puede consultar un backend HTTP. */
const API_BASE = "/api";

const API_ES_ABSOLUTA = /^https?:\/\//i.test(API_BASE);

/* GitHub Pages es hosting estático: no hay backend en su propio origen, así que
   con una API relativa se saltea el intento y no queda un 404 en la consola.
   Si se configura una API absoluta, se prueba igual — Pages contra un backend
   externo es un escenario válido. */
const API_HABILITADA = API_ES_ABSOLUTA || !/\.github\.io$/i.test(location.hostname);

const state = { zona: "*", cat: "*", orden: { col: "tasa", dir: -1 }, tablas: {} };
let DATA = null;

/* ---------------------------------------------------------------- utilidades */

const $  = (s, c = document) => c.querySelector(s);
const $$ = (s, c = document) => Array.from(c.querySelectorAll(s));

const nf0 = new Intl.NumberFormat("es-AR", { maximumFractionDigits: 0 });
const nf1 = new Intl.NumberFormat("es-AR", { minimumFractionDigits: 1, maximumFractionDigits: 1 });
const nf2 = new Intl.NumberFormat("es-AR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const pct   = v => nf2.format(v) + "%";
const money = v => "$ " + nf0.format(v);
const num   = v => nf0.format(v);


/** Umbrales operativos. Devuelven un estado semántico, nunca un color suelto:
 *  cada chip que los usa viaja siempre con ícono y etiqueta. */
function sevQuiebre(v) {
  if (v >= 8)   return "critical";
  if (v >= 5)   return "serious";
  if (v >= 2)   return "warning";
  return "good";
}
function sevCobertura(v) {
  if (v >= 8)   return "critical";   // sobrestock: capital inmovilizado
  if (v >= 6)   return "serious";
  if (v < 2.5)  return "warning";    // sin colchón ante un pico
  return "good";
}
const ETIQUETA = { critical: "Crítico", serious: "Alto", warning: "Atención", good: "Normal" };
const ICONO    = { critical: "▲", serious: "▲", warning: "●", good: "✓" };

/** La base guarda los nombres sin tildes para evitar problemas de codificación
 *  en sqlcmd/bcp y en el procesamiento del cubo. Acá se los devolvemos para
 *  mostrarlos: es una capa de presentación, no toca el dato. */
const LINDO = {
  Almacen: "Almacén", Lacteos: "Lácteos",
  Moron: "Morón", Ituzaingo: "Ituzaingó", "Vicente Lopez": "Vicente López",
  "Cerveceria Quilmes": "Cervecería Quilmes", "La Serenisima": "La Serenísima",
  "Frigorifico Sur": "Frigorífico Sur",
  "Pure de Tomate 520g": "Puré de Tomate 520g",
  "Gaseosa Lima-Limon 2.25L": "Gaseosa Lima-Limón 2.25L",
  "Jabon en Polvo 800g": "Jabón en Polvo 800g",
  "Papel Higienico x4": "Papel Higiénico x4",
  "Agua Saborizada 1.5L": "Agua Saborizada 1,5L",
  Miercoles: "Miércoles", Sabado: "Sábado",
};
const lindo = v => LINDO[v] || v;

function chip(estado, texto) {
  return `<span class="chip" data-state="${estado}"><span class="ic" aria-hidden="true">${ICONO[estado]}</span>${texto || ETIQUETA[estado]}</span>`;
}

/* ------------------------------------------------------------------- filtros */

const pasaFiltro = r =>
  (state.zona === "*" || r.zona === state.zona) &&
  (state.cat  === "*" || r.categoria === state.cat);

const fSerie = () => DATA.serie.filter(pasaFiltro);
const fSuc   = () => DATA.sucursales.filter(pasaFiltro);
const fProd  = () => DATA.productos.filter(pasaFiltro);
const fDias  = () => DATA.porDiaSemana.filter(pasaFiltro);

/** Agrupa filas y suma los conteos. Devuelve un Map clave → acumulador. */
function agrupar(filas, claveFn, iniFn) {
  const m = new Map();
  for (const r of filas) {
    const k = claveFn(r);
    if (!m.has(k)) m.set(k, iniFn(r));
    const a = m.get(k);
    a.obs += r.observaciones;
    a.q   += r.quiebres;
    if (r.unidades  != null) a.uni    = (a.uni || 0)   + r.unidades;
    if (r.valorInv  != null) a.valor  = (a.valor || 0) + r.valorInv;
    if (r.reposPend != null) a.repos  = (a.repos || 0) + r.reposPend;
    if (r.combinaciones != null) a.comb = (a.comb || 0) + r.combinaciones;
    if (r.bajoMinimo != null) a.bajo   = (a.bajo || 0)  + r.bajoMinimo;
    // promedios ponderados por cantidad de observaciones
    if (r.stockProm != null) a.stockW  = (a.stockW || 0) + r.stockProm * r.observaciones;
    if (r.ventaProm != null) a.ventaW  = (a.ventaW || 0) + r.ventaProm * r.observaciones;
    if (r.stock     != null) a.stockW  = (a.stockW || 0) + r.stock * r.observaciones;
  }
  for (const a of m.values()) {
    a.tasa = a.obs ? (100 * a.q) / a.obs : 0;
    if (a.stockW != null && a.ventaW) a.cobertura = a.stockW / a.ventaW;
  }
  return m;
}

/* ------------------------------------------------------------------ tooltip */

const tip = $("#tip");
function mostrarTip(html, ev) {
  tip.innerHTML = html;
  tip.dataset.show = "1";
  const r = tip.getBoundingClientRect();
  let x = ev.clientX + 14, y = ev.clientY - r.height - 12;
  if (x + r.width > window.innerWidth - 10) x = ev.clientX - r.width - 14;
  if (y < 10) y = ev.clientY + 18;
  tip.style.left = x + "px";
  tip.style.top  = y + "px";
}
const ocultarTip = () => { tip.dataset.show = "0"; };
function filaTip(k, v) { return `<div class="tip-row"><span>${k}</span><b>${v}</b></div>`; }

/* ---------------------------------------------------------------- svg helpers */

const SVGNS = "http://www.w3.org/2000/svg";
function el(tag, attrs = {}, padre = null) {
  const n = document.createElementNS(SVGNS, tag);
  for (const [k, v] of Object.entries(attrs)) if (v != null) n.setAttribute(k, v);
  if (padre) padre.appendChild(n);
  return n;
}
function svgRoot(cont, w, h) {
  cont.innerHTML = "";
  const s = el("svg", { viewBox: `0 0 ${w} ${h}`, role: "img" }, cont);
  return s;
}
/** Escalones "lindos" para el eje: 1, 2, 2.5, 5, 10 × 10^n */
function ticksLindos(max, n = 4) {
  if (max <= 0) return [0];
  const crudo = max / n;
  const mag = Math.pow(10, Math.floor(Math.log10(crudo)));
  const norm = crudo / mag;
  const paso = (norm <= 1 ? 1 : norm <= 2 ? 2 : norm <= 2.5 ? 2.5 : norm <= 5 ? 5 : 10) * mag;
  const out = [];
  for (let v = 0; v <= max + paso * 0.001; v += paso) out.push(+v.toFixed(10));
  return out;
}

/* ==========================================================================
   RENDER
   ========================================================================== */

function render() {
  const suc = agrupar(fSuc(), r => r.sucursal, r => ({ zona: r.zona, obs: 0, q: 0 }));
  renderKpis(suc);
  renderAlertas(suc);
  renderHeatmap();
  renderDias();
  renderSerie();
  renderSku();
  renderSucursales(suc);
  renderReglas();
  renderProveedores();
  aplicarVistas();
}

/* ------------------------------------------------------------------- KPIs */

function renderKpis(sucMap) {
  const filas = fSuc();
  const t = filas.reduce((a, r) => {
    a.obs += r.observaciones; a.q += r.quiebres; a.uni += r.unidades;
    a.valor += r.valorInv; a.repos += r.reposPend; a.comb += r.combinaciones;
    a.stockW += r.stockProm * r.observaciones;
    a.ventaW += r.ventaProm * r.observaciones;
    return a;
  }, { obs: 0, q: 0, uni: 0, valor: 0, repos: 0, comb: 0, stockW: 0, ventaW: 0 });

  const tasa = t.obs ? (100 * t.q) / t.obs : 0;
  const cob  = t.ventaW ? t.stockW / t.ventaW : 0;
  const sQ = sevQuiebre(tasa), sC = sevCobertura(cob);
  const sR = t.comb && t.repos / t.comb >= 0.5 ? "serious"
           : t.comb && t.repos / t.comb >= 0.25 ? "warning" : "good";

  $("#kpis").innerHTML = `
    <div class="kpi" data-state="${sQ}">
      <span class="kpi-label">Tasa de quiebre</span>
      <span class="kpi-value">${nf2.format(tasa)}<span class="unit">%</span></span>
      <span class="kpi-foot">${num(t.q)} días-producto sin stock sobre ${num(t.obs)}</span>
    </div>
    <div class="kpi" data-state="${sC}">
      <span class="kpi-label">Días de cobertura</span>
      <span class="kpi-value">${nf1.format(cob)}<span class="unit"> d</span></span>
      <span class="kpi-foot">Lo que dura en góndola el stock promedio</span>
    </div>
    <div class="kpi" data-state="${sR}">
      <span class="kpi-label">Reposiciones pendientes</span>
      <span class="kpi-value">${num(t.repos)}<span class="unit"> / ${num(t.comb)}</span></span>
      <span class="kpi-foot">Combinaciones sucursal-producto bajo el punto de pedido</span>
    </div>
    <div class="kpi" data-state="good">
      <span class="kpi-label">Valor de inventario</span>
      <span class="kpi-value">${money(t.valor)}</span>
      <span class="kpi-foot">Capital en góndola al ${DATA.meta.ultimaFecha}</span>
    </div>`;

  const dz = state.zona === "*" ? "toda la cadena" : `zona ${state.zona}`;
  const dc = state.cat  === "*" ? "todas las categorías" : lindo(state.cat);
  $("#kpi-scope").textContent = `${dz} · ${dc} · ${num(sucMap.size)} sucursal${sucMap.size === 1 ? "" : "es"}`;
}

/* --------------------------------------------------------------- alertas */

function renderAlertas(sucMap) {
  const sucs = Array.from(sucMap, ([nombre, a]) => ({ nombre, ...a }));
  const alertas = [];

  const peor = sucs.slice().sort((a, b) => b.tasa - a.tasa)[0];
  if (peor && peor.tasa >= 2) {
    alertas.push({
      estado: sevQuiebre(peor.tasa),
      etiqueta: "Quiebre",
      titulo: `Quiebre sostenido en ${lindo(peor.nombre)}`,
      cuerpo: `La sucursal registra la tasa de faltante más alta del recorte actual. El nivel objetivo de reposición no cubre el pico de demanda.`,
      metrica: `${pct(peor.tasa)} de los días · zona ${peor.zona}`
    });
  }

  const sobre = sucs.filter(s => s.cobertura >= 6).sort((a, b) => b.cobertura - a.cobertura)[0];
  if (sobre) {
    alertas.push({
      estado: sevCobertura(sobre.cobertura),
      etiqueta: "Sobrestock",
      titulo: `Sobrestock en ${lindo(sobre.nombre)}`,
      cuerpo: `Mantiene mucho más stock del que su demanda justifica. Es capital inmovilizado y riesgo de merma, no un problema de faltante.`,
      metrica: `${nf1.format(sobre.cobertura)} días de cobertura · ${money(sobre.valor || 0)} en góndola`
    });
  }

  const prods = Array.from(
    agrupar(fProd(), r => r.producto, r => ({ prov: r.proveedor, cat: r.categoria, obs: 0, q: 0 })),
    ([nombre, a]) => ({ nombre, ...a })
  ).sort((a, b) => b.tasa - a.tasa);
  if (prods[0] && prods[0].tasa >= 2) {
    alertas.push({
      estado: sevQuiebre(prods[0].tasa),
      etiqueta: "Faltante",
      titulo: `${lindo(prods[0].nombre)} encabeza los faltantes`,
      cuerpo: `Es el producto con más días sin stock del recorte. Revisar frecuencia de entrega con ${lindo(prods[0].prov)}.`,
      metrica: `${pct(prods[0].tasa)} de los días · ${lindo(prods[0].cat)}`
    });
  }

  if (!alertas.length) {
    alertas.push({
      estado: "good", titulo: "Sin alertas en este recorte",
      cuerpo: "Ninguna sucursal supera el umbral de atención con los filtros aplicados.",
      metrica: "—"
    });
  }

  const orden = { critical: 0, serious: 1, warning: 2, good: 3 };
  $("#alertas").innerHTML = alertas
    .sort((a, b) => orden[a.estado] - orden[b.estado])
    .slice(0, 3)
    .map(a => `
      <article class="alert" data-state="${a.estado}">
        <div class="alert-top">
          <span class="alert-title">${a.titulo}</span>
          ${chip(a.estado, a.etiqueta)}
        </div>
        <p class="alert-body">${a.cuerpo}</p>
        <span class="alert-metric">${a.metrica}</span>
      </article>`).join("");
}

/* -------------------------------------------------------------- mapa de calor */

const RAMPA = ["--seq-0", "--seq-1", "--seq-2", "--seq-3", "--seq-4", "--seq-5", "--seq-6"];
const pasoRampa = (v, max) => {
  if (max <= 0) return 0;
  return Math.min(RAMPA.length - 1, Math.floor((v / max) * RAMPA.length));
};

function renderHeatmap() {
  const filas = fSerie();
  const zonas = [...new Set(filas.map(r => r.zona))].sort();
  const cats  = [...new Set(filas.map(r => r.categoria))].sort();
  const m = agrupar(filas, r => r.zona + "|" + r.categoria, () => ({ obs: 0, q: 0 }));
  const max = Math.max(...Array.from(m.values(), a => a.tasa), 0.01);

  const padL = 78, padT = 30, cw = 108, ch = 40, gap = 2;
  const w = padL + cats.length * cw + 8;
  const h = padT + zonas.length * ch + 14;
  const svg = svgRoot($("#p-heatmap"), w, h);
  svg.setAttribute("aria-label", "Mapa de calor de tasa de quiebre por zona y categoría");

  cats.forEach((c, i) => {
    const t = el("text", { x: padL + i * cw + cw / 2, y: padT - 11, "text-anchor": "middle", class: "tick" }, svg);
    t.textContent = lindo(c);
  });

  zonas.forEach((z, r) => {
    const t = el("text", { x: padL - 10, y: padT + r * ch + ch / 2 + 4, "text-anchor": "end", class: "tick" }, svg);
    t.textContent = z;

    cats.forEach((c, i) => {
      const a = m.get(z + "|" + c);
      const x = padL + i * cw, y = padT + r * ch;
      const rect = el("rect", {
        x: x + gap / 2, y: y + gap / 2, width: cw - gap, height: ch - gap, rx: 2,
        fill: a ? `var(${RAMPA[pasoRampa(a.tasa, max)]})` : "var(--surface-2)"
      }, svg);
      if (!a) return;
      const oscuro = pasoRampa(a.tasa, max) >= 4;
      const lbl = el("text", {
        x: x + cw / 2, y: y + ch / 2 + 4, "text-anchor": "middle",
        class: "datalabel", fill: oscuro ? "#fff" : "var(--ink)"
      }, svg);
      lbl.textContent = nf1.format(a.tasa) + "%";
      rect.style.cursor = "pointer";
      rect.addEventListener("mousemove", ev => mostrarTip(
        `<div class="tip-title">${z} · ${lindo(c)}</div>` +
        filaTip("Tasa de quiebre", pct(a.tasa)) +
        filaTip("Días sin stock", num(a.q)) +
        filaTip("Observaciones", num(a.obs)), ev));
      rect.addEventListener("mouseleave", ocultarTip);
    });
  });

  $("#s-heatmap").innerHTML =
    `<span>0%</span><span class="scale-steps">` +
    RAMPA.map(v => `<span class="scale-step" style="background:var(${v})"></span>`).join("") +
    `</span><span>${nf1.format(max)}%</span>`;

  state.tablas.heatmap = () => tablaHTML(
    ["Zona", "Categoría", "Tasa de quiebre", "Días sin stock", "Observaciones"],
    zonas.flatMap(z => cats.map(c => {
      const a = m.get(z + "|" + c);
      return a ? [z, lindo(c), pct(a.tasa), num(a.q), num(a.obs)] : null;
    }).filter(Boolean)),
    [false, false, true, true, true]);
}

/* ------------------------------------------------------------ día de la semana */

function renderDias() {
  const m = agrupar(fDias(), r => r.dia, r => ({ orden: r.orden, obs: 0, q: 0 }));
  const datos = Array.from(m, ([dia, a]) => ({ dia, ...a })).sort((a, b) => a.orden - b.orden);
  const max = Math.max(...datos.map(d => d.tasa), 0.01);
  const ticks = ticksLindos(max);
  const tope = ticks[ticks.length - 1];

  const padL = 40, padR = 12, padT = 12, padB = 34;
  const w = 470, h = 260;
  const pw = w - padL - padR, ph = h - padT - padB;
  const svg = svgRoot($("#p-dias"), w, h);
  svg.setAttribute("aria-label", "Tasa de quiebre por día de la semana");

  ticks.forEach(t => {
    const y = padT + ph - (t / tope) * ph;
    el("line", { x1: padL, x2: padL + pw, y1: y, y2: y, class: "gridline" }, svg);
    const lb = el("text", { x: padL - 8, y: y + 3.5, "text-anchor": "end", class: "tick" }, svg);
    lb.textContent = nf0.format(t) + "%";
  });
  el("line", { x1: padL, x2: padL + pw, y1: padT + ph, y2: padT + ph, class: "axisline" }, svg);

  const bw = pw / datos.length;
  const pico = datos.reduce((a, b) => (b.tasa > a.tasa ? b : a), datos[0]);

  datos.forEach((d, i) => {
    const bh = (d.tasa / tope) * ph;
    const x = padL + i * bw + bw * 0.18;
    const bwid = bw * 0.64;
    const esPico = d === pico && d.tasa > 0;
    el("rect", {
      x, y: padT + ph - bh, width: bwid, height: Math.max(bh, 0), rx: 3,
      fill: esPico ? "var(--s1)" : "var(--seq-2)"
    }, svg);

    const lb = el("text", { x: x + bwid / 2, y: padT + ph + 15, "text-anchor": "middle", class: "tick" }, svg);
    lb.textContent = lindo(d.dia).slice(0, 3);

    if (esPico || d.tasa === 0) {
      const v = el("text", {
        x: x + bwid / 2, y: padT + ph - bh - 6, "text-anchor": "middle", class: "datalabel",
        fill: esPico ? "var(--s1)" : "var(--muted)"
      }, svg);
      v.textContent = nf1.format(d.tasa) + "%";
    }

    const hit = el("rect", { x: padL + i * bw, y: padT, width: bw, height: ph, fill: "transparent" }, svg);
    hit.style.cursor = "pointer";
    hit.addEventListener("mousemove", ev => mostrarTip(
      `<div class="tip-title">${lindo(d.dia)}</div>` +
      filaTip("Tasa de quiebre", pct(d.tasa)) +
      filaTip("Días sin stock", num(d.q)) +
      filaTip("Observaciones", num(d.obs)), ev));
    hit.addEventListener("mouseleave", ocultarTip);
  });

  const cats = [...new Set(fDias().map(r => r.categoria))];
  $("#dia-note").textContent = (state.cat === "*" && state.zona === "*")
    ? "Sobre toda la cadena. Filtrá por Bebidas y zona Oeste para ver el efecto de arrastre del fin de semana."
    : `El pico cae en ${lindo(pico.dia).toLowerCase()}: cuando el consumo del fin de semana vacía la góndola, el faltante aparece los días siguientes.`;

  state.tablas.dias = () => tablaHTML(
    ["Día", "Tasa de quiebre", "Días sin stock", "Observaciones"],
    datos.map(d => [lindo(d.dia), pct(d.tasa), num(d.q), num(d.obs)]),
    [false, true, true, true]);
}

/* ------------------------------------------------------------- serie mensual */

const MES3 = { Enero: "Ene", Febrero: "Feb", Marzo: "Mar", Abril: "Abr", Mayo: "May", Junio: "Jun",
               Julio: "Jul", Agosto: "Ago", Septiembre: "Sep", Octubre: "Oct", Noviembre: "Nov", Diciembre: "Dic" };

function renderSerie() {
  const m = agrupar(fSerie(), r => r.anio + "-" + String(r.mes).padStart(2, "0"),
                    r => ({ anio: r.anio, mes: r.mes, nombre: r.mesNombre, obs: 0, q: 0 }));
  const d = Array.from(m.values()).sort((a, b) => a.anio - b.anio || a.mes - b.mes);
  if (!d.length) return;

  const w = 1180, padL = 52, padR = 16, gapY = 34;
  const hTop = 132, hBot = 96, padT = 14, padB = 30;
  const h = padT + hTop + gapY + hBot + padB;
  const pw = w - padL - padR;
  const svg = svgRoot($("#p-serie"), w, h);
  svg.setAttribute("aria-label", "Evolución mensual de la tasa de quiebre y de las unidades vendidas");

  const X = i => padL + (d.length === 1 ? pw / 2 : (i * pw) / (d.length - 1));

  function panel(y0, alto, valores, color, fmt, titulo) {
    const max = Math.max(...valores, 0.01);
    const ticks = ticksLindos(max, 3);
    const tope = ticks[ticks.length - 1];
    const Y = v => y0 + alto - (v / tope) * alto;

    const tt = el("text", { x: padL, y: y0 - 5, class: "axistitle" }, svg);
    tt.textContent = titulo;

    ticks.forEach(t => {
      el("line", { x1: padL, x2: padL + pw, y1: Y(t), y2: Y(t), class: "gridline" }, svg);
      const lb = el("text", { x: padL - 8, y: Y(t) + 3.5, "text-anchor": "end", class: "tick" }, svg);
      lb.textContent = fmt(t);
    });
    el("line", { x1: padL, x2: padL + pw, y1: y0 + alto, y2: y0 + alto, class: "axisline" }, svg);

    const pts = valores.map((v, i) => [X(i), Y(v)]);
    el("path", {
      d: "M" + pts.map(p => p[0].toFixed(1) + "," + p[1].toFixed(1)).join("L"),
      fill: "none", stroke: color, "stroke-width": 2,
      "stroke-linejoin": "round", "stroke-linecap": "round"
    }, svg);

    const iMax = valores.indexOf(Math.max(...valores));
    el("circle", { cx: X(iMax), cy: Y(valores[iMax]), r: 4, fill: color, stroke: "var(--surface)", "stroke-width": 2 }, svg);
    const et = el("text", {
      x: X(iMax), y: Y(valores[iMax]) - 9, "text-anchor": iMax > d.length - 4 ? "end" : "middle",
      class: "datalabel", fill: color
    }, svg);
    et.textContent = fmt(valores[iMax]);
    return Y;
  }

  const tasas = d.map(x => x.tasa);
  const unis  = d.map(x => x.uni || 0);
  panel(padT, hTop, tasas, "var(--s1)", v => nf0.format(v) + "%", "Tasa de quiebre");
  panel(padT + hTop + gapY, hBot, unis, "var(--s2)", v => nf0.format(v / 1000) + "k", "Unidades vendidas");

  d.forEach((x, i) => {
    if (i % 2 === 0 || d.length <= 14) {
      const lb = el("text", { x: X(i), y: h - padB + 18, "text-anchor": "middle", class: "tick" }, svg);
      lb.textContent = `${MES3[x.nombre] || x.nombre.slice(0, 3)} ${String(x.anio).slice(2)}`;
    }
  });

  // capa de cruz + tooltip
  const cruz = el("line", { x1: 0, x2: 0, y1: padT, y2: padT + hTop + gapY + hBot, class: "axisline", opacity: 0 }, svg);
  const capa = el("rect", { x: padL, y: padT, width: pw, height: hTop + gapY + hBot, fill: "transparent" }, svg);
  capa.style.cursor = "crosshair";
  capa.addEventListener("mousemove", ev => {
    const box = svg.getBoundingClientRect();
    const rel = ((ev.clientX - box.left) / box.width) * w;
    let i = Math.round(((rel - padL) / pw) * (d.length - 1));
    i = Math.max(0, Math.min(d.length - 1, i));
    cruz.setAttribute("x1", X(i)); cruz.setAttribute("x2", X(i)); cruz.setAttribute("opacity", 1);
    mostrarTip(
      `<div class="tip-title">${d[i].nombre} ${d[i].anio}</div>` +
      filaTip("Tasa de quiebre", pct(d[i].tasa)) +
      filaTip("Unidades vendidas", num(d[i].uni || 0)) +
      filaTip("Días sin stock", num(d[i].q)), ev);
  });
  capa.addEventListener("mouseleave", () => { cruz.setAttribute("opacity", 0); ocultarTip(); });

  state.tablas.serie = () => tablaHTML(
    ["Mes", "Tasa de quiebre", "Unidades vendidas", "Días sin stock"],
    d.map(x => [`${x.nombre} ${x.anio}`, pct(x.tasa), num(x.uni || 0), num(x.q)]),
    [false, true, true, true]);
}

/* ------------------------------------------------------------------- SKU */

function renderSku() {
  const m = agrupar(fProd(), r => r.producto, r => ({ cat: r.categoria, prov: r.proveedor, obs: 0, q: 0 }));
  const d = Array.from(m, ([nombre, a]) => ({ nombre, ...a }))
    .sort((a, b) => b.tasa - a.tasa).slice(0, 12);
  if (!d.length) return;

  const max = Math.max(...d.map(x => x.tasa), 0.01);
  const padL = 178, padR = 52, padT = 6, padB = 24;
  const rowH = 24, w = 620;
  const h = padT + d.length * rowH + padB;
  const pw = w - padL - padR;
  const svg = svgRoot($("#p-sku"), w, h);
  svg.setAttribute("aria-label", "Productos con mayor tasa de quiebre");

  const ticks = ticksLindos(max, 4);
  const tope = ticks[ticks.length - 1];
  ticks.forEach(t => {
    const x = padL + (t / tope) * pw;
    el("line", { x1: x, x2: x, y1: padT, y2: padT + d.length * rowH, class: "gridline" }, svg);
    const lb = el("text", { x, y: padT + d.length * rowH + 15, "text-anchor": "middle", class: "tick" }, svg);
    lb.textContent = nf0.format(t) + "%";
  });
  el("line", { x1: padL, x2: padL, y1: padT, y2: padT + d.length * rowH, class: "axisline" }, svg);

  d.forEach((x, i) => {
    const y = padT + i * rowH;
    const bw = (x.tasa / tope) * pw;
    const nm = el("text", { x: padL - 10, y: y + rowH / 2 + 4, "text-anchor": "end", class: "tick", fill: "var(--ink-2)" }, svg);
    const etq = lindo(x.nombre);
    nm.textContent = etq.length > 26 ? etq.slice(0, 25) + "…" : etq;

    el("rect", { x: padL, y: y + 5, width: Math.max(bw, 1), height: rowH - 12, rx: 3, fill: "var(--s1)" }, svg);
    const v = el("text", { x: padL + bw + 8, y: y + rowH / 2 + 4, class: "datalabel" }, svg);
    v.textContent = nf1.format(x.tasa) + "%";

    const hit = el("rect", { x: 0, y, width: w, height: rowH, fill: "transparent" }, svg);
    hit.style.cursor = "pointer";
    hit.addEventListener("mousemove", ev => mostrarTip(
      `<div class="tip-title">${etq}</div>` +
      filaTip("Tasa de quiebre", pct(x.tasa)) +
      filaTip("Categoría", lindo(x.cat)) +
      filaTip("Proveedor", lindo(x.prov)) +
      filaTip("Días sin stock", num(x.q)), ev));
    hit.addEventListener("mouseleave", ocultarTip);
  });

  state.tablas.sku = () => tablaHTML(
    ["Producto", "Categoría", "Proveedor", "Tasa de quiebre", "Días sin stock"],
    d.map(x => [lindo(x.nombre), lindo(x.cat), lindo(x.prov), pct(x.tasa), num(x.q)]),
    [false, false, false, true, true]);
}

/* ------------------------------------------------------------- sucursales */

const COLS_SUC = [
  { k: "nombre",    t: "Sucursal",  num: false },
  { k: "zona",      t: "Zona",      num: false },
  { k: "tasa",      t: "Quiebre",   num: true },
  { k: "cobertura", t: "Cobertura", num: true },
  { k: "uni",       t: "Unidades",  num: true },
  { k: "valor",     t: "Inventario", num: true },
  { k: "estado",    t: "Estado",    num: false }
];

function renderSucursales(sucMap) {
  const d = Array.from(sucMap, ([nombre, a]) => ({ nombre, ...a }));
  const { col, dir } = state.orden;
  d.sort((a, b) => {
    const va = a[col] ?? "", vb = b[col] ?? "";
    return (typeof va === "string" ? va.localeCompare(vb) : va - vb) * dir;
  });
  const maxT = Math.max(...d.map(x => x.tasa), 0.01);

  $("#t-suc").innerHTML = `
    <table>
      <thead><tr>${COLS_SUC.map(c => `
        <th class="sortable ${c.num ? "num" : ""}" data-col="${c.k}"
            aria-sort="${col === c.k ? (dir === 1 ? "ascending" : "descending") : "none"}"
            tabindex="0" role="button">${c.t}</th>`).join("")}</tr></thead>
      <tbody>${d.map(x => {
        const s = sevQuiebre(x.tasa), sc = sevCobertura(x.cobertura);
        const peor = ["good", "warning", "serious", "critical"];
        const est = peor[Math.max(peor.indexOf(s), peor.indexOf(sc))];
        return `<tr>
          <td class="name">${lindo(x.nombre)}</td>
          <td>${x.zona}</td>
          <td class="num"><div class="cellbar">
            <span class="mono">${nf2.format(x.tasa)}%</span>
            <span class="cellbar-track"><span class="cellbar-fill" style="width:${(x.tasa / maxT) * 100}%"></span></span>
          </div></td>
          <td class="num mono">${nf1.format(x.cobertura || 0)} d</td>
          <td class="num mono">${num(x.uni || 0)}</td>
          <td class="num mono">${money(x.valor || 0)}</td>
          <td>${chip(est, est === "critical" && x.cobertura >= 8 ? "Sobrestock"
                        : est === "critical" ? "Quiebre crítico"
                        : est === "serious" && x.cobertura >= 6 ? "Sobrestock"
                        : ETIQUETA[est])}</td>
        </tr>`;
      }).join("")}</tbody>
    </table>`;

  $$("#t-suc th.sortable").forEach(th => {
    const activar = () => {
      const c = th.dataset.col;
      state.orden = { col: c, dir: state.orden.col === c ? -state.orden.dir : -1 };
      renderSucursales(sucMap);
    };
    th.addEventListener("click", activar);
    th.addEventListener("keydown", e => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); activar(); } });
  });
}

/* ---------------------------------------------------------------- reglas */

function renderReglas() {
  $("#reglas").innerHTML = DATA.reglas.map(r => {
    const desvio = Math.abs(r.conf2024 - r.conf2025);
    const estable = desvio <= 5;
    return `
      <article class="rule">
        <div class="rule-top">
          <span class="rule-id">${r.id}</span>
          <span class="rule-name">${r.regla}</span>
        </div>
        <div class="rule-stat">
          <div><dt>Confianza</dt><dd>${nf2.format(r.confianza)}%</dd></div>
          <div><dt>Lift</dt><dd>${nf2.format(r.lift)}×</dd></div>
          <div><dt>Soporte</dt><dd>${nf2.format(r.soporte)}%</dd></div>
          <div><dt>Base</dt><dd>${nf2.format(r.base)}%</dd></div>
        </div>
        <div class="holdout">
          <span>2024 ${nf2.format(r.conf2024)}% → 2025 ${nf2.format(r.conf2025)}%</span>
          ${chip(estable ? "good" : "warning", estable ? "Estable" : "Revisar")}
        </div>
        <p class="rule-action"><strong>Acción:</strong> ${r.accion}</p>
      </article>`;
  }).join("");
}

/* ----------------------------------------------------------- proveedores */

function renderProveedores() {
  const d = DATA.proveedores.slice().sort((a, b) => b.tasaGlobal - a.tasaGlobal);
  const max = Math.max(...d.flatMap(x => [x.tasaGlobal, x.tasaSinOeste]), 0.01);

  const padL = 150, padR = 40, padT = 24, padB = 26;
  const rowH = 34, w = 780;
  const h = padT + d.length * rowH + padB;
  const pw = w - padL - padR;
  const svg = svgRoot($("#p-prov"), w, h);
  svg.setAttribute("aria-label", "Tasa de quiebre por proveedor, global y excluyendo la zona Oeste");

  const ticks = ticksLindos(max, 4);
  const tope = ticks[ticks.length - 1];
  ticks.forEach(t => {
    const x = padL + (t / tope) * pw;
    el("line", { x1: x, x2: x, y1: padT - 6, y2: padT + d.length * rowH, class: "gridline" }, svg);
    const lb = el("text", { x, y: padT + d.length * rowH + 16, "text-anchor": "middle", class: "tick" }, svg);
    lb.textContent = nf0.format(t) + "%";
  });
  el("line", { x1: padL, x2: padL, y1: padT - 6, y2: padT + d.length * rowH, class: "axisline" }, svg);

  d.forEach((x, i) => {
    const y = padT + i * rowH;
    const nm = el("text", { x: padL - 10, y: y + rowH / 2 + 4, "text-anchor": "end", class: "tick", fill: "var(--ink-2)" }, svg);
    nm.textContent = lindo(x.proveedor);

    // dos barras finas, 2px de aire entre ellas
    const bh = 10;
    el("rect", { x: padL, y: y + 4, width: Math.max((x.tasaGlobal / tope) * pw, 1), height: bh, rx: 3, fill: "var(--s1)" }, svg);
    el("rect", { x: padL, y: y + 4 + bh + 2, width: Math.max((x.tasaSinOeste / tope) * pw, 1), height: bh, rx: 3, fill: "var(--s2)" }, svg);

    const colapsa = x.tasaSinOeste < x.tasaGlobal * 0.4;
    const refuerza = x.tasaSinOeste > x.tasaGlobal * 1.15 && x.tasaSinOeste >= 5;
    if (colapsa || refuerza) {
      const v = el("text", {
        x: padL + Math.max((x.tasaGlobal / tope) * pw, (x.tasaSinOeste / tope) * pw) + 8,
        y: y + rowH / 2 + 4, class: "datalabel",
        fill: colapsa ? "var(--s1)" : "var(--s2)"
      }, svg);
      v.textContent = colapsa ? `${nf1.format(x.tasaGlobal)}% → ${nf1.format(x.tasaSinOeste)}%`
                              : `sube a ${nf1.format(x.tasaSinOeste)}%`;
    }

    const hit = el("rect", { x: 0, y, width: w, height: rowH, fill: "transparent" }, svg);
    hit.style.cursor = "pointer";
    hit.addEventListener("mousemove", ev => mostrarTip(
      `<div class="tip-title">${lindo(x.proveedor)}</div>` +
      filaTip("Ciclo de entrega", x.diasRepos + " días") +
      filaTip("Quiebre global", pct(x.tasaGlobal)) +
      filaTip("Quiebre sin Oeste", pct(x.tasaSinOeste)), ev));
    hit.addEventListener("mouseleave", ocultarTip);
  });

  $("#l-prov").innerHTML = `
    <span class="legend-item"><span class="legend-swatch" style="background:var(--s1)"></span>Tasa global</span>
    <span class="legend-item"><span class="legend-swatch" style="background:var(--s2)"></span>Excluyendo zona Oeste</span>`;

  const top = d[0], arcor = d.find(x => x.proveedor === "Arcor");
  if (top && arcor) {
    $("#prov-lectura").innerHTML =
      `<strong>${lindo(top.proveedor)}</strong> encabeza el ranking con ${pct(top.tasaGlobal)}, pero al excluir la zona Oeste ` +
      `cae a ${pct(top.tasaSinOeste)}: el efecto desaparece, así que nunca fue el proveedor. ` +
      `<strong>Arcor</strong> hace lo contrario — pasa de ${pct(arcor.tasaGlobal)} a ${pct(arcor.tasaSinOeste)}: ` +
      `el efecto se refuerza, y ahí sí hay un problema real de ciclo de reposición.`;
  }

  state.tablas.prov = () => tablaHTML(
    ["Proveedor", "Categoría", "Ciclo", "Quiebre global", "Sin zona Oeste"],
    d.map(x => [lindo(x.proveedor), lindo(x.categoria), x.diasRepos + " d", pct(x.tasaGlobal), pct(x.tasaSinOeste)]),
    [false, false, true, true, true]);
}

/* ------------------------------------------------------------ vista tabla */

function tablaHTML(cabeceras, filas, alineaNum) {
  return `<div class="tablewrap"><table>
    <thead><tr>${cabeceras.map((c, i) => `<th class="${alineaNum[i] ? "num" : ""}">${c}</th>`).join("")}</tr></thead>
    <tbody>${filas.map(f => `<tr>${f.map((v, i) =>
      `<td class="${alineaNum[i] ? "num mono" : ""}">${v}</td>`).join("")}</tr>`).join("")}</tbody>
  </table></div>`;
}

function aplicarVistas() {
  $$(".toggle[data-view]").forEach(b => {
    const k = b.dataset.view;
    const plot = $("#p-" + k), tabla = $("#t-" + k);
    if (!plot || !tabla) return;
    const activa = b.getAttribute("aria-pressed") === "true";
    if (activa && state.tablas[k]) tabla.innerHTML = state.tablas[k]();
    plot.hidden = activa;
    tabla.hidden = !activa;
    const escala = $("#s-" + k);
    if (escala) escala.hidden = activa;
  });
}

/* ==================================================================== init */

function poblarFiltros() {
  const zonas = [...new Set(DATA.serie.map(r => r.zona))].sort();
  const cats  = [...new Set(DATA.serie.map(r => r.categoria))].sort();
  const z = $("#f-zona"), c = $("#f-cat");
  zonas.forEach(v => z.insertAdjacentHTML("beforeend", `<option value="${v}">${v}</option>`));
  cats.forEach(v  => c.insertAdjacentHTML("beforeend", `<option value="${v}">${lindo(v)}</option>`));
  z.addEventListener("change", () => { state.zona = z.value; render(); });
  c.addEventListener("change", () => { state.cat  = c.value; render(); });
  $("#f-reset").addEventListener("click", () => {
    state.zona = "*"; state.cat = "*"; z.value = "*"; c.value = "*"; render();
  });
}

function marcarFuente(src) {
  const b = $("#fuente");
  b.dataset.src = src;
  $("#fuente-txt").textContent =
    src === "api"  ? "datos en vivo" :
    src === "json" ? "archivo local" : "copia embebida";
  b.title =
    src === "api"  ? `Conectado al backend en ${API_BASE}/dashboard` :
    src === "json" ? "Leído de landing/data/portal.json" :
                     "Sin servidor: usando la copia embebida en seed-data.js";
}

async function cargar() {
  // 1. backend
  if (API_HABILITADA) try {
    const r = await fetch(`${API_BASE}/dashboard`, { headers: { Accept: "application/json" } });
    if (r.ok) {
      const j = await r.json();
      if (j && j.meta && j.serie) return { data: j, src: "api" };
    }
  } catch { /* sin backend todavía */ }
  // 2. json servido por http
  try {
    const r = await fetch("data/portal.json");
    if (r.ok) {
      const j = JSON.parse((await r.text()).replace(/^﻿/, ""));
      if (j && j.meta) return { data: j, src: "json" };
    }
  } catch { /* file:// bloquea el fetch local */ }
  // 3. semilla embebida
  return { data: window.__MINIRED_SEED__, src: "seed" };
}

function initTema() {
  const b = $("#tema");
  const guardado = (() => { try { return localStorage.getItem("minired-tema"); } catch { return null; } })();
  if (guardado) document.documentElement.setAttribute("data-theme", guardado);
  b.addEventListener("click", () => {
    const actual = document.documentElement.getAttribute("data-theme");
    const oscuro = actual ? actual === "dark" : matchMedia("(prefers-color-scheme: dark)").matches;
    const nuevo = oscuro ? "light" : "dark";
    document.documentElement.setAttribute("data-theme", nuevo);
    try { localStorage.setItem("minired-tema", nuevo); } catch { /* modo privado */ }
    render();
  });
}

async function main() {
  initTema();

  $$(".toggle[data-view]").forEach(b => b.addEventListener("click", () => {
    b.setAttribute("aria-pressed", b.getAttribute("aria-pressed") === "true" ? "false" : "true");
    b.textContent = b.getAttribute("aria-pressed") === "true" ? "Gráfico" : "Tabla";
    aplicarVistas();
  }));

  const { data, src } = await cargar();
  if (!data) {
    $("#kpis").innerHTML = `<div class="kpi" data-state="critical">
      <span class="kpi-label">Sin datos</span>
      <span class="kpi-value">—</span>
      <span class="kpi-foot">No se pudo leer el backend, el JSON ni la copia embebida.</span></div>`;
    return;
  }
  DATA = data;
  marcarFuente(src);

  $("#periodo").textContent = `${DATA.meta.desde} → ${DATA.meta.hasta}`;
  $("#foot-meta").innerHTML =
    `${num(DATA.meta.observaciones)} observaciones · ${DATA.meta.dias} días · ` +
    `${DATA.meta.sucursales} sucursales · ${DATA.meta.productos} productos`;

  poblarFiltros();
  render();
}

main();
