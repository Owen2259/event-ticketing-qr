const { generateCode } = require('./codes');

function countTaken(db, eventId) {
  const row = db
    .prepare(
      `SELECT COUNT(*) AS taken
       FROM tickets
       JOIN ticket_types ON ticket_types.id = tickets.ticket_type_id
       WHERE ticket_types.event_id = ? AND tickets.status IN ('active', 'used')`
    )
    .get(eventId);
  return row.taken;
}

function listUpcomingEvents(db) {
  const now = new Date().toISOString();
  const events = db
    .prepare('SELECT * FROM events WHERE event_datetime > ? ORDER BY event_datetime')
    .all(now);

  return events.map((event) => ({
    ...event,
    remaining: event.capacity - countTaken(db, event.id),
  }));
}

function getEvent(db, eventId) {
  if (!Number.isInteger(eventId)) return null;

  const event = db.prepare('SELECT * FROM events WHERE id = ?').get(eventId);
  if (!event) return null;

  event.remaining = event.capacity - countTaken(db, eventId);
  event.ticketTypes = db
    .prepare('SELECT id, name, price FROM ticket_types WHERE event_id = ? ORDER BY id')
    .all(eventId);
  return event;
}

function bookTicket(db, attendeeId, eventId, ticketTypeId) {
  if (!Number.isInteger(eventId) || !Number.isInteger(ticketTypeId)) {
    return { error: 'Please choose a ticket type.' };
  }

  const book = db.transaction(() => {
    const event = db.prepare('SELECT * FROM events WHERE id = ?').get(eventId);
    const ticketType = db
      .prepare('SELECT * FROM ticket_types WHERE id = ? AND event_id = ?')
      .get(ticketTypeId, eventId);

    if (!event || !ticketType) return { error: 'That ticket is not available.' };
    if (new Date(event.event_datetime) <= new Date()) return { error: 'This event has already started.' };
    if (countTaken(db, eventId) >= event.capacity) return { error: 'Sorry, this event is sold out.' };

    const code = generateCode();
    db.prepare('INSERT INTO tickets (ticket_type_id, attendee_id, code) VALUES (?, ?, ?)')
      .run(ticketTypeId, attendeeId, code);
    return { code };
  });

  return book.immediate();
}

function listTicketsForAttendee(db, attendeeId) {
  return db
    .prepare(
      `SELECT tickets.code, tickets.status,
              ticket_types.name AS ticket_type,
              events.name AS event_name, events.venue, events.event_datetime
       FROM tickets
       JOIN ticket_types ON ticket_types.id = tickets.ticket_type_id
       JOIN events ON events.id = ticket_types.event_id
       WHERE tickets.attendee_id = ?
       ORDER BY events.event_datetime`
    )
    .all(attendeeId);
}

module.exports = { countTaken, listUpcomingEvents, getEvent, bookTicket, listTicketsForAttendee };