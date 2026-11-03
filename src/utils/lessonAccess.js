const Enrollment = require('../models/Enrollment');
const Course = require('../models/Course');
const Module = require('../models/Module');
const Lesson = require('../models/Lesson');
const mongoose = require('mongoose');
const { isEnrollmentActive } = require('./accessDuration');

/**
 * Validates whether a user can access a specific lesson in a course.
 *
 * Rules:
 * 1. Admin always has full access.
 * 2. If the user is enrolled with active approval/completion (within 3 calendar months window), all lessons are unlocked.
 * 3. The first N lessons in curriculum order (default: 2, or course.freePreviewCount) are FREE PREVIEWS for everyone
 *    (including unauthenticated users and authenticated learners who haven't enrolled/purchased yet).
 * 4. Lessons from position N+1 onward require an approved enrollment or verified purchase.
 *
 * @param {Object|null} user - The requesting user (from req.user), or null if guest
 * @param {Object|String} courseOrId - The Course document or ObjectId
 * @param {Object|String} lessonOrId - The Lesson document or ObjectId
 * @returns {Promise<Object>} Access evaluation object { allowed, isFreePreview, lessonPosition, totalLessons, reason, course, lesson }
 */
const canAccessLesson = async (user, courseOrId, lessonOrId) => {
  let course = courseOrId;
  if (!course || !course._id) {
    course = await Course.findById(courseOrId);
  }
  if (!course) {
    return { allowed: false, reason: 'COURSE_NOT_FOUND', isFreePreview: false };
  }

  let lesson = lessonOrId;
  if (!lesson || !lesson._id) {
    lesson = await Lesson.findById(lessonOrId);
  }
  if (!lesson) {
    return { allowed: false, reason: 'LESSON_NOT_FOUND', isFreePreview: false };
  }

  // 1. Admin always has full access
  if (user && user.role === 'admin') {
    return { allowed: true, isFreePreview: false, hasAccess: true, accessType: 'admin', course, lesson };
  }

  // 2. Determine lesson position across the complete course curriculum
  const modules = await Module.find({ courseId: course._id }).sort('order');
  const moduleIds = modules.map((m) => m._id);
  const allLessons = await Lesson.find({ moduleId: { $in: moduleIds } }).sort('order');

  const lessonIdx = allLessons.findIndex((l) => l._id.toString() === lesson._id.toString());
  const lessonPosition = lessonIdx >= 0 ? lessonIdx + 1 : 999;
  const previewCount = typeof course.freePreviewCount === 'number' ? course.freePreviewCount : 2;
  const isFreePreview = lessonPosition <= previewCount;

  // 3. Free Preview check: First N lessons are publicly free for all
  if (isFreePreview) {
    return {
      allowed: true,
      isFreePreview: true,
      hasAccess: true,
      accessType: 'free_preview',
      lessonPosition,
      totalLessons: allLessons.length,
      course,
      lesson
    };
  }

  // 4. For lesson > previewCount: Check whether the user is authenticated & has active approved enrollment
  if (!user || !user.id) {
    return {
      allowed: false,
      isFreePreview: false,
      hasAccess: false,
      accessType: 'purchase_required',
      reason: 'AUTHENTICATION_REQUIRED',
      lessonPosition,
      totalLessons: allLessons.length,
      course,
      lesson
    };
  }

  const enrollment = await Enrollment.findOne({ student: user.id || user._id, course: course._id });
  if (enrollment && isEnrollmentActive(enrollment)) {
    return {
      allowed: true,
      isFreePreview: false,
      hasAccess: true,
      accessType: 'enrolled',
      lessonPosition,
      totalLessons: allLessons.length,
      course,
      lesson,
      enrollment
    };
  }

  if (enrollment && (enrollment.status === 'pending_approval' || enrollment.status === 'pending')) {
    return {
      allowed: false,
      isFreePreview: false,
      hasAccess: false,
      accessType: 'pending_approval',
      reason: 'PENDING_APPROVAL',
      lessonPosition,
      totalLessons: allLessons.length,
      course,
      lesson
    };
  }

  return {
    allowed: false,
    isFreePreview: false,
    hasAccess: false,
    accessType: 'purchase_required',
    reason: 'PURCHASE_REQUIRED',
    lessonPosition,
    totalLessons: allLessons.length,
    course,
    lesson
  };
};

module.exports = { canAccessLesson };

