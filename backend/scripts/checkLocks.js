const mongoose = require('mongoose');
require('dotenv').config();

mongoose.connect(process.env.MONGO_URI).then(async () => {
  try {
    // Check SystemLock index
    const locks = await mongoose.connection.db.collection('systemlocks').indexes();
    console.log('SystemLock indexes:', JSON.stringify(locks, null, 2));

    // Check if any lock is currently stuck
    const now = new Date();
    const stuck = await mongoose.connection.db.collection('systemlocks').find({ expiresAt: { $lt: now } }).toArray();
    console.log('Stuck/expired locks found:', stuck.length);

    // Clean up stuck locks if any
    if (stuck.length > 0) {
      await mongoose.connection.db.collection('systemlocks').deleteMany({ expiresAt: { $lt: now } });
      console.log('Cleaned', stuck.length, 'stuck lock(s)');
    } else {
      console.log('No stuck locks — cron is clean');
    }

    // Also verify users have push subscriptions
    const usersWithSubs = await mongoose.connection.db.collection('users').countDocuments({ 'pushSubscription.endpoint': { $exists: true, $ne: null } });
    console.log('Users with active push subscriptions:', usersWithSubs);

    await mongoose.connection.close();
    console.log('Done');
  } catch (err) {
    console.error('Error:', err.message);
    await mongoose.connection.close();
  }
});
