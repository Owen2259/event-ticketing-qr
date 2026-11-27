const request = require('supertest');
const { setup, addEvent, loginAs } = require('./helpers');
const { bookTicket } = require('../src/services/bookings');

// Alice books one ticket, and we return everything the tests need
function setupWithAliceTicket() {
  const context = setup();
  const { db, organiser, alice } = context;
  const { eventId, ticketTypeId } = addEvent(db, organiser.id, 10);
  const { code } = bookTicket(db, alice.id, eventId, ticketTypeId);
  return { ...context, code };
}

describe('ticket QR codes', () => {
  test('an attendee gets a QR image for their own ticket', async () => {
    const { app, code } = setupWithAliceTicket();
    const agent = await loginAs(app, 'alice@example.com');

    const res = await agent.get(`/tickets/${code}/qr.png`);

    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toContain('image/png');
    expect(res.body.length).toBeGreaterThan(0);
  });

  test("an attendee cannot get another attendee's QR code", async () => {
    const { app, code } = setupWithAliceTicket();
    const bobAgent = await loginAs(app, 'bob@example.com');

    await bobAgent.get(`/tickets/${code}/qr.png`).expect(404);
  });

  test('a visitor who is not logged in is sent to log in', async () => {
    const { app, code } = setupWithAliceTicket();

    await request(app).get(`/tickets/${code}/qr.png`).expect(302).expect('Location', '/login');
  });

  test('an unknown ticket code returns not found', async () => {
    const { app } = setupWithAliceTicket();
    const agent = await loginAs(app, 'alice@example.com');

    await agent.get('/tickets/NOPE-1234/qr.png').expect(404);
  });

  test('My tickets shows the QR code and a download link for an active ticket', async () => {
    const { app, code } = setupWithAliceTicket();
    const agent = await loginAs(app, 'alice@example.com');

    const res = await agent.get('/my-tickets');

    expect(res.text).toContain(`/tickets/${code}/qr.png`);
    expect(res.text).toContain('Download QR code');
  });

  test('a cancelled ticket does not show a QR code', async () => {
    const { db, app } = setupWithAliceTicket();
    db.prepare("UPDATE tickets SET status = 'cancelled'").run();
    const agent = await loginAs(app, 'alice@example.com');

    const res = await agent.get('/my-tickets');

    expect(res.text).not.toContain('qr.png');
  });
});