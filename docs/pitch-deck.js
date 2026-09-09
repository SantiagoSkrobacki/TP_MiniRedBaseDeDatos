/* Pitch ejecutivo — MiniRed S.A. · Perspectiva Logística e Inventario
   Paleta: grafito dominante, ámbar de señalización como único acento,
   arcilla reservada para el estado de quiebre. Motivo repetido: etiquetas
   de góndola (chips redondeados con texto en versalitas). */

const pptxgen = require("pptxgenjs");
const pres = new pptxgen();

pres.layout = "LAYOUT_WIDE";              // 13.3 x 7.5
pres.author = "Santiago Skrobacki";
pres.company = "MiniRed S.A.";
pres.title = "Pitch — Logística e Inventario";

const GRAFITO = "22252B";
const GRAFITO2 = "2E323A";
const CLARO = "F6F6F3";
const BLANCO = "FFFFFF";
const AMBAR = "E9A13B";
const ARCILLA = "B03A2E";
const SLATE = "5C6270";
const SLATE_CLARO = "9AA1AC";
const TITULO = "Cambria";
const CUERPO = "Calibri";

const W = 13.3, H = 7.5, M = 0.7;

/* ---------- helpers ---------- */

function fondo(slide, oscuro) {
  slide.background = { color: oscuro ? GRAFITO : CLARO };
}

/** Etiqueta de góndola: el motivo que se repite en todo el deck. */
function etiqueta(slide, x, y, texto, opts = {}) {
  const ancho = opts.w || Math.max(0.95, texto.length * 0.088 + 0.34);
  slide.addShape(pres.ShapeType.roundRect, {
    x, y, w: ancho, h: 0.28, rectRadius: 0.05,
    fill: { color: opts.fill || AMBAR },
    line: { color: opts.fill || AMBAR, width: 0 }
  });
  slide.addText(texto.toUpperCase(), {
    x, y, w: ancho, h: 0.28, isTextBox: true, margin: 0,
    fontFace: CUERPO, fontSize: 10, bold: true, charSpacing: 1.2,
    color: opts.color || GRAFITO, align: "center", valign: "middle"
  });
  return ancho;
}

function titulo(slide, texto, oscuro, opts = {}) {
  slide.addText(texto, {
    x: M, y: opts.y || 0.92, w: opts.w || W - M * 2, h: opts.h || 1.2,
    isTextBox: true, margin: 0,
    fontFace: TITULO, fontSize: opts.size || 31, bold: true,
    color: oscuro ? BLANCO : GRAFITO, valign: "middle"
  });
}

function bajada(slide, texto, oscuro, opts = {}) {
  slide.addText(texto, {
    x: M, y: opts.y || 2.18, w: opts.w || 10.2, h: opts.h || 0.5,
    isTextBox: true, margin: 0,
    fontFace: CUERPO, fontSize: 15, color: oscuro ? SLATE_CLARO : SLATE,
    valign: "top", lineSpacing: 21
  });
}

function tarjeta(slide, x, y, w, h, opts = {}) {
  slide.addShape(pres.ShapeType.roundRect, {
    x, y, w, h, rectRadius: 0.06,
    fill: { color: opts.fill || BLANCO },
    line: { color: opts.line || "E3E3DE", width: 1 },
    shadow: { type: "outer", angle: 90, blur: 10, offset: 2, opacity: 0.07, color: "000000" }
  });
}

function pie(slide, texto) {
  slide.addText(texto, {
    x: M, y: H - 0.62, w: W - M * 2, h: 0.3, isTextBox: true, margin: 0,
    fontFace: CUERPO, fontSize: 10, color: SLATE_CLARO, valign: "middle"
  });
}

/* ==================================================================
   1 — Portada
   ================================================================== */
{
  const s = pres.addSlide();
  fondo(s, true);

  s.addShape(pres.ShapeType.rect, { x: 0, y: 0, w: 4.6, h: H, fill: { color: GRAFITO2 } });

  etiqueta(s, M, 1.5, "Trabajo práctico · Unidad 3");
  s.addText("Minería de Datos,\nKDD y Modelado\nDimensional", {
    x: M, y: 1.95, w: 3.4, h: 1.4, isTextBox: true, margin: 0,
    fontFace: TITULO, fontSize: 21, bold: true, color: BLANCO, lineSpacing: 27
  });
  s.addText([
    // ↓ nombres de los integrantes: editar acá
    { text: "Integrantes", options: { breakLine: true, bold: true, color: BLANCO } },
    { text: "Santiago Skrobacki", options: { breakLine: true } },
    { text: "Nombre del compañero", options: { breakLine: true } },
    { text: "Caso: MiniRed S.A.", options: { breakLine: true } },
    { text: "6 sucursales · 2024 – 2025", options: {} }
  ], {
    x: M, y: 3.55, w: 3.4, h: 1.6, isTextBox: true, margin: 0,
    fontFace: CUERPO, fontSize: 12.5, color: SLATE_CLARO, lineSpacing: 19
  });

  s.addText("Dónde nos quedamos sin stock,\ny dónde tenemos plata dormida", {
    x: 5.5, y: 1.95, w: 7.2, h: 2.35, isTextBox: true, margin: 0,
    fontFace: TITULO, fontSize: 36, bold: true, color: BLANCO, lineSpacing: 44
  });
  s.addText("El trabajo plantea el caso de una cadena de minimercados y pide resolver un desafío de abastecimiento sobre su data warehouse.", {
    x: 5.5, y: 4.5, w: 6.9, h: 1.0, isTextBox: true, margin: 0,
    fontFace: CUERPO, fontSize: 14, color: AMBAR, lineSpacing: 21
  });
  s.addText("Perspectiva elegida: Opción B · Logística e Inventario", {
    x: 5.5, y: 6.3, w: 7.1, h: 0.4, isTextBox: true, margin: 0,
    fontFace: CUERPO, fontSize: 11, color: SLATE_CLARO
  });
  s.addNotes("[PARTICIPANTE 1]  Presentarse por nombre. En 10 minutos: qué encontramos, cómo lo validamos y qué recomienda el análisis. Arrancar por el problema, no por la tecnología.");
}

/* ==================================================================
   2 — El encargo: dos fallas opuestas
   ================================================================== */
{
  const s = pres.addSlide();
  fondo(s, false);
  etiqueta(s, M, 0.55, "El encargo");
  titulo(s, "Dos formas de perder plata con el stock", false);
  bajada(s, "Las dos son problemas de abastecimiento, y son opuestas: corregir una mal empeora la otra.", false);

  const cy = 2.75, ch = 2.75, cw = 5.75;

  tarjeta(s, M, cy, cw, ch);
  s.addShape(pres.ShapeType.roundRect, { x: M + 0.45, y: cy + 0.45, w: 0.42, h: 0.42, rectRadius: 0.08, fill: { color: ARCILLA }, line: { color: ARCILLA, width: 0 } });
  s.addText("!", { x: M + 0.45, y: cy + 0.45, w: 0.42, h: 0.42, isTextBox: true, margin: 0, fontFace: CUERPO, fontSize: 18, bold: true, color: BLANCO, align: "center", valign: "middle" });
  s.addText("Góndola vacía", { x: M + 1.05, y: cy + 0.42, w: 3.5, h: 0.48, isTextBox: true, margin: 0, fontFace: TITULO, fontSize: 21, bold: true, color: GRAFITO, valign: "middle" });
  s.addText("El cliente va a buscar el producto y no lo encuentra. Es venta perdida, y además manda al cliente al competidor de la esquina.", {
    x: M + 0.45, y: cy + 1.05, w: cw - 0.9, h: 1.0, isTextBox: true, margin: 0, fontFace: CUERPO, fontSize: 14, color: SLATE, lineSpacing: 20
  });
  s.addText("5,22 %", { x: M + 0.45, y: cy + 1.95, w: 2.2, h: 0.55, isTextBox: true, margin: 0, fontFace: TITULO, fontSize: 30, bold: true, color: ARCILLA });
  s.addText("de los días-producto\nsin stock en góndola", { x: M + 2.6, y: cy + 2.0, w: 2.6, h: 0.6, isTextBox: true, margin: 0, fontFace: CUERPO, fontSize: 11, color: SLATE, lineSpacing: 14 });

  const x2 = M + cw + 0.4;
  tarjeta(s, x2, cy, cw, ch);
  s.addShape(pres.ShapeType.roundRect, { x: x2 + 0.45, y: cy + 0.45, w: 0.42, h: 0.42, rectRadius: 0.08, fill: { color: AMBAR }, line: { color: AMBAR, width: 0 } });
  s.addText("$", { x: x2 + 0.45, y: cy + 0.45, w: 0.42, h: 0.42, isTextBox: true, margin: 0, fontFace: CUERPO, fontSize: 17, bold: true, color: GRAFITO, align: "center", valign: "middle" });
  s.addText("Depósito lleno", { x: x2 + 1.05, y: cy + 0.42, w: 3.5, h: 0.48, isTextBox: true, margin: 0, fontFace: TITULO, fontSize: 21, bold: true, color: GRAFITO, valign: "middle" });
  s.addText("Mercadería que nadie compró. Es capital inmovilizado, ocupa lugar y puede vencerse. Nunca falta nada porque sobra todo.", {
    x: x2 + 0.45, y: cy + 1.05, w: cw - 0.9, h: 1.0, isTextBox: true, margin: 0, fontFace: CUERPO, fontSize: 14, color: SLATE, lineSpacing: 20
  });
  s.addText("$ 12,0 M", { x: x2 + 0.45, y: cy + 1.95, w: 2.4, h: 0.55, isTextBox: true, margin: 0, fontFace: TITULO, fontSize: 30, bold: true, color: GRAFITO });
  s.addText("en góndola al cierre\ndel período analizado", { x: x2 + 2.75, y: cy + 2.0, w: 2.5, h: 0.6, isTextBox: true, margin: 0, fontFace: CUERPO, fontSize: 11, color: SLATE, lineSpacing: 14 });

  pie(s, "Fuente: MiniRed_DW · 131.580 observaciones diarias de góndola sobre 731 días");
  s.addNotes("[PARTICIPANTE 1]  Insistir: no alcanza con 'reponer más'. Una sucursal con cero quiebre puede ser la peor gestionada de la cadena. Ese es el hallazgo que más sorprende y lo mostramos en el minuto 6.");
}

/* ==================================================================
   3 — Qué construimos
   ================================================================== */
{
  const s = pres.addSlide();
  fondo(s, false);
  etiqueta(s, M, 0.55, "Punto de partida");
  titulo(s, "La cátedra da el diseño; la base la construimos nosotros", false);
  bajada(s, "Generamos MiniRed_DW con comportamientos realistas puestos a propósito y documentados. Los datos son simulados; las cuentas que siguen son reales.", false);

  const stats = [
    ["315.969", "líneas de ticket", "Fact_Ventas"],
    ["153.510", "fotos diarias de góndola", "Fact_Stock"],
    ["731", "días consecutivos", "2024 – 2025"],
    ["30", "productos × 6 sucursales", "5 categorías"]
  ];
  const sw = 2.85, gap = 0.28;
  stats.forEach((st, i) => {
    const x = M + i * (sw + gap);
    tarjeta(s, x, 2.85, sw, 1.85);
    s.addText(st[0], { x: x + 0.3, y: 3.1, w: sw - 0.6, h: 0.7, isTextBox: true, margin: 0, fontFace: TITULO, fontSize: 30, bold: true, color: GRAFITO, valign: "middle" });
    s.addText(st[1], { x: x + 0.3, y: 3.8, w: sw - 0.6, h: 0.42, isTextBox: true, margin: 0, fontFace: CUERPO, fontSize: 12.5, color: SLATE, valign: "top" });
    s.addText(st[2], { x: x + 0.3, y: 4.24, w: sw - 0.6, h: 0.3, isTextBox: true, margin: 0, fontFace: CUERPO, fontSize: 10.5, bold: true, color: AMBAR });
  });

  tarjeta(s, M, 5.05, W - M * 2, 1.35, { fill: "EFEFEA", line: "E3E3DE" });
  s.addText("¿Por qué plantar patrones a propósito?", { x: M + 0.4, y: 5.2, w: 5.2, h: 0.35, isTextBox: true, margin: 0, fontFace: CUERPO, fontSize: 13, bold: true, color: GRAFITO });
  s.addText("Un dataset generado al azar no contiene ninguna regla que descubrir: sería buscar huellas en una playa donde nadie caminó. La contrapartida —que la validación estadística no alcanza y todo hallazgo debe contrastarse contra la lógica del negocio— es exactamente el punto 5 de la consigna.", {
    x: M + 0.4, y: 5.55, w: W - M * 2 - 0.8, h: 0.75, isTextBox: true, margin: 0, fontFace: CUERPO, fontSize: 12, color: SLATE, lineSpacing: 17
  });
  s.addNotes("[PARTICIPANTE 1]  Declararlo de entrada quita el aire a la pregunta incómoda. Y convierte una limitación en material teórico.");
}

/* ==================================================================
   4 — El modelo: constelación
   ================================================================== */
{
  const s = pres.addSlide();
  fondo(s, false);
  etiqueta(s, M, 0.55, "Modelado dimensional");
  titulo(s, "Dos procesos de negocio, tres dimensiones compartidas", false);
  bajada(s, "Vender y reponer son procesos distintos, con distinto grano. Comparten Tiempo, Sucursal y Producto: eso convierte dos estrellas en una constelación.", false);

  const dimY = 2.98, dimW = 2.5, dimH = 0.72, dimGap = 0.24;
  const conformadas = [["Dim_Tiempo", "731 días"], ["Dim_Sucursal", "7 ubicaciones"], ["Dim_Producto", "30 productos"]];
  conformadas.forEach((d, i) => {
    const x = 5.35;
    const y = dimY + i * (dimH + dimGap);
    tarjeta(s, x, y, dimW, dimH, { fill: BLANCO, line: AMBAR });
    s.addText(d[0], { x: x + 0.18, y: y + 0.1, w: dimW - 0.36, h: 0.32, isTextBox: true, margin: 0, fontFace: CUERPO, fontSize: 12.5, bold: true, color: GRAFITO });
    s.addText(d[1], { x: x + 0.18, y: y + 0.42, w: dimW - 0.36, h: 0.26, isTextBox: true, margin: 0, fontFace: CUERPO, fontSize: 10.5, color: SLATE });
  });
  s.addText("CONFORMADAS", { x: 5.35, y: 2.66, w: dimW, h: 0.26, isTextBox: true, margin: 0, fontFace: CUERPO, fontSize: 9.5, bold: true, charSpacing: 1.2, color: AMBAR, align: "center" });

  // hechos
  const hechos = [
    { x: 1.55, y: 3.55, t: "Fact_Ventas", g: "grano: 1 línea de ticket", n: "315.969 filas" },
    { x: 9.35, y: 3.55, t: "Fact_Stock", g: "grano: 1 día × sucursal × producto", n: "153.510 filas" }
  ];
  hechos.forEach(h => {
    tarjeta(s, h.x, h.y, 2.4, 1.5, { fill: GRAFITO, line: GRAFITO });
    s.addText(h.t, { x: h.x + 0.2, y: h.y + 0.22, w: 2.0, h: 0.34, isTextBox: true, margin: 0, fontFace: CUERPO, fontSize: 13.5, bold: true, color: BLANCO });
    s.addText(h.g, { x: h.x + 0.2, y: h.y + 0.58, w: 2.0, h: 0.5, isTextBox: true, margin: 0, fontFace: CUERPO, fontSize: 10, color: SLATE_CLARO, lineSpacing: 13 });
    s.addText(h.n, { x: h.x + 0.2, y: h.y + 1.08, w: 2.0, h: 0.28, isTextBox: true, margin: 0, fontFace: CUERPO, fontSize: 10.5, bold: true, color: AMBAR });
  });

  // Conectores en L: toda la geometría se mantiene con ancho y alto NO negativos.
  // OOXML no admite extensiones negativas y PowerPoint rechaza el archivo entero.
  const LINEA = () => ({ color: "C9C9C2", width: 1.25 });
  const yTop = dimY + dimH / 2;
  const yBot = dimY + 2 * (dimH + dimGap) + dimH / 2;
  const yMid = dimY + (dimH + dimGap) + dimH / 2;   // alineado con la dimensión del medio

  // troncos verticales a cada lado de la columna de dimensiones
  s.addShape(pres.ShapeType.line, { x: 4.75, y: yTop, w: 0, h: yBot - yTop, line: LINEA() });
  s.addShape(pres.ShapeType.line, { x: 8.5, y: yTop, w: 0, h: yBot - yTop, line: LINEA() });

  // ramas horizontales hacia cada dimensión
  for (let i = 0; i < 3; i++) {
    const y = dimY + i * (dimH + dimGap) + dimH / 2;
    s.addShape(pres.ShapeType.line, { x: 4.75, y, w: 0.6, h: 0, line: LINEA() });
    s.addShape(pres.ShapeType.line, { x: 7.85, y, w: 0.65, h: 0, line: LINEA() });
  }

  // desde cada tabla de hechos hasta su tronco
  s.addShape(pres.ShapeType.line, { x: 3.95, y: yMid, w: 0.8, h: 0, line: LINEA() });
  s.addShape(pres.ShapeType.line, { x: 8.5, y: yMid, w: 0.85, h: 0, line: LINEA() });

  tarjeta(s, 1.55, 5.72, 10.2, 1.0, { fill: "EFEFEA", line: "E3E3DE" });
  s.addText("Dim_Cajero y Dim_MedioPago quedan sólo del lado de las ventas: el ingreso de mercadería no pasa por caja. Esa asimetría es la prueba de que el stock es un proceso separado y no una columna más en Fact_Ventas.", {
    x: 1.9, y: 5.9, w: 9.5, h: 0.66, isTextBox: true, margin: 0, fontFace: CUERPO, fontSize: 12.5, color: SLATE, lineSpacing: 18
  });
  s.addNotes("[PARTICIPANTE 1]  Si preguntan por qué no una sola tabla: distinto grano. Un ticket es un evento; el stock es una foto diaria. Meterlos juntos rompe la aditividad.");
}

/* ==================================================================
   5 — Semi-aditividad
   ================================================================== */
{
  const s = pres.addSlide();
  fondo(s, true);
  etiqueta(s, M, 0.55, "El error que evitamos");
  titulo(s, "Diez botellas el lunes y diez el martes no son veinte", true);
  bajada(s, "Son las mismas diez, fotografiadas dos veces. El stock se suma por sucursal y por producto, nunca por tiempo: es una medida semi-aditiva.", true);

  const cy = 2.9, cw = 5.4, ch = 2.15;
  tarjeta(s, M, cy, cw, ch, { fill: GRAFITO2, line: "3E434C" });
  s.addText("Sumando los 731 días", { x: M + 0.4, y: cy + 0.32, w: cw - 0.8, h: 0.32, isTextBox: true, margin: 0, fontFace: CUERPO, fontSize: 13, color: SLATE_CLARO });
  s.addText("6.159.125", { x: M + 0.4, y: cy + 0.7, w: cw - 0.8, h: 0.85, isTextBox: true, margin: 0, fontFace: TITULO, fontSize: 44, bold: true, color: ARCILLA, valign: "middle" });
  s.addText("unidades — no significa nada", { x: M + 0.4, y: cy + 1.55, w: cw - 0.8, h: 0.32, isTextBox: true, margin: 0, fontFace: CUERPO, fontSize: 12, color: SLATE_CLARO });

  const x2 = M + cw + 0.5;
  tarjeta(s, x2, cy, cw, ch, { fill: GRAFITO2, line: AMBAR });
  s.addText("Stock real en góndola", { x: x2 + 0.4, y: cy + 0.32, w: cw - 0.8, h: 0.32, isTextBox: true, margin: 0, fontFace: CUERPO, fontSize: 13, color: SLATE_CLARO });
  s.addText("8.161", { x: x2 + 0.4, y: cy + 0.7, w: cw - 0.8, h: 0.85, isTextBox: true, margin: 0, fontFace: TITULO, fontSize: 44, bold: true, color: AMBAR, valign: "middle" });
  s.addText("unidades — la lectura correcta", { x: x2 + 0.4, y: cy + 1.55, w: cw - 0.8, h: 0.32, isTextBox: true, margin: 0, fontFace: CUERPO, fontSize: 12, color: SLATE_CLARO });

  s.addText("Tres órdenes de magnitud de diferencia. En el cubo se resuelve configurando la medida con LastNonEmpty; el asistente la deja en Sum por defecto.", {
    x: M, y: 5.4, w: 11.4, h: 0.8, isTextBox: true, margin: 0, fontFace: CUERPO, fontSize: 14, color: BLANCO, lineSpacing: 21
  });
  s.addNotes("[PARTICIPANTE 1]  Este es el punto técnico que más pesa. Si sólo se llevan una cosa del pitch, que sea ésta: el 750x de diferencia entre sumar mal y sumar bien.");
}

/* ==================================================================
   6 — De la consulta al patrón (puntos 1 y 4)
   ================================================================== */
{
  const s = pres.addSlide();
  fondo(s, false);
  etiqueta(s, M, 0.55, "Concepto y disciplinas");
  titulo(s, "De responder preguntas a descubrir patrones", false);
  bajada(s, "Una consulta OLAP contesta lo que ya sabíamos preguntar. La minería de datos encuentra lo que no sabíamos que había que preguntar.", false);

  const filas = [
    ["Consulta analítica (OLAP)", "\u00bfCuánto quebró la zona Oeste en mayo? — La pregunta ya trae la hipótesis adentro.", "F0F0EB", SLATE],
    ["Minería de datos", "El quiebre de bebidas en el Oeste no cae el fin de semana: cae el martes. Nadie lo había preguntado.", BLANCO, GRAFITO]
  ];
  filas.forEach((f, i) => {
    const y = 2.7 + i * 1.12;
    tarjeta(s, M, y, 6.15, 0.95, { fill: f[2], line: "E3E3DE" });
    s.addText(f[0], { x: M + 0.35, y: y + 0.12, w: 5.5, h: 0.3, isTextBox: true, margin: 0, fontFace: CUERPO, fontSize: 12.5, bold: true, color: f[3] });
    s.addText(f[1], { x: M + 0.35, y: y + 0.42, w: 5.5, h: 0.45, isTextBox: true, margin: 0, fontFace: CUERPO, fontSize: 11.5, color: SLATE, lineSpacing: 15 });
  });

  const dx = 7.35;
  s.addText("Tres disciplinas, una solución", { x: dx, y: 2.7, w: 5.2, h: 0.35, isTextBox: true, margin: 0, fontFace: CUERPO, fontSize: 13, bold: true, color: GRAFITO });
  const disc = [
    ["Gestión de bases de datos", "Modelo dimensional en SQL Server, cubo en Analysis Services"],
    ["Estadística inferencial", "Soporte, confianza, lift y validación con datos que el modelo no vio"],
    ["Inteligencia artificial", "Asistentes usados para diseñar consultas, cuestionar hallazgos y maquetar el portal"]
  ];
  disc.forEach((d, i) => {
    const y = 3.2 + i * 1.02;
    s.addShape(pres.ShapeType.roundRect, { x: dx, y: y + 0.06, w: 0.3, h: 0.3, rectRadius: 0.06, fill: { color: AMBAR }, line: { color: AMBAR, width: 0 } });
    s.addText(String(i + 1), { x: dx, y: y + 0.06, w: 0.3, h: 0.3, isTextBox: true, margin: 0, fontFace: CUERPO, fontSize: 11, bold: true, color: GRAFITO, align: "center", valign: "middle" });
    s.addText(d[0], { x: dx + 0.48, y: y, w: 4.7, h: 0.32, isTextBox: true, margin: 0, fontFace: CUERPO, fontSize: 12.5, bold: true, color: GRAFITO });
    s.addText(d[1], { x: dx + 0.48, y: y + 0.32, w: 4.7, h: 0.5, isTextBox: true, margin: 0, fontFace: CUERPO, fontSize: 11, color: SLATE, lineSpacing: 15 });
  });
  s.addNotes("[PARTICIPANTE 1]  Puntos 1 y 4 de la consigna resueltos en una sola lámina. El ejemplo del martes es concreto y se puede mostrar en vivo después.");
}

/* ==================================================================
   7 — Tipos de variables
   ================================================================== */
{
  const s = pres.addSlide();
  fondo(s, false);
  etiqueta(s, M, 0.55, "Tipos de variables");
  titulo(s, "Qué se puede promediar y qué sólo se puede contar", false);
  bajada(s, "La clasificación no es un trámite: define qué operación tiene sentido sobre cada columna.", false);

  const cols = [
    ["Continuas", "Admiten cualquier valor de un rango. Se promedian.", ["ImporteTotal — pesos facturados", "CostoUnitario — costo por unidad", "ValorInventario — capital en góndola"], GRAFITO],
    ["Discretas numéricas", "Conteos. No existen los valores intermedios.", ["Cantidad — unidades vendidas", "StockDisponible — unidades en góndola", "CantidadIngresada — unidades repuestas"], GRAFITO],
    ["Discretas categóricas", "Etiquetas. Sirven para agrupar y filtrar.", ["Zona, Categoría, Proveedor", "EsFinDeSemana — binaria", "EsQuiebre — la variable objetivo"], ARCILLA]
  ];
  const cw = 3.85, gap = 0.32;
  cols.forEach((c, i) => {
    const x = M + i * (cw + gap);
    tarjeta(s, x, 2.65, cw, 3.35);
    s.addText(c[0], { x: x + 0.32, y: 2.9, w: cw - 0.64, h: 0.38, isTextBox: true, margin: 0, fontFace: TITULO, fontSize: 18, bold: true, color: c[3] });
    s.addText(c[1], { x: x + 0.32, y: 3.3, w: cw - 0.64, h: 0.62, isTextBox: true, margin: 0, fontFace: CUERPO, fontSize: 11.5, color: SLATE, lineSpacing: 16 });
    s.addText(c[2].map((t, j) => ({ text: t, options: { bullet: true, breakLine: j < c[2].length - 1 } })), {
      x: x + 0.32, y: 4.0, w: cw - 0.64, h: 1.75, isTextBox: true, margin: 0,
      fontFace: CUERPO, fontSize: 11.5, color: GRAFITO, paraSpaceAfter: 8, lineSpacing: 15
    });
  });
  pie(s, "La variable objetivo del análisis es EsQuiebre: binaria, y por eso el modelo se evalúa con confianza y lift, no con un error promedio.");
  s.addNotes("[PARTICIPANTE 1]  Punto 2. Mencionar que EsQuiebre se guarda como entero y no como bit, justamente porque se suma para contar días de faltante.");
}

/* ==================================================================
   8 — Proceso KDD
   ================================================================== */
{
  const s = pres.addSlide();
  fondo(s, false);
  etiqueta(s, M, 0.55, "Proceso KDD");
  titulo(s, "Las cinco fases, aplicadas a este caso", false);

  const fases = [
    ["Selección", "Recorte del modelo a las 7 tablas de la perspectiva logística. Se descartan cajero, medio de pago y promociones."],
    ["Preprocesamiento", "Controles de integridad: sin stock negativo, sin huérfanos. Las dos tablas de hechos cierran en 1.372.990 unidades."],
    ["Transformación", "Cálculo de tasa de quiebre, días de cobertura y valor de inventario. Banderas convertidas a enteros para poder sumarlas."],
    ["Minería de datos", "Extracción de reglas SI/ENTONCES sobre 131.580 observaciones, con soporte, confianza y lift."],
    ["Interpretación", "Validación con hold-out temporal y control de correlaciones espurias. Traducción a acciones de abastecimiento."]
  ];
  const bw = 2.28, bgap = 0.24;
  fases.forEach((f, i) => {
    const x = M + i * (bw + bgap);
    tarjeta(s, x, 2.75, bw, 3.3);
    s.addShape(pres.ShapeType.roundRect, { x: x + 0.28, y: 2.98, w: 0.36, h: 0.36, rectRadius: 0.07, fill: { color: i === 3 ? ARCILLA : AMBAR }, line: { color: i === 3 ? ARCILLA : AMBAR, width: 0 } });
    s.addText(String(i + 1), { x: x + 0.28, y: 2.98, w: 0.36, h: 0.36, isTextBox: true, margin: 0, fontFace: CUERPO, fontSize: 12, bold: true, color: i === 3 ? BLANCO : GRAFITO, align: "center", valign: "middle" });
    s.addText(f[0], { x: x + 0.28, y: 3.3, w: bw - 0.56, h: 0.66, isTextBox: true, margin: 0, fontFace: TITULO, fontSize: 14, bold: true, color: GRAFITO, valign: "top" });
    s.addText(f[1], { x: x + 0.28, y: 4.0, w: bw - 0.56, h: 1.8, isTextBox: true, margin: 0, fontFace: CUERPO, fontSize: 10.5, color: SLATE, lineSpacing: 14.5 });
  });
  pie(s, "Punto 3 de la consigna. Cada fase dejó su rastro en el repositorio: scripts, controles y resultados reproducibles.");
  s.addNotes("[PARTICIPANTE 2]  Pasar rápido por 1 a 3 y detenerse en 4 y 5, que es donde está el contenido propio.");
}

/* ==================================================================
   9 — Las cuatro reglas
   ================================================================== */
{
  const s = pres.addSlide();
  fondo(s, false);
  etiqueta(s, M, 0.55, "Aprendizaje inductivo");
  titulo(s, "Cuatro reglas inducidas desde los casos particulares", false);
  bajada(s, "Cada fila del almacén es una observación. De ellas se infieren reglas generales, y cada una tiene una acción asociada.", false);

  const reglas = [
    ["R1", "Bebidas en zona Oeste", "19,34 %", "1,91×", "Reforzar la reposición antes del fin de semana"],
    ["R2", "Proveedor Arcor, ciclo de 14 días", "9,69 %", "2,60×", "Renegociar frecuencia o subir el nivel objetivo"],
    ["R3", "Congelados en verano", "27,03 %", "3,97×", "Nivel objetivo estacional de diciembre a febrero"],
    ["R4", "Sobrestock en San Justo", "49,95 %", "1,62×", "Recalibrar el nivel objetivo a su demanda real"]
  ];
  const rh = 0.86, ry0 = 2.62;
  reglas.forEach((r, i) => {
    const y = ry0 + i * (rh + 0.14);
    tarjeta(s, M, y, W - M * 2, rh);
    s.addShape(pres.ShapeType.roundRect, { x: M + 0.28, y: y + 0.24, w: 0.52, h: 0.38, rectRadius: 0.07, fill: { color: GRAFITO }, line: { color: GRAFITO, width: 0 } });
    s.addText(r[0], { x: M + 0.28, y: y + 0.24, w: 0.52, h: 0.38, isTextBox: true, margin: 0, fontFace: CUERPO, fontSize: 12, bold: true, color: AMBAR, align: "center", valign: "middle" });
    s.addText("SI  " + r[1], { x: M + 0.98, y: y + 0.24, w: 3.5, h: 0.38, isTextBox: true, margin: 0, fontFace: CUERPO, fontSize: 13.5, bold: true, color: GRAFITO, valign: "middle" });
    s.addText(r[2], { x: M + 4.55, y: y + 0.24, w: 1.1, h: 0.38, isTextBox: true, margin: 0, fontFace: CUERPO, fontSize: 15, bold: true, color: ARCILLA, align: "right", valign: "middle" });
    s.addText("confianza", { x: M + 5.7, y: y + 0.29, w: 0.85, h: 0.28, isTextBox: true, margin: 0, fontFace: CUERPO, fontSize: 9.5, color: SLATE_CLARO, valign: "middle" });
    s.addText(r[3], { x: M + 6.5, y: y + 0.24, w: 0.85, h: 0.38, isTextBox: true, margin: 0, fontFace: CUERPO, fontSize: 15, bold: true, color: GRAFITO, align: "right", valign: "middle" });
    s.addText("lift", { x: M + 7.4, y: y + 0.29, w: 0.5, h: 0.28, isTextBox: true, margin: 0, fontFace: CUERPO, fontSize: 9.5, color: SLATE_CLARO, valign: "middle" });
    s.addText("→ " + r[4], { x: M + 8.0, y: y + 0.24, w: 3.75, h: 0.38, isTextBox: true, margin: 0, fontFace: CUERPO, fontSize: 11.5, color: SLATE, valign: "middle" });
  });
  pie(s, "El lift indica cuántas veces más probable es el quiebre cuando se cumple la condición. Un lift de 1 sería ruido.");
  s.addNotes("[PARTICIPANTE 2]  Punto 6. No leer las cuatro: contar R1 y R3, que son las más visuales, y dejar R2 para la lámina siguiente.");
}

/* ==================================================================
   10 — Hold-out
   ================================================================== */
{
  const s = pres.addSlide();
  fondo(s, false);
  etiqueta(s, M, 0.55, "Validación");
  titulo(s, "Descubiertas en 2024, verificadas contra 2025", false);
  bajada(s, "Si una regla fuera casualidad de los datos con los que se encontró, al cambiar de año se caería. Ninguna se movió más de 1,3 puntos.", false);

  s.addChart(pres.ChartType.bar, [
    { name: "Confianza 2024", labels: ["R1", "R2", "R3", "R4"], values: [19.28, 9.56, 26.42, 50.16] },
    { name: "Confianza 2025", labels: ["R1", "R2", "R3", "R4"], values: [19.40, 9.82, 27.64, 49.74] }
  ], {
    x: M, y: 2.6, w: 7.9, h: 3.5,
    barDir: "col", barGapWidthPct: 55,
    chartColors: [GRAFITO, AMBAR],
    showTitle: false,
    showValue: true, dataLabelPosition: "outEnd", dataLabelFontSize: 10,
    dataLabelColor: SLATE, dataLabelFormatCode: '0.0"%"',
    showLegend: true, legendPos: "t", legendFontSize: 11, legendColor: SLATE,
    catAxisLabelColor: GRAFITO, catAxisLabelFontSize: 12,
    valAxisLabelColor: SLATE, valAxisLabelFontSize: 10,
    valAxisMaxVal: 60, valAxisMajorUnit: 20,
    valGridLine: { color: "E3E3DE", size: 1 },
    catGridLine: { style: "none" },
    valAxisLabelFormatCode: '0"%"'
  });

  tarjeta(s, 9.0, 2.6, 3.6, 3.5, { fill: "EFEFEA", line: "E3E3DE" });
  s.addText("Por qué importa", { x: 9.3, y: 2.85, w: 3.0, h: 0.32, isTextBox: true, margin: 0, fontFace: CUERPO, fontSize: 13, bold: true, color: GRAFITO });
  s.addText("Con suficientes cruces siempre aparece alguna coincidencia llamativa. La prueba de que un patrón es real no es que se vea bien en el gráfico: es que sobreviva a datos que el análisis no miró.", {
    x: 9.3, y: 3.25, w: 3.0, h: 1.6, isTextBox: true, margin: 0, fontFace: CUERPO, fontSize: 12, color: SLATE, lineSpacing: 17
  });
  s.addText("< 1,3 pts", { x: 9.3, y: 4.95, w: 3.0, h: 0.55, isTextBox: true, margin: 0, fontFace: TITULO, fontSize: 28, bold: true, color: GRAFITO });
  s.addText("de desvío máximo entre\nel año de inducción y el de prueba", { x: 9.3, y: 5.5, w: 3.0, h: 0.5, isTextBox: true, margin: 0, fontFace: CUERPO, fontSize: 10.5, color: SLATE, lineSpacing: 14 });
  s.addNotes("[PARTICIPANTE 2]  Punto 5, primera mitad: sobreajuste. La segunda mitad es la lámina que sigue.");
}

/* ==================================================================
   11 — Correlación espuria
   ================================================================== */
{
  const s = pres.addSlide();
  fondo(s, false);
  etiqueta(s, M, 0.55, "Correlación espuria", { fill: ARCILLA, color: BLANCO });
  titulo(s, "¿Es el proveedor, o es la zona?", false);
  bajada(s, "Coca-Cola encabeza el ranking de faltantes. Al excluir la zona Oeste del cálculo, el efecto desaparece. Con Arcor pasa lo contrario.", false);

  s.addChart(pres.ChartType.bar, [
    { name: "Tasa de quiebre global", labels: ["Coca-Cola", "Aguas Danone", "Cervecería Quilmes", "Arcor", "Frigorífico Sur"], values: [10.77, 9.84, 9.84, 9.69, 6.80] },
    { name: "Excluyendo zona Oeste", labels: ["Coca-Cola", "Aguas Danone", "Cervecería Quilmes", "Arcor", "Frigorífico Sur"], values: [0.78, 0.85, 1.00, 11.49, 8.14] }
  ], {
    x: M, y: 2.65, w: 8.0, h: 3.45,
    barDir: "col", barGapWidthPct: 45,
    chartColors: [GRAFITO, ARCILLA],
    showTitle: false,
    showValue: true, dataLabelPosition: "outEnd", dataLabelFontSize: 9.5,
    dataLabelColor: SLATE, dataLabelFormatCode: '0.0"%"',
    showLegend: true, legendPos: "t", legendFontSize: 11, legendColor: SLATE,
    catAxisLabelColor: GRAFITO, catAxisLabelFontSize: 10,
    valAxisLabelColor: SLATE, valAxisLabelFontSize: 10,
    valAxisMaxVal: 14, valAxisMajorUnit: 7,
    valGridLine: { color: "E3E3DE", size: 1 },
    catGridLine: { style: "none" },
    valAxisLabelFormatCode: '0"%"'
  });

  tarjeta(s, 9.1, 2.65, 3.5, 1.62, { fill: BLANCO, line: "E3E3DE" });
  s.addText("Efecto que se desvanece", { x: 9.38, y: 2.85, w: 2.95, h: 0.3, isTextBox: true, margin: 0, fontFace: CUERPO, fontSize: 12, bold: true, color: GRAFITO });
  s.addText("10,8 %  →  0,8 %", { x: 9.38, y: 3.18, w: 2.95, h: 0.4, isTextBox: true, margin: 0, fontFace: TITULO, fontSize: 18, bold: true, color: SLATE });
  s.addText("Nunca fue Coca-Cola. Era la zona.", { x: 9.38, y: 3.6, w: 2.95, h: 0.5, isTextBox: true, margin: 0, fontFace: CUERPO, fontSize: 11, color: SLATE, lineSpacing: 15 });

  tarjeta(s, 9.1, 4.48, 3.5, 1.62, { fill: BLANCO, line: ARCILLA });
  s.addText("Efecto que se refuerza", { x: 9.38, y: 4.68, w: 2.95, h: 0.3, isTextBox: true, margin: 0, fontFace: CUERPO, fontSize: 12, bold: true, color: GRAFITO });
  s.addText("9,7 %  →  11,5 %", { x: 9.38, y: 5.01, w: 2.95, h: 0.4, isTextBox: true, margin: 0, fontFace: TITULO, fontSize: 18, bold: true, color: ARCILLA });
  s.addText("Acá sí hay un problema real de ciclo de entrega.", { x: 9.38, y: 5.43, w: 2.95, h: 0.5, isTextBox: true, margin: 0, fontFace: CUERPO, fontSize: 11, color: SLATE, lineSpacing: 15 });

  pie(s, "Presentar sólo la primera serie llevaría a renegociar el contrato equivocado.");
  s.addNotes("[PARTICIPANTE 2]  La lámina más fuerte del pitch. Pausar acá. Si hay una sola pregunta del jurado, va a salir de esta diapositiva.");
}

/* ==================================================================
   12 — Impacto
   ================================================================== */
{
  const s = pres.addSlide();
  fondo(s, false);
  etiqueta(s, M, 0.55, "Impacto");
  titulo(s, "Qué cuesta hoy, y qué se libera al corregirlo", false);

  const bloques = [
    ["$ 75,5 M", "Venta perdida estimada en 12 meses", "Asume un día de demanda perdida por cada día-producto en quiebre", ARCILLA],
    ["$ 960 K", "Capital liberable en San Justo", "Si operara con los 4 días de cobertura del resto de la cadena", AMBAR],
    ["2.969", "Días de faltante de bebidas en el Oeste", "Concentrados en los días hábiles posteriores al fin de semana", GRAFITO]
  ];
  const bw = 3.85, bgap = 0.32;
  bloques.forEach((b, i) => {
    const x = M + i * (bw + bgap);
    tarjeta(s, x, 2.35, bw, 2.05);
    s.addText(b[0], { x: x + 0.32, y: 2.6, w: bw - 0.64, h: 0.7, isTextBox: true, margin: 0, fontFace: TITULO, fontSize: 32, bold: true, color: b[3], valign: "middle" });
    s.addText(b[1], { x: x + 0.32, y: 3.3, w: bw - 0.64, h: 0.42, isTextBox: true, margin: 0, fontFace: CUERPO, fontSize: 12.5, bold: true, color: GRAFITO });
    s.addText(b[2], { x: x + 0.32, y: 3.72, w: bw - 0.64, h: 0.5, isTextBox: true, margin: 0, fontFace: CUERPO, fontSize: 10.5, color: SLATE, lineSpacing: 14 });
  });

  s.addText("Tres decisiones concretas", { x: M, y: 4.7, w: 6.0, h: 0.35, isTextBox: true, margin: 0, fontFace: CUERPO, fontSize: 14, bold: true, color: GRAFITO });
  const acciones = [
    "Nivel objetivo diferenciado para fin de semana en las bebidas del Oeste",
    "Renegociar con Arcor el ciclo de 14 días, o compensarlo subiendo el nivel objetivo",
    "Recalibrar San Justo a su demanda real y redistribuir el excedente"
  ];
  s.addText(acciones.map((a, i) => ({ text: a, options: { bullet: true, breakLine: i < acciones.length - 1 } })), {
    x: M, y: 5.1, w: 11.4, h: 1.2, isTextBox: true, margin: 0,
    fontFace: CUERPO, fontSize: 13, color: SLATE, paraSpaceAfter: 9, lineSpacing: 18
  });
  s.addNotes("[PARTICIPANTE 2]  Cerrar con acciones, no con números. El jurado quiere ver que el análisis termina en una decisión.");
}

/* ==================================================================
   13 — La demo
   ================================================================== */
{
  const s = pres.addSlide();
  fondo(s, false);
  etiqueta(s, M, 0.55, "Demostración en vivo");
  titulo(s, "El portal de abastecimiento", false);
  bajada(s, "Los hallazgos anteriores no quedan en un informe: el gerente los explora solo, sin saber SQL.", false);

  const pasos = [
    ["Estado general", "Cuatro indicadores con semáforo y las tres alertas más urgentes del momento"],
    ["Filtrar por Oeste y Bebidas", "Todo se recalcula: la tasa salta a 19,34 %, el mismo número que dio SQL"],
    ["Quiebre por día", "El pico cae el martes, no el fin de semana. El efecto de arrastre, visible"],
    ["Control de proveedores", "Coca-Cola se desploma al excluir el Oeste; Arcor se mantiene arriba"]
  ];
  pasos.forEach((p, i) => {
    const y = 2.62 + i * 0.92;
    tarjeta(s, M, y, 7.6, 0.78);
    s.addShape(pres.ShapeType.roundRect, { x: M + 0.28, y: y + 0.2, w: 0.38, h: 0.38, rectRadius: 0.07, fill: { color: AMBAR }, line: { color: AMBAR, width: 0 } });
    s.addText(String(i + 1), { x: M + 0.28, y: y + 0.2, w: 0.38, h: 0.38, isTextBox: true, margin: 0, fontFace: CUERPO, fontSize: 12, bold: true, color: GRAFITO, align: "center", valign: "middle" });
    s.addText(p[0], { x: M + 0.82, y: y + 0.11, w: 2.5, h: 0.3, isTextBox: true, margin: 0, fontFace: CUERPO, fontSize: 12.5, bold: true, color: GRAFITO });
    s.addText(p[1], { x: M + 0.82, y: y + 0.4, w: 6.5, h: 0.3, isTextBox: true, margin: 0, fontFace: CUERPO, fontSize: 11, color: SLATE });
  });

  tarjeta(s, 8.7, 2.62, 3.9, 3.62, { fill: GRAFITO, line: GRAFITO });
  s.addText("Cómo está hecho", { x: 9.0, y: 2.85, w: 3.3, h: 0.3, isTextBox: true, margin: 0, fontFace: CUERPO, fontSize: 12.5, bold: true, color: AMBAR });
  const tec = [
    "Sin librerías ni compilación",
    "Gráficos dibujados a mano en SVG",
    "SQL Server resume 470.000 registros a 783 filas",
    "Los filtros reagregan por conteos, no por promedios de tasas",
    "Preparado para enchufarle el backend"
  ];
  s.addText(tec.map((t, i) => ({ text: t, options: { bullet: true, breakLine: i < tec.length - 1 } })), {
    x: 9.0, y: 3.25, w: 3.3, h: 2.4, isTextBox: true, margin: 0,
    fontFace: CUERPO, fontSize: 11, color: "D6D8DC", paraSpaceAfter: 8, lineSpacing: 15
  });
  s.addText("santiagoskrobacki.github.io", { x: 9.0, y: 5.78, w: 3.3, h: 0.3, isTextBox: true, margin: 0, fontFace: CUERPO, fontSize: 10, color: SLATE_CLARO });
  s.addNotes("[PARTICIPANTE 2]  Abrir el portal en otra ventana ANTES de empezar el pitch. Si falla internet, la copia embebida hace que abra igual con doble clic.");
}

/* ==================================================================
   14 — Cierre
   ================================================================== */
{
  const s = pres.addSlide();
  fondo(s, true);

  etiqueta(s, M, 1.35, "Conclusión");
  s.addText("El problema no era reponer más:\nera reponer con el parámetro correcto", {
    x: M, y: 1.85, w: 8.6, h: 1.6, isTextBox: true, margin: 0,
    fontFace: TITULO, fontSize: 32, bold: true, color: BLANCO, lineSpacing: 42
  });
  s.addText("MiniRed calcula su nivel objetivo de reposición sobre el promedio de días hábiles. Los tres patrones de quiebre y el de sobrestock salen todos de ese mismo supuesto.", {
    x: M, y: 3.6, w: 8.2, h: 1.0, isTextBox: true, margin: 0,
    fontFace: CUERPO, fontSize: 15, color: SLATE_CLARO, lineSpacing: 22
  });

  const items = [
    ["4", "reglas validadas", "con hold-out temporal"],
    ["3", "acciones concretas", "sobre el nivel objetivo"],
    ["1", "correlación espuria", "descartada a tiempo"]
  ];
  items.forEach((it, i) => {
    const x = M + i * 3.9;
    s.addText(it[0], { x, y: 4.95, w: 0.7, h: 0.72, isTextBox: true, margin: 0, fontFace: TITULO, fontSize: 40, bold: true, color: AMBAR, valign: "middle" });
    s.addText(it[1], { x: x + 0.75, y: 5.0, w: 2.9, h: 0.32, isTextBox: true, margin: 0, fontFace: CUERPO, fontSize: 13, bold: true, color: BLANCO, valign: "middle" });
    s.addText(it[2], { x: x + 0.75, y: 5.32, w: 2.9, h: 0.32, isTextBox: true, margin: 0, fontFace: CUERPO, fontSize: 11, color: SLATE_CLARO, valign: "middle" });
  });

  s.addText("Portal, código y documentación:  github.com/SantiagoSkrobacki/TP_MiniRedBaseDeDatos   ·   Gracias.", {
    x: M, y: 6.45, w: 11.4, h: 0.35, isTextBox: true, margin: 0,
    fontFace: CUERPO, fontSize: 12, color: SLATE_CLARO
  });
  s.addNotes("[PARTICIPANTE 2]  Cierre en una sola idea: un supuesto mal puesto en la política de reposición explica los cuatro hallazgos. Abrir preguntas.");
}

pres.writeFile({ fileName: "MiniRed_Pitch.pptx" }).then(f => console.log("escrito:", f));
