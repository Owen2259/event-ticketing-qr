const request = require('supertest');
const { setup, addEvent, loginAs } = require('./helpers');
const { registerUser } = require('../src/services/auth');
const { bookTicket } = require('../src/services/bookings');
const { getDashboard } = require('../src/services/dashboard');

const setStatus = (db, code, status) =>
  db.prepare('UPDATE tickets SET status = ? WHERE code = ?').run(status, code);

describe('organiser dashboard numbers', () => {
  test('counts sold, checked in and remaining, ignoring cancelled tickets', () => {
    const { db, organiser, alice } = setup();
    const { eventId, ticketTypeId } = addEvent(db, organiser.id, 10);
    const codes = [1, 2, 3].map(() => bookTicket(db, alice.id, eventId, ticketTypeId).code);
    setStatus(db, codes[0], 'cancelled');
    setStatus(db, codes[1], 'used');

    const { events } = getDashboard(db, organiser.id);

    expect(events[0].sold).toBe(2);
    expect(events[0].checked_in).toBe(1);
    expect(events[0].remaining).toBe(8);
  });

  test('an event with no tickets shows zero sold', () => {
    const { db, organiser } = setup();
    addEvent(db, organiser.id, 25);

    const { events } = getDashboard(db, organiser.id);

    expect(events.length).toBe(1);
    expect(events[0].sold).toBe(0);
    expect(events[0].remaining).toBe(25);
  });

  test("another organiser's events are not included", () => {
    const { db, organiser } = setup();
    const other = registerUser(db, { name: 'Other', email: 'other@example.com', password: 'Password123', role: 'organiser' }).user;
    addEvent(db, organiser.id, 10);
    addEvent(db, other.id, 10);

    const { events } = getDashboard(db, organiser.id);

    expect(events.length).toBe(1);
  });

  test('the totals add up across events', () => {
    const { db, organiser, alice } = setup();
    const first = addEvent(db, organiser.id, 10);
    const second = addEvent(db, organiser.id, 5);
    bookTicket(db, alice.id, first.eventId, first.ticketTypeId);
    bookTicket(db, alice.id, first.eventId, first.ticketTypeId);
    const usedCode = bookTicket(db, alice.id, second.eventId, second.ticketTypeId).code;
    setStatus(db, usedCode, 'used');

    const { totals } = getDashboard(db, organiser.id);

    expect(totals).toEqual({ sold: 3, checkedIn: 1, remaining: 12 });
  });
});

describe('dashboard page access', () => {
  test('an organiser can see their events on the dashboard', async () => {
    const { db, app, organiser } = setup();
    addEvent(db, organiser.id, 10);
    const agent = await loginAs(app, 'org@example.com');

    const res = await agent.get('/dashboard');

    expect(res.status).toBe(200);
    expect(res.text).toContain('Test Event');
  });

  test('an attendee cannot open the dashboard', async () => {
    const { app } = setup();
    const agent = await loginAs(app, 'alice@example.com');

    await agent.get('/dashboard').expect(403);
  });

  test('a visitor who is not logged in is sent to log in', async () => {
    const { app } = setup();

    await request(app).get('/dashboard').expect(302).expect('Location', '/login');
  });
});