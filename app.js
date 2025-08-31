const express = require('express');
const { Pool } = require('pg');
const client = require('prom-client');

const app = express();
app.use(express.json());

const register = new client.Registry();
client.collectDefaultMetrics({ register });

const httpRequests = new client.Counter({
  name: "http_requests_total",
  help: "Nombre total de requêtes HTTP",
});
register.registerMetric(httpRequests);

const httpRequestDuration = new client.Histogram({
  name: "http_request_duration_seconds",
  help: "Durée des requêtes HTTP en secondes",
  labelNames: ["method", "route", "status_code"],
  buckets: [0.1, 0.3, 1.5, 5, 10],
});
register.registerMetric(httpRequestDuration);

app.use((req, res, next) => {
  const end = httpRequestDuration.startTimer();
  res.on("finish", () => {
    httpRequests.inc();
    end({ method: req.method, route: req.route?.path || req.path, status_code: res.statusCode });
  });
  next();
});

app.get("/metrics", async (req, res) => {
  res.set("Content-Type", register.contentType);
  res.end(await register.metrics());
});

const isProduction = process.env.NODE_ENV === "production";

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: isProduction ? { rejectUnauthorized: false } : false
});

pool.query(`
  CREATE TABLE IF NOT EXISTS tasks (
    id SERIAL PRIMARY KEY,
    title VARCHAR(255) NOT NULL,
    done BOOLEAN DEFAULT false
  )
`)
.then(() => console.log("Table 'tasks' prête"))
.catch(err => console.error("Erreur init DB", err));

app.get('/tasks', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM tasks ORDER BY id');
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.sendStatus(500);
  }
});

app.post('/tasks', async (req, res) => {
  try {
    const { title } = req.body;
    await pool.query('INSERT INTO tasks (title) VALUES ($1)', [title]);
    res.sendStatus(201);
  } catch (err) {
    console.error(err);
    res.sendStatus(500);
  }
});

app.put('/tasks/:id', async (req, res) => {
  try {
    const id = req.params.id;
    const { title, done } = req.body;
    const result = await pool.query(
      'UPDATE tasks SET title=$1, done=$2 WHERE id=$3 RETURNING *',
      [title, done, id]
    );
    if (result.rowCount === 0) return res.sendStatus(404);
    res.sendStatus(200);
  } catch (err) {
    console.error(err);
    res.sendStatus(500);
  }
});

app.delete('/tasks/:id', async (req, res) => {
  try {
    const id = req.params.id;
    const result = await pool.query('DELETE FROM tasks WHERE id=$1', [id]);
    if (result.rowCount === 0) return res.sendStatus(404);
    res.sendStatus(200);
  } catch (err) {
    console.error(err);
    res.sendStatus(500);
  }
});


const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`API démarrée sur le port ${PORT}`));
