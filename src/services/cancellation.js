const HOURS_BEFORE_EVENT = 48;
const MS_PER_HOUR = 60 * 60 * 1000;

// True if the event starts at least 48 hours from "now"
function canCancel(eventDatetime, now = new Date()) {
  const msUntilEvent = new Date(eventDatetime) - now;
  return msUntilEvent >= HOURS_BEFORE_EVENT * MS_PER_HOUR;
}

function cancelTicket(db, attendeeId, code) {
  const cancel = db.transaction(() => {
    const ticket = db
      .prepare(
        `SELECT tickets.id, tickets.status, events.event_datetime
         FROM tickets
         JOIN ticket_types ON ticket_types.id = tickets.ticket_type_id
         JOIN events ON events.id = ticket_types.event_id
         WHERE tickets.code = ? AND tickets.attendee_id = ?`
      )
      .get(code, attendeeId);

    if (!ticket) return { error: 'Ticket not found.' };
    if (ticket.status === 'cancelled') return { error: 'This ticket is already cancelled.' };
    if (ticket.status === 'used') return { error: 'This ticket has already been used.' };
    if (!canCancel(ticket.event_datetime)) {
      return { error: 'Tickets can only be cancelled up to 48 hours before the event.' };
    }

    db.prepare("UPDATE tickets SET status = 'cancelled', cancelled_at = ? WHERE id = ?")
      .run(new Date().toISOString(), ticket.id);
    return { ok: true };
  });

  return cancel.immediate();
}

module.exports = { canCancel, cancelTicket };