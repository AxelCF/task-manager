const express = require('express');
const { Pool } = require('pg');

const app = express();
app.use(express.json());

const pool = new Pool({
  connectionString: process.env.DATABASE_URL
});

pool.query(`
  CREATE TABLE IF NOT EXISTS tasks (
    id SERIAL PRIMARY KEY,
    title VARCHAR(255) NOT NULL,
    done BOOLEAN DEFAULT false
  )
`).then(() => console.log("Table 'tasks' prête"))
  .catch(err => console.error("Erreur init DB", err));

app.get('/tasks', async (req, res) => {
  const result = await pool.query('SELECT * FROM tasks ORDER BY id');
  res.json(result.rows);
});

app.post('/tasks', async (req, res) => {
  const { title } = req.body;
  await pool.query('INSERT INTO tasks (title) VALUES ($1)', [title]);
  res.sendStatus(201);
});

app.put('/tasks/:id', async (req, res) => {
  const id = req.params.id;
  const { title, done } = req.body;
  const result = await pool.query(
    'UPDATE tasks SET title=$1, done=$2 WHERE id=$3 RETURNING *',
    [title, done, id]
  );
  if (result.rowCount === 0) return res.sendStatus(404);
  res.sendStatus(200);
});

app.delete('/tasks/:id', async (req, res) => {
  const id = req.params.id;
  const result = await pool.query('DELETE FROM tasks WHERE id=$1', [id]);
  if (result.rowCount === 0) return res.sendStatus(404);
  res.sendStatus(200);
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`API démarrée sur le port ${PORT}`));

