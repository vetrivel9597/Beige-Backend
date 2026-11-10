const allowedRoles = new Set(['super_admin', 'catalog_manager', 'order_manager', 'support']);

function requireAdminRole(...roles) {
  const permitted = new Set(roles);
  return function enforceAdminRole(req, res, next) {
    const role = res.locals.admin?.role || 'super_admin';
    if (!allowedRoles.has(role) || (role !== 'super_admin' && !permitted.has(role))) {
      return res.status(403).json({ status: false, message: 'Your admin role does not allow this action.' });
    }
    return next();
  };
}

module.exports = requireAdminRole;
