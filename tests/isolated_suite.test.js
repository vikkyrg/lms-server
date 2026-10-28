/**
 * Isolated Automated Integration Test Suite - AutoOps School LMS
 * IMPORTANT: Connects strictly to an isolated test database (lms_test_suite_db)
 * Never touches or modifies the production lms_db.
 */
const assert = require('assert');
const mongoose = require('mongoose');
const http = require('http');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const NodeModule = require('module');

const TEST_DB_URI = 'mongodb://127.0.0.1:27017/lms_test_suite_db';

process.env.MONGODB_URI = TEST_DB_URI;
process.env.NODE_ENV = 'test';
process.env.PORT = '5099';
process.env.JWT_SECRET = 'test_jwt_secret_token_suite_secure';
process.env.RAZORPAY_KEY_ID = 'rzp_test_mock_key';
process.env.RAZORPAY_KEY_SECRET = 'rzp_test_mock_secret';
process.env.RAZORPAY_WEBHOOK_SECRET = 'rzp_test_mock_webhook_secret';

const User = require('../src/models/User');
const Category = require('../src/models/Category');
const Course = require('../src/models/Course');
const Module = require('../src/models/Module');
const Lesson = require('../src/models/Lesson');
const Enrollment = require('../src/models/Enrollment');
const CourseMaterial = require('../src/models/CourseMaterial');
const Quiz = require('../src/models/Quiz');
const QuizAttempt = require('../src/models/QuizAttempt');
const Assignment = require('../src/models/Assignment');
const Submission = require('../src/models/Submission');
const Payment = require('../src/models/Payment');
const Certificate = require('../src/models/Certificate');
const AuditLog = require('../src/models/AuditLog');

const makeRequest = (options, postData = null) => {
  return new Promise((resolve, reject) => {
    const req = http.request(options, (res) => {
      const chunks = [];
      res.on('data', chunk => chunks.push(chunk));
      res.on('end', () => {
        const buf = Buffer.concat(chunks);
        const contentType = res.headers['content-type'] || '';
        if (contentType.includes('application/json')) {
          try {
            resolve({ status: res.statusCode, headers: res.headers, body: buf.length ? JSON.parse(buf.toString('utf8')) : {}, raw: buf });
          } catch (e) {
            resolve({ status: res.statusCode, headers: res.headers, body: {}, raw: buf, text: buf.toString('utf8') });
          }
          return;
        }
        resolve({ status: res.statusCode, headers: res.headers, body: {}, raw: buf, text: buf.toString('utf8') });
      });
    });
    req.on('error', reject);
    if (postData) {
      if (Buffer.isBuffer(postData)) req.write(postData);
      else req.write(typeof postData === 'string' ? postData : JSON.stringify(postData));
    }
    req.end();
  });
};

// Real multipart/form-data upload, so the Admin file-upload path (multer + disk
// storage) is exercised exactly as the Admin panel uses it.
const makeMultipartRequest = (method, apiPath, authHeader, fields, file) => {
  const boundary = `----isolatest${Date.now()}`;
  const parts = [];
  Object.entries(fields).forEach(([name, value]) => {
    parts.push(Buffer.from(
      `--${boundary}\r\nContent-Disposition: form-data; name="${name}"\r\n\r\n${value}\r\n`
    ));
  });
  parts.push(Buffer.from(
    `--${boundary}\r\nContent-Disposition: form-data; name="${file.field}"; filename="${file.name}"\r\n` +
    `Content-Type: ${file.mime}\r\n\r\n`
  ));
  parts.push(file.data);
  parts.push(Buffer.from(`\r\n--${boundary}--\r\n`));
  const body = Buffer.concat(parts);

  return makeRequest({
    hostname: 'localhost',
    port: Number(process.env.PORT),
    path: apiPath,
    method,
    headers: {
      'Content-Type': `multipart/form-data; boundary=${boundary}`,
      'Content-Length': body.length,
      ...(authHeader ? { Authorization: authHeader } : {})
    }
  }, body);
};

// Minimal but structurally real PDF, so "no fake PDF URLs" holds: bytes are
// written to disk by multer and streamed back by the download endpoint.
const buildSamplePdf = (title) => Buffer.from([
  '%PDF-1.4',
  '1 0 obj << /Type /Catalog /Pages 2 0 R >> endobj',
  '2 0 obj << /Type /Pages /Kids [3 0 R] /Count 1 >> endobj',
  '3 0 obj << /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Contents 4 0 R',
  '   /Resources << /Font << /F1 5 0 R >> >> >> endobj',
  `4 0 obj << /Length 60 >> stream`,
  `BT /F1 18 Tf 60 760 Td (${title}) Tj ET`,
  'endstream endobj',
  '5 0 obj << /Type /Font /Subtype /Type1 /BaseFont /Helvetica >> endobj',
  'trailer << /Root 1 0 R >>',
  '%%EOF'
].join('\n'), 'utf8');

const signPayment = (orderId, paymentId) => crypto
  .createHmac('sha256', process.env.RAZORPAY_KEY_SECRET)
  .update(`${orderId}|${paymentId}`)
  .digest('hex');

/**
 * Razorpay is replaced only at its network boundary (orders.create / orders.fetch).
 * Everything under test stays real: the HMAC signature check, timingSafeEqual,
 * the amount/currency re-check, Payment writes, enrollment guards and the
 * Admin approval rules.
 */
const installRazorpayGatewayStub = () => {
  const orders = new Map();
  const RazorpayStub = function Razorpay() {
    this.orders = {
      create: async ({ amount, currency, receipt }) => {
        const order = {
          id: `order_stub_${crypto.randomBytes(6).toString('hex')}`,
          entity: 'order',
          amount,
          currency,
          status: 'created',
          receipt
        };
        orders.set(order.id, order);
        return order;
      },
      fetch: async (orderId) => {
        const order = orders.get(orderId);
        if (!order) throw new Error('Unknown order');
        return order;
      }
    };
    this.payments = {
      fetch: async (paymentId) => ({ id: paymentId, status: 'captured' }),
      refund: async (paymentId) => ({ id: `refund_stub_${paymentId}`, status: 'processed' })
    };
  };

  const originalLoad = NodeModule._load;
  NodeModule._load = function patchedLoad(request, ...rest) {
    if (request === 'razorpay') return RazorpayStub;
    return originalLoad.call(this, request, ...rest);
  };
  return () => { NodeModule._load = originalLoad; };
};

async function runTests() {
  console.log('--- STARTING ISOLATED AUTOMATED TEST SUITE ---');
  console.log(`Connecting to ISOLATED test database: ${TEST_DB_URI}`);

  await mongoose.connect(TEST_DB_URI);
  console.log('Connected to isolated test database.');

  // Clean isolated test DB
  await Promise.all([
    User.deleteMany({}),
    Category.deleteMany({}),
    Course.deleteMany({}),
    Module.deleteMany({}),
    Lesson.deleteMany({}),
    Enrollment.deleteMany({}),
    CourseMaterial.deleteMany({}),
    Quiz.deleteMany({}),
    QuizAttempt.deleteMany({}),
    Assignment.deleteMany({}),
    Submission.deleteMany({}),
    Payment.deleteMany({}),
    Certificate.deleteMany({}),
    AuditLog.deleteMany({})
  ]);

  // Start test server instance (gateway stub installed before the controller loads)
  const restoreRazorpayLoad = installRazorpayGatewayStub();
  require('../src/app');
  await new Promise(r => setTimeout(r, 1200));
  // The payment controller already captured its client, so the loader hook is
  // removed again and cannot affect anything else.
  restoreRazorpayLoad();

  let studentToken = '';
  let adminToken = '';
  let createdCourseId = '';
  let createdModuleId = '';
  let createdLessonId = '';
  let createdQuizId = '';
  let createdAssignmentId = '';
  let testEnrollmentId = '';
  let materialId = '';

  // 1. Health check
  console.log('Test 1: Health check');
  const healthRes = await makeRequest({ hostname: 'localhost', port: 5099, path: '/health', method: 'GET' });
  assert.strictEqual(healthRes.status, 200, 'Health endpoint should return 200');
  console.log('✓ Health check passed');

  // 2. Student Registration & Profile with Phone Number
  console.log('Test 2: Student Registration & Profile with Phone Number');
  const regRes = await makeRequest({
    hostname: 'localhost', port: 5099, path: '/api/v1/auth/register', method: 'POST',
    headers: { 'Content-Type': 'application/json' }
  }, {
    name: 'Test Student',
    email: 'teststudent@lms.com',
    password: 'studentPassword123'
  });
  assert.strictEqual(regRes.status, 201, 'Student should register with 201');
  assert.strictEqual(regRes.body.user.role, 'student', 'Registered user role must be student');
  studentToken = regRes.body.token;

  // Update student profile with phone
  const profileRes = await makeRequest({
    hostname: 'localhost', port: 5099, path: '/api/v1/auth/profile', method: 'PUT',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${studentToken}` }
  }, {
    name: 'Test Student',
    phone: '+919876543210',
    headline: 'DevOps Aspirant',
    bio: 'Learning cloud infrastructure.'
  });
  assert.strictEqual(profileRes.status, 200, 'Student profile should update');
  assert.strictEqual(profileRes.body.user.phone, '+919876543210');
  console.log('✓ Student Registration and Phone update passed');

  // 3. User Seed for Admin
  console.log('Test 3: Admin Setup in Isolated DB');
  await User.create({
    name: 'Test Admin',
    email: 'testadmin@lms.com',
    password: 'adminPassword123',
    role: 'admin'
  });

  const adminLogin = await makeRequest({
    hostname: 'localhost', port: 5099, path: '/api/v1/auth/login', method: 'POST',
    headers: { 'Content-Type': 'application/json' }
  }, { email: 'testadmin@lms.com', password: 'adminPassword123' });
  assert.strictEqual(adminLogin.status, 200, 'Admin login should succeed');
  adminToken = adminLogin.body.token;
  console.log('✓ Admin Authentication passed');

  // 4. Role Authorization Guard Test
  console.log('Test 4: Authorization Check (Student forbidden from admin routes)');
  const unauthRes = await makeRequest({
    hostname: 'localhost', port: 5099, path: '/api/v1/admin/stats', method: 'GET',
    headers: { 'Authorization': `Bearer ${studentToken}` }
  });
  assert.strictEqual(unauthRes.status, 403, 'Student should be forbidden from admin stats');
  console.log('✓ Role Authorization check passed');

  // 5. Category Creation by Admin
  console.log('Test 5: Category Creation');
  const catRes = await makeRequest({
    hostname: 'localhost', port: 5099, path: '/api/v1/categories', method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${adminToken}` }
  }, { name: 'Full Stack Engineering', description: 'Web engineering' });
  assert.strictEqual(catRes.status, 201, 'Category should be created with 201');
  const categoryId = catRes.body.category._id;
  console.log('✓ Category Creation passed');

  // 6. Minimal Course Creation & Publishing
  console.log('Test 6: Minimal Course Creation by Admin');
  const courseRes = await makeRequest({
    hostname: 'localhost', port: 5099, path: '/api/v1/courses', method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${adminToken}` }
  }, {
    title: 'Automated Test Course: Production MERN',
    shortDescription: 'Minimal course info created quickly by Admin',
    category: categoryId,
    duration: '3 Months Course Access',
    price: 0,
    isFree: true,
    status: 'published'
  });
  assert.strictEqual(courseRes.status, 201, 'Course should be created');
  createdCourseId = courseRes.body.course._id;
  console.log('✓ Minimal Course Creation passed');

  // 7. Curriculum Builder (Module & Lesson)
  console.log('Test 7: Curriculum Builder');
  const modRes = await makeRequest({
    hostname: 'localhost', port: 5099, path: '/api/v1/curriculum/modules', method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${adminToken}` }
  }, { title: 'Module 1: Architecture Test', courseId: createdCourseId, order: 1 });
  assert.strictEqual(modRes.status, 201, 'Module created');
  createdModuleId = modRes.body.module._id;

  const lessonRes = await makeRequest({
    hostname: 'localhost', port: 5099, path: '/api/v1/curriculum/lessons', method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${adminToken}` }
  }, {
    title: 'Lesson 1.1: Core Design',
    courseId: createdCourseId,
    moduleId: createdModuleId,
    videoUrl: 'https://test-bucket/video.mp4',
    duration: 12,
    order: 1,
    isPreview: true
  });
  assert.strictEqual(lessonRes.status, 201, 'Lesson created');
  createdLessonId = lessonRes.body.lesson._id;
  console.log('✓ Curriculum Builder passed');

  // 8. Student Enrolls -> Status MUST be 'pending_approval' (NO Immediate Access)
  console.log('Test 8: Enrollment Submission -> Pending Approval State');
  const enrollRes = await makeRequest({
    hostname: 'localhost', port: 5099, path: '/api/v1/enrollments/free', method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${studentToken}` }
  }, { courseId: createdCourseId });
  assert.strictEqual(enrollRes.status, 201, 'Enrollment created');
  assert.strictEqual(enrollRes.body.enrollment.status, 'pending_approval', 'Enrollment must wait for admin approval');
  testEnrollmentId = enrollRes.body.enrollment._id;
  console.log('✓ Pending Approval state verified');

  // 9. Student CANNOT access classroom or materials while Pending Approval
  console.log('Test 9: Classroom Blocked for Pending Student');
  const blockedClassroomRes = await makeRequest({
    hostname: 'localhost', port: 5099, path: `/api/v1/enrollments/classroom/${createdCourseId}`, method: 'GET',
    headers: { 'Authorization': `Bearer ${studentToken}` }
  });
  assert.strictEqual(blockedClassroomRes.status, 403, 'Pending student must be blocked from classroom');
  assert.strictEqual(blockedClassroomRes.body.code, 'PENDING_APPROVAL');
  console.log('✓ Classroom guard blocked pending enrollment correctly');

  // 10. Admin Approves Enrollment -> Exactly 3 Calendar Months Granted
  console.log('Test 10: Admin Approves Enrollment & Calculates 3 Calendar Months');
  const approveRes = await makeRequest({
    hostname: 'localhost', port: 5099, path: `/api/v1/enrollments/admin/${testEnrollmentId}/approve`, method: 'PUT',
    headers: { 'Authorization': `Bearer ${adminToken}` }
  });
  assert.strictEqual(approveRes.status, 200, 'Admin should approve enrollment');
  assert.strictEqual(approveRes.body.data.status, 'approved');
  assert(approveRes.body.data.accessStartDate, 'Start date must be set');
  assert(approveRes.body.data.accessExpiryDate, 'Expiry date must be set');

  const startDate = new Date(approveRes.body.data.accessStartDate);
  const expiryDate = new Date(approveRes.body.data.accessExpiryDate);
  // Verify difference is ~3 months (between 89 and 93 days depending on calendar month lengths)
  const diffDays = Math.round((expiryDate - startDate) / (1000 * 60 * 60 * 24));
  assert(diffDays >= 89 && diffDays <= 93, `3 calendar months should be 89-93 days, received ${diffDays}`);
  console.log(`✓ Admin Approval passed — 3 calendar months access set (${diffDays} days)`);

  // 11. Student Can Now Access Classroom
  console.log('Test 11: Approved Student Accesses Classroom');
  const activeClassroomRes = await makeRequest({
    hostname: 'localhost', port: 5099, path: `/api/v1/enrollments/classroom/${createdCourseId}`, method: 'GET',
    headers: { 'Authorization': `Bearer ${studentToken}` }
  });
  assert.strictEqual(activeClassroomRes.status, 200, 'Approved student should access classroom');
  console.log('✓ Approved student accessed classroom successfully');

  // 12. Admin Uploads Material / PDF & Student Downloads It
  console.log('Test 12: Course Materials Upload & Protected Download');
  const matDoc = await CourseMaterial.create({
    course: createdCourseId,
    title: 'Docker & Kubernetes Architecture PDF',
    description: 'Reference sheet for cloud deployment',
    module: 'Module 1',
    fileName: 'devops_cheatsheet.pdf',
    fileUrl: '/uploads/materials/test_cheatsheet.pdf',
    fileSize: 1048576,
    mimeType: 'application/pdf',
    uploadedBy: adminLogin.body.user._id,
    isPublished: true
  });
  materialId = matDoc._id;

  const matListRes = await makeRequest({
    hostname: 'localhost', port: 5099, path: `/api/v1/materials/course/${createdCourseId}`, method: 'GET',
    headers: { 'Authorization': `Bearer ${studentToken}` }
  });
  assert.strictEqual(matListRes.status, 200, 'Approved student should list materials');
  assert.strictEqual(matListRes.body.data.length, 1);
  console.log('✓ Course material visible to approved student');

  // 13. Progress Tracking & Lesson Completion
  console.log('Test 13: Lesson Completion & Progress Calculation');
  const completeRes = await makeRequest({
    hostname: 'localhost', port: 5099, path: '/api/v1/enrollments/complete-lesson', method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${studentToken}` }
  }, { courseId: createdCourseId, lessonId: createdLessonId });
  assert.strictEqual(completeRes.status, 200, 'Lesson marked as completed');
  assert.strictEqual(completeRes.body.progress, 100, '1 of 1 lessons completed should equal 100%');
  console.log('✓ Lesson progress recorded');

  // 14. Certificate Generation & Public Verification
  console.log('Test 14: Certificate Generation & Public Verification');
  const certRes = await makeRequest({
    hostname: 'localhost', port: 5099, path: '/api/v1/certificates/generate', method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${studentToken}` }
  }, { courseId: createdCourseId });
  assert.strictEqual(certRes.status, 200, 'Certificate issued');
  const certNumber = certRes.body.certificate.certificateNumber;

  const verifyRes = await makeRequest({
    hostname: 'localhost', port: 5099, path: `/api/v1/certificates/verify/${certNumber}`, method: 'GET'
  });
  assert.strictEqual(verifyRes.status, 200, 'Certificate verified publicly');
  assert.strictEqual(verifyRes.body.certificate.certificateNumber, certNumber);
  console.log('✓ Certificate verified');

  // 15. Access Expiry Simulation (After 3 Months)
  console.log('Test 15: Access Expiration Enforcement (3 Months Elapsed)');
  // Set access dates to past (expired)
  await Enrollment.findByIdAndUpdate(testEnrollmentId, {
    accessStartDate: new Date(Date.now() - 100 * 24 * 60 * 60 * 1000),
    accessExpiryDate: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000)
  });

  const expiredClassroomRes = await makeRequest({
    hostname: 'localhost', port: 5099, path: `/api/v1/enrollments/classroom/${createdCourseId}`, method: 'GET',
    headers: { 'Authorization': `Bearer ${studentToken}` }
  });
  assert.strictEqual(expiredClassroomRes.status, 403, 'Expired student must be blocked');
  assert.strictEqual(expiredClassroomRes.body.code, 'ACCESS_EXPIRED');

  // Materials download also blocked for expired student
  const expiredMatRes = await makeRequest({
    hostname: 'localhost', port: 5099, path: `/api/v1/materials/${materialId}/download`, method: 'GET',
    headers: { 'Authorization': `Bearer ${studentToken}` }
  });
  assert.strictEqual(expiredMatRes.status, 403, 'Materials download blocked for expired student');
  console.log('✓ 3-Month Expiry strictly locks lessons and PDF materials');

  // 16. Audit Log Generation Verification
  console.log('Test 16: Audit Logs & Administrative Reporting');
  const auditRes = await makeRequest({
    hostname: 'localhost', port: 5099, path: '/api/v1/admin/audit-logs', method: 'GET',
    headers: { 'Authorization': `Bearer ${adminToken}` }
  });
  assert.strictEqual(auditRes.status, 200, 'Audit logs accessible to admin');
  assert(auditRes.body.logs.length > 0, 'Audit logs must have recorded approval and enrollment events');
  console.log('✓ Audit Logs verification passed');

  // =====================================================================
  // FREE / PAID SAMPLE-COURSE WORKFLOW (discovery → enrollment → payment →
  // Admin approval → protected PDF materials). All requests go through the
  // real Admin/student HTTP APIs; nothing is inserted into the frontend.
  // =====================================================================
  const PORT = Number(process.env.PORT);
  const call = (method, apiPath, token, payload) => makeRequest({
    hostname: 'localhost',
    port: PORT,
    path: apiPath,
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {})
    }
  }, payload || null);

  const uploadedFiles = [];

  // 17. Admin creates one free and one paid course through the existing APIs
  console.log('Test 17: Admin creates the free + paid course (existing course & curriculum APIs)');
  const devopsCatRes = await call('POST', '/api/v1/categories', adminToken, {
    name: 'DevOps',
    description: 'Linux, CI/CD, containers and cloud'
  });
  assert.strictEqual(devopsCatRes.status, 201, 'DevOps category should be created');
  const devopsCategoryId = devopsCatRes.body.category._id;

  const freeCourseRes = await call('POST', '/api/v1/courses', adminToken, {
    title: 'Linux Fundamentals for Beginners',
    shortDescription: 'Learn the fundamentals of Linux, essential terminal commands, file management, permissions, processes, and basic shell scripting.',
    description: 'Hands-on introduction to the Linux skills needed to begin a DevOps learning journey.',
    category: devopsCategoryId,
    level: 'Beginner',
    duration: '3 Months Course Access',
    learningOutcomes: ['Understand Linux fundamentals.', 'Use basic Linux terminal commands.', 'Manage files and directories.'],
    isFree: true,
    price: 0,
    discountPrice: 0,
    status: 'published'
  });
  assert.strictEqual(freeCourseRes.status, 201, 'Free course should be created');
  const freeCourse = freeCourseRes.body.course;
  assert.strictEqual(freeCourse.isFree, true);
  assert.strictEqual(freeCourse.price, 0);

  const paidCourseRes = await call('POST', '/api/v1/courses', adminToken, {
    title: 'DevOps Engineering — Beginner to Practical',
    shortDescription: 'Learn practical DevOps concepts, automation tools, CI/CD workflows, containerization, cloud infrastructure, and monitoring.',
    description: 'Structured learning plus hands-on projects across the DevOps toolchain.',
    category: devopsCategoryId,
    level: 'Beginner',
    duration: '3 Months Course Access',
    learningOutcomes: ['Understand the DevOps lifecycle.', 'Learn Git and source control.', 'Learn Docker and containerization.'],
    isFree: false,
    price: 4999,
    discountPrice: 0,
    status: 'published'
  });
  assert.strictEqual(paidCourseRes.status, 201, 'Paid course should be created');
  const paidCourse = paidCourseRes.body.course;
  assert.strictEqual(paidCourse.price, 4999, '₹4,999 must be stored from the Admin form');

  const freeModuleTitles = [
    'Introduction to Linux',
    'Linux Commands and File Management',
    'Users, Groups, and Permissions',
    'Processes and System Administration',
    'Introduction to Shell Scripting'
  ];
  for (let idx = 0; idx < freeModuleTitles.length; idx++) {
    const mRes = await call('POST', '/api/v1/curriculum/modules', adminToken, {
      courseId: freeCourse._id,
      title: freeModuleTitles[idx],
      order: idx + 1
    });
    assert.strictEqual(mRes.status, 201, `Free course module "${freeModuleTitles[idx]}" should be created`);
  }

  const paidModuleRes = await call('POST', '/api/v1/curriculum/modules', adminToken, {
    courseId: paidCourse._id, title: 'Linux Foundations', order: 1
  });
  assert.strictEqual(paidModuleRes.status, 201, 'Paid course module should be created');

  // Records must really exist in MongoDB (not frontend samples)
  const freeInDb = await Course.findById(freeCourse._id).lean();
  const paidInDb = await Course.findById(paidCourse._id).lean();
  assert(freeInDb && paidInDb, 'Both courses must be persisted in MongoDB');
  assert.strictEqual(await Module.countDocuments({ courseId: freeCourse._id }), 5, 'Five dynamic modules saved');
  console.log('✓ Two real MongoDB course records created through the Admin APIs');

  // 18. Dynamic discovery endpoints used by the student website
  console.log('Test 18: Dynamic discovery (catalog, filters, details, module counts)');
  const catalogRes = await call('GET', '/api/v1/courses?limit=50');
  assert.strictEqual(catalogRes.status, 200);
  const catalogTitles = catalogRes.body.courses.map(c => c.title);
  assert(catalogTitles.includes('Linux Fundamentals for Beginners'), 'Free course appears in the catalog');
  assert(catalogTitles.includes('DevOps Engineering — Beginner to Practical'), 'Paid course appears in the catalog');

  const linuxCard = catalogRes.body.courses.find(c => c._id === freeCourse._id);
  assert.strictEqual(linuxCard.moduleCount, 5, 'Card module preview comes from the backend counts');
  assert.strictEqual(linuxCard.isFree, true, 'Free flag drives the client label');

  const onlyFreeRes = await call('GET', '/api/v1/courses?isFree=true&limit=50');
  assert(onlyFreeRes.body.courses.every(c => c.isFree || Number(c.price) === 0), 'isFree filter returns free courses only');

  // Category filter accepts the slug a hand-written link uses
  const slugFilterRes = await call('GET', `/api/v1/courses?category=${devopsCatRes.body.category.slug}&limit=50`);
  assert.strictEqual(slugFilterRes.status, 200, 'Category filter must not crash on a slug');
  assert(slugFilterRes.body.courses.length >= 2, 'Both DevOps courses found through ?category=devops');

  const detailsRes = await call('GET', `/api/v1/courses/${freeCourse.slug}`);
  assert.strictEqual(detailsRes.status, 200, 'Course details resolve by slug');
  assert.strictEqual(detailsRes.body.curriculum.length, 5, 'Details curriculum is dynamic');
  assert(Array.isArray(detailsRes.body.course.learningOutcomes), 'Learning objectives returned for the details page');

  const adminListRes = await call('GET', '/api/v1/courses/admin/list?limit=100&status=all', adminToken);
  assert.strictEqual(adminListRes.status, 200, 'Admin course table endpoint responds');
  assert(adminListRes.body.courses.length >= 3, 'Admin sees every course including drafts');
  console.log('✓ Discovery is fully backend-driven');

  // 19. Free enrollment flow — no Razorpay, pending approval, then 3 months
  console.log('Test 19: Free enrollment (no gateway) → pending → Admin approval → 3 months');
  const freeStudentReg = await call('POST', '/api/v1/auth/register', '', {
    name: 'Free Course Student', email: 'test.free@lms.com', password: 'freePassword123'
  });
  assert.strictEqual(freeStudentReg.status, 201, 'Free-course student registers');
  const freeToken = freeStudentReg.body.token;
  await call('PUT', '/api/v1/auth/profile', freeToken, { name: 'Free Course Student', phone: '+919811100001' });

  // A free course must never open a checkout
  const freeOrderAttempt = await call('POST', '/api/v1/payments/create-order', freeToken, { courseId: freeCourse._id });
  assert.strictEqual(freeOrderAttempt.status, 400, 'Backend refuses to create an order for a free course');

  const freeEnrollRes = await call('POST', '/api/v1/enrollments/free', freeToken, { courseId: freeCourse._id });
  assert.strictEqual(freeEnrollRes.status, 201, 'Free enrollment created');
  assert.strictEqual(freeEnrollRes.body.enrollment.status, 'pending_approval');
  assert(!freeEnrollRes.body.enrollment.payment, 'Free enrollment is not a paid transaction');
  assert.strictEqual(await Payment.countDocuments({ student: freeStudentReg.body.user.id }), 0,
    'No Payment record may exist for a free enrollment');

  const freePendingClassroom = await call('GET', `/api/v1/enrollments/classroom/${freeCourse._id}`, freeToken);
  assert.strictEqual(freePendingClassroom.status, 403, 'Unapproved student cannot access the classroom');
  console.log('✓ Free enrollment stays pending until Admin approves');

  // 20. Duplicate enrollment prevention
  console.log('Test 20: Duplicate enrollment is rejected');
  const dupRes = await call('POST', '/api/v1/enrollments/free', freeToken, { courseId: freeCourse._id });
  assert.strictEqual(dupRes.status, 400, 'Duplicate pending enrollment blocked');
  assert(/already/i.test(dupRes.body.message), 'Duplicate message explains the block');
  assert.strictEqual(await Enrollment.countDocuments({ student: freeStudentReg.body.user.id, course: freeCourse._id }), 1,
    'Exactly one enrollment row per student/course');
  console.log('✓ Duplicate enrollment guard works');

  // 21. Admin uploads a PDF to the free course through the real upload endpoint
  console.log('Test 21: Admin PDF upload (multipart) attaches to the correct course');
  const freePdfRes = await makeMultipartRequest('POST', '/api/v1/materials/upload', `Bearer ${adminToken}`, {
    title: 'Linux Fundamentals Starter Guide',
    description: 'Command reference for module 1-5',
    courseId: freeCourse._id,
    moduleId: freeModuleTitles[0],
    isPublished: 'true'
  }, {
    field: 'file',
    name: 'linux-fundamentals-starter-guide.pdf',
    mime: 'application/pdf',
    data: buildSamplePdf('Linux Fundamentals for Beginners')
  });
  assert.strictEqual(freePdfRes.status, 201, 'PDF upload should succeed through the Admin API');
  const freeMaterial = freePdfRes.body.material;
  assert.strictEqual(String(freeMaterial.course), String(freeCourse._id), 'PDF is bound to the free course');
  assert.strictEqual(freeMaterial.module, freeModuleTitles[0], 'PDF keeps its module association');
  uploadedFiles.push(freeMaterial.fileUrl);
  const physicalPdf = path.join(__dirname, '..', freeMaterial.fileUrl);
  assert(fs.existsSync(physicalPdf), 'File must be stored on disk by the existing storage implementation');

  const paidPdfRes = await makeMultipartRequest('POST', '/api/v1/materials/upload', `Bearer ${adminToken}`, {
    title: 'DevOps Engineering Starter Guide',
    description: 'Toolchain overview',
    courseId: paidCourse._id,
    isPublished: 'true'
  }, {
    field: 'file',
    name: 'devops-engineering-starter-guide.pdf',
    mime: 'application/pdf',
    data: buildSamplePdf('DevOps Engineering - Beginner to Practical')
  });
  assert.strictEqual(paidPdfRes.status, 201, 'Second PDF upload should also succeed');
  const paidMaterial = paidPdfRes.body.material;
  uploadedFiles.push(paidMaterial.fileUrl);

  // Materials are listed but protected before approval
  const freeMatListPending = await call('GET', `/api/v1/materials/course/${freeCourse._id}`, freeToken);
  assert.strictEqual(freeMatListPending.status, 200);
  assert.strictEqual(freeMatListPending.body.hasActiveAccess, false, 'Pending student has no material access yet');
  const freeMatDownloadPending = await call('GET', `/api/v1/materials/${freeMaterial._id}/download`, freeToken);
  assert.strictEqual(freeMatDownloadPending.status, 403, 'Unapproved student cannot download the PDF');
  const anonDownload = await call('GET', `/api/v1/materials/${freeMaterial._id}/download`);
  assert.strictEqual(anonDownload.status, 401, 'Anonymous download is refused');
  console.log('✓ PDFs stored with the correct course and protected before approval');

  // 22. Admin approves the free enrollment
  console.log('Test 22: Admin approves the free enrollment → three-month access');
  const freeEnrollmentId = freeEnrollRes.body.enrollment._id;
  const approveFreeRes = await call('PUT', `/api/v1/enrollments/admin/${freeEnrollmentId}/approve`, adminToken);
  assert.strictEqual(approveFreeRes.status, 200, 'Free enrollment can be approved without any payment');
  const freeAccess = approveFreeRes.body.data;
  const freeDiffDays = Math.round((new Date(freeAccess.accessExpiryDate) - new Date(freeAccess.accessStartDate)) / 86400000);
  assert(freeDiffDays >= 89 && freeDiffDays <= 93, `Free access must span 3 calendar months (${freeDiffDays} days)`);

  const approvedClassroom = await call('GET', `/api/v1/enrollments/classroom/${freeCourse._id}`, freeToken);
  assert.strictEqual(approvedClassroom.status, 200, 'Approved free student reaches the classroom');
  const activeMatList = await call('GET', `/api/v1/materials/course/${freeCourse._id}`, freeToken);
  assert.strictEqual(activeMatList.body.hasActiveAccess, true, 'Material access flag turns active');
  const freePdfDownload = await call('GET', `/api/v1/materials/${freeMaterial._id}/download`, freeToken);
  assert.strictEqual(freePdfDownload.status, 200, 'Approved free student downloads the PDF');
  assert.strictEqual(freePdfDownload.headers['content-type'], 'application/pdf');
  assert(freePdfDownload.raw.slice(0, 5).toString() === '%PDF-', 'Downloaded bytes are a genuine PDF');
  console.log(`✓ Free flow complete — 3 months access (${freeDiffDays} days) and real PDF served`);

  // 23. Paid course purchase flow
  console.log('Test 23: Paid course order uses the MongoDB price and never leaks the secret');
  const paidStudentReg = await call('POST', '/api/v1/auth/register', '', {
    name: 'Paid Course Student', email: 'test.paid@lms.com', password: 'paidPassword123'
  });
  const paidToken = paidStudentReg.body.token;
  await call('PUT', '/api/v1/auth/profile', paidToken, { name: 'Paid Course Student', phone: '+919811100002' });

  const orderRes = await call('POST', '/api/v1/payments/create-order', paidToken, { courseId: paidCourse._id });
  assert.strictEqual(orderRes.status, 200, 'Order created through the gateway client');
  assert.strictEqual(orderRes.body.amount, 4999 * 100, 'Amount is read from MongoDB in paise, never from the client');
  assert.strictEqual(orderRes.body.currency, 'INR');
  assert.strictEqual(orderRes.body.keyId, process.env.RAZORPAY_KEY_ID, 'Only the public key id is returned');
  assert(!JSON.stringify(orderRes.body).includes(process.env.RAZORPAY_KEY_SECRET), 'Secret must never reach the client');
  console.log('✓ Razorpay order created from the stored ₹4,999 price');

  // 24. Fake frontend success is not trusted
  console.log('Test 24: Invalid payment signature is rejected (no fake verification)');
  const bogusSig = 'a'.repeat(64);
  const badVerify = await call('POST', '/api/v1/payments/verify', paidToken, {
    razorpay_order_id: orderRes.body.orderId,
    razorpay_payment_id: 'pay_notreal123',
    razorpay_signature: bogusSig
  });
  assert.strictEqual(badVerify.status, 400, 'Tampered signature must be rejected');
  assert.strictEqual(await Enrollment.countDocuments({ course: paidCourse._id }), 0, 'Rejected verification grants nothing');
  console.log('✓ Backend HMAC verification blocks a forged success');

  // 25. Genuine verification (real HMAC path) → pending approval, still no access
  console.log('Test 25: Verified payment stores the payment and stays pending approval');
  const secondOrderRes = await call('POST', '/api/v1/payments/create-order', paidToken, { courseId: paidCourse._id });
  assert.strictEqual(secondOrderRes.status, 200);
  const gatewayPaymentId = `pay_${crypto.randomBytes(6).toString('hex')}`;
  const goodSignature = signPayment(secondOrderRes.body.orderId, gatewayPaymentId);
  const paidVerifyRes = await call('POST', '/api/v1/payments/verify', paidToken, {
    razorpay_order_id: secondOrderRes.body.orderId,
    razorpay_payment_id: gatewayPaymentId,
    razorpay_signature: goodSignature
  });
  assert.strictEqual(paidVerifyRes.status, 200, 'Correctly signed payment verifies');
  assert.strictEqual(paidVerifyRes.body.status, 'pending_approval', 'Payment alone must not grant access');

  const storedPayment = await Payment.findOne({ orderId: secondOrderRes.body.orderId }).lean();
  assert.strictEqual(storedPayment.status, 'completed', 'Verified payment is persisted');
  assert.strictEqual(storedPayment.paymentId, gatewayPaymentId);
  assert.strictEqual(storedPayment.amount, 4999);

  const paidPendingClassroom = await call('GET', `/api/v1/enrollments/classroom/${paidCourse._id}`, paidToken);
  assert.strictEqual(paidPendingClassroom.status, 403, 'Paid-but-unapproved student has no classroom access');
  const paidPendingDownload = await call('GET', `/api/v1/materials/${paidMaterial._id}/download`, paidToken);
  assert.strictEqual(paidPendingDownload.status, 403, 'Paid-but-unapproved student cannot open the PDF');
  console.log('✓ Payment verified and stored; access still withheld until approval');

  // 26. Admin approvals list (what the Approvals & Access page renders)
  console.log('Test 26: Admin approvals list exposes course type and payment status');
  const adminEnrollments = await call('GET', '/api/v1/enrollments/admin/list?status=pending_approval&limit=100', adminToken);
  assert.strictEqual(adminEnrollments.status, 200);
  const list = adminEnrollments.body.enrollments;
  assert(Array.isArray(list), 'Approvals payload is an enrollments array');
  const paidRow = list.find(e => String(e.course?._id) === String(paidCourse._id));
  assert(paidRow, 'Paid pending enrollment is listed for review');
  assert.strictEqual(paidRow.student?.name, 'Paid Course Student', 'Student name is populated');
  assert.strictEqual(paidRow.course.isFree, false, 'Course type flag is available');
  assert.strictEqual(paidRow.payment.status, 'completed', 'Verified payment details are visible to Admin');
  assert(paidRow.payment.orderId && paidRow.payment.paymentId, 'Order id and payment id are shown for review');
  assert.strictEqual(paidRow.payment.amount, 4999);
  console.log('✓ Approvals page has student / course / type / payment / status data');

  // 27. Paid enrollment without a verified payment can never be approved
  console.log('Test 27: Approval guard rejects paid enrollments without verified payment');
  const guardStudent = await call('POST', '/api/v1/auth/register', '', {
    name: 'Guard Student', email: 'test.guard@lms.com', password: 'guardPassword123'
  });
  const unverifiedOrder = await call('POST', '/api/v1/payments/create-order', guardStudent.body.token, { courseId: paidCourse._id });
  assert.strictEqual(unverifiedOrder.status, 200, 'Order row exists but stays unverified');
  const unverifiedPayment = await Payment.findOne({ orderId: unverifiedOrder.body.orderId });
  const manualEnrollment = await Enrollment.create({
    student: guardStudent.body.user.id,
    course: paidCourse._id,
    payment: unverifiedPayment._id,
    status: 'pending_approval'
  });
  const blockedApprove = await call('PUT', `/api/v1/enrollments/admin/${manualEnrollment._id}/approve`, adminToken);
  assert.strictEqual(blockedApprove.status, 400, 'Unverified payment must block approval');
  assert(/verified payment/i.test(blockedApprove.body.message), 'Guard explains that verification is required');
  const stillPending = await Enrollment.findById(manualEnrollment._id).lean();
  assert.strictEqual(stillPending.status, 'pending_approval', 'Rejected approval leaves the enrollment pending');
  await Enrollment.deleteOne({ _id: manualEnrollment._id });
  await Payment.deleteOne({ _id: unverifiedPayment._id });
  console.log('✓ Paid approval requires a backend-verified payment');

  // 28. Admin approves the verified paid enrollment
  console.log('Test 28: Admin approves the paid enrollment → three-month access + PDF');
  const paidEnrollmentId = paidVerifyRes.body.enrollment._id;
  const approvePaidRes = await call('PUT', `/api/v1/enrollments/admin/${paidEnrollmentId}/approve`, adminToken);
  assert.strictEqual(approvePaidRes.status, 200, 'Verified paid enrollment is approved');
  const paidAccess = approvePaidRes.body.data;
  const paidDiffDays = Math.round((new Date(paidAccess.accessExpiryDate) - new Date(paidAccess.accessStartDate)) / 86400000);
  assert(paidDiffDays >= 89 && paidDiffDays <= 93, `Paid access must span 3 calendar months (${paidDiffDays} days)`);

  const paidClassroomAfterApprove = await call('GET', `/api/v1/enrollments/classroom/${paidCourse._id}`, paidToken);
  assert.strictEqual(paidClassroomAfterApprove.status, 200, 'Approved paid student reaches the classroom');
  const paidPdfDownload = await call('GET', `/api/v1/materials/${paidMaterial._id}/download?inline=true`, paidToken);
  assert.strictEqual(paidPdfDownload.status, 200, 'Approved paid student views the PDF inline');
  assert(paidPdfDownload.headers['content-disposition'].startsWith('inline'), 'Inline flag respected for the viewer');

  // Wrong-course student cannot read another course PDF
  const wrongCourseDownload = await call('GET', `/api/v1/materials/${paidMaterial._id}/download`, freeToken);
  assert.strictEqual(wrongCourseDownload.status, 403, 'PDF of a course the student is not enrolled in is blocked');

  // Expired access re-blocks the same PDF
  await Enrollment.findByIdAndUpdate(paidEnrollmentId, {
    accessStartDate: new Date(Date.now() - 200 * 86400000),
    accessExpiryDate: new Date(Date.now() - 5 * 86400000),
    status: 'expired'
  });
  const expiredPaidDownload = await call('GET', `/api/v1/materials/${paidMaterial._id}/download`, paidToken);
  assert.strictEqual(expiredPaidDownload.status, 403, 'Expired access locks the PDF again');
  console.log('✓ Paid flow complete: approval grants 3 months, expiry and cross-course access stay locked');

  // 29. Admin unpublish / publish round trip is reflected on the student site
  console.log('Test 29: Publish / unpublish reflected on the student website endpoints');
  const unpublishRes = await call('PUT', `/api/v1/courses/${freeCourse._id}`, adminToken, { status: 'draft' });
  assert.strictEqual(unpublishRes.status, 200, 'Admin can unpublish');
  const hiddenDetails = await call('GET', `/api/v1/courses/${freeCourse.slug}`);
  assert.strictEqual(hiddenDetails.status, 404, 'Unpublished course disappears from the student site');
  const hiddenCatalog = await call('GET', '/api/v1/courses?limit=50');
  assert(!hiddenCatalog.body.courses.some(c => c._id === freeCourse._id), 'Unpublished course is out of the catalog');
  const blockedEnroll = await call('POST', '/api/v1/enrollments/free', paidToken, { courseId: freeCourse._id });
  assert.strictEqual(blockedEnroll.status, 400, 'Unpublished course cannot be enrolled');

  const republishRes = await call('PUT', `/api/v1/courses/${freeCourse._id}`, adminToken, { status: 'published' });
  assert.strictEqual(republishRes.status, 200, 'Admin can republish');
  const backDetails = await call('GET', `/api/v1/courses/${freeCourse.slug}`);
  assert.strictEqual(backDetails.status, 200, 'Course is visible again after republishing');

  // Price edits stay dynamic: ₹0 label vs ₹4,999 label come from the record
  const priceEdit = await call('PUT', `/api/v1/courses/${paidCourse._id}`, adminToken, { price: 5999 });
  assert.strictEqual(priceEdit.status, 200, 'Admin can edit the price');
  const editedCatalog = await call('GET', '/api/v1/courses?limit=50');
  const editedPaid = editedCatalog.body.courses.find(c => c._id === paidCourse._id);
  assert.strictEqual(editedPaid.price, 5999, 'Edited price is served to the frontend');
  await call('PUT', `/api/v1/courses/${paidCourse._id}`, adminToken, { price: 4999 });
  console.log('✓ Admin publishing and pricing changes flow straight through to the student API');

  // 30. Other protected learning content honours the same approved+window rule
  console.log('Test 30: Approved access extends to protected learning content (quizzes)');
  const quizCreate = await call('POST', '/api/v1/quizzes', adminToken, {
    title: 'Linux Fundamentals Check',
    courseId: freeCourse._id,
    published: true,
    timeLimitMinutes: 10,
    passingPercentage: 60,
    questions: [{
      questionText: 'Which command shows the current working directory?',
      questionType: 'multiple-choice',
      options: ['pwd', 'ls', 'cd', 'whoami'],
      correctAnswer: 0,
      points: 1
    }]
  });
  assert.strictEqual(quizCreate.status, 201, 'Admin can publish a quiz on the course');

  const approvedQuizList = await call('GET', `/api/v1/quizzes/course/${freeCourse._id}`, freeToken);
  assert.strictEqual(approvedQuizList.status, 200, 'Approved student reaches course quizzes');
  assert.strictEqual(approvedQuizList.body.quizzes.length, 1, 'The published quiz is listed');
  assert.strictEqual(approvedQuizList.body.quizzes[0].questions[0].correctAnswer, undefined,
    'Answers must never be sent to a student');

  const quizOpen = await call('GET', `/api/v1/quizzes/${quizCreate.body.quiz._id}`, freeToken);
  assert.strictEqual(quizOpen.status, 200, 'Approved student can open the quiz');

  const pendingQuizStudent = await call('POST', '/api/v1/auth/register', '', {
    name: 'Pending Quiz Student', email: 'test.quizpending@lms.com', password: 'quizPassword123'
  });
  const pendingQuizToken = pendingQuizStudent.body.token;
  await call('POST', '/api/v1/enrollments/free', pendingQuizToken, { courseId: freeCourse._id });
  const blockedQuizList = await call('GET', `/api/v1/quizzes/course/${freeCourse._id}`, pendingQuizToken);
  assert.strictEqual(blockedQuizList.status, 403, 'Pending-approval student cannot reach the quiz');
  const blockedQuizOpen = await call('GET', `/api/v1/quizzes/${quizCreate.body.quiz._id}`, pendingQuizToken);
  assert.strictEqual(blockedQuizOpen.status, 403, 'Pending-approval student cannot open the quiz either');

  // And after the window closes the quiz is locked again
  await Enrollment.findByIdAndUpdate(freeEnrollmentId, {
    accessStartDate: new Date(Date.now() - 200 * 86400000),
    accessExpiryDate: new Date(Date.now() - 1 * 86400000),
    status: 'expired'
  });
  const expiredQuizList = await call('GET', `/api/v1/quizzes/course/${freeCourse._id}`, freeToken);
  assert.strictEqual(expiredQuizList.status, 403, 'Expired access locks protected learning content');
  console.log('✓ Quiz access follows the same approved + 3-month window rule');

  // 31. Isolation: nothing above touched the production database
  console.log('Test 31: Test run stayed on the isolated database');
  assert.strictEqual(mongoose.connection.name, 'lms_test_suite_db', 'Suite must run on the isolated DB');
  assert.strictEqual(process.env.MONGODB_URI, TEST_DB_URI);
  console.log('✓ Production database lms_db untouched');

  // Remove PDF files written by the upload tests so the repo stays clean
  uploadedFiles.forEach((fileUrl) => {
    const abs = path.join(__dirname, '..', fileUrl);
    if (fs.existsSync(abs)) fs.rmSync(abs, { force: true });
  });

  // Clean test DB
  await Promise.all([
    User.deleteMany({}),
    Category.deleteMany({}),
    Course.deleteMany({}),
    Module.deleteMany({}),
    Lesson.deleteMany({}),
    Enrollment.deleteMany({}),
    CourseMaterial.deleteMany({}),
    Quiz.deleteMany({}),
    QuizAttempt.deleteMany({}),
    Assignment.deleteMany({}),
    Submission.deleteMany({}),
    Payment.deleteMany({}),
    Certificate.deleteMany({}),
    AuditLog.deleteMany({})
  ]);
  await mongoose.connection.close();

  console.log('\n======================================================');
  console.log('ALL 31 AUTO-OPS SCHOOL LMS TESTS COMPLETED WITH 100% SUCCESS!');
  console.log('Isolated test database lms_test_suite_db wiped and closed.');
  console.log('Existing production database lms_db remained completely untouched.');
  console.log('======================================================\n');
  process.exit(0);
}

runTests().catch(err => {
  console.error('Test Suite Failed:', err);
  process.exit(1);
});
