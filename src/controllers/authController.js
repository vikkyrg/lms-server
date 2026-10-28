const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const User = require('../models/User');
const { getJwtSecret } = require('../middleware/auth');
const { sendEmail } = require('../utils/email');

const generateToken = (id) => {
  return jwt.sign({ id }, getJwtSecret(), {
    expiresIn: process.env.JWT_EXPIRE || '7d'
  });
};

// @desc Register student
// @route POST /api/v1/auth/register
exports.register = async (req, res, next) => {
  try {
    const { name, email, password } = req.body;

    if (!name || typeof name !== 'string' || name.trim().length < 2
      || !email || typeof email !== 'string'
      || !password || typeof password !== 'string' || password.length < 8) {
      return res.status(400).json({ success: false, message: 'Please provide all required fields' });
    }

    const userExists = await User.findOne({ email });
    if (userExists) {
      return res.status(400).json({ success: false, message: 'Email already registered' });
    }

    // Public registration only allows student role
    const user = await User.create({
      name,
      email,
      password,
      role: 'student',
      isVerified: false
    });

    await sendVerificationEmail(user);
    const token = generateToken(user._id);

    res.status(201).json({
      success: true,
      token,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        avatar: user.avatar
      }
    });
  } catch (error) {
    next(error);
  }
};

const sendVerificationEmail = async (user) => {
  const rawToken = crypto.randomBytes(32).toString('hex');
  user.emailVerificationToken = crypto.createHash('sha256').update(rawToken).digest('hex');
  user.emailVerificationExpire = new Date(Date.now() + 24 * 60 * 60 * 1000);
  await user.save({ validateBeforeSave: false });
  const clientUrl = process.env.CLIENT_URL || 'http://localhost:5173';
  await sendEmail({
    to: user.email,
    subject: 'Verify your SkillElevate account',
    text: `Verify your account: ${clientUrl}/verify-email/${rawToken}`
  });
};

// @desc Login user
// @route POST /api/v1/auth/login
exports.login = async (req, res, next) => {
  try {
    const { email, password } = req.body;

    if (!email || typeof email !== 'string' || !password || typeof password !== 'string') {
      return res.status(400).json({ success: false, message: 'Please provide email and password' });
    }

    const user = await User.findOne({ email }).select('+password');
    if (!user) {
      return res.status(401).json({ success: false, message: 'Invalid credentials' });
    }

    const isMatch = await user.matchPassword(password);
    if (!isMatch) {
      return res.status(401).json({ success: false, message: 'Invalid credentials' });
    }

    if (!user.isActive) {
      return res.status(403).json({ success: false, message: 'Account is deactivated' });
    }
    if (!['student', 'admin'].includes(user.role)) {
      return res.status(403).json({ success: false, message: 'This account role is no longer supported' });
    }

    const token = generateToken(user._id);

    res.status(200).json({
      success: true,
      token,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        avatar: user.avatar,
        headline: user.headline,
        bio: user.bio,
        expertise: user.expertise
      }
    });
  } catch (error) {
    next(error);
  }
};

// @desc Get current user profile
// @route GET /api/v1/auth/me
exports.getMe = async (req, res, next) => {
  try {
    const user = await User.findById(req.user.id);
    res.status(200).json({
      success: true,
      user
    });
  } catch (error) {
    next(error);
  }
};

// @desc Update user profile
// @route PUT /api/v1/auth/profile
exports.updateProfile = async (req, res, next) => {
  try {
    const { name, phone, headline, bio, avatar, expertise } = req.body;
    const user = await User.findById(req.user.id);

    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    if (name !== undefined) {
      if (typeof name !== 'string' || name.trim().length < 2) {
        return res.status(400).json({ success: false, message: 'Name must contain at least 2 characters' });
      }
      user.name = name.trim();
    }
    if (phone !== undefined) {
      if (phone && (typeof phone !== 'string' || phone.trim().length < 7)) {
        return res.status(400).json({ success: false, message: 'Please provide a valid phone number' });
      }
      user.phone = typeof phone === 'string' ? phone.trim() : '';
    }
    if (headline !== undefined) user.headline = headline;
    if (bio !== undefined) user.bio = bio;
    if (avatar !== undefined) user.avatar = avatar;
    if (expertise) user.expertise = Array.isArray(expertise) ? expertise : expertise.split(',').map(s => s.trim());

    await user.save();

    res.status(200).json({
      success: true,
      user
    });
  } catch (error) {
    next(error);
  }
};

// @desc Change the authenticated user's password
// @route PUT /api/v1/auth/password
exports.changePassword = async (req, res, next) => {
  try {
    const { currentPassword, newPassword } = req.body;
    if (typeof currentPassword !== 'string' || typeof newPassword !== 'string' || newPassword.length < 8) {
      return res.status(400).json({ success: false, message: 'A current password and a new password of at least 8 characters are required' });
    }

    const user = await User.findById(req.user.id).select('+password');
    if (!user || !(await user.matchPassword(currentPassword))) {
      return res.status(400).json({ success: false, message: 'Current password is incorrect' });
    }

    user.password = newPassword;
    await user.save();
    res.status(200).json({ success: true, message: 'Password changed successfully' });
  } catch (error) {
    next(error);
  }
};

exports.forgotPassword = async (req, res, next) => {
  try {
    const email = typeof req.body.email === 'string' ? req.body.email.trim().toLowerCase() : '';
    const response = { success: true, message: 'If an account exists for that email, reset instructions have been sent.' };
    if (!email) return res.status(200).json(response);
    const user = await User.findOne({ email });
    if (!user) return res.status(200).json(response);

    const rawToken = crypto.randomBytes(32).toString('hex');
    user.resetPasswordToken = crypto.createHash('sha256').update(rawToken).digest('hex');
    user.resetPasswordExpire = new Date(Date.now() + 15 * 60 * 1000);
    await user.save({ validateBeforeSave: false });
    const clientUrl = process.env.CLIENT_URL || 'http://localhost:5173';
    await sendEmail({
      to: user.email,
      subject: 'Reset your SkillElevate password',
      text: `Reset your password: ${clientUrl}/reset-password/${rawToken}`
    });
    return res.status(200).json(response);
  } catch (error) {
    next(error);
  }
};

exports.resetPassword = async (req, res, next) => {
  try {
    const { token, password } = req.body;
    if (typeof token !== 'string' || typeof password !== 'string' || password.length < 8) {
      return res.status(400).json({ success: false, message: 'A valid token and password of at least 8 characters are required' });
    }
    const hashedToken = crypto.createHash('sha256').update(token).digest('hex');
    const user = await User.findOne({
      resetPasswordToken: hashedToken,
      resetPasswordExpire: { $gt: new Date() }
    }).select('+password');
    if (!user) return res.status(400).json({ success: false, message: 'Reset token is invalid or expired' });

    user.password = password;
    user.resetPasswordToken = undefined;
    user.resetPasswordExpire = undefined;
    await user.save();
    return res.status(200).json({ success: true, message: 'Password reset successfully' });
  } catch (error) {
    next(error);
  }
};

exports.verifyEmail = async (req, res, next) => {
  try {
    const hashedToken = crypto.createHash('sha256').update(req.params.token || '').digest('hex');
    const user = await User.findOne({
      emailVerificationToken: hashedToken,
      emailVerificationExpire: { $gt: new Date() }
    });
    if (!user) return res.status(400).json({ success: false, message: 'Verification token is invalid or expired' });

    user.isVerified = true;
    user.emailVerificationToken = undefined;
    user.emailVerificationExpire = undefined;
    await user.save({ validateBeforeSave: false });
    return res.status(200).json({ success: true, message: 'Email verified successfully' });
  } catch (error) {
    next(error);
  }
};

exports.resendVerification = async (req, res, next) => {
  try {
    const email = typeof req.body.email === 'string' ? req.body.email.trim().toLowerCase() : '';
    const user = await User.findOne({ email });
    if (user && !user.isVerified) await sendVerificationEmail(user);
    return res.status(200).json({ success: true, message: 'If an unverified account exists, a verification email has been sent.' });
  } catch (error) {
    next(error);
  }
};
