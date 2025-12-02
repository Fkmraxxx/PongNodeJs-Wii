// nunchuk-server.js
// Lit le Nunchuk Wii en I2C et envoie les données en WebSocket

const i2c = require('i2c-bus');
const WebSocket = require('ws');

const I2C_BUS = 1;
const NUNCHUK_ADDR = 0x52;

async function initNunchuk(bus) {
  // Séquence classique pour désactiver le chiffrement
  await bus.writeByte(NUNCHUK_ADDR, 0xF0, 0x55);
  await bus.writeByte(NUNCHUK_ADDR, 0xFB, 0x00);
  await new Promise((res) => setTimeout(res, 10));
}

async function readNunchuk(bus) {
  const buf = Buffer.alloc(6);

  // Demande une nouvelle mesure
  await bus.writeByte(NUNCHUK_ADDR, 0x00, 0x00);
  await new Promise((res) => setTimeout(res, 5));

  await bus.i2cRead(NUNCHUK_ADDR, 6, buf);

  const joyX = buf[0];
  const joyY = buf[1];

  const zPressed = !(buf[5] & 0x01);           // 0 = appuyé
  const cPressed = !((buf[5] >> 1) & 0x01);    // 0 = appuyé

  return { joyX, joyY, zPressed, cPressed };
}

(async () => {
  const bus = await i2c.openPromisified(I2C_BUS);
  await initNunchuk(bus);
  console.log("Nunchuk initialisé");

  const wss = new WebSocket.Server({ port: 8080 });
  console.log("Serveur WebSocket sur ws://0.0.0.0:8080");

  wss.on('connection', () => {
    console.log("Client WebSocket connecté");
  });

  setInterval(async () => {
    try {
      const data = await readNunchuk(bus);
      const payload = JSON.stringify(data);

      wss.clients.forEach((client) => {
        if (client.readyState === WebSocket.OPEN) {
          client.send(payload);
        }
      });
    } catch (err) {
      console.error("Erreur lecture Nunchuk :", err.message);
    }
  }, 50); // 20 fois par seconde
})();
