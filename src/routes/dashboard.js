const express = require('express');
const { requireRole } = require('../middleware/auth');
const { getDashboard } = require('../services/dashboard');

const router = express.Router();

router.get('/dashboard', requireRole('organiser'), (req, res) => {
  const { events, totals } = getDashboard(req.app.locals.db, req.session.user.id);
  res.render('dashboard', { events, totals });
});

module.exports = router;