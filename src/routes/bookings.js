const express = require('express');
const { requireRole } = require('../middleware/auth');
const { listUpcomingEvents, getEvent, bookTicket, listTicketsForAttendee } = require('../services/bookings');
const { canCancel } = require('../services/cancellation');

const router = express.Router();

router.get('/events', (req, res) => {
  const events = listUpcomingEvents(req.app.locals.db);
  res.render('events', { events });
});

router.get('/events/:id', (req, res) => {
  const event = getEvent(req.app.locals.db, Number(req.params.id));
  if (!event) return res.status(404).render('error', { message: 'Event not found.' });
  res.render('event-detail', { event, error: null });
});

router.post('/events/:id/reserve', requireRole('attendee'), (req, res) => {
  const db = req.app.locals.db;
  const eventId = Number(req.params.id);
  const ticketTypeId = Number(req.body.ticket_type_id);

  const result = bookTicket(db, req.session.user.id, eventId, ticketTypeId);

  if (result.error) {
    const event = getEvent(db, eventId);
    return res.status(400).render('event-detail', { event, error: result.error });
  }
  res.redirect('/my-tickets');
});

router.get('/my-tickets', requireRole('attendee'), (req, res) => {
  const tickets = listTicketsForAttendee(req.app.locals.db, req.session.user.id).map((ticket) => ({
    ...ticket,
    canCancel: ticket.status === 'active' && canCancel(ticket.event_datetime),
  }));
  res.render('my-tickets', { tickets });
});

module.exports = router;