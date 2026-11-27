const request = require('supertest');
const { setup, addEvent, loginAs } = require('./helpers');
const { bookTicket } = require('../src/services/bookings');
const { checkInTicket } = require('../src/services/checkin');
const { canCancel, cancelTicket } = require('../src/services/cancellation');

const HOUR = 60 * 60 * 1000;
const ticketRow = (db, code) => db.prepare('SELECT * FROM tickets WHERE code = ?').get(code);

// Alice has booked one ticket for an event that starts in "daysAway" days
function setupWithTicket(daysAway = 10, capacity = 10) {
  const context = setup();
  const { db, organiser, alice } = context;
  const { eventId, ticketTypeId } = addEvent(db, organiser.id, capacity, daysAway);
  const { code } = bookTicket(db, alice.id, eventId, ticketTypeId);
  return { ...context, eventId, ticketTypeId, code };
}

describe('the 48-hour rule', () => {
  const now = new Date('2026-12-01T10:00:00Z');

  test('cancelling is allowed exactly 48 hours before the event', () => {
    const eventTime = new Date(now.getTime() + 48 * HOUR).toISOString();

    expect(canCancel(eventTime, now)).toBe(true);
  });

  test('cancelling is not allowed with less than 48 hours to go', () => {
    const eventTime = new Date(now.getTime() + 48 * HOUR - 1000).toISOString();

    expect(canCancel(eventTime, now)).toBe(false);
  });
});

describe('cancelling tickets', () => {
  test('an attendee can cancel their ticket', () => {
    const { db, alice, code } = setupWithTicket();

    const result = cancelTicket(db, alice.id, code);

    expect(result.error).toBeUndefined();
    expect(ticketRow(db, code).status).toBe('cancelled');
    expect(ticketRow(db, code).cancelled_at).not.toBeNull();
  });

  test('cancelling frees the place for someone else', () => {
    const { db, eventId, ticketTypeId, alice, bob, code } = setupWithTicket(10, 1);
    expect(bookTicket(db, bob.id, eventId, ticketTypeId).error).toContain('sold out');

    cancelTicket(db, alice.id, code);

    expect(bookTicket(db, bob.id, eventId, ticketTypeId).error).toBeUndefined();
  });

  test('a ticket cannot be cancelled inside the 48-hour window', () => {
    const { db, alice, code } = setupWithTicket(1);

    const result = cancelTicket(db, alice.id, code);

    expect(result.error).toContain('48 hours');
    expect(ticketRow(db, code).status).toBe('active');
  });

  test("an attendee cannot cancel someone else's ticket", () => {
    const { db, bob, code } = setupWithTicket();

    const result = cancelTicket(db, bob.id, code);

    expect(result.error).toContain('not found');
    expect(ticketRow(db, code).status).toBe('active');
  });

  test('a ticket that was already used cannot be cancelled', () => {
    const { db, organiser, alice, eventId, code } = setupWithTicket();
    checkInTicket(db, organiser.id, eventId, code);

    const result = cancelTicket(db, alice.id, code);

    expect(result.error).toContain('already been used');
    expect(ticketRow(db, code).status).toBe('used');
  });

  test('a ticket cannot be cancelled twice', () => {
    const { db, alice, code } = setupWithTicket();

    cancelTicket(db, alice.id, code);
    const second = cancelTicket(db, alice.id, code);

    expect(second.error).toContain('already cancelled');
  });
});

describe('cancelling through the website', () => {
  test('an attendee can cancel from the page', async () => {
    const { db, app, code } = setupWithTicket();
    const agent = await loginAs(app, 'alice@example.com');

    await agent.post(`/tickets/${code}/cancel`).expect(302).expect('Location', '/my-tickets');

    expect(ticketRow(db, code).status).toBe('cancelled');
  });

  test('a visitor who is not logged in cannot cancel', async () => {
    const { db, app, code } = setupWithTicket();

    await request(app).post(`/tickets/${code}/cancel`).expect(302).expect('Location', '/login');

    expect(ticketRow(db, code).status).toBe('active');
  });

  test('an organiser cannot cancel a ticket', async () => {
    const { db, app, code } = setupWithTicket();
    const agent = await loginAs(app, 'org@example.com');

    await agent.post(`/tickets/${code}/cancel`).expect(403);

    expect(ticketRow(db, code).status).toBe('active');
  });

  test('My tickets only offers cancellation when it is allowed', async () => {
    const { db, app, organiser, alice, code: farCode } = setupWithTicket(10);
    const near = addEvent(db, organiser.id, 10, 1);
    const nearCode = bookTicket(db, alice.id, near.eventId, near.ticketTypeId).code;
    const agent = await loginAs(app, 'alice@example.com');

    const res = await agent.get('/my-tickets');

    expect(res.text).toContain(`/tickets/${farCode}/cancel`);
    expect(res.text).not.toContain(`/tickets/${nearCode}/cancel`);
    expect(res.text).toContain('Cancellation is closed');
  });
});