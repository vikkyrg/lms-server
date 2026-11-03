/**
 * One-time, idempotent migration for WhatsApp-style sidebar notification badges.
 *
 * Marks every PRE-EXISTING enrollment as "notification viewed" so historical
 * records are not suddenly counted as new unread notifications when the badge
 * feature ships. Enrollments created after this migration default to
 * notificationViewed = false and will correctly raise the badge.
 *
 * It never changes enrollment.status, never deletes anything, and only touches
 * documents where the field does not yet exist (safe to re-run).
 *
 * Usage: node migrate_notifications.js
 */
require('dotenv').config();
const mongoose = require('mongoose');
const Enrollment = require('./src/models/Enrollment');

async function run() {
  await mongoose.connect(process.env.MONGODB_URI);
  console.log('Connected to MongoDB');

  const result = await Enrollment.updateMany(
    { notificationViewed: { $exists: false } },
    { $set: { notificationViewed: true, notificationViewedAt: new Date() } }
  );

  console.log(`Marked ${result.modifiedCount} pre-existing enrollment(s) as already-viewed.`);
  const stillUnread = await Enrollment.countDocuments({
    status: 'pending_approval',
    notificationViewed: { $ne: true }
  });
  console.log(`Unread enrollment notifications now: ${stillUnread}`);

  await mongoose.disconnect();
}

run().catch((err) => { console.error(err); process.exit(1); });
