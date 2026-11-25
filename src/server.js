const { createApp } = require('./app');
const { createDb } = require('./db/database');

const db = createDb();
const app = createApp(db);

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`);
});