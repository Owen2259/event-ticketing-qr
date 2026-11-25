const bcrypt = require('bcryptjs');

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const ROLES = ['organiser', 'attendee'];

const str = (v) => (typeof v === 'string' ? v : '');

function validateRegistration(input) {
  const name = str(input.name).trim();
  const errors = [];
  if (name.length < 2 || name.length > 100) errors.push('Name must be between 2 and 100 characters.');
  if (!EMAIL_RE.test(str(input.email).trim())) errors.push('Please enter a valid email address.');
  if (str(input.password).length < 8) errors.push('Password must be at least 8 characters.');
  if (!ROLES.includes(input.role)) errors.push('Please choose a role.');
  return errors;
}

function registerUser(db, input) {
  const errors = validateRegistration(input);
  if (errors.length) return { errors };

  const name = str(input.name).trim();
  const email = str(input.email).trim().toLowerCase();

  if (db.prepare('SELECT id FROM users WHERE email = ?').get(email)) {
    return { errors: ['An account with that email already exists.'] };
  }

  const hash = bcrypt.hashSync(str(input.password), 10);
  const info = db
    .prepare('INSERT INTO users (name, email, password_hash, role) VALUES (?, ?, ?, ?)')
    .run(name, email, hash, input.role);

  return { user: { id: Number(info.lastInsertRowid), name, email, role: input.role } };
}

function loginUser(db, input) {
  const email = str(input.email).trim().toLowerCase();
  const row = db.prepare('SELECT * FROM users WHERE email = ?').get(email);
  if (!row || !bcrypt.compareSync(str(input.password), row.password_hash)) {
    return { errors: ['Invalid email or password.'] };
  }
  return { user: { id: row.id, name: row.name, email: row.email, role: row.role } };
}

module.exports = { registerUser, loginUser, validateRegistration };