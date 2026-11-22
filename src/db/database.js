const Database = require('better-sqlite3');
const fs = require('fs');
const path = require('path');

function createDb(file = path.join(__dirname, '..', '..', 'data', 'app.db')) {
  if (file !== ':memory:') {
    fs.mkdirSync(path.dirname(file), { recursive: true });
  }
  const db = new Database(file);
  db.pragma('foreign_keys = ON');
  db.exec(fs.readFileSync(path.join(__dirname, 'schema.sql'), 'utf8'));
  return db;
}

module.exports = { createDb };