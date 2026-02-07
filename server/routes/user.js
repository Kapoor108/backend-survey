const router = require('express').Router();
const { auth, isUser } = require('../middleware/auth');
const SurveyAssignment = require('../models/SurveyAssignment');
const SurveyResponse = require('../models/SurveyResponse');
const Survey = require('../models/Survey');

router.use(auth, isUser);

// User Dashboard - Get assigned surveys
router.get('/dashboard', async (req, res) => {
  try {
    const assignments = await SurveyAssignment.find({ employeeId: req.user._id })
      .populate('surveyId')
      .sort({ assignedAt: -1 });

    const pending = assignments.filter(a => a.status === 'pending' || a.status === 'in_progress');
    const completed = assignments.filter(a => a.status === 'completed');

    res.json({
      pending: pending.map(a => ({
        assignmentId: a._id,
        survey: a.surveyId,
        dueDate: a.dueDate,
        status: a.status,
        daysLeft: a.dueDate ? Math.ceil((new Date(a.dueDate) - new Date()) / (1000 * 60 * 60 * 24)) : null
      })),
      completed: completed.map(a => ({
        assignmentId: a._id,
        survey: a.surveyId,
        completedAt: a.completedAt
      })),
      stats: {
        totalAssigned: assignments.length,
        completed: completed.length,
        pending: pending.length,
        completionRate: assignments.length > 0 ? Math.round((completed.length / assignments.length) * 100) : 0
      }
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get survey to fill
router.get('/surveys/:id', async (req, res) => {
  try {
    const assignment = await SurveyAssignment.findOne({ 
      surveyId: req.params.id, 
      employeeId: req.user._id 
    });

    if (!assignment) return res.status(404).json({ error: 'Survey not assigned to you' });

    const survey = await Survey.findById(req.params.id);
    const existingResponse = await SurveyResponse.findOne({ 
      surveyId: req.params.id, 
      employeeId: req.user._id 
    });

    res.json({ 
      survey, 
      assignment,
      draft: existingResponse?.isDraft ? existingResponse : null 
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Save draft
router.post('/surveys/:id/draft', async (req, res) => {
  try {
    const { answers } = req.body;
    
    // Format answers for draft (no marks calculation yet)
    const formattedAnswers = answers.map(a => ({
      questionId: a.questionId,
      creativityOptionIndex: a.creativityOptionIndex,
      moralityOptionIndex: a.moralityOptionIndex
    }));
    
    const response = await SurveyResponse.findOneAndUpdate(
      { surveyId: req.params.id, employeeId: req.user._id },
      {
        surveyId: req.params.id,
        employeeId: req.user._id,
        orgId: req.user.orgId,
        departmentId: req.user.departmentId,
        answers: formattedAnswers,
        isDraft: true
      },
      { upsert: true, new: true }
    );

    await SurveyAssignment.findOneAndUpdate(
      { surveyId: req.params.id, employeeId: req.user._id },
      { status: 'in_progress' }
    );

    res.json({ response, message: 'Draft saved' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Submit survey
router.post('/surveys/:id/submit', async (req, res) => {
  try {
    const { answers } = req.body;
    
    // Get survey to calculate marks
    const survey = await Survey.findById(req.params.id);
    if (!survey) return res.status(404).json({ error: 'Survey not found' });
    
    // Initialize totals for Present and Future aspects
    let presentCreativityTotal = 0;
    let presentMoralityTotal = 0;
    let futureCreativityTotal = 0;
    let futureMoralityTotal = 0;
    
    // Calculate marks for each answer
    const formattedAnswers = answers.map(a => {
      const question = survey.questions.find(q => q._id.toString() === a.questionId);
      let presentCreativityMarks = 0;
      let presentMoralityMarks = 0;
      let futureCreativityMarks = 0;
      let futureMoralityMarks = 0;
      
      if (question) {
        // Present Aspect - user selected ONE option with BOTH marks
        if (a.presentOptionIndex !== undefined && question.presentOptions && question.presentOptions[a.presentOptionIndex]) {
          const presentOpt = question.presentOptions[a.presentOptionIndex];
          presentCreativityMarks = presentOpt.creativityMarks || 0;
          presentMoralityMarks = presentOpt.moralityMarks || 0;
        }
        // Future Aspect - user selected ONE option with BOTH marks
        if (a.futureOptionIndex !== undefined && question.futureOptions && question.futureOptions[a.futureOptionIndex]) {
          const futureOpt = question.futureOptions[a.futureOptionIndex];
          futureCreativityMarks = futureOpt.creativityMarks || 0;
          futureMoralityMarks = futureOpt.moralityMarks || 0;
        }
      }
      
      presentCreativityTotal += presentCreativityMarks;
      presentMoralityTotal += presentMoralityMarks;
      futureCreativityTotal += futureCreativityMarks;
      futureMoralityTotal += futureMoralityMarks;
      
      return {
        questionId: a.questionId,
        questionNumber: question?.questionNumber || '',
        presentOptionIndex: a.presentOptionIndex,
        presentCreativityMarks,
        presentMoralityMarks,
        futureOptionIndex: a.futureOptionIndex,
        futureCreativityMarks,
        futureMoralityMarks
      };
    });
    
    // Calculate percentages and bands
    const maxScore = survey.questions.length * 5;
    
    const presentCreativityPercentage = ((presentCreativityTotal / maxScore) * 100).toFixed(1);
    const presentMoralityPercentage = ((presentMoralityTotal / maxScore) * 100).toFixed(1);
    const futureCreativityPercentage = ((futureCreativityTotal / maxScore) * 100).toFixed(1);
    const futureMoralityPercentage = ((futureMoralityTotal / maxScore) * 100).toFixed(1);
    
    const getBand = (percentage) => {
      if (percentage < 40) return 'Early';
      if (percentage < 50) return 'Emerging';
      return 'Leading';
    };
    
    const response = await SurveyResponse.findOneAndUpdate(
      { surveyId: req.params.id, employeeId: req.user._id },
      {
        surveyId: req.params.id,
        employeeId: req.user._id,
        orgId: req.user.orgId,
        departmentId: req.user.departmentId,
        answers: formattedAnswers,
        // Present Aspect
        presentCreativityTotal,
        presentMoralityTotal,
        presentCreativityPercentage: parseFloat(presentCreativityPercentage),
        presentMoralityPercentage: parseFloat(presentMoralityPercentage),
        presentCreativityBand: getBand(parseFloat(presentCreativityPercentage)),
        presentMoralityBand: getBand(parseFloat(presentMoralityPercentage)),
        // Future Aspect
        futureCreativityTotal,
        futureMoralityTotal,
        futureCreativityPercentage: parseFloat(futureCreativityPercentage),
        futureMoralityPercentage: parseFloat(futureMoralityPercentage),
        futureCreativityBand: getBand(parseFloat(futureCreativityPercentage)),
        futureMoralityBand: getBand(parseFloat(futureMoralityPercentage)),
        isDraft: false,
        submittedAt: new Date()
      },
      { upsert: true, new: true }
    );

    await SurveyAssignment.findOneAndUpdate(
      { surveyId: req.params.id, employeeId: req.user._id },
      { status: 'completed', completedAt: new Date() }
    );

    // Don't return marks to user - only return success message
    res.json({ message: 'Survey submitted successfully' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get survey history - NO marks shown to user
router.get('/history', async (req, res) => {
  try {
    const responses = await SurveyResponse.find({ employeeId: req.user._id, isDraft: false })
      .populate('surveyId', 'title description')
      .sort({ submittedAt: -1 });
    
    // Return only non-sensitive data (no marks)
    const sanitizedResponses = responses.map(r => ({
      id: r._id,
      survey: r.surveyId,
      submittedAt: r.submittedAt
    }));
    
    res.json(sanitizedResponses);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
