const router = require('express').Router();
const { auth } = require('../middleware/auth');
const Survey = require('../models/Survey');

router.use(auth);

// Get survey templates (for CEO to use)
router.get('/templates', async (req, res) => {
  try {
    const templates = await Survey.find({ isTemplate: true });
    res.json(templates);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Clone template to org
router.post('/templates/:id/clone', async (req, res) => {
  try {
    if (req.user.role !== 'ceo' && req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Access denied' });
    }

    const template = await Survey.findById(req.params.id);
    if (!template) return res.status(404).json({ error: 'Template not found' });

    const survey = await Survey.create({
      title: template.title,
      description: template.description,
      questions: template.questions,
      orgId: req.user.orgId,
      createdBy: req.user._id,
      isTemplate: false,
      status: 'draft'
    });

    res.status(201).json(survey);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
