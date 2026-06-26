#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
image_filler.py
----------------
Herramienta de un solo archivo (servidor local + navegador) para recorrer un
JSON de palabras y rellenar el campo "image" con una versión comprimida
(<= 7 KB) en base64 de una imagen que el usuario arrastra o pega.

Uso:
    pip install pillow
    python image_filler.py palabras.json [puerto]

Por defecto usa "words.json" y el puerto 8765.
Abre automáticamente el navegador en http://127.0.0.1:<puerto>/
"""

import sys
import json
import base64
import io
import time
import threading
import webbrowser
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path

try:
    from PIL import Image
except ImportError:
    sys.exit("Falta la dependencia Pillow. Instálala con: pip install pillow")

# ---------------------------------------------------------------------------
# Configuración
# ---------------------------------------------------------------------------
JSON_PATH = Path(sys.argv[1] if len(sys.argv) > 1 else "words.json")
PORT = int(sys.argv[2]) if len(sys.argv) > 2 else 8765
MAX_BYTES = 7 * 1024  # tope de 7 KB para la imagen ya comprimida

if not JSON_PATH.exists():
    sys.exit(f"No existe el archivo: {JSON_PATH}")

lock = threading.Lock()

def load_data():
    with open(JSON_PATH, "r", encoding="utf-8") as f:
        return json.load(f)

def save_data(payload, retries=8, delay=0.25):
    """
    Guarda con escritura atómica (archivo temporal + replace).
    Reintenta si el archivo está bloqueado (p.ej. por VSCode en Windows).
    """
    tmp = JSON_PATH.with_suffix(JSON_PATH.suffix + ".tmp")
    with open(tmp, "w", encoding="utf-8") as f:
        json.dump(payload, f, ensure_ascii=False, indent=2)
    last_err = None
    for attempt in range(retries):
        try:
            tmp.replace(JSON_PATH)
            return  # éxito
        except PermissionError as e:
            last_err = e
            time.sleep(delay)
    # último intento: si falla, que el error suba
    try:
        tmp.replace(JSON_PATH)
    except PermissionError:
        # Plan B: sobrescribir directamente si replace sigue fallando
        with open(JSON_PATH, "w", encoding="utf-8") as f:
            json.dump(payload, f, ensure_ascii=False, indent=2)
        try:
            tmp.unlink()
        except OSError:
            pass
        print(f"[WARN] Escritura atómica falló ({last_err}); se escribió directamente.")

data = load_data()
if not isinstance(data, list):
    sys.exit("El JSON debe ser una lista de objetos con la estructura esperada.")

pointer = 0

def find_next_pending(start):
    """Avanza desde `start` saltando (con log en consola) las palabras que
    ya tienen imagen asignada."""
    i = start
    n = len(data)
    while i < n:
        entry = data[i]
        if entry.get("image"):
            print(f"[SKIP-AUTO] '{entry.get('word')}' ya tiene imagen, se omite.")
            i += 1
            continue
        return i
    return n

pointer = find_next_pending(0)

# ---------------------------------------------------------------------------
# Compresión de imagen
# ---------------------------------------------------------------------------
def compress_image(raw_bytes, max_bytes=MAX_BYTES):
    """Recibe bytes crudos de cualquier imagen estática común y devuelve
    (bytes_jpeg_comprimidos, ancho/alto_max_usado, calidad_usada),
    intentando quedar por debajo de max_bytes."""
    img = Image.open(io.BytesIO(raw_bytes))

    # Rechazar imágenes animadas (gif animado, webp animado, apng, etc.)
    if getattr(img, "is_animated", False) or getattr(img, "n_frames", 1) > 1:
        raise ValueError("Solo se permiten imágenes estáticas (esta imagen es animada).")

    # Normalizar a RGB (sin canal alfa) para poder guardar como JPEG
    if img.mode in ("RGBA", "LA") or (img.mode == "P" and "transparency" in img.info):
        img = img.convert("RGBA")
        bg = Image.new("RGB", img.size, (255, 255, 255))
        bg.paste(img, mask=img.split()[-1])
        img = bg
    else:
        img = img.convert("RGB")

    max_dims = [256, 192, 160, 128, 96, 64, 48, 32]
    quality_steps = [85, 75, 65, 55, 45, 35, 25, 15, 10]

    last_bytes, last_dim, last_q = None, None, None
    for max_dim in max_dims:
        w, h = img.size
        scale = min(1.0, max_dim / max(w, h))
        if scale < 1.0:
            resized = img.resize(
                (max(1, round(w * scale)), max(1, round(h * scale))),
                Image.LANCZOS,
            )
        else:
            resized = img
        for q in quality_steps:
            buf = io.BytesIO()
            resized.save(buf, format="JPEG", quality=q, optimize=True)
            size = buf.tell()
            last_bytes, last_dim, last_q = buf.getvalue(), max_dim, q
            if size <= max_bytes:
                return last_bytes, max_dim, q

    # Si ni en el peor caso entra bajo el límite, devolvemos lo más pequeño logrado
    return last_bytes, last_dim, last_q

# ---------------------------------------------------------------------------
# Estado para el frontend
# ---------------------------------------------------------------------------
def current_state(extra=None):
    n = len(data)
    if pointer >= n:
        state = {"done": True, "total": n}
    else:
        entry = data[pointer]
        state = {
            "done": False,
            "index": pointer,
            "total": n,
            "word": entry.get("word"),
            "translations": entry.get("translations") or [],
            "description": entry.get("description"),
            "past": entry.get("past"),
        }
    if extra:
        state.update(extra)
    return state

# ---------------------------------------------------------------------------
# HTML / JS embebido (página única)
# ---------------------------------------------------------------------------
PAGE = """<!doctype html>
<html lang="es">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Rellenar imágenes</title>
<style>
  :root{ color-scheme: dark; }
  *{ box-sizing: border-box; }
  body{
    font-family: system-ui, -apple-system, Segoe UI, Roboto, sans-serif;
    display:flex; justify-content:center; align-items:center;
    min-height:100vh; margin:0; background:#0f172a; color:#e2e8f0;
    padding: 1.5rem;
  }
  .card{
    background:#1e293b; padding:2rem 2.25rem; border-radius:16px;
    max-width:460px; width:100%; box-shadow:0 10px 30px rgba(0,0,0,.35);
  }
  h1{ font-size:.85rem; color:#94a3b8; margin:0 0 .35rem; font-weight:600; letter-spacing:.02em;}
  .word{ font-size:2.1rem; font-weight:700; margin:.1rem 0 .9rem; display:flex; align-items:center; gap:.6rem; word-break:break-word;}
  .word button{
    border:none; background:#334155; color:#e2e8f0; border-radius:8px;
    width:2rem; height:2rem; font-size:1rem; cursor:pointer; flex:0 0 auto;
  }
  .word button:hover{ background:#475569; }
  .desc{ color:#cbd5e1; font-size:.92rem; margin-bottom:.4rem; line-height:1.4;}
  .meta{ color:#64748b; font-size:.8rem; margin-bottom:1rem; }
  .drop{
    margin-top:.5rem; border:2px dashed #475569; border-radius:12px;
    min-height:170px; display:flex; align-items:center; justify-content:center;
    text-align:center; padding:1rem; color:#64748b; font-size:.85rem;
    transition:.15s; cursor:pointer;
  }
  .drop.drag{ border-color:#38bdf8; background:rgba(56,189,248,.08); color:#7dd3fc; }
  .drop img{ max-width:100%; max-height:155px; border-radius:8px; }
  input[type=file]{ display:none; }
  .toast{ margin-top:.7rem; font-size:.82rem; text-align:center; min-height:1.2rem; }
  .ok{ color:#4ade80; }
  .err{ color:#f87171; }
  .warn{ color:#facc15; }
  .skip-btn{
    margin-top:1.1rem; width:100%; padding:.7rem; border:none; border-radius:10px;
    background:#7f1d1d; color:#fecaca; font-weight:600; font-size:.88rem; cursor:pointer;
  }
  .skip-btn:hover{ background:#991b1b; }
  .done{ text-align:center; padding:2rem 0; }
  .done .big{ font-size:1.5rem; margin-bottom:.4rem; }
  .done small{ color:#64748b; }
</style>
</head>
<body>
  <div class="card" id="app">Cargando…</div>

<script>
// ─── Estado ────────────────────────────────────────────────────────────────
let state = null;
let uploading = false;   // bloquea uploads simultáneos

// ─── Listener de paste: se registra UNA SOLA VEZ aquí, nunca dentro de
//     setupDrop/render, para evitar la acumulación de listeners que causaba
//     que una imagen se aplicara a varias palabras consecutivas.
document.addEventListener('paste', e => {
  const items = e.clipboardData ? e.clipboardData.items : [];
  for (const it of items) {
    if (it.type && it.type.startsWith('image/')) {
      handleFile(it.getAsFile());
      break;
    }
  }
});

// ─── API ───────────────────────────────────────────────────────────────────
async function refresh() {
  const r = await fetch('/api/state');
  state = await r.json();
  render();
}

function render() {
  const app = document.getElementById('app');
  if (state.done) {
    app.innerHTML = `
      <div class="done">
        <div class="big">✅ ¡Completado!</div>
        <small>No quedan palabras sin imagen (${state.total} en total).</small>
      </div>`;
    return;
  }

  app.innerHTML = `
    <h1>PALABRA ${state.index + 1} / ${state.total}</h1>
    <div class="word">
      <span id="wordText">${escapeHtml(state.word || '')}</span>
      <button id="copyBtn" title="Copiar palabra">⧉</button>
    </div>
    ${state.description ? `<div class="desc">${escapeHtml(state.description)}</div>` : ''}
    <div class="meta">
      ${ (state.translations && state.translations.length) ? 'Traducción: ' + escapeHtml(state.translations.join(', ')) : '' }
      ${ state.past ? ' · Past: ' + escapeHtml(state.past) : '' }
    </div>
    <div class="drop" id="drop">Arrastra una imagen aquí, pégala (Ctrl+V) o haz clic para elegirla</div>
    <input type="file" id="fileInput" accept="image/*">
    <div class="toast" id="toast"></div>
    <button class="skip-btn" id="skipBtn">Saltar esta palabra ⏭</button>
  `;

  document.getElementById('copyBtn').onclick = () => {
    navigator.clipboard.writeText(state.word || '');
    flash('Copiado: ' + state.word, 'ok');
  };

  document.getElementById('skipBtn').onclick = async () => {
    if (uploading) { flash('Espera, hay una subida en curso…', 'warn'); return; }
    await fetch('/api/skip', { method: 'POST' });
    refresh();
  };

  setupDrop();
}

function escapeHtml(s) {
  const d = document.createElement('div');
  d.textContent = s;
  return d.innerHTML;
}

function flash(msg, cls) {
  const t = document.getElementById('toast');
  if (!t) return;
  t.textContent = msg;
  t.className = 'toast ' + (cls || '');
}

// ─── Zona de drop: solo registra click, drag/drop y file-input.
//     El paste va en el listener global de arriba.
function setupDrop() {
  const drop = document.getElementById('drop');
  const fileInput = document.getElementById('fileInput');

  drop.addEventListener('click', () => fileInput.click());
  fileInput.addEventListener('change', () => {
    if (fileInput.files[0]) handleFile(fileInput.files[0]);
  });

  ['dragenter', 'dragover'].forEach(ev => drop.addEventListener(ev, e => {
    e.preventDefault();
    drop.classList.add('drag');
  }));
  ['dragleave', 'drop'].forEach(ev => drop.addEventListener(ev, e => {
    e.preventDefault();
    drop.classList.remove('drag');
  }));
  drop.addEventListener('drop', e => {
    const f = e.dataTransfer.files[0];
    if (f) handleFile(f);
  });
}

// ─── Subida ────────────────────────────────────────────────────────────────
function handleFile(file) {
  if (!file || !file.type.startsWith('image/')) {
    flash('Eso no es una imagen', 'err');
    return;
  }
  // Capturar el índice de la palabra visible EN ESTE MOMENTO para mandarlo
  // al servidor como verificación. Así, si el usuario salta mientras se
  // sube la imagen, el servidor la rechaza en lugar de asignarla a la
  // palabra equivocada.
  if (uploading) { flash('Ya hay una subida en curso, espera…', 'warn'); return; }
  if (!state || state.done) return;
  const expectedIndex = state.index;

  const reader = new FileReader();
  reader.onload = async () => {
    const drop = document.getElementById('drop');
    if (drop) drop.innerHTML = `<img src="${reader.result}">`;
    flash('Subiendo y comprimiendo…');
    uploading = true;
    try {
      const r = await fetch('/api/upload', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ dataUrl: reader.result, expectedIndex })
      });
      const j = await r.json();
      if (j.error) {
        flash(j.error, 'err');
        // Si hubo conflicto de índice, refrescar para mostrar la palabra actual
        if (j.conflict) setTimeout(refresh, 800);
        return;
      }
      flash(`Guardado (${j.savedBytes} bytes)`, 'ok');
      setTimeout(() => { state = j; render(); }, 600);
    } catch (err) {
      flash('Error de red subiendo la imagen', 'err');
    } finally {
      uploading = false;
    }
  };
  reader.readAsDataURL(file);
}

refresh();
</script>
</body>
</html>
"""

# ---------------------------------------------------------------------------
# Servidor HTTP (solo librería estándar)
# ---------------------------------------------------------------------------
class Handler(BaseHTTPRequestHandler):
    def _send_json(self, obj, status=200):
        body = json.dumps(obj, ensure_ascii=False).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def _send_html(self, html):
        body = html.encode("utf-8")
        self.send_response(200)
        self.send_header("Content-Type", "text/html; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def do_GET(self):
        if self.path == "/":
            self._send_html(PAGE)
        elif self.path == "/api/state":
            with lock:
                self._send_json(current_state())
        else:
            self._send_json({"error": "not found"}, 404)

    def do_POST(self):
        global pointer
        length = int(self.headers.get("Content-Length", 0) or 0)
        raw = self.rfile.read(length) if length else b"{}"
        try:
            payload = json.loads(raw.decode("utf-8")) if raw else {}
        except json.JSONDecodeError:
            payload = {}

        if self.path == "/api/upload":
            with lock:
                if pointer >= len(data):
                    self._send_json(current_state())
                    return

                # ── Validar que el cliente está subiendo para la palabra
                #    correcta. Si el pointer avanzó desde que el cliente
                #    cargó la página (p.ej. por un skip tardío), rechazar.
                expected = payload.get("expectedIndex")
                if expected is not None and int(expected) != pointer:
                    word_expected = data[int(expected)].get("word") if int(expected) < len(data) else "?"
                    word_current  = data[pointer].get("word")
                    print(
                        f"[CONFLICT] Upload rechazado: cliente envió índice {expected} "
                        f"('{word_expected}') pero el pointer está en {pointer} ('{word_current}')."
                    )
                    self._send_json({
                        "error": (
                            f"La imagen fue rechazada: el servidor ya avanzó a otra palabra "
                            f"('{word_current}'). Vuelve a subir la imagen."
                        ),
                        "conflict": True,
                    }, 409)
                    return

                data_url = payload.get("dataUrl", "")
                if "," not in data_url:
                    self._send_json({"error": "Imagen inválida"}, 400)
                    return
                try:
                    raw_bytes = base64.b64decode(data_url.split(",", 1)[1])
                    compressed, dim, q = compress_image(raw_bytes)
                except Exception as e:
                    self._send_json({"error": str(e)}, 400)
                    return

                b64 = base64.b64encode(compressed).decode("ascii")
                entry = data[pointer]
                entry["image"] = f"data:image/jpeg;base64,{b64}"
                try:
                    save_data(data)
                except Exception as e:
                    # Revertir en memoria si no se pudo guardar
                    entry["image"] = None
                    self._send_json({"error": f"No se pudo guardar el archivo: {e}"}, 500)
                    return

                print(
                    f"[OK] '{entry.get('word')}' -> imagen guardada "
                    f"({len(compressed)} bytes, {dim}px, calidad {q})."
                )
                pointer = find_next_pending(pointer + 1)
                self._send_json(current_state({"savedBytes": len(compressed)}))
            return

        if self.path == "/api/skip":
            with lock:
                if pointer < len(data):
                    print(f"[SKIP-MANUAL] '{data[pointer].get('word')}' omitida por el usuario.")
                    pointer = find_next_pending(pointer + 1)
                self._send_json(current_state())
            return

        self._send_json({"error": "not found"}, 404)

    def log_message(self, fmt, *args):
        pass  # silenciamos el log HTTP por defecto; usamos nuestros propios prints

def main():
    server = ThreadingHTTPServer(("127.0.0.1", PORT), Handler)
    url = f"http://127.0.0.1:{PORT}/"
    print(f"Archivo JSON: {JSON_PATH.resolve()}")
    print(f"Servidor en {url}  (Ctrl+C para salir)")
    threading.Timer(0.6, lambda: webbrowser.open(url)).start()
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("\nCerrando servidor.")

if __name__ == "__main__":
    main()