const Quiz = require('../models/Quiz');
const QuizAttempt = require('../models/QuizAttempt');
const { requireCourseEnrollment, isCourseOwnerOrAdmin } = require('../middleware/auth');

const canManageQuiz = async (req, courseId) => {
  const result = await isCourseOwnerOrAdmin(req, courseId);
  return result.allowed;
};

// Get quizzes for a course
exports.getQuizzesByCourse = async (req, res, next) => {
  try {
    const enrollment = await requireCourseEnrollment(req, req.params.courseId);
    if (!enrollment && !(await canManageQuiz(req, req.params.courseId))) {
      return res.status(403).json({ success: false, message: 'You must be enrolled to access quizzes for this course' });
    }
    const quizzes = await Quiz.find({ courseId: req.params.courseId, ...(req.user.role === 'student' ? { published: true } : {}) })
      .select('-questions.correctAnswer');
    res.status(200).json({ success: true, quizzes });
  } catch (error) {
    next(error);
  }
};

// Get single quiz for taking
exports.getQuiz = async (req, res, next) => {
  try {
    const quiz = await Quiz.findById(req.params.id);
    if (!quiz) return res.status(404).json({ success: false, message: 'Quiz not found' });
    if (req.user.role === 'student') {
      const enrollment = await requireCourseEnrollment(req, quiz.courseId);
      if (!enrollment || quiz.published === false) {
        return res.status(403).json({ success: false, message: 'You must be enrolled to access this quiz' });
      }
    } else if (!(await canManageQuiz(req, quiz.courseId))) {
      return res.status(403).json({ success: false, message: 'You are not authorized to access this quiz' });
    }

    // Exclude correctAnswer for students taking quiz
    const sanitizedQuiz = quiz.toObject();
    if (req.user.role === 'student') {
      sanitizedQuiz.questions = sanitizedQuiz.questions.map(q => {
        const { correctAnswer, ...rest } = q;
        return rest;
      });
    }

    res.status(200).json({ success: true, quiz: sanitizedQuiz });
  } catch (error) {
    next(error);
  }
};

// Create quiz (admin)
exports.createQuiz = async (req, res, next) => {
  try {
    if (!(await canManageQuiz(req, req.body.courseId))) {
      return res.status(403).json({ success: false, message: 'You are not authorized to manage this course' });
    }
    const { title, courseId, moduleId, instructions, timeLimitMinutes, passingPercentage, maxAttempts, deadline, published, questions } = req.body;
    const quiz = await Quiz.create({ title, courseId, moduleId, instructions, timeLimitMinutes, passingPercentage, maxAttempts, deadline, published, questions });
    res.status(201).json({ success: true, quiz });
  } catch (error) {
    next(error);
  }
};

// Submit quiz attempt
exports.submitQuiz = async (req, res, next) => {
  try {
    const { answers } = req.body; // [{ questionIndex: 0, answer: "..." }]
    const quiz = await Quiz.findById(req.params.id);
    if (!quiz) return res.status(404).json({ success: false, message: 'Quiz not found' });
    const enrollment = await requireCourseEnrollment(req, quiz.courseId);
    if (!enrollment) {
      return res.status(403).json({ success: false, message: 'You must be enrolled to submit this quiz' });
    }
    if (quiz.deadline && new Date() > quiz.deadline) {
      return res.status(400).json({ success: false, message: 'This quiz is past its deadline' });
    }
    const attempts = await QuizAttempt.countDocuments({ quizId: quiz._id, studentId: req.user.id });
    if (quiz.maxAttempts > 0 && attempts >= quiz.maxAttempts) {
      return res.status(400).json({ success: false, message: 'Maximum quiz attempts reached' });
    }

    let score = 0;
    const evaluatedAnswers = quiz.questions.map((q, idx) => {
      const userAnsObj = (answers || []).find(a => a.questionIndex === idx);
      const userAns = userAnsObj ? userAnsObj.answer : '';
      const normalizedUserAnswer = Array.isArray(userAns)
        ? userAns.map(answer => String(answer).trim().toLowerCase()).sort().join('|')
        : String(userAns).trim().toLowerCase();
      const normalizedCorrectAnswer = Array.isArray(q.correctAnswer)
        ? q.correctAnswer.map(answer => String(answer).trim().toLowerCase()).sort().join('|')
        : String(q.correctAnswer).trim().toLowerCase();
      const isCorrect = normalizedUserAnswer === normalizedCorrectAnswer;
      if (isCorrect) score += (q.points || 1);
      return {
        questionIndex: idx,
        userAnswer: userAns,
        isCorrect
      };
    });

    const totalScore = quiz.questions.reduce((sum, q) => sum + (q.points || 1), 0);
    const percentage = totalScore > 0 ? Math.round((score / totalScore) * 100) : 0;
    const passed = percentage >= quiz.passingPercentage;

    const attempt = await QuizAttempt.create({
      quizId: quiz._id,
      studentId: req.user.id,
      courseId: quiz.courseId,
      score,
      totalScore,
      percentage,
      passed,
      answers: evaluatedAnswers
    });

    res.status(200).json({
      success: true,
      attempt,
      percentage,
      passed,
      score,
      totalScore
    });
  } catch (error) {
    next(error);
  }
};

// Get student attempts
exports.getMyAttempts = async (req, res, next) => {
  try {
    const attempts = await QuizAttempt.find({ studentId: req.user.id })
      .populate('quizId', 'title')
      .populate('courseId', 'title')
      .sort('-createdAt');
    res.status(200).json({ success: true, attempts });
  } catch (error) {
    next(error);
  }
};
