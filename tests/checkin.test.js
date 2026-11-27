const request = require('supertest');
const { setup, addEvent, loginAs } = require('./helpers');
const { registerUser } = require('../src/services/auth');
const { bookTicket } = require('../src/services/bookings');
const { checkInTicket } = require('../src/services/checkin');

// Alice has booked one ticket for an event run by the organiser
function setupWithTicket() {
  const context = setup();
  const { db, organiser, alice } = context;
  const { eventId, ticketTypeId } = addEvent(db, organiser.id, 10);
  const { code } = bookTicket(db, alice.id, eventId, ticketTypeId);
  return { ...context, eventId, code };
}

const ticketRow = (db, code) => db.prepare('SELECT * FROM tickets WHERE code = ?').get(code);

describe('checking in tickets', () => {
  test('a valid ticket is checked in and marked as used', () => {
    const { db, organiser, eventId, code } = setupWithTicket();

    const result = checkInTicket(db, organiser.id, eventId, code);

    expect(result.ok).toBe(true);
    expect(result.attendeeName).toBe('Alice');
    expect(ticketRow(db, code).status).toBe('used');
    expect(ticketRow(db, code).checked_in_at).not.toBeNull();
  });

  test('a ticket cannot be checked in twice', () => {
    const { db, organiser, eventId, code } = setupWithTicket();

    checkInTicket(db, organiser.id, eventId, code);
    const second = checkInTicket(db, organiser.id, eventId, code);

    expect(second.ok).toBe(false);
    expect(second.message).toContain('already been used');
    expect(second.checkedInAt).toBeDefined();
  });

  test('a cancelled ticket is rejected', () => {
    const { db, organiser, eventId, code } = setupWithTicket();
    db.prepare("UPDATE tickets SET status = 'cancelled'").run();

    const result = checkInTicket(db, organiser.id, eventId, code);

    expect(result.ok).toBe(false);
    expect(result.message).toContain('cancelled');
  });

  test('a code that does not exist is rejected', () => {
    const { db, organiser, eventId } = setupWithTicket();

    const result = checkInTicket(db, organiser.id, eventId, 'XXXX-XXXX');

    expect(result.ok).toBe(false);
    expect(result.message).toContain('Invalid code');
  });

  test('a ticket for a different event is rejected and stays unused', () => {
    const { db, organiser, code } = setupWithTicket();
    const otherEvent = addEvent(db, organiser.id, 10);

    const result = checkInTicket(db, organiser.id, otherEvent.eventId, code);

    expect(result.ok).toBe(false);
    expect(result.message).toContain('different event');
    expect(ticketRow(db, code).status).toBe('active');
  });

  test('the code can be typed in lower case with spaces', () => {
    const { db, organiser, eventId, code } = setupWithTicket();

    const result = checkInTicket(db, organiser.id, eventId, `  ${code.toLowerCase()}  `);

    expect(result.ok).toBe(true);
  });

  test("an organiser cannot check in tickets for another organiser's event", () => {
    const { db, organiser, code } = setupWithTicket();
    const otherOrganiser = registerUser(db, {
      name: 'Other', email: 'other@example.com', password: 'Password123', role: 'organiser',
    }).user;
    const theirEvent = addEvent(db, otherOrganiser.id, 10);

    const result = checkInTicket(db, organiser.id, theirEvent.eventId, code);

    expect(result.ok).toBe(false);
    expect(result.message).toContain('one of your events');
  });
});

describe('check-in page access', () => {
  test('a visitor who is not logged in is sent to log in', async () => {
    const { app } = setup();

    await request(app).get('/checkin').expect(302).expect('Location', '/login');
  });

  test('an attendee cannot open the check-in page', async () => {
    const { app } = setup();
    const agent = await loginAs(app, 'alice@example.com');

    await agent.get('/checkin').expect(403);
  });

  test('an organiser can check in a ticket from the page', async () => {
    const { db, app, eventId, code } = setupWithTicket();
    const agent = await loginAs(app, 'org@example.com');

    const res = await agent.post('/checkin').type('form').send({ event_id: String(eventId), code });

    expect(res.status).toBe(200);
    expect(res.text).toContain('VALID');
    expect(ticketRow(db, code).status).toBe('used');
  });
});