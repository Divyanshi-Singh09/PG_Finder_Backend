/**
 * Role authorization middleware factory
 * @param {...string} allowedRoles Roles allowed to access the route (e.g. 'ADMIN', 'OWNER', 'SEEKER')
 */
const authorizeRoles = (...allowedRoles) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required before accessing this endpoint.',
      });
    }

    if (!allowedRoles.includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        message: `Access denied. ${req.user.role} role is not authorized to perform this action.`,
      });
    }

    next();
  };
};

module.exports = { authorizeRoles };
