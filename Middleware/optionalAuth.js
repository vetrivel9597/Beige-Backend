require('../config/environment');
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const Token = require('../models/authToken');

module.exports = async function optionalAuth(req, res, next) {
  const authorization = req.headers.authorization;
  if (!authorization) return next();
  const [scheme, token, extra] = authorization.trim().split(/\s+/);
  if (scheme?.toLowerCase() !== 'bearer' || !token || extra || !process.env.JWT_SECRET) {
    return res.status(401).json({ status: false, message: 'Your login session is invalid. Please sign in again.' });
  }
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const userId = decoded?.userId || decoded?.id;
    if (!userId) return res.status(401).json({ status: false, message: 'Your login session is invalid. Please sign in again.' });
    const [storedToken, user] = await Promise.all([
      Token.findOne({ token }).select('_id'),
      User.findById(userId).select('_id'),
    ]);
    if (!storedToken || !user) return res.status(401).json({ status: false, message: 'Your login session has expired. Please sign in again.' });
    req.authUserId = user._id;
    return next();
  } catch (error) {
    if (['JsonWebTokenError', 'TokenExpiredError', 'NotBeforeError'].includes(error.name)) {
      return res.status(401).json({ status: false, message: 'Your login session has expired. Please sign in again.' });
    }
    return next(error);
  }
};
