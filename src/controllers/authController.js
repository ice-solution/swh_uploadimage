const User = require('../models/User');
const { signAccessToken, signRefreshToken, verifyToken } = require('../utils/jwt');

function issueTokens(user) {
  const accessToken = signAccessToken({
    sub: user._id.toString(),
    username: user.username,
    type: 'access',
  });
  const refreshToken = signRefreshToken({
    sub: user._id.toString(),
    type: 'refresh',
  });
  return { accessToken, refreshToken };
}

async function register(req, res, next) {
  try {
    const { username, password } = req.body;

    if (!username || !password) {
      return res.status(400).json({
        success: false,
        message: 'username and password are required',
      });
    }

    if (String(password).length < 6) {
      return res.status(400).json({
        success: false,
        message: 'password must be at least 6 characters',
      });
    }

    const existing = await User.findOne({ username: String(username).toLowerCase().trim() });
    if (existing) {
      return res.status(409).json({
        success: false,
        message: 'username already exists',
      });
    }

    const user = await User.create({
      username: String(username).toLowerCase().trim(),
      password,
    });

    const tokens = issueTokens(user);
    user.refreshToken = tokens.refreshToken;
    await user.save();

    return res.status(201).json({
      success: true,
      data: {
        user: { id: user._id, username: user.username },
        accessToken: tokens.accessToken,
        refreshToken: tokens.refreshToken,
        expiresIn: process.env.JWT_EXPIRES_IN || '7d',
      },
    });
  } catch (err) {
    return next(err);
  }
}

async function login(req, res, next) {
  try {
    const { username, password } = req.body;

    if (!username || !password) {
      return res.status(400).json({
        success: false,
        message: 'username and password are required',
      });
    }

    const user = await User.findOne({
      username: String(username).toLowerCase().trim(),
    }).select('+password +refreshToken');

    if (!user || !(await user.comparePassword(password))) {
      return res.status(401).json({
        success: false,
        message: 'Invalid username or password',
      });
    }

    const tokens = issueTokens(user);
    user.refreshToken = tokens.refreshToken;
    await user.save();

    return res.json({
      success: true,
      data: {
        user: { id: user._id, username: user.username },
        accessToken: tokens.accessToken,
        refreshToken: tokens.refreshToken,
        expiresIn: process.env.JWT_EXPIRES_IN || '7d',
      },
    });
  } catch (err) {
    return next(err);
  }
}

/**
 * Access token 過期後，用 refreshToken 換取新的 access + refresh token
 */
async function refresh(req, res, next) {
  try {
    const { refreshToken } = req.body;

    if (!refreshToken) {
      return res.status(400).json({
        success: false,
        message: 'refreshToken is required',
        code: 'REFRESH_TOKEN_MISSING',
      });
    }

    let decoded;
    try {
      decoded = verifyToken(refreshToken);
    } catch (err) {
      const code =
        err.name === 'TokenExpiredError' ? 'REFRESH_TOKEN_EXPIRED' : 'REFRESH_TOKEN_INVALID';
      return res.status(401).json({
        success: false,
        message:
          err.name === 'TokenExpiredError'
            ? 'Refresh token expired, please login again'
            : 'Invalid refresh token',
        code,
      });
    }

    if (decoded.type !== 'refresh') {
      return res.status(401).json({
        success: false,
        message: 'Invalid refresh token',
        code: 'REFRESH_TOKEN_INVALID',
      });
    }

    const user = await User.findById(decoded.sub).select('+refreshToken');
    if (!user || !user.refreshToken || user.refreshToken !== refreshToken) {
      return res.status(401).json({
        success: false,
        message: 'Refresh token revoked or invalid',
        code: 'REFRESH_TOKEN_INVALID',
      });
    }

    const tokens = issueTokens(user);
    user.refreshToken = tokens.refreshToken;
    await user.save();

    return res.json({
      success: true,
      data: {
        accessToken: tokens.accessToken,
        refreshToken: tokens.refreshToken,
        expiresIn: process.env.JWT_EXPIRES_IN || '7d',
      },
    });
  } catch (err) {
    return next(err);
  }
}

async function logout(req, res, next) {
  try {
    await User.findByIdAndUpdate(req.user._id, { refreshToken: null });
    return res.json({ success: true, message: 'Logged out' });
  } catch (err) {
    return next(err);
  }
}

module.exports = {
  register,
  login,
  refresh,
  logout,
};
