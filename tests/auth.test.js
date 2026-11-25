const request = require('supertest');
const { createDb } = require('../src/db/database');
const { createApp } = require('../src/app');
const { registerUser } = require('../src/services/auth');

function setup() {
  const db = createDb(':memory:');
  return { db, app: createApp(db) };
}

const valid = { name: 'Test User', email: 'test@example.com', password: 'Password123', role: 'attendee' };

describe('authentication', () => {
  test('registration rejects a duplicate email', async () => {
    const { app } = setup();
    await request(app).post('/register').type('form').send(valid).expect(302);
    const res = await request(app).post('/register').type('form').send(valid);
    expect(res.status).toBe(400);
    expect(res.text).toContain('already exists');
  });

  test('registration rejects a short password', async () => {
    const { app } = setup();
    const res = await request(app).post('/register').type('form').send({ ...valid, password: 'short' });
    expect(res.status).toBe(400);
    expect(res.text).toContain('at least 8 characters');
  });

  test('password is stored hashed, not in plain text', async () => {
    const { db, app } = setup();
    await request(app).post('/register').type('form').send(valid);
    const row = db.prepare('SELECT password_hash FROM users WHERE email = ?').get(valid.email);
    expect(row.password_hash).not.toBe(valid.password);
    expect(row.password_hash.startsWith('$2')).toBe(true);
  });

  test('login fails with a wrong password', async () => {
    const { db, app } = setup();
    registerUser(db, valid);
    const res = await request(app).post('/login').type('form').send({ email: valid.email, password: 'WrongPassword1' });
    expect(res.status).toBe(401);
    expect(res.text).toContain('Invalid email or password');
  });

  test('login succeeds with the correct password', async () => {
    const { db, app } = setup();
    registerUser(db, valid);
    await request(app)
      .post('/login')
      .type('form')
      .send({ email: valid.email, password: valid.password })
      .expect(302)
      .expect('Location', '/');
  });
});