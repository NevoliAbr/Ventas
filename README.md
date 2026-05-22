# Ventas

Aplicación de ventas con **React (frontend)** + **Node/Express (backend)** y **SQLite** como base de datos.

## Estructura

```
ventas/
├── client/                 # Frontend — React + Vite
│   ├── public/
│   ├── src/
│   │   ├── components/      # Componentes reutilizables
│   │   ├── pages/          # Vistas (VentasPage)
│   │   ├── services/       # Llamadas a la API (api.js)
│   │   ├── App.jsx
│   │   └── main.jsx
│   ├── index.html
│   └── vite.config.js      # incluye proxy /api -> backend
│
├── server/                 # Backend — Node + Express
│   ├── src/
│   │   ├── routes/         # Endpoints (/api/ventas)
│   │   ├── controllers/    # Lógica de cada ruta
│   │   ├── db.js           # SQLite (node:sqlite) + siembra
│   │   ├── seed.json       # Datos de ejemplo
│   │   └── index.js        # Arranque del servidor
│   └── ventas.db           # Base de datos (se crea sola, ignorada en git)
│
└── package.json            # workspaces + scripts para correr ambos
```

## Requisitos

- **Node.js 22.5 o superior** (se usa el módulo integrado `node:sqlite`, sin dependencias nativas).

## Instalación

Desde la raíz del proyecto, una sola vez:

```bash
npm install
```

(npm workspaces instala las dependencias de `client/` y `server/` automáticamente.)

## Desarrollo

Arranca frontend y backend a la vez:

```bash
npm run dev
```

- Frontend (Vite): http://localhost:5173
- Backend (API):   http://localhost:3001

El frontend usa rutas relativas (`/api/...`); Vite las redirige al backend mediante un proxy, así que no hay problemas de CORS en desarrollo.

### Correr por separado

```bash
npm run dev:server   # solo la API
npm run dev:client   # solo el frontend
```

## API

| Método | Ruta            | Descripción              |
|--------|-----------------|--------------------------|
| GET    | `/api/health`   | Comprobar que responde   |
| GET    | `/api/ventas`   | Listar ventas            |
| POST   | `/api/ventas`   | Crear una venta          |

Ejemplo de cuerpo para `POST /api/ventas`:

```json
{ "producto": "Teclado", "cantidad": 2, "precio": 850.0 }
```

## Producción (build)

```bash
npm run build        # genera client/dist
npm start            # arranca solo la API
```

> Para servir el frontend ya compilado desde Express habría que añadir un
> `express.static(...)` apuntando a `client/dist`. No está incluido en este
> esqueleto.
