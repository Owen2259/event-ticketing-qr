const request = require('supertest');
const { createDb } = require('../src/db/database');
const { createApp } = require('../src/app');
const { registerUser } = require('../src/services/auth');

// Creates a fresh in-memory database and app with one organiser and two attendees
function setup() {
  const db = createDb(':memory:');
  const app = createApp(db);
  const organiser = registerUser(db, { name: 'Olivia', email: 'org@example.com', password: 'Password123', role: 'organiser' }).user;
  const alice = registerUser(db, { name: 'Alice', email: 'alice@example.com', password: 'Password123', role: 'attendee' }).user;
  const bob = registerUser(db, { name: 'Bob', email: 'bob@example.com', password: 'Password123', role: 'attendee' }).user;
  return { db, app, organiser, alice, bob };
}

// Adds an event with one ticket type. It starts "daysAway" days from now.
function addEvent(db, organiserId, capacity, daysAway = 10) {
  const date = new Date(Date.now() + daysAway * 24 * 60 * 60 * 1000).toISOString();
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

// Returns a browser-like agent that is already logged in
async function loginAs(app, email) {
  const agent = request.agent(app);
  await agent.post('/login').type('form').send({ email, password: 'Password123' }).expect(302);
  return agent;
}

module.exports = { setup, addEvent, loginAs };