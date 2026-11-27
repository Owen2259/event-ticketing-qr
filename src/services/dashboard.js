const sum = (list, key) => list.reduce((total, item) => total + item[key], 0);

// For each of the organiser's events: capacity, tickets sold, checked in and remaining.
// "Sold" means active or used tickets. Cancelled tickets do not count.
function getDashboard(db, organiserId) {
  const rows = db
    .prepare(
      `SELECT events.id, events.name, events.event_datetime, events.capacity,
              COUNT(CASE WHEN tickets.status IN ('active', 'used') THEN 1 END) AS sold,
              COUNT(CASE WHEN tickets.status = 'used' THEN 1 END) AS checked_in
       FROM events
       LEFT JOIN ticket_types ON ticket_types.event_id = events.id
       LEFT JOIN tickets ON tickets.ticket_type_id = ticket_types.id
       WHERE events.organiser_id = ?
       GROUP BY events.id
       ORDER BY events.event_datetime`
    )
    .all(organiserId);

  const events = rows.map((row) => ({ ...row, remaining: row.capacity - row.sold }));

  const totals = {
    sold: sum(events, 'sold'),
    checkedIn: sum(events, 'checked_in'),
    remaining: sum(events, 'remaining'),
  };

  return { events, totals };
}

module.exports = { getDashboard };