"""Arma el guion del pitch en HTML: cada diapositiva con su imagen al lado del
texto que le corresponde. Después se convierte a PDF con Chrome sin interfaz."""

import base64
import io
import pathlib
import re

RAIZ = pathlib.Path(r"C:\Users\Santy\Desktop\TP_MiniRedBaseDeDatos")
THUMBS = pathlib.Path(
    r"C:\Users\Santy\AppData\Local\Temp\claude"
    r"\C--Users-Santy-Desktop-automata-laberinto-master"
    r"\e0a46d33-2cfa-4945-b2fd-d39b10ec4576\scratchpad\ppt\thumbs"
)
SALIDA = pathlib.Path(
    r"C:\Users\Santy\AppData\Local\Temp\claude"
    r"\C--Users-Santy-Desktop-automata-laberinto-master"
    r"\e0a46d33-2cfa-4945-b2fd-d39b10ec4576\scratchpad\ppt\guion.html"
)

md = io.open(RAIZ / "docs" / "guion-pitch.md", encoding="utf-8").read()


def imagen(n):
    p = THUMBS / f"Diapositiva{n}.PNG"
    if not p.exists():
        return None
    return "data:image/png;base64," + base64.b64encode(p.read_bytes()).decode()


def inline(t):
    """Marcado en línea de Markdown a HTML."""
    t = (t.replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;"))
    t = re.sub(r"\*\*(.+?)\*\*", r"<strong>\1</strong>", t)
    t = re.sub(r"\*(.+?)\*", r"<em>\1</em>", t)
    t = re.sub(r"`(.+?)`", r"<code>\1</code>", t)
    return t


bloques = re.split(r"\n## ", md)
intro = bloques[0]
secciones = bloques[1:]

partes = []

for sec in secciones:
    lineas = sec.split("\n")
    cabecera = lineas[0].strip()
    cuerpo = "\n".join(lineas[1:])

    m = re.match(r"^(\d+) · (.+?) — \*\*([AB])\*\* — (.+)$", cabecera)

    # ---- párrafos hablados, acotaciones y transición ----
    hablado, acot, transicion = [], [], None
    buffer = []
    for ln in cuerpo.split("\n"):
        s = ln.strip()
        if s.startswith(">"):
            txt = s.lstrip("> ").strip()
            if txt:
                buffer.append(txt)
            elif buffer:
                hablado.append(" ".join(buffer)); buffer = []
        else:
            if buffer:
                hablado.append(" ".join(buffer)); buffer = []
            if s.startswith("**Transición:**"):
                transicion = inline(s.replace("**Transición:**", "").strip())
            elif s.startswith("*(") and s.endswith(")*"):
                acot.append(inline(s[2:-2]))
            elif s.startswith("- [ ]"):
                acot.append("CHECK:" + inline(s[5:].strip()))
    if buffer:
        hablado.append(" ".join(buffer))

    bloques_libres = []
    if not m:
        acc = []
        for ln in cuerpo.split(chr(10)):
            t = ln.strip()
            if not t or t.startswith("---"):
                if acc:
                    bloques_libres.append(" ".join(acc)); acc = []
            elif t.startswith("- [ ]"):
                if acc:
                    bloques_libres.append(" ".join(acc)); acc = []
                bloques_libres.append("CHECK:" + t[5:].strip())
            else:
                acc.append(t)
        if acc:
            bloques_libres.append(" ".join(acc))

    partes.append({
        "libres": bloques_libres,
        "num": m.group(1) if m else None,
        "titulo": inline(m.group(2)) if m else inline(cabecera),
        "quien": m.group(3) if m else None,
        "tiempo": m.group(4) if m else None,
        "hablado": [inline(h) for h in hablado],
        "acot": acot,
        "transicion": transicion,
    })

# ------------------------------------------------------------------ HTML

css = """
@page { size: A4 portrait; margin: 14mm 15mm 13mm; }
* { box-sizing: border-box; }
body { margin:0; font-family: Calibri, "Segoe UI", sans-serif; color:#22252B;
       font-size: 11.2pt; line-height: 1.5; }
h1 { font-family: Cambria, Georgia, serif; font-size: 25pt; margin:0 0 6pt;
     letter-spacing:-.01em; }
.portada { padding-bottom: 10pt; border-bottom: 2px solid #22252B; margin-bottom: 14pt; }
.portada p { margin: 0 0 8pt; color:#5C6270; font-size: 11.5pt; max-width: 46em; }
.chip { display:inline-block; background:#E9A13B; color:#22252B; font-size:8.5pt;
        font-weight:bold; letter-spacing:.09em; padding:2.5pt 7pt; border-radius:3pt;
        text-transform:uppercase; }

.slide { page-break-after: always; page-break-inside: avoid; }
.slide:last-of-type { page-break-after: auto; }

.cab { display:flex; align-items:baseline; gap:9pt; margin-bottom:7pt; }
.num { font-family: Cambria, serif; font-size:20pt; font-weight:bold; color:#E9A13B;
       line-height:1; }
.tit { font-family: Cambria, serif; font-size:15pt; font-weight:bold; flex:1; }
.quien { font-size:9pt; font-weight:bold; color:#fff; background:#22252B;
         padding:2.5pt 7pt; border-radius:3pt; white-space:nowrap; }
.quien.b { background:#B03A2E; }
.tiempo { font-size:9.5pt; color:#5C6270; white-space:nowrap; font-variant-numeric:tabular-nums; }

.thumb { width:100%; border:1px solid #D8D8D2; border-radius:3pt; display:block;
         margin: 0 0 11pt; }

.dice { margin:0 0 8pt; padding-left:10pt; border-left:2.5pt solid #E9A13B; }
.dice p { margin:0 0 7pt; }
.dice p:last-child { margin-bottom:0; }

.acot { font-size:10pt; color:#5C6270; font-style:italic; margin:0 0 7pt; }
.acot.check::before { content:"☐  "; font-style:normal; }
.trans { margin-top:9pt; padding-top:7pt; border-top:1px solid #E0E0DA;
         font-size:10pt; color:#5C6270; }
.trans b { color:#22252B; }

.libre h2 { font-family: Cambria, serif; font-size:16pt; margin:0 0 9pt; }
.libre p { margin:0 0 7pt; }
.qa p { margin:0 0 9pt; }
"""

html = ["<!doctype html><html lang='es'><head><meta charset='utf-8'>",
        "<title>Guion del pitch — MiniRed</title>",
        f"<style>{css}</style></head><body>"]

# portada
html.append("""
<div class="portada">
  <span class="chip">Guion de presentación</span>
  <h1 style="margin-top:9pt">Pitch MiniRed — 10 minutos, dos presentadores</h1>
  <p>Cada página corresponde a una diapositiva de <strong>MiniRed_Pitch.pptx</strong>.
  Arriba, la lámina tal como se ve proyectada; abajo, qué se dice sobre ella.</p>
  <p><strong>A</strong> lleva la voz del negocio: abre, plantea el problema, el impacto y el cierre.
  <strong>B</strong> lleva la voz técnica: el modelo, las reglas, la validación y la demo.
  Así ninguno habla más de dos minutos seguidos.</p>
  <p>Lo escrito es para ensayar, no para leer. Una vez tomada la idea, contarlo con
  palabras propias suena mucho mejor.</p>
</div>
""")

for p in partes:
    if p["num"]:
        img = imagen(int(p["num"]))
        cls = "quien b" if p["quien"] == "B" else "quien"
        html.append("<section class='slide'>")
        html.append("<div class='cab'>"
                    f"<span class='num'>{p['num']}</span>"
                    f"<span class='tit'>{p['titulo']}</span>"
                    f"<span class='{cls}'>Habla {p['quien']}</span>"
                    f"<span class='tiempo'>{p['tiempo']}</span></div>")
        if img:
            html.append(f"<img class='thumb' src='{img}' alt='Diapositiva {p[chr(39)+'num'+chr(39)] if False else p['num']}'>")
        for a in p["acot"]:
            if a.startswith(("CHECK:", "Q:", "P:")):
                continue
            html.append(f"<p class='acot'>{a}</p>")
        if p["hablado"]:
            html.append("<div class='dice'>" + "".join(f"<p>{h}</p>" for h in p["hablado"]) + "</div>")
        if p["transicion"]:
            html.append(f"<p class='trans'><b>Pasa a:</b> {p['transicion']}</p>")
        html.append("</section>")
    else:
        # secciones sin diapositiva: checklist previo y preguntas
        html.append("<section class='slide libre'>")
        html.append(f"<h2>{p['titulo']}</h2>")
        es_qa = "Pregunta" in p["titulo"]
        html.append("<div class='qa'>" if es_qa else "<div>")
        for blk in p["libres"]:
            if blk.startswith("CHECK:"):
                html.append(f"<p class='acot check'>{inline(blk[6:])}</p>")
            else:
                html.append(f"<p>{inline(blk)}</p>")
        html.append("</div></section>")

html.append("</body></html>")
io.open(SALIDA, "w", encoding="utf-8").write("\n".join(html))
print("HTML escrito:", SALIDA, f"({SALIDA.stat().st_size/1024:.0f} KB)")
print("secciones:", len(partes), "| con diapositiva:", sum(1 for x in partes if x["num"]))
