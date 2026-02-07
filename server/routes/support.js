const express = require('express');
const router = express.Router();
const SupportTicket = require('../models/SupportTicket');
const { auth } = require('../middleware/auth');

// Create a new support ticket (User/CEO)
router.post('/tickets', auth, async (req, res) => {
  try {
    const { subject, category, priority, message } = req.body;
    
    console.log('Creating ticket:', { subject, category, priority, message, user: req.user });
    
    if (!subject || !message) {
      return res.status(400).json({ error: 'Subject and message are required' });
    }

    // Ensure user has orgId if they're not admin
    const orgId = req.user.role === 'admin' ? null : req.user.orgId;

    const ticket = new SupportTicket({
      subject,
      category: category || 'other',
      priority: priority || 'medium',
      createdBy: req.user._id,
      createdByRole: req.user.role,
      orgId: orgId,
      messages: [{
        sender: req.user._id,
        senderRole: req.user.role,
        message
      }]
    });

    await ticket.save();
    await ticket.populate('createdBy', 'name email');
    
    console.log('Ticket created successfully:', ticket._id);
    res.json(ticket);
  } catch (error) {
    console.error('Create ticket error:', error);
    res.status(500).json({ error: error.message || 'Failed to create ticket' });
  }
});

// Get user's tickets (User/CEO)
router.get('/tickets', auth, async (req, res) => {
  try {
    const query = req.user.role === 'admin' 
      ? {} 
      : { createdBy: req.user._id };

    const tickets = await SupportTicket.find(query)
      .populate('createdBy', 'name email')
      .populate('assignedTo', 'name email')
      .sort({ updatedAt: -1 });

    res.json(tickets);
  } catch (error) {
    console.error('Get tickets error:', error);
    res.status(500).json({ error: 'Failed to fetch tickets' });
  }
});

// Get single ticket details
router.get('/tickets/:id', auth, async (req, res) => {
  try {
    const ticket = await SupportTicket.findById(req.params.id)
      .populate('createdBy', 'name email role')
      .populate('assignedTo', 'name email')
      .populate('messages.sender', 'name email role');

    if (!ticket) {
      return res.status(404).json({ error: 'Ticket not found' });
    }

    // Check access
    if (req.user.role !== 'admin' && ticket.createdBy._id.toString() !== req.user._id.toString()) {
      return res.status(403).json({ error: 'Access denied' });
    }

    res.json(ticket);
  } catch (error) {
    console.error('Get ticket error:', error);
    res.status(500).json({ error: 'Failed to fetch ticket' });
  }
});

// Add message to ticket
router.post('/tickets/:id/messages', auth, async (req, res) => {
  try {
    const { message } = req.body;
    
    if (!message) {
      return res.status(400).json({ error: 'Message is required' });
    }

    const ticket = await SupportTicket.findById(req.params.id);
    
    if (!ticket) {
      return res.status(404).json({ error: 'Ticket not found' });
    }

    // Check access
    if (req.user.role !== 'admin' && ticket.createdBy.toString() !== req.user._id.toString()) {
      return res.status(403).json({ error: 'Access denied' });
    }

    ticket.messages.push({
      sender: req.user._id,
      senderRole: req.user.role,
      message
    });

    // Update status if admin replies
    if (req.user.role === 'admin' && ticket.status === 'open') {
      ticket.status = 'in-progress';
    }

    await ticket.save();
    await ticket.populate('messages.sender', 'name email role');

    res.json(ticket);
  } catch (error) {
    console.error('Add message error:', error);
    res.status(500).json({ error: 'Failed to add message' });
  }
});

// Admin: Get all tickets with stats
router.get('/admin/tickets', auth, async (req, res) => {
  try {
    if (req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Admin access required' });
    }

    const { status, priority } = req.query;
    const query = {};
    
    if (status) query.status = status;
    if (priority) query.priority = priority;

    const tickets = await SupportTicket.find(query)
      .populate('createdBy', 'name email role')
      .populate('orgId', 'name')
      .populate('assignedTo', 'name email')
      .sort({ updatedAt: -1 });

    // Get stats
    const stats = {
      total: await SupportTicket.countDocuments(),
      open: await SupportTicket.countDocuments({ status: 'open' }),
      inProgress: await SupportTicket.countDocuments({ status: 'in-progress' }),
      resolved: await SupportTicket.countDocuments({ status: 'resolved' }),
      closed: await SupportTicket.countDocuments({ status: 'closed' }),
      urgent: await SupportTicket.countDocuments({ priority: 'urgent', status: { $in: ['open', 'in-progress'] } }),
      byCategory: await SupportTicket.aggregate([
        { $group: { _id: '$category', count: { $sum: 1 } } }
      ]),
      byPriority: await SupportTicket.aggregate([
        { $group: { _id: '$priority', count: { $sum: 1 } } }
      ])
    };

    res.json({ tickets, stats });
  } catch (error) {
    console.error('Admin get tickets error:', error);
    res.status(500).json({ error: 'Failed to fetch tickets' });
  }
});

// Admin: Update ticket status/priority
router.patch('/admin/tickets/:id', auth, async (req, res) => {
  try {
    if (req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Admin access required' });
    }

    const { status, priority, assignedTo } = req.body;
    const ticket = await SupportTicket.findById(req.params.id);

    if (!ticket) {
      return res.status(404).json({ error: 'Ticket not found' });
    }

    if (status) ticket.status = status;
    if (priority) ticket.priority = priority;
    if (assignedTo !== undefined) ticket.assignedTo = assignedTo;
    
    if (status === 'resolved' || status === 'closed') {
      ticket.resolvedAt = new Date();
    }

    await ticket.save();
    await ticket.populate('createdBy', 'name email role');
    await ticket.populate('assignedTo', 'name email');

    res.json(ticket);
  } catch (error) {
    console.error('Update ticket error:', error);
    res.status(500).json({ error: 'Failed to update ticket' });
  }
});

module.exports = router;
