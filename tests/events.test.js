const request = require('supertest');
const { createDb } = require('../src/db/database');
const { createApp } = require('../src/app');
const { registerUser } = require('../src/services/auth');

function setup() {
  const db = createDb(':memory:');
  const app = createApp(db);
  registerUser(db, { name: 'Olivia Organiser', email: 'org@example.com', password: 'Password123', role: 'organiser' });
  registerUser(db, { name: 'Alice Attendee', email: 'alice@example.com', password: 'Password123', role: 'attendee' });
  return { db, app };
}

async function loginAs(app, email) {
  const agent = request.agent(app);
  await agent.post('/login').type('form').send({ email, password: 'Password123' }).expect(302);
  return agent;
}

// Builds a form body that can repeat a field, like the real form does for ticket types
function formBody(obj) {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(obj)) [].concat(value).forEach((v) => params.append(key, v));
  return params.toString();
}

function dateInDays(days) {
  return new Date(Date.now() + days * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
}

const validEvent = () => ({
  name: 'Campus Music Night',
  venue: 'Main Hall',
  date: dateInDays(10),
  time: '19:00',
  capacity: '100',
  ticket_name: ['General', 'VIP'],
  ticket_price: ['50', '120'],
});

const eventCount = (db) => db.prepare('SELECT COUNT(*) AS n FROM events').get().n;

describe('creating events', () => {
  test('a visitor who is not logged in is redirected to log in', async () => {
    const { app } = setup();
    await request(app).get('/events/new').expect(302).expect('Location', '/login');
  });

  test('an attendee cannot open the create event page', async () => {
    const { app } = setup();
    const agent = await loginAs(app, 'alice@example.com');
    await agent.get('/events/new').expect(403);
  });

  test('an attendee cannot create an event', async () => {
    const { app, db } = setup();
    const agent = await loginAs(app, 'alice@example.com');
    await agent.post('/events').type('form').send(formBody(validEvent())).expect(403);
    expect(eventCount(db)).toBe(0);
  });

  test('an organiser can create an event with ticket types', async () => {
    const { app, db } = setup();
    const agent = await loginAs(app, 'org@example.com');
    await agent.post('/events').type('form').send(formBody(validEvent())).expect(302).expect('Location', '/my-events');
    expect(eventCount(db)).toBe(1);
    expect(db.prepare('SELECT capacity FROM events').get().capacity).toBe(100);
    expect(db.prepare('SELECT name, price FROM ticket_types ORDER BY id').all()).toEqual([
      { name: 'General', price: 50 },
      { name: 'VIP', price: 120 },
    ]);
  });

  test('a capacity of zero is rejected', async () => {
    const { app, db } = setup();
    const agent = await loginAs(app, 'org@example.com');
    const res = await agent.post('/events').type('form').send(formBody({ ...validEvent(), capacity: '0' }));
    expect(res.status).toBe(400);
    expect(res.text).toContain('Capacity must be');
    expect(eventCount(db)).toBe(0);
  });

  test('an event in the past is rejected', async () => {
    const { app, db } = setup();
    const agent = await loginAs(app, 'org@example.com');
    const res = await agent.post('/events').type('form').send(formBody({ ...validEvent(), date: dateInDays(-5) }));
    expect(res.status).toBe(400);
    expect(res.text).toContain('must be in the future');
    expect(eventCount(db)).toBe(0);
  });

  test('an event needs a ticket type and prices cannot be negative', async () => {
    const { app, db } = setup();
    const agent = await loginAs(app, 'org@example.com');

    const none = await agent
      .post('/events')
      .type('form')
      .send(formBody({ ...validEvent(), ticket_name: ['', ''], ticket_price: ['', ''] }));
    expect(none.status).toBe(400);
    expect(none.text).toContain('Add at least one ticket type');

    const negative = await agent
      .post('/events')
      .type('form')
      .send(formBody({ ...validEvent(), ticket_name: ['General'], ticket_price: ['-5'] }));
    expect(negative.status).toBe(400);
    expect(negative.text).toContain('price must be 0 or more');
    expect(eventCount(db)).toBe(0);
  });
});