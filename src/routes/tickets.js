const express = require('express');
const { requireRole } = require('../middleware/auth');
const { findTicketForAttendee } = require('../services/tickets');
const { cancelTicket } = require('../services/cancellation');
const { createQrMatrix } = require('../services/qr-code');
const { matrixToPng } = require('../services/png');

const router = express.Router();

// Sends the ticket's QR code as a PNG image. Only the ticket's owner can see it.
router.get('/tickets/:code/qr.png', requireRole('attendee'), (req, res) => {
  const ticket = findTicketForAttendee(req.app.locals.db, req.params.code, req.session.user.id);
  if (!ticket) return res.status(404).render('error', { message: 'Ticket not found.' });

  const qrImage = matrixToPng(createQrMatrix(ticket.code));
  res.type('png').send(qrImage);
});

router.post('/tickets/:code/cancel', requireRole('attendee'), (req, res) => {
  const result = cancelTicket(req.app.locals.db, req.session.user.id, req.params.code);
  if (result.error) return res.status(400).render('error', { message: result.error });

  res.redirect('/my-tickets');
});

module.exports = router;