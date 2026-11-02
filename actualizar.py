"""Genera euribor.json: euríbor a 12 meses del día y medias mensuales de los últimos 3 años.

Media mensual: BCE (la misma que usa el Banco de España como referencia hipotecaria).
Valor diario: euribor-rates.eu. Si una fuente falla se conserva lo que había.
"""
import csv, io, json, os, re, urllib.request
from datetime import datetime

RUTA = os.path.join(os.path.dirname(os.path.abspath(__file__)), "euribor.json")
BCE = "https://data-api.ecb.europa.eu/service/data/FM/M.U2.EUR.RT.MM.EURIBOR1YD_.HSTA?format=csvdata&lastNObservations=36"
DIARIO = "https://www.euribor-rates.eu/en/current-euribor-rates/4/euribor-rate-12-months/"
UA = {"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)"}


def bajar(url):
    return urllib.request.urlopen(urllib.request.Request(url, headers=UA), timeout=60).read().decode("utf-8", "replace")


def mensual():
    filas = csv.DictReader(io.StringIO(bajar(BCE)))
    return [{"mes": f["TIME_PERIOD"], "valor": round(float(f["OBS_VALUE"]), 3)} for f in filas if f.get("OBS_VALUE")]


def diario():
    html = bajar(DIARIO)
    filas = re.findall(r"(\d{1,2})/(\d{1,2})/(\d{4})</td>\s*<td[^>]*>\s*(-?[\d.]+)\s*%", html)
    out = []
    for m, d, a, v in filas[:30]:
        out.append({"fecha": "%s-%02d-%02d" % (a, int(m), int(d)), "valor": float(v)})
    out.sort(key=lambda x: x["fecha"])
    return out


def main():
    try:
        datos = json.load(open(RUTA, encoding="utf-8"))
    except Exception:
        datos = {}
    try:
        datos["mensual"] = mensual()
    except Exception as e:
        print("BCE falló:", e)
    try:
        d = diario()
        if d:
            datos["diario"] = d
    except Exception as e:
        print("Diario falló:", e)
    if not datos.get("mensual"):
        raise SystemExit("Sin datos")
    datos["actualizado"] = datetime.utcnow().strftime("%Y-%m-%d")
    with open(RUTA, "w", encoding="utf-8") as f:
        json.dump(datos, f, ensure_ascii=False, separators=(",", ":"))
    print(datos["actualizado"], datos["mensual"][-1], (datos.get("diario") or [None])[-1])


if __name__ == "__main__":
    main()
