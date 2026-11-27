const express = require('express');
const { requireRole } = require('../middleware/auth');
const { listEventsByOrganiser } = require('../services/events');
const { checkInTicket } = require('../services/checkin');

const router = express.Router();
const organiserOnly = requireRole('organiser');

router.get('/checkin', organiserOnly, (req, res) => {
  const events = listEventsByOrganiser(req.app.locals.db, req.session.user.id);
  res.render('checkin', { events, selectedEventId: '', result: null });
});

router.post('/checkin', organiserOnly, (req, res) => {
  const db = req.app.locals.db;
  const organiserId = req.session.user.id;

  const result = checkInTicket(db, organiserId, Number(req.body.event_id), req.body.code);

  // Keep the same event selected, ready for the next ticket
  const events = listEventsByOrganiser(db, organiserId);
  res.render('checkin', { events, selectedEventId: String(req.body.event_id), result });
});

module.exports = router;