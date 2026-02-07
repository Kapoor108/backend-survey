const router = require('express').Router();
const passport = require('passport');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const Employee = require('../models/Employee');
const InviteLog = require('../models/InviteLog');
const Organization = require('../models/Organization');
const OTP = require('../models/OTP');
const SurveyAssignment = require('../models/SurveyAssignment');
const Survey = require('../models/Survey');
const { sendOTPEmail, generateOTP } = require('../config/email');

const generateToken = (user) => {
  return jwt.sign(
    { id: user._id, role: user.role, orgId: user.orgId },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRES_IN }
  );
};

// Helper function to assign existing department surveys to new user
const assignExistingSurveysToUser = async (user) => {
  if (!user.departmentId || user.role !== 'user') return;
  
  try {
    // Find all active surveys assigned to this department
    const existingAssignments = await SurveyAssignment.find({
      departmentId: user.departmentId,
      orgId: user.orgId
    }).distinct('surveyId');
    
    // Get active surveys
    const activeSurveys = await Survey.find({
      _id: { $in: existingAssignments },
      status: 'active'
    });
    
    // Create assignments for this user
    for (const survey of activeSurveys) {
      const alreadyAssigned = await SurveyAssignment.findOne({
        surveyId: survey._id,
        employeeId: user._id
      });
      
      if (!alreadyAssigned) {
        await SurveyAssignment.create({
          surveyId: survey._id,
          orgId: user.orgId,
          departmentId: user.departmentId,
          employeeId: user._id,
          dueDate: survey.dueDate
        });
      }
    }
  } catch (err) {
    console.error('Error assigning surveys to new user:', err);
  }
};

// ============ OTP LOGIN (Primary method for all users) ============

// Send OTP for login - works for ALL users in database (admin, ceo, user)
router.post('/login/send-otp', async (req, res) => {
  try {
    const email = req.body.email?.toLowerCase().trim();
    
    if (!email) {
      return res.status(400).json({ error: 'Email is required' });
    }
    
    // Check if user exists in Employee collection (any role, any status)
    let user = await Employee.findOne({ 
      email: new RegExp('^' + email.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '$', 'i')
    });
    
    // If no user in Employee, check InviteLog for pending invites
    if (!user) {
      const invite = await InviteLog.findOne({ 
        email: new RegExp('^' + email.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '$', 'i')
      }).sort({ createdAt: -1 });
      
      if (!invite) {
        return res.status(400).json({ error: 'No account found with this email. Please contact your administrator for an invitation.' });
      }
      
      // Create user from invite
      user = await Employee.create({
        email: invite.email.toLowerCase(),
        role: invite.role,
        orgId: invite.orgId,
        departmentId: invite.departmentId,
        inviteStatus: 'pending',
        inviteToken: invite.token
      });
    }

    // Delete existing OTPs
    await OTP.deleteMany({ email: user.email.toLowerCase(), type: 'login' });

    // Generate and save OTP
    const otp = generateOTP();
    await OTP.create({ email: user.email.toLowerCase(), otp, type: 'login' });

    // Send OTP email
    await sendOTPEmail(user.email, otp, 'login');

    res.json({ message: 'OTP sent to your email', email: user.email });
  } catch (err) {
    console.error('Login send OTP error:', err);
    res.status(500).json({ error: err.message });
  }
});

// Verify OTP and login
router.post('/login/verify-otp', async (req, res) => {
  try {
    const email = req.body.email?.toLowerCase().trim();
    const { otp } = req.body;

    const otpRecord = await OTP.findOne({
      email: new RegExp('^' + email.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '$', 'i'),
      otp,
      type: 'login',
      expiresAt: { $gt: new Date() }
    });

    if (!otpRecord) {
      return res.status(400).json({ error: 'Invalid or expired OTP' });
    }

    let user = await Employee.findOne({ 
      email: new RegExp('^' + email.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '$', 'i')
    });
    
    if (!user) {
      return res.status(400).json({ error: 'User not found' });
    }

    // Delete used OTP
    await OTP.deleteMany({ email: user.email.toLowerCase(), type: 'login' });

    // If user was pending, mark as accepted now (they verified their email)
    if (user.inviteStatus === 'pending') {
      user.inviteStatus = 'accepted';
      user.acceptedAt = new Date();
      
      // Also update the invite log
      await InviteLog.findOneAndUpdate(
        { email: new RegExp('^' + email.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '$', 'i'), status: { $in: ['sent', 'clicked'] } },
        { status: 'accepted', acceptedAt: new Date() }
      );
      
      // Assign existing department surveys to this new user
      await assignExistingSurveysToUser(user);
      
      // If CEO, update organization
      if (user.role === 'ceo') {
        await Organization.findByIdAndUpdate(user.orgId, {
          ceoId: user._id,
          status: 'active'
        });
      }
    }

    user.lastLogin = new Date();
    await user.save();

    const token = generateToken(user);
    res.json({
      token,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        orgId: user.orgId
      }
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});


// Resend OTP
router.post('/resend-otp', async (req, res) => {
  try {
    const email = req.body.email?.toLowerCase().trim();
    const { type } = req.body;

    await OTP.deleteMany({ email, type });

    const otp = generateOTP();
    await OTP.create({ email, otp, type });

    await sendOTPEmail(email, otp, type);

    res.json({ message: 'OTP resent successfully' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ============ INVITE VERIFICATION (for signup page - optional) ============

router.get('/verify-invite/:token', async (req, res) => {
  try {
    const invite = await InviteLog.findOne({
      token: req.params.token,
      status: { $in: ['sent', 'clicked'] },
      expiresAt: { $gt: new Date() }
    }).populate('orgId', 'name').populate('departmentId', 'name');

    if (!invite) {
      return res.status(400).json({ 
        valid: false, 
        error: 'Invalid or expired invitation link' 
      });
    }

    // Track that the invite link was clicked
    if (invite.status === 'sent') {
      invite.status = 'clicked';
      invite.clickedAt = new Date();
      await invite.save();
    }

    res.json({
      valid: true,
      email: invite.email,
      role: invite.role,
      orgName: invite.orgId?.name || 'Organization',
      departmentName: invite.departmentId?.name || null
    });
  } catch (err) {
    res.status(500).json({ valid: false, error: err.message });
  }
});

// ============ SIGNUP (Optional - users can also just login directly) ============

router.post('/signup/send-otp', async (req, res) => {
  try {
    const { token } = req.body;

    const invite = await InviteLog.findOne({
      token,
      status: { $in: ['sent', 'clicked'] },
      expiresAt: { $gt: new Date() }
    });

    if (!invite) {
      return res.status(400).json({ error: 'Invalid or expired invitation' });
    }

    const existingUser = await Employee.findOne({ email: invite.email, inviteStatus: 'accepted' });
    if (existingUser) {
      return res.status(400).json({ error: 'Account already exists. Please login.' });
    }

    await OTP.deleteMany({ email: invite.email, type: 'signup' });

    const otp = generateOTP();
    await OTP.create({ email: invite.email, otp, type: 'signup' });

    await sendOTPEmail(invite.email, otp, 'signup');

    res.json({ message: 'OTP sent to your email', email: invite.email });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/signup/verify-otp', async (req, res) => {
  try {
    const { token, otp, name, password } = req.body;

    const invite = await InviteLog.findOne({
      token,
      status: { $in: ['sent', 'clicked'] },
      expiresAt: { $gt: new Date() }
    });

    if (!invite) {
      return res.status(400).json({ error: 'Invalid or expired invitation' });
    }

    const otpRecord = await OTP.findOne({
      email: invite.email,
      otp,
      type: 'signup',
      expiresAt: { $gt: new Date() }
    });

    if (!otpRecord) {
      return res.status(400).json({ error: 'Invalid or expired OTP' });
    }

    await OTP.deleteMany({ email: invite.email, type: 'signup' });

    const hashedPassword = await bcrypt.hash(password, 10);

    let user = await Employee.findOne({ email: invite.email });
    
    if (user) {
      user.name = name;
      user.password = hashedPassword;
      user.inviteStatus = 'accepted';
      user.acceptedAt = new Date();
      user.inviteToken = null;
    } else {
      user = new Employee({
        name,
        email: invite.email,
        password: hashedPassword,
        role: invite.role,
        orgId: invite.orgId,
        departmentId: invite.departmentId,
        inviteStatus: 'accepted',
        acceptedAt: new Date()
      });
    }

    await user.save();

    // Assign existing department surveys to this new user
    await assignExistingSurveysToUser(user);

    invite.status = 'accepted';
    invite.acceptedAt = new Date();
    await invite.save();

    if (invite.role === 'ceo') {
      await Organization.findByIdAndUpdate(invite.orgId, {
        ceoId: user._id,
        status: 'active'
      });
    }

    const authToken = generateToken(user);
    res.status(201).json({
      token: authToken,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        orgId: user.orgId
      }
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});


// ============ GOOGLE OAUTH ============

router.get('/google', passport.authenticate('google', { scope: ['profile', 'email'] }));

router.get('/google/callback',
  passport.authenticate('google', { session: false, failureRedirect: '/login' }),
  (req, res) => {
    const token = generateToken(req.user);
    res.redirect(`${process.env.FRONTEND_URL}/auth/callback?token=${token}`);
  }
);

// ============ GET CURRENT USER ============

router.get('/me', require('../middleware/auth').auth, async (req, res) => {
  res.json({
    user: {
      id: req.user._id,
      name: req.user.name,
      email: req.user.email,
      role: req.user.role,
      orgId: req.user.orgId
    }
  });
});

module.exports = router;
