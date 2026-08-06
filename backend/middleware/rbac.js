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

// Export BOTH middlewares
module.exports = { rbac, authorizeInstitution };