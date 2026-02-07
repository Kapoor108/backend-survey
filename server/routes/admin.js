const router = require('express').Router();
const { v4: uuidv4 } = require('uuid');
const { auth, isAdmin } = require('../middleware/auth');
const Organization = require('../models/Organization');
const Employee = require('../models/Employee');
const Department = require('../models/Department');
const Survey = require('../models/Survey');
const SurveyAssignment = require('../models/SurveyAssignment');
const SurveyResponse = require('../models/SurveyResponse');
const InviteLog = require('../models/InviteLog');
const { sendCEOInviteEmail } = require('../config/email');

router.use(auth, isAdmin);

// Create Organization & Invite CEO
router.post('/organizations', async (req, res) => {
  try {
    const { name, ceoEmail } = req.body;
    
    console.log('Creating org:', { name, ceoEmail });

    if (!name || !ceoEmail) {
      return res.status(400).json({ error: 'Organization name and CEO email are required' });
    }

    // Check if email already has an accepted account
    const existingUser = await Employee.findOne({ email: ceoEmail, inviteStatus: 'accepted' });
    if (existingUser) {
      return res.status(400).json({ error: 'This email already has an active account' });
    }

    // Check if there's a pending invite for this email - delete old ones
    const existingInvite = await InviteLog.findOne({ email: ceoEmail, status: 'sent' });
    if (existingInvite) {
      // Delete old pending invite and employee record to allow re-invite
      await InviteLog.deleteMany({ email: ceoEmail, status: 'sent' });
      await Employee.deleteMany({ email: ceoEmail, inviteStatus: 'pending' });
      await Organization.deleteMany({ ceoEmail, status: 'pending' });
      console.log('Deleted old pending invites for:', ceoEmail);
    }

    const inviteToken = uuidv4();

    // Create organization
    const org = await Organization.create({
      name,
      ceoEmail,
      inviteToken,
      status: 'pending'
    });
    console.log('Org created:', org._id);

    // Create placeholder employee record
    await Employee.create({
      name: 'CEO',
      email: ceoEmail,
      role: 'ceo',
      orgId: org._id,
      inviteToken,
      inviteStatus: 'pending'
    });
    console.log('CEO employee created');

    // Create invite log
    await InviteLog.create({
      email: ceoEmail,
      orgId: org._id,
      invitedBy: req.user._id,
      role: 'ceo',
      token: inviteToken
    });
    console.log('Invite log created');

    // Try to send CEO invite email (don't fail if email fails)
    let emailSent = false;
    try {
      await sendCEOInviteEmail(ceoEmail, inviteToken, name);
      emailSent = true;
      console.log('Email sent successfully');
    } catch (emailErr) {
      console.error('Failed to send email:', emailErr.message);
    }

    res.status(201).json({
      org,
      inviteToken,
      emailSent,
      signupLink: `${process.env.FRONTEND_URL}/signup?token=${inviteToken}`,
      message: emailSent 
        ? `Organization created and invitation sent to ${ceoEmail}` 
        : `Organization created. Email failed - share this link manually: ${process.env.FRONTEND_URL}/signup?token=${inviteToken}`
    });
  } catch (err) {
    console.error('Create org error:', err);
    res.status(500).json({ error: err.message });
  }
});

// Resend CEO invite
router.post('/organizations/:id/resend-invite', async (req, res) => {
  try {
    const org = await Organization.findById(req.params.id);
    if (!org) return res.status(404).json({ error: 'Organization not found' });

    if (org.status === 'active') {
      return res.status(400).json({ error: 'CEO has already accepted the invite' });
    }

    // Generate new token
    const inviteToken = uuidv4();

    // Update invite log
    await InviteLog.findOneAndUpdate(
      { orgId: org._id, role: 'ceo', status: 'sent' },
      {
        token: inviteToken,
        sentAt: new Date(),
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
      }
    );

    // Update employee record
    await Employee.findOneAndUpdate(
      { orgId: org._id, role: 'ceo' },
      { inviteToken }
    );

    // Send email
    await sendCEOInviteEmail(org.ceoEmail, inviteToken, org.name);

    res.json({ message: 'Invitation resent successfully' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get all organizations with stats
router.get('/organizations', async (req, res) => {
  try {
    const orgs = await Organization.find().populate('ceoId', 'name email');

    const orgsWithStats = await Promise.all(orgs.map(async (org) => {
      const employees = await Employee.countDocuments({ orgId: org._id, role: 'user' });
      const departments = await Department.countDocuments({ orgId: org._id });
      const surveys = await Survey.countDocuments({ orgId: org._id });
      const assignments = await SurveyAssignment.countDocuments({ orgId: org._id });
      const completed = await SurveyAssignment.countDocuments({ orgId: org._id, status: 'completed' });

      return {
        ...org.toObject(),
        stats: {
          employees,
          departments,
          surveys,
          completionRate: assignments > 0 ? Math.round((completed / assignments) * 100) : 0
        }
      };
    }));

    res.json(orgsWithStats);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get organization details (drill-down)
router.get('/organizations/:id', async (req, res) => {
  try {
    const org = await Organization.findById(req.params.id).populate('ceoId', 'name email');
    if (!org) return res.status(404).json({ error: 'Organization not found' });

    const departments = await Department.find({ orgId: req.params.id });
    const employees = await Employee.find({ orgId: req.params.id });
    const surveys = await Survey.find({ orgId: req.params.id });
    const assignments = await SurveyAssignment.find({ orgId: req.params.id });

    res.json({
      org,
      departments,
      employees,
      surveys,
      stats: {
        totalEmployees: employees.filter(e => e.role === 'user').length,
        activeEmployees: employees.filter(e => e.inviteStatus === 'accepted' && e.role === 'user').length,
        totalSurveys: surveys.length,
        totalAssignments: assignments.length,
        completedAssignments: assignments.filter(a => a.status === 'completed').length,
        pendingAssignments: assignments.filter(a => a.status === 'pending').length
      }
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Create survey template
router.post('/surveys/template', async (req, res) => {
  try {
    const { title, description, questions } = req.body;
    const survey = await Survey.create({
      title,
      description,
      questions,
      createdBy: req.user._id,
      isTemplate: true
    });
    res.status(201).json(survey);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get all survey templates
router.get('/surveys/templates', async (req, res) => {
  try {
    const templates = await Survey.find({ isTemplate: true });
    res.json(templates);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get single survey template
router.get('/surveys/templates/:id', async (req, res) => {
  try {
    const template = await Survey.findOne({ _id: req.params.id, isTemplate: true });
    if (!template) return res.status(404).json({ error: 'Template not found' });
    res.json(template);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Update survey template
router.put('/surveys/templates/:id', async (req, res) => {
  try {
    const { title, description, questions } = req.body;
    const template = await Survey.findOneAndUpdate(
      { _id: req.params.id, isTemplate: true },
      { title, description, questions },
      { new: true }
    );
    if (!template) return res.status(404).json({ error: 'Template not found' });
    res.json(template);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Delete survey template
router.delete('/surveys/templates/:id', async (req, res) => {
  try {
    const template = await Survey.findOneAndDelete({ _id: req.params.id, isTemplate: true });
    if (!template) return res.status(404).json({ error: 'Template not found' });
    res.json({ message: 'Template deleted successfully' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get all invites
router.get('/invites', async (req, res) => {
  try {
    const invites = await InviteLog.find()
      .populate('orgId', 'name')
      .populate('invitedBy', 'name email')
      .sort({ sentAt: -1 });
    res.json(invites);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get dashboard stats
router.get('/dashboard', async (req, res) => {
  try {
    const totalOrgs = await Organization.countDocuments();
    const activeOrgs = await Organization.countDocuments({ status: 'active' });
    const totalEmployees = await Employee.countDocuments({ role: { $ne: 'admin' } });
    const totalTemplates = await Survey.countDocuments({ isTemplate: true });
    const totalSurveys = await Survey.countDocuments({ isTemplate: false });
    const pendingInvites = await InviteLog.countDocuments({ status: 'sent' });
    const totalResponses = await SurveyResponse.countDocuments({ isDraft: false });

    const recentActivity = await SurveyResponse.find({ isDraft: false })
      .populate('employeeId', 'name email')
      .populate('surveyId', 'title')
      .sort({ submittedAt: -1 })
      .limit(10);

    res.json({
      stats: { totalOrgs, activeOrgs, totalEmployees, totalTemplates, totalSurveys, pendingInvites, totalResponses },
      recentActivity
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get user marks for an organization
router.get('/organizations/:orgId/user-marks', async (req, res) => {
  try {
    const responses = await SurveyResponse.find({ orgId: req.params.orgId, isDraft: false })
      .populate('employeeId', 'name email')
      .populate('surveyId', 'title')
      .populate('departmentId', 'name')
      .sort({ submittedAt: -1 });

    const userMarks = responses.map(r => ({
      id: r._id,
      employee: r.employeeId,
      survey: r.surveyId,
      department: r.departmentId,
      totalCreativityMarks: r.totalCreativityMarks || 0,
      totalMoralityMarks: r.totalMoralityMarks || 0,
      totalMarks: (r.totalCreativityMarks || 0) + (r.totalMoralityMarks || 0),
      submittedAt: r.submittedAt,
      answers: r.answers
    }));

    res.json(userMarks);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get individual user response details
router.get('/responses/:responseId', async (req, res) => {
  try {
    const response = await SurveyResponse.findById(req.params.responseId)
      .populate('employeeId', 'name email')
      .populate('surveyId')
      .populate('departmentId', 'name');

    if (!response) return res.status(404).json({ error: 'Response not found' });

    res.json(response);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get individual user details with all survey responses
router.get('/users/:userId', async (req, res) => {
  try {
    const user = await Employee.findById(req.params.userId)
      .populate('orgId', 'name')
      .populate('departmentId', 'name');

    if (!user) return res.status(404).json({ error: 'User not found' });

    // Get all survey responses for this user
    const responses = await SurveyResponse.find({ employeeId: req.params.userId, isDraft: false })
      .populate('surveyId')
      .sort({ submittedAt: -1 });

    // Calculate total marks across all surveys
    let totalCreativity = 0;
    let totalMorality = 0;

    const surveyResults = responses.map(r => {
      totalCreativity += r.totalCreativityMarks || 0;
      totalMorality += r.totalMoralityMarks || 0;

      return {
        id: r._id,
        survey: r.surveyId,
        creativityMarks: r.totalCreativityMarks || 0,
        moralityMarks: r.totalMoralityMarks || 0,
        totalMarks: (r.totalCreativityMarks || 0) + (r.totalMoralityMarks || 0),
        submittedAt: r.submittedAt,
        answers: r.answers
      };
    });

    res.json({
      user,
      surveyResults,
      summary: {
        totalSurveys: responses.length,
        totalCreativityMarks: totalCreativity,
        totalMoralityMarks: totalMorality,
        totalMarks: totalCreativity + totalMorality,
        averageCreativity: responses.length > 0 ? Math.round(totalCreativity / responses.length) : 0,
        averageMorality: responses.length > 0 ? Math.round(totalMorality / responses.length) : 0
      }
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
