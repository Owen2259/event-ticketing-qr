const express = require('express');
const path = require('path');
const session = require('express-session');
const { attachUser } = require('./middleware/auth');
const authRoutes = require('./routes/auth');
const eventRoutes = require('./routes/events');
const bookingRoutes = require('./routes/bookings');

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

  return app;
}

module.exports = { createApp };