require('../config/environment');
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const Token = require('../models/authToken');

async function verifyToken(req, res, next) {
  const authorization = req.headers.authorization;
  if (!authorization) {
    return res.status(401).json({ status: false, message: 'Please sign in to continue.' });
  }

  const [scheme, bearerToken, extra] = authorization.trim().split(/\s+/);
  if (scheme?.toLowerCase() !== 'bearer' || !bearerToken || extra) {
    return res.status(401).json({ status: false, message: 'Your login session is invalid. Please sign in again.' });
  }
  if (!process.env.JWT_SECRET) {
    console.error('JWT_SECRET is not configured.');
    return res.status(503).json({ status: false, message: 'Authentication is temporarily unavailable.' });
  }

  let decoded;
  try {
    decoded = jwt.verify(bearerToken, process.env.JWT_SECRET, { maxAge: '24h' });
  } catch {
    return res.status(401).json({ status: false, message: 'Your login session has expired. Please sign in again.' });
  }

  const userId = decoded?.userId || decoded?.id;
  if (!userId) {
    return res.status(401).json({ status: false, message: 'Your login session is invalid. Please sign in again.' });
  }

  try {
    const [storedToken, user] = await Promise.all([
      Token.findOne({ token: bearerToken }).select('_id'),
      User.findById(userId).select('_id'),
    ]);
    if (!storedToken || !user) {
      return res.status(401).json({ status: false, message: 'Your login session has expired. Please sign in again.' });
    }
    res.locals.user_id = user._id;
    res.locals.auth_token = bearerToken;
    return next();
  } catch (error) {
    console.error('Authentication lookup failed:', error);
    return res.status(500).json({ status: false, message: 'Unable to verify your login right now.' });
  }
}

module.exports = verifyToken;
