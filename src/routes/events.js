const express = require('express');
const { requireRole } = require('../middleware/auth');
const { emptyForm, formFromInput, createEvent, listEventsByOrganiser } = require('../services/events');

const router = express.Router();
const organiserOnly = requireRole('organiser');

router.get('/events/new', organiserOnly, (req, res) => {
  res.render('event-new', { errors: [], form: emptyForm() });
});

router.post('/events', organiserOnly, (req, res) => {
  const body = req.body || {};
  const result = createEvent(req.app.locals.db, req.session.user.id, body);
  if (result.errors) {
    return res.status(400).render('event-new', { errors: result.errors, form: formFromInput(body) });
  }
  res.redirect('/my-events');
});

router.get('/my-events', organiserOnly, (req, res) => {
  const events = listEventsByOrganiser(req.app.locals.db, req.session.user.id);
  res.render('my-events', { events });
});

module.exports = router;