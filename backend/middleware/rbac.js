// Role-Based Access Control Middleware
const rbac = (...allowedRoles) => {
  return (req, res, next) => {
    if (!req.user || !allowedRoles.includes(req.user.role)) {
      return res.status(403).json({ error: 'Insufficient permissions' });
    }
    next();
  };
};

// Institution Isolation Middleware (Multi-Tenancy)
const authorizeInstitution = (req, res, next) => {
  // Get institution ID from authenticated user's JWT token
  const userInstitutionId = req.user?.institution_id;
  
  // Get requested institution ID from request body or params
  const requestedInstitutionId = req.body.institution_id || req.params.institution_id;
  
  // Super admins can access all institutions (optional - remove if not needed)
  if (req.user?.role === 'super_admin') {
    return next();
  }
  
  // Block cross-tenant access
  if (!userInstitutionId || userInstitutionId !== requestedInstitutionId) {
    return res.status(403).json({ 
      error: 'Unauthorized: You can only manage credentials for your own institution' 
    });
  }
  
  next();
};

/**
 * Restricts a route to the regulator's own oversight views.
 *
 * ZAQA is an institution_admin like any other — what distinguishes it is
 * institutions.type = 'regulatory_body', carried in the JWT as
 * institution_type. Checking the role alone would expose every institution's
 * activity to every institution's admin, so the institution type is the gate.
 *
 * super_admin passes as a system-wide account that is not bound to one
 * institution's mandate, consistent with the rest of the codebase.
 */
const requireRegulator = (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({ error: 'Authentication required' });
  }

  const isRegulator = req.user.institution_type === 'regulatory_body';
  const isSuperAdmin = req.user.role === 'super_admin';

  if (!isRegulator && !isSuperAdmin) {
    return res.status(403).json({
      error: 'This view is restricted to the national qualifications regulator'
    });
  }

  next();
};

// Export ALL middlewares
module.exports = { rbac, authorizeInstitution, requireRegulator };