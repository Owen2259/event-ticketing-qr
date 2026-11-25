const request = require('supertest');
const { createDb } = require('../src/db/database');
const { createApp } = require('../src/app');
const { registerUser } = require('../src/services/auth');
const { bookTicket, countTaken } = require('../src/services/bookings');

function setup() {
  const db = createDb(':memory:');
  const app = createApp(db);
  const organiser = registerUser(db, { name: 'Olivia', email: 'org@example.com', password: 'Password123', role: 'organiser' }).user;
  const alice = registerUser(db, { name: 'Alice', email: 'alice@example.com', password: 'Password123', role: 'attendee' }).user;
  const bob = registerUser(db, { name: 'Bob', email: 'bob@example.com', password: 'Password123', role: 'attendee' }).user;
  return { db, app, organiser, alice, bob };
}


function addEvent(db, organiserId, capacity) {
  const date = new Date(Date.now() + 10 * 24 * 60 * 60 * 1000).toISOString();
  const eventId = Number(
    db.prepare('INSERT INTO events (organiser_id, name, venue, event_datetime, capacity) VALUES (?, ?, ?, ?, ?)')
      .run(organiserId, 'Test Event', 'Main Hall', date, capacity).lastInsertRowid
  );
  const ticketTypeId = Number(
    db.prepare('INSERT INTO ticket_types (event_id, name, price) VALUES (?, ?, ?)')
      .run(eventId, 'General', 50).lastInsertRowid
  );
  return { eventId, ticketTypeId };
}

async function loginAs(app, email) {
  const agent = request.agent(app);
  await agent.post('/login').type('form').send({ email, password: 'Password123' }).expect(302);
  return agent;
}

describe('booking tickets', () => {
  test('an attendee can reserve a ticket', () => {
    const { db, organiser, alice } = setup();
    const { eventId, ticketTypeId } = addEvent(db, organiser.id, 10);

    const result = bookTicket(db, alice.id, eventId, ticketTypeId);

    expect(result.error).toBeUndefined();
    expect(result.code).toBeDefined();
    expect(countTaken(db, eventId)).toBe(1);
  });

  test('booking fails once the event is full', () => {
    const { db, organiser, alice, bob } = setup();
    const { eventId, ticketTypeId } = addEvent(db, organiser.id, 1);

    bookTicket(db, alice.id, eventId, ticketTypeId);
    const result = bookTicket(db, bob.id, eventId, ticketTypeId);

    expect(result.error).toContain('sold out');
    expect(countTaken(db, eventId)).toBe(1);
  });

  test('a cancelled ticket does not use up a place', () => {
    const { db, organiser, alice, bob } = setup();
    const { eventId, ticketTypeId } = addEvent(db, organiser.id, 1);

    bookTicket(db, alice.id, eventId, ticketTypeId);
    db.prepare("UPDATE tickets SET status = 'cancelled'").run();

    expect(countTaken(db, eventId)).toBe(0);
    expect(bookTicket(db, bob.id, eventId, ticketTypeId).error).toBeUndefined();
  });

  test('every ticket gets a unique code', () => {
    const { db, organiser, alice } = setup();
    const { eventId, ticketTypeId } = addEvent(db, organiser.id, 10);

    const codes = [1, 2, 3].map(() => bookTicket(db, alice.id, eventId, ticketTypeId).code);

    expect(new Set(codes).size).toBe(3);
  });

  test('a ticket type from a different event cannot be booked', () => {
    const { db, organiser, alice } = setup();
    const first = addEvent(db, organiser.id, 10);
    const second = addEvent(db, organiser.id, 10);

    const result = bookTicket(db, alice.id, first.eventId, second.ticketTypeId);

    expect(result.error).toContain('not available');
    expect(countTaken(db, first.eventId)).toBe(0);
  });

  test('a visitor who is not logged in cannot reserve', async () => {
    const { db, app, organiser } = setup();
    const { eventId, ticketTypeId } = addEvent(db, organiser.id, 10);

    await request(app)
      .post(`/events/${eventId}/reserve`)
      .type('form')
      .send({ ticket_type_id: ticketTypeId })
      .expect(302)
      .expect('Location', '/login');
  });

  test('an organiser cannot reserve a ticket', async () => {
    const { db, app, organiser } = setup();
    const { eventId, ticketTypeId } = addEvent(db, organiser.id, 10);
    const agent = await loginAs(app, 'org@example.com');

    await agent.post(`/events/${eventId}/reserve`).type('form').send({ ticket_type_id: ticketTypeId }).expect(403);

    expect(countTaken(db, eventId)).toBe(0);
  });

  test('a full event shows as sold out', async () => {
    const { db, app, organiser, alice } = setup();
    const { eventId, ticketTypeId } = addEvent(db, organiser.id, 1);
    bookTicket(db, alice.id, eventId, ticketTypeId);

    const res = await request(app).get(`/events/${eventId}`);

    expect(res.text).toContain('Sold out');
    expect(res.text).not.toContain('>Reserve<');
  });
});