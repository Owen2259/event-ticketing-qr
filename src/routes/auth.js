const express = require('express');
const { registerUser, loginUser } = require('../services/auth');

const router = express.Router();

router.get('/register', (req, res) => {
  res.render('register', { errors: [], form: {} });
});

router.post('/register', (req, res, next) => {
  const body = req.body || {};
  const result = registerUser(req.app.locals.db, body);
  if (result.errors) {
    return res
      .status(400)
      .render('register', { errors: result.errors, form: { name: body.name, email: body.email, role: body.role } });
  }
  req.session.regenerate((err) => {
    if (err) return next(err);
    req.session.user = result.user;
    res.redirect('/');
  });
});

router.get('/login', (req, res) => {
  res.render('login', { errors: [], form: {} });
});

router.post('/login', (req, res, next) => {
  const body = req.body || {};
  const result = loginUser(req.app.locals.db, body);
  if (result.errors) {
    return res.status(401).render('login', { errors: result.errors, form: { email: body.email } });
  }
  req.session.regenerate((err) => {
    if (err) return next(err);
    req.session.user = result.user;
    res.redirect('/');
  });
});

router.post('/logout', (req, res, next) => {
  req.session.destroy((err) => {
    if (err) return next(err);
    res.redirect('/');
  });
});

module.exports = router;