const jwt = require('jsonwebtoken');

function getSecret() {
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    throw new Error('JWT_SECRET is not set');
  }
  return secret;
}

function signAccessToken(payload) {
  return jwt.sign(payload, getSecret(), {
    expiresIn: process.env.JWT_EXPIRES_IN || '7d',
  });
}

function signRefreshToken(payload) {
  return jwt.sign(payload, getSecret(), {
    expiresIn: process.env.REFRESH_TOKEN_EXPIRES_IN || '30d',
  });
}

function verifyToken(token) {
  return jwt.verify(token, getSecret());
}

module.exports = {
  signAccessToken,
  signRefreshToken,
  verifyToken,
};
