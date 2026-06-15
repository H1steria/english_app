# EnglishUp – App de inglés para Android

## Archivos incluidos
| Archivo | Descripción |
|---|---|
| `index.html` | La app principal |
| `words.json` | Lista de palabras y traducciones (editable) |
| `manifest.json` | Configuración para instalar como app Android |

---

## ▶ Cómo usarla

### Opción A – En el celular (recomendada)
1. Sube los 3 archivos a cualquier hosting gratuito:
   - **GitHub Pages** (gratis): crea un repositorio público, sube los archivos, activa Pages en Settings.
   - **Netlify** (gratis): arrastra la carpeta a netlify.com/drop.
   - **Vercel** (gratis): `vercel deploy` desde la carpeta.
2. Abre la URL en Chrome para Android.
3. Toca el menú (⋮) → **"Añadir a pantalla de inicio"**.
4. ¡La app queda instalada como una app nativa!

### Opción B – Local (PC o Android con servidor)
1. Instala Python (viene en muchos sistemas):
   ```
   python -m http.server 8080
   ```
2. Abre `http://localhost:8080` en Chrome.

---

## ✏️ Cómo agregar palabras

Edita `words.json`. Cada palabra sigue este formato:

```json
{
  "word": "bounce",
  "translations": ["rebotar", "saltar"],
  "past": null
}
```

- `"word"` → la palabra en inglés (tal como se mostrará).
- `"translations"` → array con **todas** las traducciones válidas, en minúsculas.
- `"past"` → el pasado irregular (ej. `"swung"`), o `null` si no aplica.

Cuando `"past"` tiene valor, la app pedirá al usuario que escriba:
```
su pasado es <pasado>
```
El premio (🏆) sólo se otorga si se escriben **todas** las traducciones Y el pasado correcto.

---

## 🎮 Reglas del juego
- Las traducciones se escriben separadas por coma, en cualquier orden.
- Todo se compara en **minúsculas** (no importan mayúsculas/tildes de tecla).
- El premio 🏆 aparece sólo si aciertas **todo** de una vez.
- La racha 🔥 se reinicia si fallas o saltas.
