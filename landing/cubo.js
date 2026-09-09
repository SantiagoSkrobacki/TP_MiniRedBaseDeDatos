/* MiniRed · Explorador visual del cubo. No requiere SSAS: consulta el respaldo estático. */

const $ = (selector, context = document) => context.querySelector(selector);
const $$ = (selector, context = document) => Array.from(context.querySelectorAll(selector));

let DATA;

const ENTITIES = {
  stock: {
    type: "Grupo de medidas · tabla de hechos", name: "Stock", source: "Fact_Stock",
    description: "Registra el estado diario del inventario. Es el proceso principal de la perspectiva Logística e Inventario.",
    grain: "Una fila por Fecha + Sucursal + Producto.",
    related: ["Tiempo", "Sucursal", "Producto"],
    items: ["Cantidad Ingresada", "Cantidad Vendida", "Stock Disponible", "Valor Inventario", "Observaciones", "Es Quiebre", "Es Bajo Mínimo", "Es Sobrestock"]
  },
  ventas: {
    type: "Grupo de medidas · tabla de hechos", name: "Ventas", source: "Fact_Ventas",
    description: "Registra las líneas de los tickets. Permite comparar demanda e inventario mediante las dimensiones conformadas.",
    grain: "Una fila por línea de producto dentro de un ticket.",
    related: ["Tiempo", "Sucursal", "Producto", "Cajero", "Medio de Pago"],
    items: ["Cantidad Vendida", "Importe Total", "Costo Total", "Tickets"]
  },
  tiempo: {
    type: "Dimensión conformada", name: "Tiempo", source: "Dim_Tiempo",
    description: "Organiza los hechos cronológicamente y permite comparar períodos equivalentes.",
    grain: "Un miembro por día.", hierarchy: "Año → Trimestre → Mes → Fecha",
    related: ["Stock", "Ventas"], items: ["Fecha", "Año", "Trimestre", "Mes", "Día de semana", "Fin de semana", "Temporada"]
  },
  sucursal: {
    type: "Dimensión conformada", name: "Sucursal", source: "Dim_Sucursal",
    description: "Ubica cada operación y separa sucursales comerciales del depósito central.",
    grain: "Un miembro por sucursal o depósito.", hierarchy: "Zona → Sucursal",
    related: ["Stock", "Ventas"], items: ["Nombre", "Zona", "Tipo de ubicación"]
  },
  producto: {
    type: "Dimensión conformada", name: "Producto", source: "Dim_Producto",
    description: "Describe el catálogo y permite analizar el abastecimiento desde familias hasta SKU individuales.",
    grain: "Un miembro por producto.", hierarchy: "Categoría → Rubro → Producto",
    related: ["Stock", "Ventas"], items: ["Producto", "Categoría", "Rubro", "Proveedor", "Días de reposición"]
  },
  cajero: {
    type: "Dimensión exclusiva de Ventas", name: "Cajero", source: "Dim_Cajero",
    description: "Describe quién registró el ticket. No se relaciona con Stock porque un snapshot de inventario no tiene cajero.",
    grain: "Un miembro por cajero.", hierarchy: "Turno → Cajero",
    related: ["Ventas"], items: ["Nombre", "Turno"]
  },
  pago: {
    type: "Dimensión exclusiva de Ventas", name: "Medio de pago", source: "Dim_MedioPago",
    description: "Clasifica la forma de cobro y sus campañas. No corresponde al proceso diario de Stock.",
    grain: "Un miembro por medio de pago.", hierarchy: "Tipo de pago → Campaña",
    related: ["Ventas"], items: ["Tipo de pago", "Campaña"]
  }
};

const ANALYSES = {
  zoneCategory: { label: "Zona × Categoría", source: "serie", row: "zona", rowLabel: "Zona", col: "categoria", colLabel: "Categoría", temporal: true, measures: ["rate", "breaks", "observations", "units", "stock"] },
  branchCategory: { label: "Sucursal × Categoría", source: "sucursales", row: "sucursal", rowLabel: "Sucursal", col: "categoria", colLabel: "Categoría", temporal: false, measures: ["rate", "breaks", "lowRate", "observations", "units", "stock", "coverage", "inventory"] },
  monthZone: { label: "Mes × Zona", source: "serie", row: "period", rowLabel: "Mes", col: "zona", colLabel: "Zona", temporal: true, measures: ["rate", "breaks", "observations", "units", "stock"] },
  productZone: { label: "Producto × Zona", source: "productos", row: "producto", rowLabel: "Producto", col: "zona", colLabel: "Zona", temporal: false, measures: ["rate", "breaks", "observations", "units", "inventory"] }
};

const MEASURES = {
  rate: { label: "Tasa de quiebre", format: value => formatNumber(value, 2) + "%", aggregate: acc => acc.observations ? acc.breaks * 100 / acc.observations : 0 },
  breaks: { label: "Quiebres", format: value => formatNumber(value, 0), aggregate: acc => acc.breaks },
  lowRate: { label: "Tasa bajo mínimo", format: value => formatNumber(value, 2) + "%", aggregate: acc => acc.observations ? acc.low * 100 / acc.observations : 0 },
  observations: { label: "Observaciones", format: value => formatNumber(value, 0), aggregate: acc => acc.observations },
  units: { label: "Unidades vendidas", format: value => formatNumber(value, 0), aggregate: acc => acc.units },
  stock: { label: "Stock promedio", format: value => formatNumber(value, 2), aggregate: acc => acc.observations ? acc.weightedStock / acc.observations : 0 },
  coverage: { label: "Días de cobertura", format: value => formatNumber(value, 2), aggregate: acc => acc.weightedSales ? acc.weightedStock / acc.weightedSales : 0 },
  inventory: { label: "Valor inventario", format: value => "$ " + formatNumber(value, 0), aggregate: acc => acc.inventory }
};

function formatNumber(value, decimals) {
  return new Intl.NumberFormat("es-AR", { minimumFractionDigits: decimals, maximumFractionDigits: decimals }).format(value || 0);
}

function esc(value) {
  return String(value ?? "").replace(/[&<>'"]/g, char => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;" })[char]);
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
      if (data?.meta && data?.serie) return { data, source: "archivo local" };
    }
  } catch { /* file:// no permite leer el JSON; continúa con la semilla. */ }
  if (window.__MINIRED_SEED__?.meta) return { data: window.__MINIRED_SEED__, source: "copia embebida" };
  throw new Error("No se encontró portal.json ni su copia embebida.");
}

function renderEntity(key) {
  const entity = ENTITIES[key];
  $$(".model-node").forEach(node => node.setAttribute("aria-pressed", String(node.dataset.entity === key)));
  $("#entity-panel").innerHTML = `
    <p class="entity-type">${esc(entity.type)}</p><h3>${esc(entity.name)}</h3>
    <p class="entity-description">${esc(entity.description)}</p>
    <div class="entity-block"><h4>Objeto físico</h4><p><code>${esc(entity.source)}</code></p></div>
    <div class="entity-block"><h4>Grano</h4><p>${esc(entity.grain)}</p></div>
    ${entity.hierarchy ? `<div class="entity-block"><h4>Jerarquía natural</h4><p class="hierarchy">${esc(entity.hierarchy)}</p></div>` : ""}
    <div class="entity-block"><h4>${key === "stock" || key === "ventas" ? "Medidas" : "Atributos"}</h4><ul class="entity-list">${entity.items.map(item => `<li>${esc(item)}</li>`).join("")}</ul></div>
    <div class="entity-block"><h4>Relacionado con</h4><ul class="entity-list">${entity.related.map(item => `<li>${esc(item)}</li>`).join("")}</ul></div>`;
}

function initModel() {
  $$(".model-node").forEach(node => node.addEventListener("click", () => renderEntity(node.dataset.entity)));
  renderEntity("stock");
}

function unique(field, collections) {
  return [...new Set(collections.flatMap(rows => rows.map(row => row[field])).filter(Boolean))].sort((a, b) => String(a).localeCompare(String(b), "es"));
}

function fillFilters() {
  const zones = unique("zona", [DATA.serie, DATA.sucursales, DATA.productos]);
  const categories = unique("categoria", [DATA.serie, DATA.sucursales, DATA.productos]);
  $("#filter-zone").insertAdjacentHTML("beforeend", zones.map(value => `<option value="${esc(value)}">${esc(value)}</option>`).join(""));
  $("#filter-category").insertAdjacentHTML("beforeend", categories.map(value => `<option value="${esc(value)}">${esc(value)}</option>`).join(""));
}

function updateMeasureOptions() {
  const config = ANALYSES[$("#analysis").value];
  const previous = $("#measure").value;
  $("#measure").innerHTML = config.measures.map(key => `<option value="${key}">${esc(MEASURES[key].label)}</option>`).join("");
  if (config.measures.includes(previous)) $("#measure").value = previous;
  $("#year-field").hidden = !config.temporal;
  if (!config.temporal) $("#filter-year").value = "*";
}

function emptyAccumulator() {
  return { observations: 0, breaks: 0, low: 0, units: 0, inventory: 0, weightedStock: 0, weightedSales: 0 };
}

function addRow(acc, row, source) {
  const observations = Number(row.observaciones) || 0;
  const stock = source === "serie" ? Number(row.stock) || 0 : Number(row.stockProm) || 0;
  const sales = Number(row.ventaProm) || 0;
  acc.observations += observations;
  acc.breaks += Number(row.quiebres) || 0;
  acc.low += Number(row.bajoMinimo) || 0;
  acc.units += Number(row.unidades) || 0;
  acc.inventory += Number(row.valorInv) || 0;
  acc.weightedStock += stock * observations;
  acc.weightedSales += sales * observations;
}

function rowKey(row, config) {
  if (config.row === "period") return `${row.anio}-${String(row.mes).padStart(2, "0")}`;
  return row[config.row];
}

function rowLabel(key, config, rows) {
  if (config.row !== "period") return key;
  const sample = rows.find(row => rowKey(row, config) === key);
  return `${sample?.mesNombre || key} ${sample?.anio || ""}`;
}

function filteredRows(config) {
  const zone = $("#filter-zone").value;
  const category = $("#filter-category").value;
  const year = $("#filter-year").value;
  return DATA[config.source].filter(row =>
    (zone === "*" || row.zona === zone) &&
    (category === "*" || row.categoria === category) &&
    (year === "*" || Number(row.anio) === Number(year))
  );
}

function renderQuery(config, measure) {
  const chips = [
    `MEDIDA: ${measure.label}`, `FILAS: ${config.rowLabel}`, `COLUMNAS: ${config.colLabel}`,
    $("#filter-zone").value !== "*" ? `ZONA: ${$("#filter-zone").value}` : null,
    $("#filter-category").value !== "*" ? `CATEGORÍA: ${$("#filter-category").value}` : null,
    $("#filter-year").value !== "*" ? `AÑO: ${$("#filter-year").value}` : null
  ].filter(Boolean);
  $("#query-strip").innerHTML = `<span class="query-label">Consulta</span>${chips.map(chip => `<span class="query-chip">${esc(chip)}</span>`).join("")}`;
}

function renderMatrix() {
  const config = ANALYSES[$("#analysis").value];
  const measure = MEASURES[$("#measure").value];
  const rows = filteredRows(config);
  renderQuery(config, measure);

  if (!rows.length) {
    $("#matrix-summary").innerHTML = "No hay observaciones para esta combinación de filtros.";
    $("#olap-result").innerHTML = '<div class="empty-result">Probá quitando uno de los filtros.</div>';
    return;
  }

  const rowKeys = [...new Set(rows.map(row => rowKey(row, config)))].sort((a, b) =>
    config.row === "period" ? a.localeCompare(b) : String(a).localeCompare(String(b), "es"));
  const colKeys = [...new Set(rows.map(row => row[config.col]))].sort((a, b) => String(a).localeCompare(String(b), "es"));
  const cells = new Map();
  const rowTotals = new Map();
  const colTotals = new Map();
  const grandTotal = emptyAccumulator();

  rows.forEach(row => {
    const rKey = rowKey(row, config);
    const cKey = row[config.col];
    const cellKey = `${rKey}\u0000${cKey}`;
    if (!cells.has(cellKey)) cells.set(cellKey, emptyAccumulator());
    if (!rowTotals.has(rKey)) rowTotals.set(rKey, emptyAccumulator());
    if (!colTotals.has(cKey)) colTotals.set(cKey, emptyAccumulator());
    addRow(cells.get(cellKey), row, config.source);
    addRow(rowTotals.get(rKey), row, config.source);
    addRow(colTotals.get(cKey), row, config.source);
    addRow(grandTotal, row, config.source);
  });

  const values = [...cells.values()].map(acc => measure.aggregate(acc));
  const maxValue = Math.max(...values, 0) || 1;
  const cellHtml = acc => {
    if (!acc) return '<td class="metric-cell">—</td>';
    const value = measure.aggregate(acc);
    const intensity = Math.max(.08, value / maxValue);
    return `<td class="metric-cell"><span class="cell-shade" style="opacity:${Math.min(.82, .12 + intensity * .7)}"></span><span class="cell-value">${esc(measure.format(value))}</span></td>`;
  };

  const body = rowKeys.map(rKey => `<tr><td class="name">${esc(rowLabel(rKey, config, rows))}</td>${colKeys.map(cKey => cellHtml(cells.get(`${rKey}\u0000${cKey}`))).join("")}${cellHtml(rowTotals.get(rKey))}</tr>`).join("");
  const totals = `<tr class="total-row"><td>Total</td>${colKeys.map(cKey => cellHtml(colTotals.get(cKey))).join("")}${cellHtml(grandTotal)}</tr>`;
  $("#olap-result").innerHTML = `<table class="matrix-table"><thead><tr><th>${esc(config.rowLabel)} ↓ / ${esc(config.colLabel)} →</th>${colKeys.map(key => `<th class="num">${esc(key)}</th>`).join("")}<th class="num">Total</th></tr></thead><tbody>${body}${totals}</tbody></table>`;
  $("#matrix-summary").innerHTML = `<strong>${rows.length.toLocaleString("es-AR")} filas resumidas</strong> en ${rowKeys.length} × ${colKeys.length} celdas. Los totales se recalculan desde sus componentes.`;
}

function initLab() {
  fillFilters();
  updateMeasureOptions();
  $("#analysis").addEventListener("change", () => { updateMeasureOptions(); renderMatrix(); });
  $$("#olap-form select:not(#analysis)").forEach(select => select.addEventListener("change", renderMatrix));
  $("#reset-view").addEventListener("click", () => {
    $("#analysis").value = "zoneCategory";
    $("#filter-zone").value = "*";
    $("#filter-category").value = "*";
    $("#filter-year").value = "*";
    updateMeasureOptions();
    $("#measure").value = "rate";
    renderMatrix();
  });
  renderMatrix();
}

async function main() {
  initTheme();
  initModel();
  try {
    const loaded = await loadData();
    DATA = loaded.data;
    $("#data-source").textContent = loaded.source;
    initLab();
  } catch (error) {
    const notice = $("#cube-notice");
    notice.textContent = error.message;
    notice.hidden = false;
    $("#olap-result").innerHTML = '<div class="empty-result">No fue posible cargar los datos del laboratorio.</div>';
  }
}

main();
