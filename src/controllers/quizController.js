const mongoose = require('mongoose');
const Quiz = require('../models/Quiz');
const QuizAttempt = require('../models/QuizAttempt');
const Module = require('../models/Module');
const Lesson = require('../models/Lesson');
const { requireCourseEnrollment, isCourseOwnerOrAdmin } = require('../middleware/auth');
const { logAudit } = require('../utils/audit');

// Answers are stored as option indexes (numbers). The legacy student flow sent
// the option text, so text answers are resolved back to their index here.
const normalizeAnswer = (question, raw) => {
  if (raw === undefined || raw === null || raw === '') return null;
  const toIndex = (value) => {
    const asNumber = Number(value);
    if (Number.isInteger(asNumber) && asNumber >= 0 && asNumber < (question.options?.length || 0)
      && typeof value !== 'string') {
      return asNumber;
    }
    if (typeof value === 'string') {
      const trimmed = value.trim();
      if (/^\d+$/.test(trimmed) && Number(trimmed) < (question.options?.length || 0)) {
        return Number(trimmed);
      }
      const byText = (question.options || []).findIndex(
        (opt) => String(opt).trim().toLowerCase() === trimmed.toLowerCase()
      );
      if (byText !== -1) return byText;
      if (question.questionType === 'true-false') {
        if (/^true$/i.test(trimmed)) return 0;
        if (/^false$/i.test(trimmed)) return 1;
      }
    }
    return typeof value === 'string' ? value : null;
  };

  if (question.questionType === 'multiple-select') {
    if (!Array.isArray(raw)) return null;
    const mapped = raw.map(toIndex).filter((v) => Number.isInteger(v));
    return mapped.sort((a, b) => a - b);
  }
  if (Array.isArray(raw)) return null;
  return toIndex(raw);
};

const sameAnswer = (a, b) => JSON.stringify(a ?? null) === JSON.stringify(b ?? null);

const sanitizeQuestion = (q, { includeCorrect }) => {
  const obj = {
    _id: q._id,
    questionText: q.questionText,
    questionType: q.questionType,
    options: q.options || [],
    points: q.points ?? 1
  };
  // Explanations can contain the correct answer, so they follow the same gate.
  if (includeCorrect) {
    obj.correctAnswer = q.correctAnswer;
    obj.explanation = q.explanation || '';
  }
  return obj;
};

const stripCorrectAnswers = (quiz) => {
  const obj = typeof quiz.toObject === 'function' ? quiz.toObject() : quiz;
  return {
    ...obj,
    questions: (obj.questions || []).map((q) => sanitizeQuestion(q, { includeCorrect: false }))
  };
};

const validateQuizPayload = (body, { forPublish }) => {
  const errors = [];
  const questions = Array.isArray(body.questions) ? body.questions : [];
  if (forPublish && questions.length === 0) {
    errors.push('A published quiz needs at least one question.');
  }
  questions.forEach((q, idx) => {
    const label = `Question ${idx + 1}`;
    if (!String(q.questionText || '').trim()) errors.push(`${label}: question text is required.`);
    const type = q.questionType || 'multiple-choice';
    if (!['multiple-choice', 'multiple-select', 'true-false', 'short-answer'].includes(type)) {
      errors.push(`${label}: unsupported question type.`);
    }
    if (type !== 'short-answer') {
      const options = Array.isArray(q.options) ? q.options.filter((o) => String(o ?? '').trim() !== '') : [];
      if (forPublish && options.length < (type === 'true-false' ? 2 : 4)) {
        errors.push(`${label}: ${type === 'true-false' ? 'true/false questions need two options.' : 'four answer options are required.'}`);
      }
      const correct = q.correctAnswer;
      const validIndexes = Array.isArray(correct)
        ? correct.every((v) => Number.isInteger(Number(v)) && Number(v) >= 0 && Number(v) < options.length) && correct.length > 0
        : Number.isInteger(Number(correct)) && Number(correct) >= 0 && Number(correct) < options.length;
      if (!validIndexes) errors.push(`${label}: select at least one valid correct option.`);
    } else if (q.correctAnswer === undefined || q.correctAnswer === null || String(q.correctAnswer).trim() === '') {
      errors.push(`${label}: a reference answer is required for short-answer questions.`);
    }
    if (q.points !== undefined && (!Number.isFinite(Number(q.points)) || Number(q.points) < 0)) {
      errors.push(`${label}: marks must be a positive number.`);
    }
  });
  if (body.timeLimitMinutes !== undefined && (!Number.isFinite(Number(body.timeLimitMinutes)) || Number(body.timeLimitMinutes) < 0)) {
    errors.push('Duration must be zero or a positive number of minutes.');
  }
  if (body.passingPercentage !== undefined && (Number(body.passingPercentage) < 0 || Number(body.passingPercentage) > 100)) {
    errors.push('Passing percentage must be between 0 and 100.');
  }
  return errors;
};

const mapBodyToQuizFields = (body) => {
  const fields = {};
  [
    'title', 'description', 'courseId', 'moduleId', 'lessonId', 'instructions',
    'timeLimitMinutes', 'passingPercentage', 'feedbackMode', 'maxAttempts', 'deadline', 'published', 'order'
  ].forEach((key) => {
    if (body[key] !== undefined) fields[key] = body[key];
  });
  if (body.questions !== undefined) {
    fields.questions = (body.questions || []).map((q, idx) => ({
      questionText: q.questionText,
      questionType: q.questionType || 'multiple-choice',
      options: q.options || [],
      correctAnswer: q.correctAnswer,
      explanation: q.explanation || '',
      points: q.points ?? 1,
      _id: q._id && mongoose.isValidObjectId(q._id) ? q._id : undefined,
      order: idx
    }));
    // Keep only meaningful ids (new questions must not carry stale ObjectIds)
    fields.questions = fields.questions.map(({ order, ...q }) => q);
  }
  if (fields.timeLimitMinutes !== undefined) fields.timeLimitMinutes = Number(fields.timeLimitMinutes) || 0;
  if (fields.passingPercentage !== undefined) fields.passingPercentage = Number(fields.passingPercentage);
  if (fields.maxAttempts !== undefined) fields.maxAttempts = Number(fields.maxAttempts) || 0;
  if (fields.moduleId === '') fields.moduleId = null;
  if (fields.lessonId === '') fields.lessonId = null;
  return fields;
};

const ensureQuizManager = async (req, res, courseId) => {
  if (!mongoose.isValidObjectId(courseId)) {
    res.status(400).json({ success: false, message: 'Invalid course id' });
    return null;
  }
  const manager = await isCourseOwnerOrAdmin(req, courseId);
  if (!manager.allowed) {
    res.status(403).json({ success: false, message: 'You are not authorized to manage quizzes for this course' });
    return null;
  }
  return manager;
};

const attachContext = async (quizzes) => {
  const moduleIds = quizzes.map((q) => q.moduleId).filter(Boolean);
  const lessonIds = quizzes.map((q) => q.lessonId).filter(Boolean);
  const [modules, lessons] = await Promise.all([
    moduleIds.length ? Module.find({ _id: { $in: moduleIds } }).select('title order') : [],
    lessonIds.length ? Lesson.find({ _id: { $in: lessonIds } }).select('title order') : []
  ]);
  const moduleMap = new Map(modules.map((m) => [m._id.toString(), m]));
  const lessonMap = new Map(lessons.map((l) => [l._id.toString(), l]));
  return quizzes.map((q) => ({
    ...q,
    moduleTitle: q.moduleId ? moduleMap.get(q.moduleId.toString())?.title || null : null,
    lessonTitle: q.lessonId ? lessonMap.get(q.lessonId.toString())?.title || null : null
  }));
};

const buildStudentStats = async (quiz, studentId) => {
  const attempts = await QuizAttempt.find({
    quizId: quiz._id,
    studentId,
    status: 'completed'
  }).sort('-createdAt').lean();
  const inProgress = await QuizAttempt.findOne({ quizId: quiz._id, studentId, status: 'in_progress' }).lean();
  const bestPercentage = attempts.length ? Math.max(...attempts.map((a) => a.percentage)) : null;
  const latest = attempts[0] || null;
  const attemptsUsed = attempts.length;
  const attemptsLeft = quiz.maxAttempts > 0 ? Math.max(0, quiz.maxAttempts - attemptsUsed) : null;
  return {
    attemptsUsed,
    attemptsLeft,
    canStart: (quiz.maxAttempts === 0 || attemptsLeft > 0 || Boolean(inProgress)) && (!quiz.deadline || new Date() <= quiz.deadline),
    bestPercentage,
    latestAttempt: latest ? {
      _id: latest._id,
      score: latest.score,
      totalScore: latest.totalScore,
      percentage: latest.percentage,
      passed: latest.passed,
      attemptNumber: latest.attemptNumber,
      submittedAt: latest.submittedAt || latest.createdAt
    } : null,
    inProgressAttempt: inProgress ? { _id: inProgress._id, startedAt: inProgress.startedAt } : null
  };
};

const buildReview = (quiz, attempt) => {
  // buildReview is only ever assembled once an attempt is finalized, so the
  // correct answers are released here in BOTH feedback modes. The difference
  // between Practice and Assessment is enforced earlier (during the attempt).
  return (quiz.questions || []).map((q, idx) => {
    const saved = (attempt.answers || []).find((a) => a.questionIndex === idx);
    const answered = saved && saved.userAnswer !== undefined && saved.userAnswer !== null
      && !(Array.isArray(saved.userAnswer) && saved.userAnswer.length === 0) && saved.userAnswer !== '';
    const review = {
      questionIndex: idx,
      questionText: q.questionText,
      questionType: q.questionType,
      options: q.options || [],
      points: q.points ?? 1,
      userAnswer: answered ? saved.userAnswer : null,
      userAnswerText: answered
        ? (Array.isArray(saved.userAnswer)
          ? saved.userAnswer.map((i) => q.options?.[Number(i)] ?? String(i)).join(', ')
          : (q.options?.[Number(saved.userAnswer)] ?? String(saved.userAnswer)))
        : '',
      isCorrect: Boolean(saved?.isCorrect),
      marksEarned: saved?.marksEarned ?? 0,
      answered: Boolean(answered)
    };
    review.correctAnswer = q.correctAnswer;
    review.correctAnswerTexts = Array.isArray(q.correctAnswer)
      ? q.correctAnswer.map((i) => q.options?.[Number(i)] ?? String(i))
      : [q.options?.[Number(q.correctAnswer)] ?? String(q.correctAnswer)];
    review.explanation = q.explanation || '';
    return review;
  });
};

// ============================================================
// Student-facing endpoints
// ============================================================

// GET /quizzes/course/:courseId - published quizzes for the classroom list
exports.getQuizzesByCourse = async (req, res, next) => {
  try {
    const { courseId } = req.params;
    if (!mongoose.isValidObjectId(courseId)) {
      return res.status(400).json({ success: false, message: 'Invalid course id' });
    }
    const enrollment = await requireCourseEnrollment(req, courseId);
    if (!enrollment && !(await isCourseOwnerOrAdmin(req, courseId)).allowed) {
      return res.status(403).json({ success: false, message: 'You must be enrolled to access quizzes for this course' });
    }
    const filter = { courseId };
    if (req.user.role === 'student') filter.published = true;
    const quizzes = (await Quiz.find(filter).sort('order createdAt')).map(stripCorrectAnswers);
    const withContext = await attachContext(quizzes);
    res.status(200).json({ success: true, quizzes: withContext });
  } catch (error) {
    next(error);
  }
}

// GET /quizzes/course/:courseId/my - quiz cards with the student's own stats
exports.getMyCourseQuizzes = async (req, res, next) => {
  try {
    const { courseId } = req.params;
    const enrollment = await requireCourseEnrollment(req, courseId);
    if (!enrollment) {
      return res.status(403).json({ success: false, message: 'An active enrollment is required to access quizzes' });
    }
    const quizzes = await Quiz.find({ courseId, published: true }).sort('order createdAt');
    const payloads = await Promise.all(quizzes.map(async (quiz) => ({
      ...stripCorrectAnswers(quiz),
      stats: await buildStudentStats(quiz, req.user.id)
    })));
    const withContext = await attachContext(payloads);
    res.status(200).json({ success: true, quizzes: withContext });
  } catch (error) {
    next(error);
  }
};

// GET /quizzes/:id - open a quiz for taking (correct answers stripped)
exports.getQuiz = async (req, res, next) => {
  try {
    const quiz = await Quiz.findById(req.params.id);
    if (!quiz) return res.status(404).json({ success: false, message: 'Quiz not found' });

    if (req.user.role === 'student') {
      const enrollment = await requireCourseEnrollment(req, quiz.courseId);
      if (!enrollment || quiz.published === false) {
        return res.status(403).json({ success: false, message: 'You must be enrolled to access this quiz' });
      }
      const payload = stripCorrectAnswers(quiz);
      payload.stats = await buildStudentStats(quiz, req.user.id);
      const [withContext] = await attachContext([payload]);
      return res.status(200).json({ success: true, quiz: withContext });
    }

    const manager = await isCourseOwnerOrAdmin(req, quiz.courseId);
    if (!manager.allowed) {
      return res.status(403).json({ success: false, message: 'You are not authorized to access this quiz' });
    }
    // Managers editing via the student preview still should not leak here; the
    // dedicated admin endpoint returns full data.
    res.status(200).json({ success: true, quiz: stripCorrectAnswers(quiz) });
  } catch (error) {
    next(error);
  }
};

// POST /quizzes/:id/start - create or resume the current in-progress attempt
exports.startQuiz = async (req, res, next) => {
  try {
    const quiz = await Quiz.findById(req.params.id);
    if (!quiz) return res.status(404).json({ success: false, message: 'Quiz not found' });
    if (!quiz.published) {
      return res.status(400).json({ success: false, message: 'This quiz is not published yet' });
    }
    const enrollment = await requireCourseEnrollment(req, quiz.courseId);
    if (!enrollment) {
      return res.status(403).json({ success: false, message: 'An active enrollment is required to start this quiz' });
    }
    if (quiz.deadline && new Date() > quiz.deadline) {
      return res.status(400).json({ success: false, message: 'This quiz is past its deadline' });
    }

    let attempt = await QuizAttempt.findOne({ quizId: quiz._id, studentId: req.user.id, status: 'in_progress' });
    if (!attempt) {
      const completed = await QuizAttempt.countDocuments({ quizId: quiz._id, studentId: req.user.id, status: 'completed' });
      if (quiz.maxAttempts > 0 && completed >= quiz.maxAttempts) {
        return res.status(400).json({ success: false, message: 'Maximum quiz attempts reached' });
      }
      attempt = await QuizAttempt.create({
        quizId: quiz._id,
        studentId: req.user.id,
        courseId: quiz.courseId,
        attemptNumber: completed + 1,
        status: 'in_progress',
        startedAt: new Date()
      });
      await logAudit({
        action: 'QUIZ_ATTEMPT_STARTED',
        performedBy: req.user,
        role: req.user.role,
        targetResource: 'QuizAttempt',
        targetId: attempt._id,
        details: { quiz: quiz.title, attemptNumber: attempt.attemptNumber }
      });
    }

    const includeCorrect = false;
    res.status(200).json({
      success: true,
      attempt: {
        _id: attempt._id,
        attemptNumber: attempt.attemptNumber,
        startedAt: attempt.startedAt,
        answers: attempt.answers.map((a) => ({ questionIndex: a.questionIndex, userAnswer: a.userAnswer }))
      },
      quiz: {
        ...stripCorrectAnswers(quiz),
        questions: (quiz.questions || []).map((q) => sanitizeQuestion(q, { includeCorrect }))
      },
      stats: await buildStudentStats(quiz, req.user.id)
    });
  } catch (error) {
    next(error);
  }
};

// PUT /quizzes/:id/attempt/:attemptId/answer - persist one answer (refresh-safe)
exports.saveAnswer = async (req, res, next) => {
  try {
    const { attemptId } = req.params;
    const { questionIndex, answer } = req.body;
    const attempt = await QuizAttempt.findOne({ _id: attemptId, studentId: req.user.id, quizId: req.params.id });
    if (!attempt) return res.status(404).json({ success: false, message: 'Attempt not found' });
    if (attempt.status !== 'in_progress') {
      return res.status(400).json({ success: false, message: 'This attempt has already been submitted' });
    }
    const quiz = await Quiz.findById(attempt.quizId);
    const idx = Number(questionIndex);
    if (!Number.isInteger(idx) || idx < 0 || idx >= quiz.questions.length) {
      return res.status(400).json({ success: false, message: 'Invalid question index' });
    }

    const normalized = normalizeAnswer(quiz.questions[idx], answer);
    const existing = attempt.answers.find((a) => a.questionIndex === idx);
    if (existing) {
      existing.userAnswer = normalized ?? undefined;
      if (normalized === null) existing.userAnswer = undefined;
    } else {
      attempt.answers.push({ questionIndex: idx, userAnswer: normalized ?? undefined });
    }
    attempt.markModified('answers');
    await attempt.save();
    res.status(200).json({ success: true, saved: true });
  } catch (error) {
    next(error);
  }
};

// POST /quizzes/:id/attempt/:attemptId/check - practice-mode per-question check
exports.checkAnswer = async (req, res, next) => {
  try {
    const attempt = await QuizAttempt.findOne({
      _id: req.params.attemptId,
      quizId: req.params.id,
      studentId: req.user.id
    });
    if (!attempt) return res.status(404).json({ success: false, message: 'Attempt not found' });
    if (attempt.status !== 'in_progress') {
      return res.status(400).json({ success: false, message: 'This attempt has already been submitted' });
    }
    const quiz = await Quiz.findById(attempt.quizId);
    if (quiz.feedbackMode !== 'immediate') {
      return res.status(403).json({
        success: false,
        message: 'Per-question answer checking is only available in Practice mode. Your feedback unlocks after submission.'
      });
    }
    const idx = Number(req.body.questionIndex);
    const question = quiz.questions[idx];
    if (!question) return res.status(400).json({ success: false, message: 'Invalid question index' });

    const raw = req.body.answer !== undefined ? req.body.answer : undefined;
    const normalized = normalizeAnswer(question, raw);
    const correct = normalized !== null && sameAnswer(normalized, question.correctAnswer);

    const result = {
      success: true,
      isCorrect: correct,
      answered: normalized !== null,
      explanation: question.explanation || ''
    };
    // Practice mode reveals the correct answer set; assessment mode only
    // says right/wrong until the final submission.
    if (quiz.feedbackMode === 'immediate') {
      result.correctAnswer = question.correctAnswer;
      result.correctAnswerTexts = Array.isArray(question.correctAnswer)
        ? question.correctAnswer.map((i) => question.options?.[Number(i)] ?? String(i))
        : [question.options?.[Number(question.correctAnswer)] ?? String(question.correctAnswer)];
    }
    res.status(200).json(result);
  } catch (error) {
    next(error);
  }
};

// POST /quizzes/:id/submit or /quizzes/:id/attempt/:attemptId/submit
exports.submitQuiz = async (req, res, next) => {
  try {
    const quiz = await Quiz.findById(req.params.id);
    if (!quiz) return res.status(404).json({ success: false, message: 'Quiz not found' });
    const enrollment = await requireCourseEnrollment(req, quiz.courseId);
    if (!enrollment) {
      return res.status(403).json({ success: false, message: 'An active enrollment is required to submit this quiz' });
    }

    let attempt;
    if (req.params.attemptId) {
      attempt = await QuizAttempt.findOne({ _id: req.params.attemptId, quizId: quiz._id, studentId: req.user.id });
    }
    if (!attempt) {
      // Legacy path: no attempt started - score the payload directly as a new attempt.
      const completed = await QuizAttempt.countDocuments({ quizId: quiz._id, studentId: req.user.id, status: 'completed' });
      if (quiz.maxAttempts > 0 && completed >= quiz.maxAttempts) {
        return res.status(400).json({ success: false, message: 'Maximum quiz attempts reached' });
      }
      attempt = await QuizAttempt.create({
        quizId: quiz._id,
        studentId: req.user.id,
        courseId: quiz.courseId,
        attemptNumber: completed + 1,
        startedAt: new Date()
      });
    }
    if (attempt.status === 'completed') {
      return res.status(409).json({
        success: false,
        code: 'ALREADY_SUBMITTED',
        message: 'This attempt has already been submitted',
        attempt
      });
    }
    if (quiz.deadline && new Date() > quiz.deadline) {
      return res.status(400).json({ success: false, message: 'This quiz is past its deadline' });
    }

    // Merge freshly submitted answers over progressively saved ones.
    const incoming = Array.isArray(req.body.answers) ? req.body.answers : [];
    for (const item of incoming) {
      const idx = Number(item.questionIndex);
      const question = quiz.questions[idx];
      if (!question) continue;
      const normalized = normalizeAnswer(question, item.answer);
      const existing = attempt.answers.find((a) => a.questionIndex === idx);
      if (existing) existing.userAnswer = normalized ?? undefined;
      else attempt.answers.push({ questionIndex: idx, userAnswer: normalized ?? undefined });
    }

    let score = 0;
    attempt.answers.forEach((entry) => {
      const question = quiz.questions[entry.questionIndex];
      if (!question) return;
      const isCorrect = entry.userAnswer !== undefined
        && entry.userAnswer !== null
        && sameAnswer(entry.userAnswer, question.correctAnswer);
      entry.isCorrect = isCorrect;
      entry.marksEarned = isCorrect ? (question.points ?? 1) : 0;
      if (isCorrect) score += entry.marksEarned;
    });

    const totalScore = quiz.totalMarks();
    const percentage = totalScore > 0 ? Math.round((score / totalScore) * 100) : 0;
    const passed = percentage >= quiz.passingPercentage;
    const submittedAt = new Date();
    const timeSpentSeconds = Math.max(0, Math.round((submittedAt - attempt.startedAt) / 1000));

    attempt.score = score;
    attempt.totalScore = totalScore;
    attempt.percentage = percentage;
    attempt.passed = passed;
    attempt.status = 'completed';
    attempt.submittedAt = submittedAt;
    attempt.timeSpentSeconds = timeSpentSeconds;
    attempt.markModified('answers');
    await attempt.save();

    await logAudit({
      action: 'QUIZ_ATTEMPT_SUBMITTED',
      performedBy: req.user,
      role: req.user.role,
      targetResource: 'QuizAttempt',
      targetId: attempt._id,
      details: { quiz: quiz.title, attemptNumber: attempt.attemptNumber, percentage, passed }
    });

    const attemptsLeftAfter = quiz.maxAttempts > 0
      ? Math.max(0, quiz.maxAttempts - await QuizAttempt.countDocuments({ quizId: quiz._id, studentId: req.user.id, status: 'completed' }))
      : null;

    res.status(200).json({
      success: true,
      attempt,
      quiz: {
        _id: quiz._id,
        title: quiz.title,
        passingPercentage: quiz.passingPercentage,
        feedbackMode: quiz.feedbackMode,
        maxAttempts: quiz.maxAttempts
      },
      result: {
        score,
        totalScore,
        percentage,
        passed,
        timeSpentSeconds,
        attemptNumber: attempt.attemptNumber,
        review: buildReview(quiz, attempt)
      },
      attemptsLeft: attemptsLeftAfter
    });
  } catch (error) {
    next(error);
  }
};

// GET /quizzes/:id/attempt/:attemptId/result - persisted result page data
exports.getAttemptResult = async (req, res, next) => {
  try {
    const attempt = await QuizAttempt.findOne({ _id: req.params.attemptId, quizId: req.params.id });
    if (!attempt) return res.status(404).json({ success: false, message: 'Attempt not found' });
    const isManager = await isCourseOwnerOrAdmin(req, attempt.courseId);
    if (req.user.role !== 'admin' && String(attempt.studentId) !== String(req.user.id) && !isManager.allowed) {
      return res.status(403).json({ success: false, message: 'You can only view your own quiz results' });
    }
    if (attempt.status !== 'completed') {
      return res.status(400).json({ success: false, message: 'This attempt has not been submitted yet' });
    }
    const quiz = await Quiz.findById(attempt.quizId);
    if (!quiz) return res.status(404).json({ success: false, message: 'Quiz not found' });

    // The owner of a completed attempt sees the full review; other students
    // never get correct answers.
    const showFullReview = String(attempt.studentId) === String(req.user.id) || isManager.allowed;
    const reviewQuiz = {
      ...quiz.toObject(),
      feedbackMode: showFullReview ? quiz.feedbackMode : 'deferred'
    };
    const attemptsLeft = quiz.maxAttempts > 0
      ? Math.max(0, quiz.maxAttempts - await QuizAttempt.countDocuments({ quizId: quiz._id, studentId: attempt.studentId, status: 'completed' }))
      : null;

    res.status(200).json({
      success: true,
      attempt: {
        _id: attempt._id,
        attemptNumber: attempt.attemptNumber,
        score: attempt.score,
        totalScore: attempt.totalScore,
        percentage: attempt.percentage,
        passed: attempt.passed,
        startedAt: attempt.startedAt,
        submittedAt: attempt.submittedAt,
        timeSpentSeconds: attempt.timeSpentSeconds
      },
      quiz: {
        _id: quiz._id,
        title: quiz.title,
        description: quiz.description,
        passingPercentage: quiz.passingPercentage,
        feedbackMode: quiz.feedbackMode,
        maxAttempts: quiz.maxAttempts,
        deadline: quiz.deadline
      },
      showFullReview,
      attemptsLeft,
      result: {
        score: attempt.score,
        totalScore: attempt.totalScore,
        percentage: attempt.percentage,
        passed: attempt.passed,
        timeSpentSeconds: attempt.timeSpentSeconds,
        attemptNumber: attempt.attemptNumber,
        review: showFullReview ? buildReview(reviewQuiz, attempt) : []
      }
    });
  } catch (error) {
    next(error);
  }
};

// GET /quizzes/:id/attempts - attempt history for one quiz (student: own)
exports.getQuizAttempts = async (req, res, next) => {
  try {
    const quiz = await Quiz.findById(req.params.id);
    if (!quiz) return res.status(404).json({ success: false, message: 'Quiz not found' });
    const filter = { quizId: quiz._id, status: 'completed' };
    if (req.user.role !== 'admin') {
      const enrollment = await requireCourseEnrollment(req, quiz.courseId);
      if (!enrollment) {
        return res.status(403).json({ success: false, message: 'An active enrollment is required' });
      }
      filter.studentId = req.user.id;
    }
    const attempts = await QuizAttempt.find(filter).sort('-createdAt').lean();
    res.status(200).json({ success: true, attempts });
  } catch (error) {
    next(error);
  }
};

// GET /quizzes/attempts/my - all attempts for the signed-in student
exports.getMyAttempts = async (req, res, next) => {
  try {
    const attempts = await QuizAttempt.find({ studentId: req.user.id, status: 'completed' })
      .populate('quizId', 'title passingPercentage feedbackMode')
      .populate('courseId', 'title')
      .sort('-createdAt');
    res.status(200).json({ success: true, attempts });
  } catch (error) {
    next(error);
  }
};

// ============================================================
// Admin quiz builder endpoints (/quizzes/admin/*)
// ============================================================

exports.adminListQuizzes = async (req, res, next) => {
  try {
    const filter = {};
    if (req.query.courseId) filter.courseId = req.query.courseId;
    if (req.query.moduleId) filter.moduleId = req.query.moduleId;
    const quizzes = await Quiz.find(filter).sort('order createdAt').lean();
    const enriched = await Promise.all(quizzes.map(async (q) => ({
      ...q,
      totalMarks: (q.questions || []).reduce((sum, item) => sum + (item.points ?? 1), 0),
      attemptCount: await QuizAttempt.countDocuments({ quizId: q._id, status: 'completed' })
    })));
    const withContext = await attachContext(enriched);
    res.status(200).json({ success: true, quizzes: withContext });
  } catch (error) {
    next(error);
  }
};

exports.adminGetQuiz = async (req, res, next) => {
  try {
    const quiz = await Quiz.findById(req.params.id);
    if (!quiz) return res.status(404).json({ success: false, message: 'Quiz not found' });
    const manager = await ensureQuizManager(req, res, quiz.courseId);
    if (!manager) return;
    const attemptCount = await QuizAttempt.countDocuments({ quizId: quiz._id, status: 'completed' });
    res.status(200).json({ success: true, quiz: { ...quiz.toObject(), attemptCount } });
  } catch (error) {
    next(error);
  }
};

exports.createQuiz = async (req, res, next) => {
  try {
    const { courseId } = req.body;
    if (!courseId) return res.status(400).json({ success: false, message: 'Course is required' });
    const manager = await ensureQuizManager(req, res, courseId);
    if (!manager) return;

    const errors = validateQuizPayload(req.body, { forPublish: Boolean(req.body.published) });
    if (errors.length) return res.status(400).json({ success: false, message: 'Fix the highlighted issues', errors });

    const fields = mapBodyToQuizFields(req.body);
    if (fields.order === undefined) {
      const count = await Quiz.countDocuments({ courseId });
      fields.order = count + 1;
    }
    const quiz = await Quiz.create(fields);

    await logAudit({
      action: req.body.published ? 'QUIZ_PUBLISHED' : 'QUIZ_DRAFT_CREATED',
      performedBy: req.user,
      role: req.user.role,
      targetResource: 'Quiz',
      targetId: quiz._id,
      details: { title: quiz.title, courseId }
    });
    res.status(201).json({ success: true, quiz });
  } catch (error) {
    next(error);
  }
};

exports.updateQuiz = async (req, res, next) => {
  try {
    const quiz = await Quiz.findById(req.params.id);
    if (!quiz) return res.status(404).json({ success: false, message: 'Quiz not found' });
    const manager = await ensureQuizManager(req, res, quiz.courseId);
    if (!manager) return;

    const errors = validateQuizPayload(
      { ...quiz.toObject(), ...req.body },
      { forPublish: req.body.published !== undefined ? Boolean(req.body.published) : quiz.published }
    );
    if (errors.length) return res.status(400).json({ success: false, message: 'Fix the highlighted issues', errors });

    const fields = mapBodyToQuizFields(req.body);
    delete fields.courseId;
    Object.assign(quiz, fields);
    await quiz.save();

    await logAudit({
      action: 'QUIZ_UPDATED',
      performedBy: req.user,
      role: req.user.role,
      targetResource: 'Quiz',
      targetId: quiz._id,
      details: { title: quiz.title }
    });
    res.status(200).json({ success: true, quiz });
  } catch (error) {
    next(error);
  }
};

exports.publishQuiz = async (req, res, next) => {
  try {
    const quiz = await Quiz.findById(req.params.id);
    if (!quiz) return res.status(404).json({ success: false, message: 'Quiz not found' });
    const manager = await ensureQuizManager(req, res, quiz.courseId);
    if (!manager) return;

    const errors = validateQuizPayload(quiz.toObject(), { forPublish: true });
    if (errors.length) return res.status(400).json({ success: false, message: 'Quiz is not ready to publish', errors });

    quiz.published = true;
    await quiz.save();
    await logAudit({
      action: 'QUIZ_PUBLISHED',
      performedBy: req.user,
      role: req.user.role,
      targetResource: 'Quiz',
      targetId: quiz._id,
      details: { title: quiz.title }
    });
    res.status(200).json({ success: true, quiz });
  } catch (error) {
    next(error);
  }
};

exports.unpublishQuiz = async (req, res, next) => {
  try {
    const quiz = await Quiz.findById(req.params.id);
    if (!quiz) return res.status(404).json({ success: false, message: 'Quiz not found' });
    const manager = await ensureQuizManager(req, res, quiz.courseId);
    if (!manager) return;

    quiz.published = false;
    await quiz.save();
    await logAudit({
      action: 'QUIZ_UNPUBLISHED',
      performedBy: req.user,
      role: req.user.role,
      targetResource: 'Quiz',
      targetId: quiz._id,
      details: { title: quiz.title }
    });
    res.status(200).json({ success: true, quiz });
  } catch (error) {
    next(error);
  }
};

exports.reorderQuizzes = async (req, res, next) => {
  try {
    const { courseId, quizIds } = req.body;
    if (!Array.isArray(quizIds)) return res.status(400).json({ success: false, message: 'quizIds must be an array' });
    const manager = await ensureQuizManager(req, res, courseId);
    if (!manager) return;
    await Promise.all(quizIds.map((id, idx) => Quiz.updateOne(
      { _id: id, courseId },
      { $set: { order: idx + 1 } }
    )));
    res.status(200).json({ success: true, message: 'Quiz order updated' });
  } catch (error) {
    next(error);
  }
};

exports.deleteQuiz = async (req, res, next) => {
  try {
    const quiz = await Quiz.findById(req.params.id);
    if (!quiz) return res.status(404).json({ success: false, message: 'Quiz not found' });
    const manager = await ensureQuizManager(req, res, quiz.courseId);
    if (!manager) return;

    const attemptCount = await QuizAttempt.countDocuments({ quizId: quiz._id });
    if (attemptCount > 0 && req.query.confirm !== 'true') {
      return res.status(409).json({
        success: false,
        code: 'QUIZ_HAS_ATTEMPTS',
        message: `This quiz has ${attemptCount} saved attempt(s). Deleting it also removes their results.`,
        attemptCount
      });
    }

    await QuizAttempt.deleteMany({ quizId: quiz._id });
    await Quiz.findByIdAndDelete(quiz._id);

    await logAudit({
      action: 'QUIZ_DELETED',
      performedBy: req.user,
      role: req.user.role,
      targetResource: 'Quiz',
      targetId: quiz._id,
      details: { title: quiz.title, removedAttempts: attemptCount }
    });
    res.status(200).json({ success: true, message: 'Quiz deleted' });
  } catch (error) {
    next(error);
  }
};
