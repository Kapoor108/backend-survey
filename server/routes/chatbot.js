const express = require('express');
const router = express.Router();
const { GoogleGenerativeAI } = require('@google/generative-ai');

// Initialize Gemini AI
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

// System prompt with platform knowledge
const SYSTEM_CONTEXT = `You are CXO Survey Assistant, a helpful AI chatbot for the CXO Survey Platform. 

PLATFORM OVERVIEW:
CXO Survey is an enterprise survey management platform designed for organizations to assess creativity and morality aspects across their workforce.

KEY FEATURES:
1. **Role-Based Access**: Three user roles - Admin, CEO, and Employee
2. **Survey Templates**: Admins create reusable survey templates with questions
3. **Survey Structure**: Each question has Present Aspect and Future Aspect options
4. **Scoring System**: Options contain hidden creativity and morality marks
5. **Department Management**: CEOs can organize employees into departments
6. **Survey Assignment**: CEOs assign surveys to employees or departments
7. **Analytics & Reports**: Comprehensive reporting with performance bands (Early, Emerging, Leading)
8. **Support System**: Built-in ticketing system for user support

USER ROLES:
- **Admin**: Creates organizations, invites CEOs, manages survey templates, views all reports
- **CEO**: Manages departments, invites employees, creates and assigns surveys, views organization analytics
- **Employee/User**: Completes assigned surveys, views personal dashboard, tracks survey progress

SURVEY WORKFLOW:
1. Admin creates survey templates with questions
2. Each question has Present and Future options with creativity/morality marks
3. CEO assigns surveys to employees
4. Employees receive email notifications
5. Employees complete surveys (can save drafts)
6. System calculates scores and performance bands
7. Reports generated with insights and recommendations

SCORING BANDS:
- Early: 0-59% (Needs significant improvement)
- Emerging: 60-79% (Developing capabilities)
- Leading: 80-100% (Excellent performance)

AUTHENTICATION:
- OTP-based email login
- Google OAuth integration
- Invite-only registration system

SUPPORT:
- Help & Support page with FAQs
- Ticket system for issues
- Email notifications for updates

Be friendly, concise, and helpful. If users ask about features not mentioned here, politely say you'll help them contact support for more specific information.`;

// Chat endpoint
router.post('/chat', async (req, res) => {
  try {
    const { message, conversationHistory = [] } = req.body;

    if (!message || !message.trim()) {
      return res.status(400).json({ error: 'Message is required' });
    }

    if (!process.env.GEMINI_API_KEY || process.env.GEMINI_API_KEY === 'your_gemini_api_key_here') {
      return res.status(503).json({ 
        error: 'AI service not configured. Please add GEMINI_API_KEY to environment variables.' 
      });
    }

    // Initialize the model (using latest model name)
    const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });

    // Build conversation context
    let prompt = SYSTEM_CONTEXT + '\n\n';
    
    // Add conversation history (last 5 messages for context)
    const recentHistory = conversationHistory.slice(-5);
    recentHistory.forEach(msg => {
      prompt += `${msg.role === 'user' ? 'User' : 'Assistant'}: ${msg.content}\n`;
    });
    
    prompt += `User: ${message}\nAssistant:`;

    // Generate response
    const result = await model.generateContent(prompt);
    const response = await result.response;
    const text = response.text();

    res.json({ 
      reply: text,
      timestamp: new Date()
    });

  } catch (error) {
    console.error('Chatbot error:', error);
    
    if (error.message?.includes('API key')) {
      return res.status(503).json({ 
        error: 'AI service configuration error. Please check API key.' 
      });
    }
    
    res.status(500).json({ 
      error: 'Failed to generate response. Please try again.',
      details: error.message 
    });
  }
});

// Quick replies endpoint
router.get('/quick-replies', (req, res) => {
  res.json({
    replies: [
      { id: 1, text: 'How do I complete a survey?', icon: '📝' },
      { id: 2, text: 'What are the user roles?', icon: '👥' },
      { id: 3, text: 'How does scoring work?', icon: '📊' },
      { id: 4, text: 'How to invite employees?', icon: '✉️' },
      { id: 5, text: 'What are performance bands?', icon: '🎯' },
      { id: 6, text: 'How to create surveys?', icon: '📋' }
    ]
  });
});

module.exports = router;
