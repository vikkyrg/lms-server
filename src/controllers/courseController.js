const Course = require('../models/Course');
const Module = require('../models/Module');
const Lesson = require('../models/Lesson');
const Enrollment = require('../models/Enrollment');
const Category = require('../models/Category');
const mongoose = require('mongoose');

const escapeRegex = value => String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

// An id that can exist in a filter but matches no document.
const MATCH_NOTHING = new mongoose.Types.ObjectId('000000000000000000000000');

// The category filter accepts an id, a slug or a name (e.g. ?category=devops)
// so a hand-written link never triggers an ObjectId CastError.
const resolveCategoryFilter = async (value) => {
  if (!value) return null;
  if (mongoose.isValidObjectId(value)) return value;
  const found = await Category.findOne({
    $or: [
      { slug: String(value).toLowerCase() },
      { name: { $regex: `^${escapeRegex(value)}$`, $options: 'i' } }
    ]
  }).select('_id').lean();
  return found ? String(found._id) : MATCH_NOTHING;
};

// Attach dynamic curriculum counts so course cards can preview the module
// structure without any hardcoded frontend data.
const withCurriculumCounts = async (courses) => {
  const courseIds = courses.map(c => c._id);
  const [moduleCounts, lessonCounts] = await Promise.all([
    Module.aggregate([{ $match: { courseId: { $in: courseIds } } }, { $group: { _id: '$courseId', count: { $sum: 1 } } }]),
    Lesson.aggregate([{ $match: { courseId: { $in: courseIds } } }, { $group: { _id: '$courseId', count: { $sum: 1 } } }])
  ]);
  const moduleMap = new Map(moduleCounts.map(m => [m._id.toString(), m.count]));
  const lessonMap = new Map(lessonCounts.map(l => [l._id.toString(), l.count]));

  return courses.map(c => {
    const obj = c.toObject();
    obj.moduleCount = moduleMap.get(c._id.toString()) || 0;
    obj.lessonCount = lessonMap.get(c._id.toString()) || 0;
    return obj;
  });
};

// @desc Get public courses with filters, search, sort, pagination
// @route GET /api/v1/courses
exports.getCourses = async (req, res, next) => {
  try {
    const { category, level, isFree, search, sort } = req.query;
    const page = Math.max(1, Number.parseInt(req.query.page, 10) || 1);
    const limit = Math.min(50, Math.max(1, Number.parseInt(req.query.limit, 10) || 12));

    const query = { status: 'published' };

    if (category) query.category = await resolveCategoryFilter(category);
    if (level) query.level = level;
    if (isFree !== undefined && isFree !== '') query.isFree = isFree === 'true';

    if (search) {
      query.$or = [
        { title: { $regex: escapeRegex(search), $options: 'i' } },
        { shortDescription: { $regex: escapeRegex(search), $options: 'i' } }
      ];
    }

    let sortOption = { createdAt: -1 };
    if (sort === 'popular') sortOption = { enrollmentCount: -1 };
    if (sort === 'price-low') sortOption = { price: 1 };
    if (sort === 'price-high') sortOption = { price: -1 };
    if (sort === 'rating') sortOption = { rating: -1 };

    const skip = (page - 1) * limit;

    const courses = await Course.find(query)
      .populate('category', 'name slug')
      .populate('instructor', 'name avatar headline')
      .sort(sortOption)
      .skip(skip)
      .limit(limit);

    const total = await Course.countDocuments(query);

    res.status(200).json({
      success: true,
      courses: await withCurriculumCounts(courses),
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / Number(limit))
      }
    });
  } catch (error) {
    next(error);
  }
};

// @desc Admin course directory (every status, so drafts/archived stay manageable)
// @route GET /api/v1/courses/admin/list
exports.getAdminCourses = async (req, res, next) => {
  try {
    const { status, category, isFree, search } = req.query;
    const page = Math.max(1, Number.parseInt(req.query.page, 10) || 1);
    const limit = Math.min(100, Math.max(1, Number.parseInt(req.query.limit, 10) || 50));

    const query = {};
    if (status && status !== 'all') query.status = status;
    if (category) query.category = await resolveCategoryFilter(category);
    if (isFree !== undefined && isFree !== '') query.isFree = isFree === 'true';
    if (search) {
      query.$or = [
        { title: { $regex: escapeRegex(search), $options: 'i' } },
        { shortDescription: { $regex: escapeRegex(search), $options: 'i' } }
      ];
    }

    const skip = (page - 1) * limit;
    const courses = await Course.find(query)
      .populate('category', 'name slug')
      .populate('instructor', 'name avatar headline')
      .sort('-createdAt')
      .skip(skip)
      .limit(limit);

    const total = await Course.countDocuments(query);
    const coursesWithCounts = await withCurriculumCounts(courses);

    res.status(200).json({
      success: true,
      data: coursesWithCounts,
      courses: coursesWithCounts,
      pagination: { page, limit, total, pages: Math.ceil(total / limit) }
    });
  } catch (error) {
    next(error);
  }
};

// @desc Get single course by slug or ID
// @route GET /api/v1/courses/:identifier
exports.getCourseDetails = async (req, res, next) => {
  try {
    const { identifier } = req.params;
    let course;

    if (identifier.match(/^[0-9a-fA-F]{24}$/)) {
      course = await Course.findById(identifier)
        .populate('category', 'name slug')
        .populate('instructor', 'name avatar headline bio expertise');
    } else {
      course = await Course.findOne({ slug: identifier })
        .populate('category', 'name slug')
        .populate('instructor', 'name avatar headline bio expertise');
    }

    if (!course) {
      return res.status(404).json({ success: false, message: 'Course not found' });
    }
    if (course.status !== 'published') {
      return res.status(404).json({ success: false, message: 'Course not found' });
    }

    // Fetch modules and lessons
    const modules = await Module.find({ courseId: course._id }).sort('order');
    const moduleIds = modules.map(m => m._id);
    const lessons = await Lesson.find({ moduleId: { $in: moduleIds } }).sort('order');

    // Determine user active enrollment status if token was provided
    let hasFullAccess = false;
    if (req.user) {
      if (req.user.role === 'admin') {
        hasFullAccess = true;
      } else {
        const Enrollment = require('../models/Enrollment');
        const { isEnrollmentActive } = require('../utils/accessDuration');
        const enr = await Enrollment.findOne({ student: req.user._id || req.user.id, course: course._id });
        if (enr && isEnrollmentActive(enr)) {
          hasFullAccess = true;
        }
      }
    }

    const freePreviewCount = typeof course.freePreviewCount === 'number' ? course.freePreviewCount : 2;

    // Track chronological lesson index across the complete curriculum
    let runningLessonIndex = 0;

    // Group lessons inside modules
    const curriculum = modules.map(mod => {
      const modLessons = lessons.filter(l => l.moduleId.toString() === mod._id.toString());
      return {
        ...mod.toObject(),
        lessons: modLessons.map(l => {
          runningLessonIndex += 1;
          const isFreePreview = runningLessonIndex <= freePreviewCount || Boolean(l.isPreview);
          const isUnlocked = hasFullAccess || isFreePreview;

          return {
            _id: l._id,
            title: l.title,
            description: l.description,
            duration: l.duration,
            order: l.order,
            lessonPosition: runningLessonIndex,
            isFreePreview,
            isLocked: !isUnlocked,
            hasAccess: isUnlocked,
            accessType: hasFullAccess
              ? 'enrolled'
              : isFreePreview
              ? 'free_preview'
              : 'purchase_required',
            // Only expose playable video URL/endpoint when the user is authorized or it is free preview
            videoUrl: isUnlocked
              ? (l.video?.fileId ? `/api/v1/curriculum/courses/${course._id}/lessons/${l._id}/video` : l.videoUrl)
              : ''
          };
        })
      };
    });

    res.status(200).json({
      success: true,
      course,
      curriculum
    });
  } catch (error) {
    next(error);
  }
};

// @desc Create a new course (Admin)
// @route POST /api/v1/courses
exports.createCourse = async (req, res, next) => {
  try {
    const {
      title, slug, shortDescription, description, thumbnail, thumbnailImage, previewVideo, category,
      level, language, duration, videoDuration, curriculumTitle, learningOutcomes, prerequisites, isFree, price,
      discountPrice, status, freePreviewCount
    } = req.body;

    const numericDuration = videoDuration !== undefined && videoDuration !== null && videoDuration !== ''
      ? Math.max(1, Number(videoDuration))
      : (parseFloat(duration) || 10);

    const formattedDuration = `${numericDuration} Hours`;

    const courseData = {
      title, slug, shortDescription, description, thumbnail, thumbnailImage, previewVideo, category,
      level, language,
      duration: duration || formattedDuration,
      videoDuration: numericDuration,
      curriculumTitle, learningOutcomes, prerequisites, isFree, price,
      discountPrice, status,
      freePreviewCount: freePreviewCount !== undefined ? Math.max(0, Number(freePreviewCount)) : 2
    };
    courseData.instructor = req.user.id;

    const course = await Course.create(courseData);

    // If a thumbnailImage ID was uploaded prior to course creation, associate it with this course
    if (thumbnailImage && mongoose.isValidObjectId(thumbnailImage)) {
      const CourseImage = require('../models/CourseImage');
      await CourseImage.findByIdAndUpdate(thumbnailImage, { course: course._id }).catch(() => {});
    }

    const { logAudit } = require('../utils/audit');
    await logAudit({
      action: 'COURSE_CREATED',
      performedBy: req.user,
      role: req.user.role,
      targetResource: 'Course',
      targetId: course._id,
      details: { title: course.title, status: course.status }
    });

    res.status(201).json({ success: true, course });
  } catch (error) {
    next(error);
  }
};

// @desc Update course
// @route PUT /api/v1/courses/:id
exports.updateCourse = async (req, res, next) => {
  try {
    let course = await Course.findById(req.params.id);
    if (!course) {
      return res.status(404).json({ success: false, message: 'Course not found' });
    }

    const allowedFields = [
      'title', 'slug', 'shortDescription', 'description', 'thumbnail', 'thumbnailImage', 'previewVideo',
      'category', 'level', 'language', 'duration', 'videoDuration', 'curriculumTitle', 'learningOutcomes', 'prerequisites',
      'isFree', 'price', 'discountPrice', 'status', 'freePreviewCount'
    ];
    const updates = {};
    allowedFields.forEach(field => {
      if (req.body[field] !== undefined) updates[field] = req.body[field];
    });

    if (req.body.videoDuration !== undefined && req.body.videoDuration !== null && req.body.videoDuration !== '') {
      const numHours = Math.max(1, Number(req.body.videoDuration));
      updates.videoDuration = numHours;
      updates.duration = `${numHours} Hours`;
    } else if (req.body.duration !== undefined) {
      const parsedHours = parseFloat(req.body.duration);
      if (!isNaN(parsedHours)) {
        updates.videoDuration = parsedHours;
        updates.duration = `${parsedHours} Hours`;
      }
    }

    course = await Course.findByIdAndUpdate(req.params.id, updates, {
      new: true,
      runValidators: true
    });

    const { logAudit } = require('../utils/audit');
    await logAudit({
      action: 'COURSE_UPDATED',
      performedBy: req.user,
      role: req.user.role,
      targetResource: 'Course',
      targetId: course._id,
      details: { updates }
    });

    res.status(200).json({ success: true, course });
  } catch (error) {
    next(error);
  }
};

// @desc Delete course (Permanently deletes course and cleans up associated modules, lessons, and materials)
// @route DELETE /api/v1/courses/:id
exports.deleteCourse = async (req, res, next) => {
  try {
    const course = await Course.findById(req.params.id);
    if (!course) {
      return res.status(404).json({ success: false, message: 'Course not found' });
    }

    const courseId = course._id;

    // Delete associated lessons, modules, and course materials
    await Promise.all([
      Lesson.deleteMany({ courseId }),
      Module.deleteMany({ courseId }),
      Course.findByIdAndDelete(courseId)
    ]);

    // Clean up materials and images if models exist
    try {
      const CourseMaterial = require('../models/CourseMaterial');
      await CourseMaterial.deleteMany({ courseId });
    } catch (_) {}

    try {
      const CourseImage = require('../models/CourseImage');
      await CourseImage.deleteMany({ courseId });
    } catch (_) {}

    res.status(200).json({ success: true, message: 'Course deleted successfully' });
  } catch (error) {
    next(error);
  }
};
