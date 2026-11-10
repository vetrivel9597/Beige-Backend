require('../config/environment');
const jwt = require('jsonwebtoken');
const adminCollection = require('../models/adminModule');

async function verifyToken(req, res, next) {
  const authorization = req.headers.authorization;
  if (!authorization) {
    return res.status(401).json({ status: false, message: 'No admin token provided.' });
  }

  const [scheme, token, extra] = authorization.trim().split(/\s+/);
  if (scheme?.toLowerCase() !== 'bearer' || !token || extra) {
    return res.status(401).json({ status: false, message: 'Invalid admin token.' });
  }
  if (!process.env.JWT_ADMIN_SECRET) {
    console.error('JWT_ADMIN_SECRET is not configured.');
    return res.status(503).json({ status: false, message: 'Admin authentication is unavailable.' });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_ADMIN_SECRET);
    if (!decoded.id) {
      return res.status(401).json({ status: false, message: 'Invalid admin token.' });
    }
    const admin = await adminCollection.findById(decoded.id).select('_id email role');
    if (!admin) {
      return res.status(401).json({ status: false, message: 'Admin session has expired.' });
    }
    res.locals.admin_id = admin._id;
    // Legacy admin accounts predate the role field and retain full access.
    if (!admin.role) admin.role = 'super_admin';
    res.locals.admin = admin;
    return next();
  } catch (error) {
    if (error.name === 'JsonWebTokenError' || error.name === 'TokenExpiredError' || error.name === 'NotBeforeError') {
      return res.status(401).json({ status: false, message: 'Admin session is invalid or expired.' });
    }
    console.error('Admin authentication lookup failed:', error);
    return res.status(500).json({ status: false, message: 'Unable to verify the admin session.' });
  }
}

module.exports = verifyToken;
