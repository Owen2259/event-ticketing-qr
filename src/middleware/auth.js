function attachUser(req, res, next) {
  res.locals.user = req.session.user || null;
  next();
}

function requireLogin(req, res, next) {
  if (!req.session.user) return res.redirect('/login');
  next();
}

function requireRole(role) {
  return (req, res, next) => {
    if (!req.session.user) return res.redirect('/login');
    if (req.session.user.role !== role) {
      return res.status(403).render('error', { message: 'You do not have permission to view this page.' });
    }
    next();
  };
}

module.exports = { attachUser, requireLogin, requireRole };