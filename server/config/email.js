const nodemailer = require('nodemailer');

// Create transporter using environment variables
const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.EMAIL_USER || process.env.GMAIL_USER,
    pass: process.env.EMAIL_PASS || process.env.GMAIL_APP_PASSWORD
  }
});

// Verify transporter on startup
transporter.verify((error, success) => {
  if (error) {
    console.error('❌ Email configuration error:', error.message);
  } else {
    console.log('✓ Email server ready');
  }
});

// Generate 6-digit OTP
const generateOTP = () => {
  return Math.floor(100000 + Math.random() * 900000).toString();
};

// Send OTP Email
const sendOTPEmail = async (to, otp, type) => {
  const subjects = {
    login: 'Your Login OTP - Survey App',
    signup: 'Verify Your Email - Survey App',
    reset: 'Password Reset OTP - Survey App'
  };

  const messages = {
    login: 'Use this OTP to login to your account',
    signup: 'Use this OTP to verify your email and complete registration',
    reset: 'Use this OTP to reset your password'
  };

  const mailOptions = {
    from: `"Survey App" <${process.env.EMAIL_USER || process.env.GMAIL_USER}>`,
    to,
    subject: subjects[type],
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 500px; margin: 0 auto; padding: 20px;">
        <h2 style="color: #4F46E5; text-align: center;">Survey App</h2>
        <div style="background: #f3f4f6; padding: 30px; border-radius: 10px; text-align: center;">
          <p style="color: #374151; margin-bottom: 20px;">${messages[type]}</p>
          <div style="background: #4F46E5; color: white; font-size: 32px; letter-spacing: 8px; padding: 15px 30px; border-radius: 8px; display: inline-block; font-weight: bold;">
            ${otp}
          </div>
          <p style="color: #6b7280; margin-top: 20px; font-size: 14px;">This OTP expires in 10 minutes</p>
        </div>
        <p style="color: #9ca3af; font-size: 12px; text-align: center; margin-top: 20px;">
          If you didn't request this, please ignore this email.
        </p>
      </div>
    `
  };

  return transporter.sendMail(mailOptions);
};

// Send CEO Invite Email (from Admin)
const sendCEOInviteEmail = async (to, inviteToken, orgName) => {
  const signupUrl = `${process.env.FRONTEND_URL}/signup?token=${inviteToken}`;
  
  const mailOptions = {
    from: `"Survey App" <${process.env.EMAIL_USER || process.env.GMAIL_USER}>`,
    to,
    subject: `You're invited as CEO of ${orgName} - Survey App`,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
        <div style="text-align: center; margin-bottom: 30px;">
          <h1 style="color: #4F46E5; margin: 0;">Survey App</h1>
        </div>
        <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 40px; border-radius: 15px; text-align: center; color: white;">
          <h2 style="margin: 0 0 10px 0;">🎉 Congratulations!</h2>
          <p style="font-size: 18px; margin: 0;">You've been invited as <strong>CEO</strong> of</p>
          <h3 style="font-size: 28px; margin: 15px 0;">${orgName}</h3>
        </div>
        <div style="background: #f9fafb; padding: 30px; border-radius: 10px; margin-top: 20px;">
          <p style="color: #374151; font-size: 16px;">As CEO, you will be able to:</p>
          <ul style="color: #4b5563; line-height: 2;">
            <li>Manage departments in your organization</li>
            <li>Invite and manage employees</li>
            <li>Create and assign surveys</li>
            <li>View analytics and reports</li>
          </ul>
          <div style="text-align: center; margin-top: 30px;">
            <a href="${signupUrl}" style="background: #4F46E5; color: white; padding: 15px 40px; text-decoration: none; border-radius: 8px; display: inline-block; font-size: 16px; font-weight: bold;">
              Accept Invitation & Sign Up
            </a>
          </div>
          <p style="color: #6b7280; font-size: 14px; text-align: center; margin-top: 20px;">
            Or copy this link: <br/>
            <span style="color: #4F46E5; word-break: break-all;">${signupUrl}</span>
          </p>
        </div>
        <p style="color: #9ca3af; font-size: 12px; text-align: center; margin-top: 20px;">
          This invitation expires in 7 days. If you didn't expect this, please ignore this email.
        </p>
      </div>
    `
  };

  console.log('Sending CEO invite email to:', to);
  return transporter.sendMail(mailOptions);
};

// Send User Invite Email (from CEO)
const sendUserInviteEmail = async (to, inviteToken, orgName, departmentName) => {
  const signupUrl = `${process.env.FRONTEND_URL}/signup?token=${inviteToken}`;
  
  const mailOptions = {
    from: `"Survey App" <${process.env.EMAIL_USER || process.env.GMAIL_USER}>`,
    to,
    subject: `You're invited to join ${orgName} - Survey App`,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
        <div style="text-align: center; margin-bottom: 30px;">
          <h1 style="color: #4F46E5; margin: 0;">Survey App</h1>
        </div>
        <div style="background: linear-gradient(135deg, #11998e 0%, #38ef7d 100%); padding: 40px; border-radius: 15px; text-align: center; color: white;">
          <h2 style="margin: 0 0 10px 0;">Welcome!</h2>
          <p style="font-size: 18px; margin: 0;">You've been invited to join</p>
          <h3 style="font-size: 28px; margin: 15px 0;">${orgName}</h3>
          ${departmentName ? `<p style="font-size: 16px; margin: 0;">Department: <strong>${departmentName}</strong></p>` : ''}
        </div>
        <div style="background: #f9fafb; padding: 30px; border-radius: 10px; margin-top: 20px;">
          <p style="color: #374151; font-size: 16px;">As a team member, you will be able to:</p>
          <ul style="color: #4b5563; line-height: 2;">
            <li>Participate in organizational surveys</li>
            <li>Track your survey progress</li>
            <li>Save drafts and submit responses</li>
          </ul>
          <div style="text-align: center; margin-top: 30px;">
            <a href="${signupUrl}" style="background: #10b981; color: white; padding: 15px 40px; text-decoration: none; border-radius: 8px; display: inline-block; font-size: 16px; font-weight: bold;">
              Accept Invitation & Sign Up
            </a>
          </div>
          <p style="color: #6b7280; font-size: 14px; text-align: center; margin-top: 20px;">
            Or copy this link: <br/>
            <span style="color: #10b981; word-break: break-all;">${signupUrl}</span>
          </p>
        </div>
        <p style="color: #9ca3af; font-size: 12px; text-align: center; margin-top: 20px;">
          This invitation expires in 7 days. If you didn't expect this, please ignore this email.
        </p>
      </div>
    `
  };

  console.log('Sending user invite email to:', to);
  return transporter.sendMail(mailOptions);
};

// Legacy invite email
const sendInviteEmail = async (to, inviteToken, orgName, role) => {
  if (role === 'CEO' || role === 'ceo') {
    return sendCEOInviteEmail(to, inviteToken, orgName);
  }
  return sendUserInviteEmail(to, inviteToken, orgName);
};

const sendSurveyNotification = async (to, surveyTitle, dueDate) => {
  const mailOptions = {
    from: `"Survey App" <${process.env.EMAIL_USER || process.env.GMAIL_USER}>`,
    to,
    subject: `New Survey Assigned: ${surveyTitle}`,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 500px; margin: 0 auto; padding: 20px;">
        <h2 style="color: #4F46E5; text-align: center;">Survey App</h2>
        <div style="background: #fef3c7; padding: 30px; border-radius: 10px;">
          <h3 style="color: #92400e; margin: 0 0 15px 0;">📋 New Survey Assigned</h3>
          <p style="color: #374151; font-size: 18px; margin: 0 0 10px 0;"><strong>${surveyTitle}</strong></p>
          <p style="color: #6b7280; margin: 0;">Due Date: <strong>${dueDate ? new Date(dueDate).toLocaleDateString() : 'No deadline'}</strong></p>
          <div style="text-align: center; margin-top: 25px;">
            <a href="${process.env.FRONTEND_URL}/dashboard" style="background: #f59e0b; color: white; padding: 12px 30px; text-decoration: none; border-radius: 6px; display: inline-block;">
              Go to Dashboard
            </a>
          </div>
        </div>
      </div>
    `
  };

  return transporter.sendMail(mailOptions);
};

module.exports = { 
  sendInviteEmail, 
  sendCEOInviteEmail, 
  sendUserInviteEmail, 
  sendSurveyNotification, 
  sendOTPEmail, 
  generateOTP, 
  transporter 
};
