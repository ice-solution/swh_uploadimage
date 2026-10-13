const { verifyToken } = require('../utils/jwt');
const User = require('../models/User');

async function requireAuth(req, res, next) {
  try {
    const header = req.headers.authorization;
    if (!header || !header.startsWith('Bearer ')) {
      return res.status(401).json({
        success: false,
        message: 'Missing or invalid Authorization header',
        code: 'TOKEN_MISSING',
      });
    }

    const token = header.slice(7);
    let decoded;
    try {
      decoded = verifyToken(token);
    } catch (err) {
      const code = err.name === 'TokenExpiredError' ? 'TOKEN_EXPIRED' : 'TOKEN_INVALID';
      return res.status(401).json({
        success: false,
        message: err.name === 'TokenExpiredError' ? 'Access token expired' : 'Invalid access token',
        code,
      });
    }

    if (decoded.type && decoded.type !== 'access') {
      return res.status(401).json({
        success: false,
        message: 'Invalid access token',
        code: 'TOKEN_INVALID',
      });
    }

    const user = await User.findById(decoded.sub);
    if (!user) {
      return res.status(401).json({
        success: false,
        message: 'User not found',
        code: 'TOKEN_INVALID',
      });
    }

    req.user = user;
    return next();
  } catch (err) {
    return next(err);
  }
}

module.exports = { requireAuth };
