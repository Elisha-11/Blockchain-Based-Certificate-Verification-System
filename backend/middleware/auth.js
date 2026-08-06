const jwt = require('jsonwebtoken');

const auth = (req, res, next) => {
  try {
    const token = req.header('Authorization')?.replace('Bearer ', '');
    
    if (!token) {
      return res.status(401).json({ error: 'No token provided' });
    }
    
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    
    // CRITICAL: Ensure institution_id is attached to req.user
    req.user = {
      user_id: decoded.user_id,
      email: decoded.email,
      role: decoded.role,
      institution_id: decoded.institution_id, 
      full_name: decoded.full_name
    };
    
    next();
  } catch (error) {
    res.status(401).json({ error: 'Invalid token' });
  }
};

module.exports = auth;