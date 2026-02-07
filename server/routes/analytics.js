const router = require('express').Router();
const { auth, isAdmin, isCEO } = require('../middleware/auth');
const Organization = require('../models/Organization');
const Employee = require('../models/Employee');
const Survey = require('../models/Survey');
const SurveyAssignment = require('../models/SurveyAssignment');
const SurveyResponse = require('../models/SurveyResponse');
const Department = require('../models/Department');

router.use(auth);

// Admin: Global analytics
router.get('/global', isAdmin, async (req, res) => {
  try {
    const orgs = await Organization.find();
    const globalStats = {
      totalOrganizations: orgs.length,
      totalEmployees: await Employee.countDocuments(),
      totalSurveys: await Survey.countDocuments({ isTemplate: false }),
      totalResponses: await SurveyResponse.countDocuments({ isDraft: false }),
      avgCompletionRate: 0
    };

    const assignments = await SurveyAssignment.countDocuments();
    const completed = await SurveyAssignment.countDocuments({ status: 'completed' });
    globalStats.avgCompletionRate = assignments > 0 ? Math.round((completed / assignments) * 100) : 0;

    // Org-wise breakdown
    const orgBreakdown = await Promise.all(orgs.map(async (org) => {
      const empCount = await Employee.countDocuments({ orgId: org._id });
      const surveyCount = await Survey.countDocuments({ orgId: org._id });
      const assignCount = await SurveyAssignment.countDocuments({ orgId: org._id });
      const compCount = await SurveyAssignment.countDocuments({ orgId: org._id, status: 'completed' });
      
      return {
        orgId: org._id,
        name: org.name,
        employees: empCount,
        surveys: surveyCount,
        completionRate: assignCount > 0 ? Math.round((compCount / assignCount) * 100) : 0
      };
    }));

    res.json({ globalStats, orgBreakdown });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// CEO: Organization analytics
router.get('/organization', isCEO, async (req, res) => {
  try {
    const orgId = req.user.orgId;
    
    const departments = await Department.find({ orgId });
    const surveys = await Survey.find({ orgId });
    
    // Department-wise stats
    const deptStats = await Promise.all(departments.map(async (dept) => {
      const empCount = await Employee.countDocuments({ departmentId: dept._id });
      const assignCount = await SurveyAssignment.countDocuments({ departmentId: dept._id });
      const compCount = await SurveyAssignment.countDocuments({ departmentId: dept._id, status: 'completed' });
      
      return {
        deptId: dept._id,
        name: dept.name,
        employees: empCount,
        assigned: assignCount,
        completed: compCount,
        completionRate: assignCount > 0 ? Math.round((compCount / assignCount) * 100) : 0
      };
    }));

    // Survey-wise stats
    const surveyStats = await Promise.all(surveys.map(async (survey) => {
      const assignCount = await SurveyAssignment.countDocuments({ surveyId: survey._id });
      const compCount = await SurveyAssignment.countDocuments({ surveyId: survey._id, status: 'completed' });
      
      return {
        surveyId: survey._id,
        title: survey.title,
        assigned: assignCount,
        completed: compCount,
        completionRate: assignCount > 0 ? Math.round((compCount / assignCount) * 100) : 0
      };
    }));

    // Time-based completion trend (last 7 days)
    const trend = [];
    for (let i = 6; i >= 0; i--) {
      const date = new Date();
      date.setDate(date.getDate() - i);
      date.setHours(0, 0, 0, 0);
      const nextDate = new Date(date);
      nextDate.setDate(nextDate.getDate() + 1);
      
      const count = await SurveyResponse.countDocuments({
        orgId,
        isDraft: false,
        submittedAt: { $gte: date, $lt: nextDate }
      });
      
      trend.push({ date: date.toISOString().split('T')[0], count });
    }

    res.json({ departmentStats: deptStats, surveyStats, completionTrend: trend });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
