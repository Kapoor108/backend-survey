// Run this once to create initial users (admin, CEO, and regular user)
// Usage: cd server && node seed.js
// Or: node server/seed.js (from root)

const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const Employee = require('./models/Employee');
const Organization = require('./models/Organization');
const Department = require('./models/Department');

// User credentials
const users = [
  {
    name: 'Harsh Kapoor',
    email: 'hkapoor@1gen.io',
    password: '123456Harsh',
    role: 'admin'
  },
  {
    name: 'John CEO',
    email: 'ceo@mailto.plus',
    password: 'Ceo@123456',
    role: 'ceo'
  },
  {
    name: 'Jane User',
    email: 'user@mailto.plus',
    password: 'User@123456',
    role: 'user'
  }
];

async function createOrUpdateUser(userData, orgId = null, deptId = null) {
  let user = await Employee.findOne({ email: userData.email });
  
  const userPayload = {
    name: userData.name,
    email: userData.email,
    password: await bcrypt.hash(userData.password, 10),
    role: userData.role,
    inviteStatus: 'accepted',
    isActive: true
  };

  // Add org and department for CEO and user roles
  if (orgId && userData.role !== 'admin') {
    userPayload.orgId = orgId;
  }
  if (deptId && userData.role === 'user') {
    userPayload.departmentId = deptId;
  }

  if (user) {
    Object.assign(user, userPayload);
    await user.save();
    console.log(`✓ ${userData.role.toUpperCase()} updated: ${userData.email}`);
  } else {
    await Employee.create(userPayload);
    console.log(`✓ ${userData.role.toUpperCase()} created: ${userData.email}`);
  }
}

async function seed() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✓ Connected to MongoDB');

    // Create a sample organization for CEO and User
    const ceoEmail = 'ceo@example.com';
    let org = await Organization.findOne({ name: 'Sample Organization' });
    if (!org) {
      org = await Organization.create({
        name: 'Sample Organization',
        ceoEmail: ceoEmail,
        status: 'active'
      });
      console.log('✓ Sample Organization created');
    }

    // Create a sample department
    let dept = await Department.findOne({ name: 'Engineering', orgId: org._id });
    if (!dept) {
      dept = await Department.create({
        name: 'Engineering',
        orgId: org._id
      });
      console.log('✓ Sample Department created');
    }

    // Create/update all users
    for (const userData of users) {
      await createOrUpdateUser(userData, org._id, dept._id);
    }

    // Print credentials
    console.log('\n========================================');
    console.log('  ALL USER CREDENTIALS');
    console.log('========================================');
    
    for (const user of users) {
      console.log(`\n  [${user.role.toUpperCase()}]`);
      console.log(`  Name:     ${user.name}`);
      console.log(`  Email:    ${user.email}`);
      console.log(`  Password: ${user.password}`);
    }
    
    console.log('\n========================================');
    console.log('  SAMPLE ORGANIZATION');
    console.log('========================================');
    console.log(`  Name: Sample Organization`);
    console.log(`  Department: Engineering`);
    console.log('========================================\n');
    
    process.exit(0);
  } catch (err) {
    console.error('✗ Seed error:', err.message);
    process.exit(1);
  }
}

seed();
