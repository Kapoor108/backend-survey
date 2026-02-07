# 🔧 SurveyX Backend (Server)

## 📁 This is the BACKEND folder

This folder contains the **Node.js/Express API server** that handles:
- Database operations (MongoDB)
- Authentication & Authorization
- OTP generation and email sending
- Survey management
- User management
- Analytics and reports

---

## 🏗️ Technology Stack

- **Runtime**: Node.js
- **Framework**: Express.js
- **Database**: MongoDB (Mongoose ODM)
- **Authentication**: JWT + Passport.js
- **Email**: Nodemailer
- **Password Hashing**: bcryptjs

---

## 📂 Folder Structure

```
server/
├── config/           # Configuration files
│   ├── email.js      # Email & OTP configuration
│   └── passport.js   # Google OAuth configuration
├── middleware/       # Express middleware
│   └── auth.js       # JWT authentication middleware
├── models/           # MongoDB/Mongoose models
│   ├── Employee.js
│   ├── Organization.js
│   ├── Department.js
│   ├── Survey.js
│   ├── SurveyResponse.js
│   ├── SurveyAssignment.js
│   ├── OTP.js
│   ├── InviteLog.js
│   └── SupportTicket.js
├── routes/           # API route handlers
│   ├── auth.js       # Authentication routes
│   ├── admin.js      # Admin routes
│   ├── ceo.js        # CEO routes
│   ├── user.js       # User routes
│   ├── surveys.js    # Survey routes
│   ├── analytics.js  # Analytics routes
│   ├── support.js    # Support ticket routes
│   ├── reports.js    # Report routes
│   └── chatbot.js    # AI chatbot routes
├── .env              # Environment variables (DO NOT COMMIT)
├── index.js          # Main server entry point
├── seed.js           # Database seeding script
├── package.json      # Dependencies and scripts
└── README.md         # This file
```

---

## 🚀 Getting Started

### Prerequisites
- Node.js 18+ installed
- MongoDB running (local or Atlas)

### Installation

```bash
# Navigate to server folder
cd server

# Install dependencies
npm install

# Create .env file (copy from .env.example)
# Add your MongoDB URI and other credentials

# Seed the database with test users
node seed.js

# Start the server
npm start
```

### Development Mode (with auto-reload)
```bash
npm run dev
```

---

## 🔐 Environment Variables

Create a `.env` file in this folder with:

```env
# Database
MONGODB_URI=mongodb://localhost:27017/SurveyX

# JWT
JWT_SECRET=your-secret-key-here
JWT_EXPIRES_IN=7d

# Email
EMAIL_USER=your-email@gmail.com
EMAIL_PASS=your-app-password

# Server
PORT=5000
NODE_ENV=development
FRONTEND_URL=http://localhost:3000

# OAuth (optional)
GOOGLE_CLIENT_ID=your-google-client-id
GOOGLE_CLIENT_SECRET=your-google-client-secret

# AI (optional)
GEMINI_API_KEY=your-gemini-api-key

# Static files
SERVE_STATIC=false
```

---

## 📡 API Endpoints

### Authentication
- `POST /api/auth/login/send-otp` - Send OTP to email
- `POST /api/auth/login/verify-otp` - Verify OTP and login
- `GET /api/auth/google` - Google OAuth login
- `GET /api/auth/me` - Get current user

### Admin Routes
- `GET /api/admin/dashboard` - Admin dashboard stats
- `GET /api/admin/organizations` - List all organizations
- `POST /api/admin/organizations` - Create organization
- `GET /api/admin/users` - List all users
- `POST /api/admin/invite` - Invite new user

### CEO Routes
- `GET /api/ceo/dashboard` - CEO dashboard stats
- `GET /api/ceo/departments` - List departments
- `POST /api/ceo/departments` - Create department
- `GET /api/ceo/employees` - List employees
- `POST /api/ceo/surveys` - Create survey

### User Routes
- `GET /api/user/dashboard` - User dashboard
- `GET /api/user/surveys` - Assigned surveys
- `POST /api/user/surveys/:id/submit` - Submit survey response

### Survey Routes
- `GET /api/surveys` - List surveys
- `GET /api/surveys/:id` - Get survey details
- `POST /api/surveys` - Create survey
- `PUT /api/surveys/:id` - Update survey
- `DELETE /api/surveys/:id` - Delete survey

### Analytics Routes
- `GET /api/analytics/survey/:id` - Survey analytics
- `GET /api/analytics/organization/:id` - Organization analytics

---

## 🗄️ Database Models

### Employee
User accounts (Admin, CEO, User roles)

### Organization
Company/organization details

### Department
Departments within organizations

### Survey
Survey templates and questions

### SurveyResponse
User responses to surveys

### SurveyAssignment
Survey assignments to users/departments

### OTP
One-time passwords for authentication

### InviteLog
User invitation tracking

### SupportTicket
Support ticket system

---

## 🧪 Testing

### Test Database Connection
```bash
node test-db.js
```

### Seed Test Data
```bash
node seed.js
```

### Test API Endpoints
Use tools like:
- Postman
- Thunder Client (VS Code extension)
- curl commands

Example:
```bash
curl http://localhost:5000/api/health
```

---

## 🚀 Deployment

### Deploy to Render

1. Push code to GitHub
2. Create new Web Service on Render
3. Set Root Directory: `server`
4. Build Command: `npm install`
5. Start Command: `node index.js`
6. Add all environment variables
7. Deploy!

See `../DEPLOY_NOW.md` for detailed instructions.

---

## 📝 Scripts

```bash
npm start       # Start server (production)
npm run dev     # Start with nodemon (development)
npm run seed    # Seed database with test data
```

---

## 🔒 Security Features

- JWT token authentication
- Password hashing with bcrypt
- OTP-based login
- Role-based access control (RBAC)
- CORS protection
- Input validation
- Secure HTTP headers

---

## 🐛 Common Issues

### MongoDB Connection Failed
- Check if MongoDB is running
- Verify MONGODB_URI in .env
- Check Network Access in MongoDB Atlas

### Port Already in Use
- Change PORT in .env
- Or kill the process using port 5000

### Email Not Sending
- Verify EMAIL_USER and EMAIL_PASS
- Check if "Less secure app access" is enabled (Gmail)
- Use App Password for Gmail

---

## 📚 Dependencies

**Production:**
- express - Web framework
- mongoose - MongoDB ODM
- jsonwebtoken - JWT authentication
- bcryptjs - Password hashing
- nodemailer - Email sending
- passport - OAuth authentication
- cors - CORS middleware
- dotenv - Environment variables

**Development:**
- nodemon - Auto-reload server

---

## 👥 Default Test Users

After running `node seed.js`:

**Admin:**
- Email: hkapoor@1gen.io
- Password: 123456Harsh

**CEO:**
- Email: ceo@mailto.plus
- Password: Ceo@123456

**User:**
- Email: user@mailto.plus
- Password: User@123456

---

## 📞 Support

For issues or questions:
1. Check the logs in console
2. Review environment variables
3. Check MongoDB connection
4. See `../DEPLOY_NOW.md` for deployment help

---

**This is the BACKEND - handles all server-side logic and database operations.**

For the frontend (React app), see `../client/README.md`
