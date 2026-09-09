"""Regenera landing/seed-data.js a partir de landing/data/portal.json.

El JSON se produce con:
    bcp "EXEC MiniRed_DW.dbo.sp_PortalDashboard" queryout landing/data/portal.json ^
        -S localhost -T -c -C 65001

El seed es solo un respaldo: si hay backend, el portal usa la API y lo ignora.
"""
import json, io, pathlib

raiz = pathlib.Path(__file__).resolve().parent.parent
datos = json.loads(io.open(raiz / "landing" / "data" / "portal.json", encoding="utf-8-sig").read().strip())

cabecera = (
    "// GENERADO AUTOMATICAMENTE - no editar a mano.\n"
    "// Origen: EXEC MiniRed_DW.dbo.sp_PortalDashboard\n"
    "// Regenerar:  python landing/build-seed.py\n"
    "// Sirve de respaldo para que el portal abra sin servidor ni backend.\n"
    "window.__MINIRED_SEED__ = "
)
salida = cabecera + json.dumps(datos, ensure_ascii=False, separators=(",", ":")) + ";\n"
io.open(raiz / "landing" / "seed-data.js", "w", encoding="utf-8").write(salida)
print(f"seed-data.js regenerado ({len(salida):,} bytes)")
