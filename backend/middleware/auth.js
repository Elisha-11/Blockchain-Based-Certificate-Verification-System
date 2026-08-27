// backend/middleware/auth.js
const jwt = require('jsonwebtoken');

/**
 * Authentication Middleware
 * Verifies JWT token and attaches user context to request.
 * Maps BOTH snake_case (JWT standard) and camelCase (Controller expectations)
 * to ensure compatibility across the entire application.
 */
const auth = (req, res, next) => {
  try {
    // Extract Bearer token from Authorization header
    const authHeader = req.header('Authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'No token provided' });
    }

    const token = authHeader.replace('Bearer ', '');
    
    // Verify token signature and expiration
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    
    //  Map BOTH naming conventions for full compatibility
    req.user = {
      // Original JWT claims (snake_case - matches database & token payload)
      user_id: decoded.user_id,
      email: decoded.email,
      role: decoded.role,
      institution_id: decoded.institution_id, 
      full_name: decoded.full_name,
      
      // Controller-compatible aliases (camelCase - matches frontend/service expectations)
      userId: decoded.user_id,              // Required by revokeCertificate controller
      institutionId: decoded.institution_id  // Required by getMyInstitutionCerts controller
    };
    
    next();
  } catch (error) {
    console.error('[AuthMiddleware] Token verification failed:', error.message);
    
    // Distinguish between expired vs invalid tokens for better UX
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({ error: 'Session expired. Please log in again.' });
    }
    
    res.status(401).json({ error: 'Invalid token' });
  }
};

module.exports = auth;