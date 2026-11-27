// Finds a ticket by its code, but only if it belongs to this attendee
function findTicketForAttendee(db, code, attendeeId) {
  return db
    .prepare('SELECT * FROM tickets WHERE code = ? AND attendee_id = ?')
    .get(code, attendeeId);
}

module.exports = { findTicketForAttendee };