const str = (v) => (typeof v === 'string' ? v : '');
const list = (v) => (Array.isArray(v) ? v : v === undefined ? [] : [v]);

function emptyForm() {
  return {
    name: '', venue: '', date: '', time: '', capacity: '',
    ticketTypes: [{ name: '', price: '' }, { name: '', price: '' }],
  };
}

// Rebuilds the form from a submission so the user does not have to retype it
function formFromInput(input) {
  const names = list(input.ticket_name).map(str);
  const prices = list(input.ticket_price).map(str);
  const rows = Math.max(names.length, prices.length, 1);
  const ticketTypes = [];
  for (let i = 0; i < rows; i++) ticketTypes.push({ name: names[i] || '', price: prices[i] || '' });
  return {
    name: str(input.name), venue: str(input.venue), date: str(input.date),
    time: str(input.time), capacity: str(input.capacity), ticketTypes,
  };
}

function parseEvent(input) {
  const errors = [];
  const name = str(input.name).trim();
  const venue = str(input.venue).trim();
  const date = str(input.date).trim();
  const time = str(input.time).trim();
  const capacityText = str(input.capacity).trim();

  if (name.length < 2 || name.length > 100) errors.push('Event name must be between 2 and 100 characters.');
  if (venue.length < 2 || venue.length > 100) errors.push('Venue must be between 2 and 100 characters.');

  let eventDate = null;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !/^\d{2}:\d{2}$/.test(time)) {
    errors.push('Please enter a valid date and time.');
  } else {
    eventDate = new Date(`${date}T${time}`);
    if (Number.isNaN(eventDate.getTime())) {
      errors.push('Please enter a valid date and time.');
      eventDate = null;
    } else if (eventDate <= new Date()) {
      errors.push('The event must be in the future.');
    }
  }

  const capacity = Number(capacityText);
  if (!/^\d+$/.test(capacityText) || capacity < 1 || capacity > 100000) {
    errors.push('Capacity must be a whole number between 1 and 100000.');
  }

  const names = list(input.ticket_name).map(str);
  const prices = list(input.ticket_price).map(str);
  const rows = Math.max(names.length, prices.length);
  const ticketTypes = [];
  const seen = new Set();
  let filledRows = 0;

  for (let i = 0; i < rows; i++) {
    const tName = (names[i] || '').trim();
    const tPrice = (prices[i] || '').trim();
    if (!tName && !tPrice) continue; // blank rows are ignored
    filledRows++;
    const label = `Ticket type ${i + 1}`;
    if (!tName || tName.length > 50) {
      errors.push(`${label}: a name is required (maximum 50 characters).`);
      continue;
    }
    if (!/^\d+(\.\d{1,2})?$/.test(tPrice) || Number(tPrice) > 100000) {
      errors.push(`${label}: price must be 0 or more, with at most 2 decimal places.`);
      continue;
    }
    if (seen.has(tName.toLowerCase())) {
      errors.push(`${label}: the name "${tName}" is used more than once.`);
      continue;
    }
    seen.add(tName.toLowerCase());
    ticketTypes.push({ name: tName, price: Number(tPrice) });
  }
  if (filledRows === 0) errors.push('Add at least one ticket type.');
  if (filledRows > 10) errors.push('An event can have at most 10 ticket types.');

  return {
    errors,
    data: { name, venue, eventDatetime: eventDate ? eventDate.toISOString() : null, capacity, ticketTypes },
  };
}

function createEvent(db, organiserId, input) {
  const { errors, data } = parseEvent(input);
  if (errors.length) return { errors };

  const insertEvent = db.prepare(
    'INSERT INTO events (organiser_id, name, venue, event_datetime, capacity) VALUES (?, ?, ?, ?, ?)'
  );
  const insertType = db.prepare('INSERT INTO ticket_types (event_id, name, price) VALUES (?, ?, ?)');

  // One transaction: either the event and all its ticket types are saved, or nothing is
  const save = db.transaction(() => {
    const eventId = Number(
      insertEvent.run(organiserId, data.name, data.venue, data.eventDatetime, data.capacity).lastInsertRowid
    );
    for (const t of data.ticketTypes) insertType.run(eventId, t.name, t.price);
    return eventId;
  });

  return { eventId: save() };
}

function listEventsByOrganiser(db, organiserId) {
  const events = db
    .prepare('SELECT * FROM events WHERE organiser_id = ? ORDER BY event_datetime')
    .all(organiserId);
  const typesStmt = db.prepare('SELECT name, price FROM ticket_types WHERE event_id = ? ORDER BY id');
  return events.map((e) => ({ ...e, ticketTypes: typesStmt.all(e.id) }));
}

module.exports = { emptyForm, formFromInput, parseEvent, createEvent, listEventsByOrganiser };