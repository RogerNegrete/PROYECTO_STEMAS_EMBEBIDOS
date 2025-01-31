const express = require('express');
const admin = require('firebase-admin');
const path = require('path');
const moment = require('moment');

admin.initializeApp({
  credential: admin.credential.cert(require('./serviceAccountKey.json')),
  databaseURL: "https://proyecto-65-7a3d1-default-rtdb.firebaseio.com"
});

const db = admin.database();
const app = express();
const PORT = 3000;

app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));
app.use(express.static(path.join(__dirname, 'public')));

// Almacenar instancias de gráficos
let temperaturaChart, humedadChart, distanciaChart;

// Ruta principal
app.get('/', async (req, res) => {
  try {
    const snapshots = await Promise.all([
      db.ref('/incubacion/dia').once('value'),
      db.ref('/sensor/temperatura').once('value'),
      db.ref('/sensor/humedad').once('value'),
      db.ref('/sensor/distancia').once('value'),
      db.ref('/control/foco').once('value'),
      db.ref('/control/ventilador').once('value')
    ]);

    const [dia, temp, hum, dist, foco, ventilador] = snapshots.map(s => s.val());
    
    res.render('index', {
      diaIncubacion: dia,
      temperatura: temp,
      humedad: hum,
      distancia: dist,
      foco: foco,
      ventilador: ventilador
    });

  } catch (error) {
    console.error("Error:", error);
    res.status(500).send("Error al obtener datos.");
  }
});

// SSE para actualización en tiempo real
app.get('/api/realtime', (req, res) => {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');

  const refs = {
    temperatura: db.ref('/sensor/temperatura'),
    humedad: db.ref('/sensor/humedad'),
    distancia: db.ref('/sensor/distancia'),
    foco: db.ref('/control/foco'),
    ventilador: db.ref('/control/ventilador'),
    dia: db.ref('/incubacion/dia')
  };

  Object.entries(refs).forEach(([key, ref]) => {
    ref.on('value', (snapshot) => {
      const data = { [key]: snapshot.val() };
      res.write(`data: ${JSON.stringify(data)}\n\n`);
    });
  });
});

// Datos históricos
app.get('/api/historical', async (req, res) => {
  try {
    const snapshot = await db.ref('/historical').once('value');
    const data = snapshot.val();
    const formatted = Object.keys(data).map(key => ({
      time: moment(parseInt(key)).format('HH:mm:ss'),
      ...data[key]
    }));
    
    res.json({
      timestamps: formatted.map(d => d.time),
      temperaturas: formatted.map(d => d.temperatura),
      humedades: formatted.map(d => d.humedad),
      distancias: formatted.map(d => d.distancia)
    });
  } catch (error) {
    res.status(500).send(error.message);
  }
});

app.listen(PORT, () => console.log(`Servidor en http://localhost:${PORT}`));