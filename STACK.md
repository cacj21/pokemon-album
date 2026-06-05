# Stack: Cloudflare Workers + D1 + Claude Vision + Cloudflare Pages

## Tecnologías
- **Backend**: Cloudflare Workers (TypeScript) + D1 (SQLite) + Anthropic Claude Vision
- **Frontend**: Lovable (TanStack Start + React + Tailwind CSS)
- **Deploy**: Wrangler CLI

---

## 1. Backend — Cloudflare Worker

### Estructura
```
proyecto/
├── wrangler.toml
├── package.json
├── tsconfig.json
└── src/
    ├── index.ts        # Router + CORS
    ├── types.ts        # Interfaces Env, Card
    ├── schema.sql      # CREATE TABLE
    └── routes/
        ├── cards.ts    # Lógica de negocio
        └── health.ts   # GET /health
```

### wrangler.toml mínimo
```toml
name = "nombre-proyecto"
main = "src/index.ts"
compatibility_date = "2024-09-23"
compatibility_flags = ["nodejs_compat"]

[[d1_databases]]
binding = "DB"
database_name = "nombre-db"
database_id = "PEGAR-ID-AQUI"

[vars]
ENVIRONMENT = "development"
```

### Pasos de setup
```bash
# 1. Instalar dependencias
npm install wrangler @cloudflare/workers-types @anthropic-ai/sdk typescript

# 2. Crear base de datos D1
wrangler d1 create nombre-db
# → Copiar el database_id al wrangler.toml

# 3. Aplicar schema
wrangler d1 execute nombre-db --remote --file=src/schema.sql

# 4. Configurar API key de Anthropic (en tu terminal, no en scripts)
wrangler secret put ANTHROPIC_API_KEY
# → Pegar el sk-ant-...

# 5. Deploy
wrangler deploy
```

### Patrón de imágenes sin R2
Guardar imágenes en D1 como base64 (para proyectos pequeños/demo):
- Recibir imagen como `multipart/form-data`
- Convertir a base64 con `toBase64(arrayBuffer)`
- Guardar como `data:image/jpeg;base64,...` en columna `TEXT`
- El frontend usa el valor directo como `<img src>`

### CORS en index.ts
```typescript
const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};
```

---

## 2. Frontend — Lovable + Cloudflare Pages

### Prompt base para Lovable
Describir la app en español indicando:
- URL del backend (workers.dev)
- Campos que devuelve la API
- Rutas disponibles
- Estilo deseado

### Problema iPhone (HEIC → JPEG)
Las fotos de iPhone son HEIC. Convertir antes de subir en `pokemon-api.ts`:

```typescript
async function convertToJpeg(file: File): Promise<File> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      const MAX = 1200;
      let { naturalWidth: w, naturalHeight: h } = img;
      if (w > MAX || h > MAX) {
        if (w > h) { h = Math.round((h * MAX) / w); w = MAX; }
        else { w = Math.round((w * MAX) / h); h = MAX; }
      }
      const canvas = document.createElement("canvas");
      canvas.width = w; canvas.height = h;
      const ctx = canvas.getContext("2d");
      if (!ctx) return reject(new Error("Canvas not supported"));
      ctx.drawImage(img, 0, 0, w, h);
      canvas.toBlob(
        (blob) => {
          URL.revokeObjectURL(url);
          if (!blob) return reject(new Error("Conversion failed"));
          resolve(new File([blob], "card.jpg", { type: "image/jpeg" }));
        },
        "image/jpeg", 0.85
      );
    };
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error("Could not load image")); };
    img.src = url;
  });
}
```

### vite.config.ts para build local
```typescript
import { defineConfig } from "@lovable.dev/vite-tanstack-config";

export default defineConfig({
  tanstackStart: { server: { entry: "server" } },
  nitro: { preset: "cloudflare-pages" },
});
```

### Deploy frontend (desde el repo clonado)
```bash
# 1. Clonar repo de Lovable
git clone https://github.com/usuario/repo-front.git
cd repo-front

# 2. Instalar dependencias
npm install --legacy-peer-deps

# 3. Build con preset Cloudflare Pages
npm run build
# → genera dist/ con _worker.js, _routes.json, _redirects

# 4. Crear proyecto Pages (solo la primera vez)
wrangler pages project create nombre-front --production-branch main

# 5. Deploy
wrangler pages deploy dist --project-name nombre-front --commit-dirty=true

# Para actualizaciones siguientes: solo pasos 3 y 5
```

### URL resultante
`https://nombre-front.pages.dev`

---

## Flujo completo de actualización

```bash
# Backend
cd proyecto-worker
# ... editar código ...
wrangler deploy

# Frontend
cd repo-front
npm run build
wrangler pages deploy dist --project-name nombre-front --commit-dirty=true
```

---

## Lecciones aprendidas
- R2 requiere plan de pago activado → usar base64 en D1 para demos
- `wrangler secret put` requiere terminal interactiva (no scripts)
- Lovable sin créditos no redeploya → clonar repo y deployar con wrangler
- `nitro: { preset: "cloudflare-pages" }` es clave para el build correcto del front
- Sin ese preset, Nitro usa servidor Node.js que no corre en Cloudflare Workers
