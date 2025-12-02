// serveur.js
// - Sert index.html, sketch.js, p5.js, etc. sur http://IP:8085
// - Lit le Nunchuk en I2C
// - Envoie les données du Nunchuk au navigateur via WebSocket (même port)

const http = require('http');
const path = require('path');
const fs = require('fs');
const i2c = require('i2c-bus');
const WebSocket = require('ws');

const HTTP_PORT = 8085;
const I2C_BUS = 1;
const NUNCHUK_ADDR = 0x52;

// ---------- SERVEUR HTTP ----------

function handleRequest(req, res) {
  let pathname = req.url;

  if (pathname === '/') {
    pathname = '/index.html';
  }

  const ext = path.extname(pathname);

  const typeExt = {
    '.html': 'text/html',
    '.js':   'text/javascript',
    '.css':  'text/css',
    '.jpg':  'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.png':  'image/png'
  };

  const contentType = typeExt[ext] || 'text/plain';

  const fullPath = path.join(__dirname, pathname);
  // Debug éventuel
  // console.log('HTTP GET', fullPath);

  fs.readFile(fullPath, (err, data) => {
    if (err) {
      res.writeHead(404);
      return res.end('Error loading ' + pathname);
    }
    res.writeHead(200, { 'Content-Type': contentType });
    res.end(data);
  });
}

const server = http.createServer(handleRequest);

server.listen(HTTP_PORT, '0.0.0.0', () => {
  console.log(`Server + WebSocket on http://0.0.0.0:${HTTP_PORT}`);
});

// ---------- SERVEUR WEBSOCKET + NUNCHUK ----------

const wss = new WebSocket.Server({ server });

let bus = null;

async function initNunchuk(bus) {
  await bus.writeByte(NUNCHUK_ADDR, 0xF0, 0x55);
  await bus.writeByte(NUNCHUK_ADDR, 0xFB, 0x00);
  await new Promise((res) => setTimeout(res, 10));
}

async function readNunchuk(bus) {
  const buf = Buffer.alloc(6);

  await bus.writeByte(NUNCHUK_ADDR, 0x00, 0x00);
  await new Promise((res) => setTimeout(res, 5));

  await bus.i2cRead(NUNCHUK_ADDR, 6, buf);

  const joyX = buf[0];
  const joyY = buf[1];
  const zPressed = !(buf[5] & 0x01);
  const cPressed = !((buf[5] >> 1) & 0x01);

  return { joyX, joyY, zPressed, cPressed };
}

(async () => {
  try {
    bus = await i2c.openPromisified(I2C_BUS);
    await initNunchuk(bus);
    console.log('Nunchuk initialisé');
  } catch (err) {
    console.error('Erreur init Nunchuk :', err.message);
  }
})();

wss.on('connection', () => {
  console.log('Client WebSocket connecté');
});

setInterval(async () => {
  if (!bus) return;
  try {
    const data = await readNunchuk(bus);
    const payload = JSON.stringify(data);

    wss.clients.forEach((client) => {
      if (client.readyState === WebSocket.OPEN) {
        client.send(payload);
      }
    });
  } catch (err) {
    console.error('Erreur lecture Nunchuk :', err.message);
  }
}, 50); // 20 Hz
