const express = require('express');
const path = require('path');
const session = require('express-session');
const { attachUser } = require('./middleware/auth');
const authRoutes = require('./routes/auth');
const eventRoutes = require('./routes/events');
const bookingRoutes = require('./routes/bookings');
const ticketRoutes = require('./routes/tickets');
const checkinRoutes = require('./routes/checkin');
const dashboardRoutes = require('./routes/dashboard');

function createApp(db) {
  const app = express();
  app.locals.db = db;
  app.locals.formatDate = (iso) =>
    new Date(iso).toLocaleString('en-GB', { dateStyle: 'medium', timeStyle: 'short' });

  app.set('view engine', 'ejs');
  app.set('views', path.join(__dirname, '..', 'views'));

  app.use(express.urlencoded({ extended: false }));
  app.use(express.static(path.join(__dirname, '..', 'public')));
  app.use(
    session({
      secret: process.env.SESSION_SECRET || 'dev-only-secret-change-me',
      resave: false,
      saveUninitialized: false,
      cookie: { httpOnly: true, sameSite: 'lax' },
    })
  );
  app.use(attachUser);

  app.get('/', (req, res) => res.render('home'));
  app.use('/', authRoutes);
  app.use('/', eventRoutes);
  app.use('/', bookingRoutes);
  app.use('/', ticketRoutes);
  app.use('/', checkinRoutes);
  app.use('/', dashboardRoutes);

  // Anything that matched no route
  app.use((req, res) => {
    res.status(404).render('error', { message: 'Page not found.' });
  });

  // Anything that went wrong unexpectedly
  app.use((err, req, res, next) => {
    console.error(err);
    res.status(500).render('error', { message: 'Something went wrong. Please try again.' });
  });

  return app;
}

module.exports = { createApp };