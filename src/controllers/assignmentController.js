const Assignment = require('../models/Assignment');
const Submission = require('../models/Submission');
const { requireCourseEnrollment, isCourseOwnerOrAdmin } = require('../middleware/auth');

// Get assignments for a course
exports.getAssignmentsByCourse = async (req, res, next) => {
  try {
    const enrollment = await requireCourseEnrollment(req, req.params.courseId);
    const manager = await isCourseOwnerOrAdmin(req, req.params.courseId);
    if (!enrollment && !manager.allowed) {
      return res.status(403).json({ success: false, message: 'You must be enrolled to access assignments for this course' });
    }
    const assignments = await Assignment.find({
      courseId: req.params.courseId,
      ...(req.user.role === 'student' ? { published: true } : {})
    }).sort('dueDate');
    res.status(200).json({ success: true, assignments });
  } catch (error) {
    next(error);
  }
};

// Create assignment (admin)
exports.createAssignment = async (req, res, next) => {
  try {
    const manager = await isCourseOwnerOrAdmin(req, req.body.courseId);
    if (!manager.allowed) {
      return res.status(403).json({ success: false, message: 'You are not authorized to manage this course' });
    }
    const { title, courseId, moduleId, instructions, totalMarks, dueDate, allowLateSubmission, published } = req.body;
    const assignment = await Assignment.create({ title, courseId, moduleId, instructions, totalMarks, dueDate, allowLateSubmission, published });
    res.status(201).json({ success: true, assignment });
  } catch (error) {
    next(error);
  }
};

// Submit assignment
exports.submitAssignment = async (req, res, next) => {
  try {
    const { submissionText, fileUrl } = req.body;
    const assignmentId = req.params.id;

    const assignment = await Assignment.findById(assignmentId);
    if (!assignment) return res.status(404).json({ success: false, message: 'Assignment not found' });
    if (!(await requireCourseEnrollment(req, assignment.courseId))) {
      return res.status(403).json({ success: false, message: 'You must be enrolled to submit this assignment' });
    }
    if (!assignment.allowLateSubmission && new Date() > assignment.dueDate) {
      return res.status(400).json({ success: false, message: 'The assignment deadline has passed' });
    }

    let submission = await Submission.findOne({ assignmentId, studentId: req.user.id });

    if (submission) {
      submission.submissionText = submissionText;
      if (fileUrl) submission.fileUrl = fileUrl;
      submission.status = 'submitted';
      await submission.save();
    } else {
      submission = await Submission.create({
        assignmentId,
        courseId: assignment.courseId,
        studentId: req.user.id,
        submissionText,
        fileUrl: fileUrl || '',
        status: 'submitted'
      });
    }

    res.status(200).json({ success: true, submission });
  } catch (error) {
    next(error);
  }
};

// Get student submissions
exports.getMySubmissions = async (req, res, next) => {
  try {
    const submissions = await Submission.find({ studentId: req.user.id })
      .populate('assignmentId', 'title totalMarks dueDate')
      .populate('courseId', 'title')
      .sort('-createdAt');
    res.status(200).json({ success: true, submissions });
  } catch (error) {
    next(error);
  }
};

// Grade submission (admin)
exports.gradeSubmission = async (req, res, next) => {
  try {
    const { marksObtained, feedback } = req.body;
    const submission = await Submission.findById(req.params.id);

    if (!submission) return res.status(404).json({ success: false, message: 'Submission not found' });
    const manager = await isCourseOwnerOrAdmin(req, submission.courseId);
    if (!manager.allowed) {
      return res.status(403).json({ success: false, message: 'You are not authorized to grade this submission' });
    }
    const assignment = await Assignment.findById(submission.assignmentId).select('totalMarks');
    if (!assignment || !Number.isFinite(Number(marksObtained))
      || Number(marksObtained) < 0 || Number(marksObtained) > assignment.totalMarks) {
      return res.status(400).json({ success: false, message: 'Marks must be between 0 and the assignment maximum' });
    }

    submission.marksObtained = Number(marksObtained);
    submission.feedback = feedback || '';
    submission.status = 'graded';
    submission.gradedBy = req.user.id;
    submission.gradedAt = new Date();

    await submission.save();

    res.status(200).json({ success: true, submission });
  } catch (error) {
    next(error);
  }
};

// Get all submissions for grading
exports.getAllSubmissions = async (req, res, next) => {
  try {
    const filter = {};
    if (req.query.courseId) filter.courseId = req.query.courseId;
    const submissions = await Submission.find(filter)
      .populate('assignmentId', 'title totalMarks')
      .populate('studentId', 'name email')
      .populate('courseId', 'title')
      .sort('-createdAt');

    res.status(200).json({ success: true, count: submissions.length, submissions });
  } catch (error) {
    next(error);
  }
};
