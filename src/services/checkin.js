const reject = (message) => ({ ok: false, message });

// Codes are upper case, but people may type them in lower case or add spaces
function cleanCode(code) {
  return String(code || '').trim().toUpperCase();
}

function findTicket(db, code) {
  return db
    .prepare(
      `SELECT tickets.id, tickets.status, tickets.checked_in_at,
              ticket_types.name AS ticket_type, ticket_types.event_id,
              users.name AS attendee_name
       FROM tickets
       JOIN ticket_types ON ticket_types.id = tickets.ticket_type_id
       JOIN users ON users.id = tickets.attendee_id
       WHERE tickets.code = ?`
    )
    .get(code);
}

// Checks a ticket in at the door. Returns { ok, message, ... }.
function checkInTicket(db, organiserId, eventId, code) {
  if (!Number.isInteger(eventId)) return reject('Please choose one of your events.');

  const checkIn = db.transaction(() => {
    const event = db
      .prepare('SELECT id FROM events WHERE id = ? AND organiser_id = ?')
      .get(eventId, organiserId);
    if (!event) return reject('Please choose one of your events.');

    const ticket = findTicket(db, cleanCode(code));
    if (!ticket) return reject('Invalid code. No ticket was found with that code.');
    if (ticket.event_id !== eventId) return reject('This ticket is for a different event.');
    if (ticket.status === 'cancelled') return reject('This ticket has been cancelled.');
    if (ticket.status === 'used') {
      return { ok: false, message: 'This ticket has already been used.', checkedInAt: ticket.checked_in_at };
    }

    db.prepare("UPDATE tickets SET status = 'used', checked_in_at = ? WHERE id = ?")
      .run(new Date().toISOString(), ticket.id);

    return {
      ok: true,
      message: 'Ticket is valid. Checked in.',
      attendeeName: ticket.attendee_name,
      ticketType: ticket.ticket_type,
    };
  });

  // "immediate" locks the database first, so the same ticket
  // cannot be checked in twice by two people at the same moment.
  return checkIn.immediate();
}

module.exports = { checkInTicket };