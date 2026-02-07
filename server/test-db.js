require('dotenv').config();
const mongoose = require('mongoose');

console.log('🔍 Testing MongoDB Connection...\n');
console.log('URI:', process.env.MONGODB_URI.replace(/:[^:@]+@/, ':****@'));
console.log('');

mongoose.connect(process.env.MONGODB_URI, {
  serverSelectionTimeoutMS: 10000
})
  .then(() => {
    console.log('✅ SUCCESS! MongoDB Connected!');
    console.log('📦 Database:', mongoose.connection.name);
    console.log('🌐 Host:', mongoose.connection.host);
    console.log('\n✨ Your database is ready to use!');
    process.exit(0);
  })
  .catch(err => {
    console.error('❌ FAILED! MongoDB Connection Error:');
    console.error('Error:', err.message);
    if (err.code) console.error('Code:', err.code);
    process.exit(1);
  });
