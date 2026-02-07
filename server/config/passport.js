const GoogleStrategy = require('passport-google-oauth20').Strategy;
const Employee = require('../models/Employee');

module.exports = (passport) => {
  passport.use(new GoogleStrategy({
    clientID: process.env.GOOGLE_CLIENT_ID,
    clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    callbackURL: '/api/auth/google/callback'
  }, async (accessToken, refreshToken, profile, done) => {
    try {
      let user = await Employee.findOne({ email: profile.emails[0].value });
      
      if (user) {
        user.googleId = profile.id;
        user.lastLogin = new Date();
        await user.save();
        return done(null, user);
      }
      
      // User not found - they need an invite first
      return done(null, false, { message: 'No account found. Please use your invite link.' });
    } catch (err) {
      return done(err, null);
    }
  }));

  passport.serializeUser((user, done) => done(null, user.id));
  passport.deserializeUser(async (id, done) => {
    const user = await Employee.findById(id);
    done(null, user);
  });
};
