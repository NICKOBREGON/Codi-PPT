# Trauma Team Board — Servidor de sincronización

Servidor mínimo (Node.js + WebSocket) que sincroniza la pizarra del Trauma Team Board
entre hasta 3 dispositivos conectados a la misma sesión/caso. No usa base de datos:
todo vive en memoria mientras el servidor está corriendo y mientras haya al menos
un dispositivo conectado a esa sala.

## Cómo desplegarlo en Render (gratis)

1. Sube esta carpeta (`trauma-sync-server/`) a un repo de GitHub, o añádela como
   subcarpeta a tu repo actual `Codi-PPT`.
2. En Render → **New +** → **Web Service**.
3. Conecta el repo de GitHub que la contiene.
4. Configuración:
   - **Root Directory**: `trauma-sync-server` (si la metiste como subcarpeta de tu repo)
   - **Build Command**: `npm install`
   - **Start Command**: `npm start`
   - **Instance Type**: Free
5. Deploy. Render te dará una URL tipo `https://trauma-sync-xxxx.onrender.com`.

## Conectar el HTML del Trauma Team Board a este servidor

En `trauma-team-board.html`, busca esta línea (cerca del final del `<script>`):

```js
const SYNC_SERVER_URL = "wss://CAMBIA-ESTO.onrender.com";
```

Sustitúyela por tu URL real de Render, cambiando `https://` por `wss://`:

```js
const SYNC_SERVER_URL = "wss://trauma-sync-xxxx.onrender.com";
```

Guarda y vuelve a desplegar el HTML en GitHub Pages como siempre.

## Evitar que el servidor "se duerma" (importante para uso clínico)

El plan Free de Render duerme el servicio tras ~15 min sin tráfico, y tarda unos
segundos en despertar. Para casos PPT impredecibles esto puede ser un problema.

Solución gratis: usa **UptimeRobot** (uptimerobot.com, cuenta gratis) para hacer
un ping HTTP GET cada 5 minutos a:

```
https://tu-servicio.onrender.com/health
```

Esto mantiene el servidor despierto de forma continua sin coste.

## Uso en la app

1. En el primer dispositivo (la pantalla/TV o el primer móvil que abre el caso),
   pulsa el icono 🔗 en la cabecera → "Crear sesión compartida".
2. Se genera un código de 6 caracteres y un QR.
3. Los otros 1-2 dispositivos escanean el QR (o entran manualmente el código
   pulsando 🔗 → "Unirse") y quedan sincronizados en tiempo real.
4. Cualquier cambio en cualquiera de los dispositivos se refleja en los demás
   en menos de 1 segundo.
5. El CSV se sigue descargando de forma independiente en cada dispositivo,
   como ya funcionaba — no hay cambios ahí.

## Límites conocidos

- Máximo 3 dispositivos por sala (configurable en `server.js`, variable de
  comprobación `room.clients.size >= 3`).
- Si el servidor se reinicia (deploy nuevo, caída), las salas activas pierden
  su estado en memoria — los clientes reconectan solos pero sin datos previos.
  Por eso el CSV se descarga localmente al terminar cada caso, no depende del servidor.
- No hay autenticación: cualquiera con el código de 6 caracteres puede unirse.
  El código no es adivinable a fuerza bruta en la práctica (32^6 combinaciones),
  pero no está pensado como control de acceso fuerte — solo como conveniencia
  para conectar dispositivos del mismo equipo rápidamente.
