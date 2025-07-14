module.exports = function verifyCsrf(req, res, next) {
  const expected = process.env.CSRF_SECRET;
  const token = req.get('X-CSRF-Token');
  if (!token || token !== expected) {
    return res.status(403).json({ error: 'Invalid CSRF token' });
  }
  next();
};
