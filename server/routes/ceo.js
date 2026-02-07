const router = require('express').Router();
const { v4: uuidv4 } = require('uuid');
const xlsx = require('xlsx');
const { auth, isCEO } = require('../middleware/auth');
const Employee = require('../models/Employee');
const Department = require('../models/Department');
const Survey = require('../models/Survey');
const SurveyAssignment = require('../models/SurveyAssignment');
const SurveyResponse = require('../models/SurveyResponse');
const InviteLog = require('../models/InviteLog');
const { sendUserInviteEmail, sendSurveyNotification } = require('../config/email');

router.use(auth, isCEO);

// CEO Dashboard
router.get('/dashboard', async (req, res) => {
  try {
    const orgId = req.user.orgId;

    const departments = await Department.find({ orgId });
    const employees = await Employee.countDocuments({ orgId, role: 'user', inviteStatus: 'accepted' });
    const pendingInvites = await Employee.countDocuments({ orgId, role: 'user', inviteStatus: 'pending' });
    const surveys = await Survey.find({ orgId });
    const assignments = await SurveyAssignment.find({ orgId });
    const completed = assignments.filter(a => a.status === 'completed').length;

    // Department-wise completion
    const deptStats = await Promise.all(departments.map(async (dept) => {
      const deptAssignments = await SurveyAssignment.countDocuments({ departmentId: dept._id });
      const deptCompleted = await SurveyAssignment.countDocuments({ departmentId: dept._id, status: 'completed' });
      const deptEmployees = await Employee.countDocuments({ departmentId: dept._id, inviteStatus: 'accepted' });
      return {
        id: dept._id,
        name: dept.name,
        employees: deptEmployees,
        total: deptAssignments,
        completed: deptCompleted,
        rate: deptAssignments > 0 ? Math.round((deptCompleted / deptAssignments) * 100) : 0
      };
    }));

    res.json({
      stats: {
        totalEmployees: employees,
        pendingInvites,
        totalDepartments: departments.length,
        totalSurveys: surveys.length,
        completionRate: assignments.length > 0 ? Math.round((completed / assignments.length) * 100) : 0
      },
      departmentStats: deptStats,
      recentSurveys: surveys.slice(-5)
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ============ DEPARTMENTS ============

router.post('/departments', async (req, res) => {
  try {
    const { name } = req.body;
    const dept = await Department.create({
      name,
      orgId: req.user.orgId
    });
    res.status(201).json(dept);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/departments', async (req, res) => {
  try {
    const departments = await Department.find({ orgId: req.user.orgId });
    
    // Add employee count to each department (all employees, not just accepted)
    const deptsWithCount = await Promise.all(departments.map(async (dept) => {
      const totalCount = await Employee.countDocuments({ 
        departmentId: dept._id,
        role: 'user'
      });
      const activeCount = await Employee.countDocuments({ 
        departmentId: dept._id, 
        role: 'user',
        inviteStatus: 'accepted' 
      });
      const pendingCount = await Employee.countDocuments({ 
        departmentId: dept._id, 
        role: 'user',
        inviteStatus: 'pending' 
      });
      return { 
        ...dept.toObject(), 
        employeeCount: totalCount,
        activeCount,
        pendingCount
      };
    }));
    
    res.json(deptsWithCount);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get employees by department
router.get('/departments/:id/employees', async (req, res) => {
  try {
    const dept = await Department.findOne({ _id: req.params.id, orgId: req.user.orgId });
    if (!dept) return res.status(404).json({ error: 'Department not found' });
    
    const employees = await Employee.find({ 
      departmentId: req.params.id, 
      role: 'user'
    }).select('name email departmentId inviteStatus').populate('departmentId', 'name');
    
    res.json({ department: dept, employees });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ============ EMPLOYEE INVITES ============

// Invite single employee
router.post('/invite', async (req, res) => {
  try {
    const { email, name, departmentId } = req.body;
    const orgId = req.user.orgId;

    // Check if email already has an account
    const existingUser = await Employee.findOne({ email, inviteStatus: 'accepted' });
    if (existingUser) {
      return res.status(400).json({ error: 'This email already has an account' });
    }

    // Check if there's a pending invite
    const existingInvite = await InviteLog.findOne({ email, status: 'sent' });
    if (existingInvite) {
      return res.status(400).json({ error: 'An invitation is already pending for this email' });
    }

    // Get department and org names for email
    const department = departmentId ? await Department.findById(departmentId) : null;
    const org = await require('../models/Organization').findById(orgId);

    const inviteToken = uuidv4();

    // Create employee placeholder
    const employee = await Employee.create({
      name: name || 'Employee',
      email,
      role: 'user', // LOCKED
      orgId, // LOCKED
      departmentId, // LOCKED
      inviteToken,
      inviteStatus: 'pending'
    });

    // Create invite log
    await InviteLog.create({
      email,
      orgId,
      departmentId,
      invitedBy: req.user._id,
      role: 'user',
      token: inviteToken
    });

    // Send invite email
    await sendUserInviteEmail(email, inviteToken, org.name, department?.name);

    res.status(201).json({
      employee,
      message: `Invitation sent to ${email}`
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Batch invite via Excel data
router.post('/invite/batch', async (req, res) => {
  try {
    const { employees } = req.body; // Array of { name, email, departmentId }
    
    if (!employees || !Array.isArray(employees) || employees.length === 0) {
      return res.status(400).json({ error: 'No employees provided' });
    }

    const orgId = req.user.orgId;
    const org = await require('../models/Organization').findById(orgId);
    
    if (!org) {
      return res.status(404).json({ error: 'Organization not found' });
    }

    const results = [];
    let invitedCount = 0;
    let skippedCount = 0;
    let failedCount = 0;

    for (const emp of employees) {
      try {
        // Validate email
        if (!emp.email || !emp.email.match(/^[^\s@]+@[^\s@]+\.[^\s@]+$/)) {
          results.push({ 
            email: emp.email || 'invalid', 
            status: 'failed', 
            reason: 'Invalid email format' 
          });
          failedCount++;
          continue;
        }

        // Skip if already exists or has pending invite
        const existingUser = await Employee.findOne({ 
          email: emp.email.toLowerCase(), 
          inviteStatus: 'accepted' 
        });
        
        if (existingUser) {
          results.push({ 
            email: emp.email, 
            status: 'skipped', 
            reason: 'User already has an active account' 
          });
          skippedCount++;
          continue;
        }

        const existingInvite = await InviteLog.findOne({ 
          email: emp.email.toLowerCase(), 
          status: 'sent' 
        });
        
        if (existingInvite) {
          results.push({ 
            email: emp.email, 
            status: 'skipped', 
            reason: 'Invitation already pending' 
          });
          skippedCount++;
          continue;
        }

        // Get department info
        const department = emp.departmentId ? await Department.findById(emp.departmentId) : null;
        const inviteToken = uuidv4();

        // Create employee record
        await Employee.create({
          name: emp.name || 'Employee',
          email: emp.email.toLowerCase(),
          role: 'user',
          orgId,
          departmentId: emp.departmentId,
          inviteToken,
          inviteStatus: 'pending'
        });

        // Create invite log
        await InviteLog.create({
          email: emp.email.toLowerCase(),
          orgId,
          departmentId: emp.departmentId,
          invitedBy: req.user._id,
          role: 'user',
          token: inviteToken
        });

        // Send invitation email
        await sendUserInviteEmail(
          emp.email.toLowerCase(), 
          inviteToken, 
          org.name, 
          department?.name
        );

        results.push({ 
          email: emp.email, 
          status: 'invited',
          name: emp.name,
          department: department?.name || 'N/A'
        });
        invitedCount++;
      } catch (err) {
        console.error(`Failed to invite ${emp.email}:`, err);
        results.push({ 
          email: emp.email, 
          status: 'failed', 
          reason: err.message 
        });
        failedCount++;
      }
    }

    res.json({ 
      results, 
      summary: {
        total: employees.length,
        invited: invitedCount,
        skipped: skippedCount,
        failed: failedCount
      },
      message: `Successfully invited ${invitedCount} employee(s). ${skippedCount} skipped, ${failedCount} failed.`
    });
  } catch (err) {
    console.error('Batch invite error:', err);
    res.status(500).json({ error: err.message });
  }
});

// Resend invite
router.post('/invite/:id/resend', async (req, res) => {
  try {
    const employee = await Employee.findOne({ 
      _id: req.params.id, 
      orgId: req.user.orgId,
      inviteStatus: 'pending'
    });

    if (!employee) {
      return res.status(404).json({ error: 'Employee not found or already accepted' });
    }

    const org = await require('../models/Organization').findById(req.user.orgId);
    const department = employee.departmentId ? await Department.findById(employee.departmentId) : null;
    const inviteToken = uuidv4();

    // Update employee
    employee.inviteToken = inviteToken;
    await employee.save();

    // Update invite log
    await InviteLog.findOneAndUpdate(
      { email: employee.email, status: 'sent' },
      {
        token: inviteToken,
        sentAt: new Date(),
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
      }
    );

    await sendUserInviteEmail(employee.email, inviteToken, org.name, department?.name);

    res.json({ message: 'Invitation resent successfully' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get all employees
router.get('/employees', async (req, res) => {
  try {
    const employees = await Employee.find({ orgId: req.user.orgId, role: 'user' })
      .populate('departmentId', 'name')
      .sort({ createdAt: -1 });
    res.json(employees);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Delete employee
router.delete('/employees/:id', async (req, res) => {
  try {
    const employee = await Employee.findOne({ 
      _id: req.params.id, 
      orgId: req.user.orgId,
      role: 'user'
    });

    if (!employee) {
      return res.status(404).json({ error: 'Employee not found' });
    }

    // Delete all related data
    await SurveyAssignment.deleteMany({ employeeId: req.params.id });
    await SurveyResponse.deleteMany({ employeeId: req.params.id });
    await InviteLog.deleteMany({ email: employee.email });
    await Employee.findByIdAndDelete(req.params.id);

    res.json({ message: 'Employee deleted successfully' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ============ SURVEYS ============

// Get all survey templates (created by admin)
router.get('/surveys/templates', async (req, res) => {
  try {
    const templates = await Survey.find({ isTemplate: true })
      .populate('createdBy', 'name')
      .sort({ createdAt: -1 });
    res.json(templates);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Create survey from template
router.post('/surveys/from-template', async (req, res) => {
  try {
    const { templateId, dueDate } = req.body;
    
    const template = await Survey.findOne({ _id: templateId, isTemplate: true });
    if (!template) return res.status(404).json({ error: 'Template not found' });
    
    // Create a new survey for this org based on template
    const survey = await Survey.create({
      title: template.title,
      description: template.description,
      questions: template.questions,
      orgId: req.user.orgId,
      createdBy: req.user._id,
      dueDate,
      status: 'draft',
      isTemplate: false
    });
    
    res.status(201).json(survey);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/surveys', async (req, res) => {
  try {
    const { title, description, questions, dueDate } = req.body;
    const survey = await Survey.create({
      title,
      description,
      questions,
      orgId: req.user.orgId,
      createdBy: req.user._id,
      dueDate,
      status: 'draft'
    });
    res.status(201).json(survey);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/surveys', async (req, res) => {
  try {
    const surveys = await Survey.find({ orgId: req.user.orgId, isTemplate: { $ne: true } })
      .populate('createdBy', 'name')
      .sort({ createdAt: -1 });
    
    // Get assigned departments for each survey
    const surveysWithDepts = await Promise.all(surveys.map(async (survey) => {
      const assignments = await SurveyAssignment.find({ surveyId: survey._id })
        .populate('departmentId', 'name');
      
      // Get unique departments
      const deptMap = new Map();
      assignments.forEach(a => {
        if (a.departmentId && !deptMap.has(a.departmentId._id.toString())) {
          deptMap.set(a.departmentId._id.toString(), a.departmentId.name);
        }
      });
      
      const assignedDepartments = Array.from(deptMap.entries()).map(([id, name]) => ({ _id: id, name }));
      const totalAssigned = assignments.length;
      const completed = assignments.filter(a => a.status === 'completed').length;
      
      return {
        ...survey.toObject(),
        assignedDepartments,
        totalAssigned,
        completedCount: completed
      };
    }));
    
    res.json(surveysWithDepts);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Delete survey
router.delete('/surveys/:id', async (req, res) => {
  try {
    const survey = await Survey.findOne({ _id: req.params.id, orgId: req.user.orgId, isTemplate: { $ne: true } });
    if (!survey) return res.status(404).json({ error: 'Survey not found' });
    
    // Delete all related assignments and responses
    await SurveyAssignment.deleteMany({ surveyId: req.params.id });
    await SurveyResponse.deleteMany({ surveyId: req.params.id });
    await Survey.findByIdAndDelete(req.params.id);
    
    res.json({ message: 'Survey deleted successfully' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Assign survey to departments
router.post('/surveys/:id/assign', async (req, res) => {
  try {
    const { departmentIds } = req.body;
    const survey = await Survey.findOne({ _id: req.params.id, orgId: req.user.orgId });

    if (!survey) return res.status(404).json({ error: 'Survey not found' });

    const assignments = [];
    const skipped = [];

    for (const deptId of departmentIds) {
      // Get ALL employees in department (both accepted and pending)
      const employees = await Employee.find({
        departmentId: deptId,
        role: 'user'
      });

      for (const emp of employees) {
        // Check if already assigned
        const existing = await SurveyAssignment.findOne({
          surveyId: survey._id,
          employeeId: emp._id
        });

        if (!existing) {
          const assignment = await SurveyAssignment.create({
            surveyId: survey._id,
            orgId: req.user.orgId,
            departmentId: deptId,
            employeeId: emp._id,
            dueDate: survey.dueDate
          });
          assignments.push(assignment);

          // Send notification only to accepted employees
          if (emp.inviteStatus === 'accepted') {
            try {
              await sendSurveyNotification(emp.email, survey.title, survey.dueDate);
            } catch (emailErr) {
              console.error('Failed to send survey notification:', emailErr);
            }
          }
        } else {
          skipped.push(emp.email);
        }
      }
    }

    survey.status = 'active';
    await survey.save();

    res.json({
      assignments,
      skipped,
      message: `Survey assigned to ${assignments.length} employees`
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Sync survey assignments - assigns active surveys to any users who might have been missed
router.post('/surveys/sync-assignments', async (req, res) => {
  try {
    const orgId = req.user.orgId;
    let newAssignments = 0;
    
    // Get all active surveys for this org
    const activeSurveys = await Survey.find({ orgId, status: 'active' });
    
    for (const survey of activeSurveys) {
      // Get departments this survey is assigned to
      const existingDeptAssignments = await SurveyAssignment.find({ surveyId: survey._id }).distinct('departmentId');
      
      for (const deptId of existingDeptAssignments) {
        // Get all users in this department
        const employees = await Employee.find({
          departmentId: deptId,
          orgId,
          role: 'user'
        });
        
        for (const emp of employees) {
          // Check if already assigned
          const existing = await SurveyAssignment.findOne({
            surveyId: survey._id,
            employeeId: emp._id
          });
          
          if (!existing) {
            await SurveyAssignment.create({
              surveyId: survey._id,
              orgId,
              departmentId: deptId,
              employeeId: emp._id,
              dueDate: survey.dueDate
            });
            newAssignments++;
          }
        }
      }
    }
    
    res.json({ message: `Synced ${newAssignments} new survey assignments` });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get survey analytics
router.get('/surveys/:id/analytics', async (req, res) => {
  try {
    const survey = await Survey.findOne({ _id: req.params.id, orgId: req.user.orgId });
    if (!survey) return res.status(404).json({ error: 'Survey not found' });

    const assignments = await SurveyAssignment.find({ surveyId: req.params.id })
      .populate('employeeId', 'name email')
      .populate('departmentId', 'name');
    const responses = await SurveyResponse.find({ surveyId: req.params.id, isDraft: false });

    const completedCount = assignments.filter(a => a.status === 'completed').length;

    const analytics = {
      survey: { title: survey.title, description: survey.description },
      totalAssigned: assignments.length,
      completed: completedCount,
      pending: assignments.length - completedCount,
      completionRate: assignments.length > 0 ? Math.round((completedCount / assignments.length) * 100) : 0,
      byDepartment: {},
      questionAnalytics: [],
      // Employee completion list (NO marks shown to CEO)
      employees: assignments.map(a => {
        const response = responses.find(r => r.employeeId?.toString() === a.employeeId?._id?.toString());
        return {
          id: a.employeeId?._id,
          name: a.employeeId?.name || 'Unknown',
          email: a.employeeId?.email || '',
          department: a.departmentId?.name || 'Unknown',
          status: a.status,
          completedAt: a.completedAt || (response?.submittedAt) || null
        };
      })
    };

    // Department breakdown
    assignments.forEach(a => {
      const deptName = a.departmentId?.name || 'Unknown';
      if (!analytics.byDepartment[deptName]) {
        analytics.byDepartment[deptName] = { total: 0, completed: 0 };
      }
      analytics.byDepartment[deptName].total++;
      if (a.status === 'completed') analytics.byDepartment[deptName].completed++;
    });

    // Question analytics
    survey.questions.forEach((q) => {
      const qAnalytics = { question: q.question, type: q.type };

      if (q.type === 'rating') {
        const ratings = responses
          .map(r => r.answers.find(a => a.questionId.toString() === q._id.toString())?.answer)
          .filter(a => a !== undefined && a !== null);
        qAnalytics.average = ratings.length > 0 
          ? (ratings.reduce((a, b) => Number(a) + Number(b), 0) / ratings.length).toFixed(2) 
          : 0;
        qAnalytics.distribution = [1, 2, 3, 4, 5].map(r => ratings.filter(x => Number(x) === r).length);
      } else if (q.type === 'mcq') {
        qAnalytics.distribution = q.options.map(opt => ({
          option: opt,
          count: responses.filter(r => 
            r.answers.find(a => a.questionId.toString() === q._id.toString())?.answer === opt
          ).length
        }));
      }

      analytics.questionAnalytics.push(qAnalytics);
    });

    res.json(analytics);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
