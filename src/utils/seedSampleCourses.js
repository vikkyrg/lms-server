/**
 * Sample course creator — one FREE course and one PAID course.
 *
 * Everything is written through the existing Admin workflow: the script logs in
 * with the Admin account and calls the very same endpoints the Admin panel uses
 * (POST /courses, POST /curriculum/modules, POST /curriculum/lessons,
 * POST /materials/upload). Nothing is hardcoded in React, and no new course
 * model, API or demo page is introduced.
 *
 * It is idempotent: re-running updates the two records (matched by slug) instead
 * of duplicating them, and leaves every other course record untouched.
 *
 * Usage (server must be running):  npm run seed:sample-courses
 *   SEED_API_URL          default http://localhost:5001/api/v1
 *   SEED_ADMIN_EMAIL      default admin@lms.com   (local dev admin from npm run seed)
 *   SEED_ADMIN_PASSWORD   default admin123
 *   SEED_FORCE=true       reset the two courses' curriculum/materials first
 */
const fs = require('fs');
const path = require('path');
const mongoose = require('mongoose');
const dotenv = require('dotenv');
const PDFDocument = require('pdfkit');

dotenv.config();

const API_URL = process.env.SEED_API_URL || `http://localhost:${process.env.PORT || 5001}/api/v1`;
const ADMIN_EMAIL = process.env.SEED_ADMIN_EMAIL || 'admin@lms.com';
const ADMIN_PASSWORD = process.env.SEED_ADMIN_PASSWORD || 'admin123';
const CATEGORY_NAME = 'DevOps';
const FORCE = process.env.SEED_FORCE === 'true';

const UPLOADS_DIR = path.join(__dirname, '../../uploads');
const THUMB_DIR = path.join(UPLOADS_DIR, 'thumbnails');
const MATERIALS_DIR = path.join(UPLOADS_DIR, 'materials');
const TMP_DIR = path.join(UPLOADS_DIR, '.tmp-seed');

// --- Brand palette used across the LMS (see client/admin themes) -------------
const BRAND = {
  navy: '#102747',
  blue: '#173563',
  mid: '#3F6FA8',
  gold: '#F4D36B',
  ink: '#0B1B33'
};

const COURSES = [
  {
    title: 'Linux Fundamentals for Beginners',
    slug: 'linux-fundamentals-for-beginners',
    shortDescription: 'Learn the fundamentals of Linux, essential terminal commands, file management, permissions, processes, and basic shell scripting. This course introduces the Linux skills needed to begin a DevOps learning journey.',
    description: 'Linux is the operating system behind almost every server, container and cloud deployment you will meet as an engineer. This beginner course builds the fundamentals from the ground up: navigating the filesystem from the terminal, creating and editing files, managing users and permissions, inspecting processes and services, and writing your first shell scripts. Every module is paired with practical exercises so the commands become second nature before you move on to DevOps tooling.\n\nCourse access is granted for 3 calendar months after Admin approval, including all PDF study sheets and reference guides.',
    curriculumTitle: 'Linux Fundamentals Learning Path',
    level: 'Beginner',
    language: 'English',
    duration: '',
    isFree: true,
    price: 0,
    discountPrice: 0,
    status: 'published',
    learningOutcomes: [
      'Understand Linux fundamentals',
      'Use basic Linux terminal commands',
      'Manage files and directories',
      'Understand users and permissions',
      'Learn basic process management',
      'Understand introductory shell scripting'
    ],
    prerequisites: [
      'Basic computer literacy',
      'No prior Linux or command-line experience required'
    ],
    accentColor: BRAND.mid,
    modules: [
      {
        title: 'Introduction to Linux',
        description: 'What Linux is, where it runs, and how to get a terminal to work in.',
        lessons: ['What is Linux and why it dominates the server world', 'Linux distributions and choosing one', 'The terminal, shell and prompt explained', 'Installing a lab environment (VM, cloud, WSL)']
      },
      {
        title: 'Linux Commands and File Management',
        description: 'Navigate, inspect, create and organise files and directories with confidence.',
        lessons: ['Navigation: pwd, ls, cd and absolute vs relative paths', 'Creating, viewing and editing files: touch, cat, less, nano', 'Copy, move, rename and remove safely', 'Finding files: which, find, grep basics', 'Archives and compression: tar, zip, gzip']
      },
      {
        title: 'Users, Groups, and Permissions',
        description: 'How Linux decides who may read, write or execute anything.',
        lessons: ['Users, groups and the root account', 'Reading permission bits: rwx, numeric modes', 'chmod, chown and chgrp in practice', 'sudo and the principle of least privilege', 'Special permissions: setuid, setgid, sticky bit']
      },
      {
        title: 'Processes and System Administration',
        description: 'Keep a Linux machine healthy: processes, services, storage and logs.',
        lessons: ['Inspecting processes with ps and top/htop', 'Foreground, background and job control', 'Killing and prioritising processes', 'systemd services: start, stop, enable, status', 'Disk usage, mounts and file systems', 'Reading logs with journalctl and /var/log']
      },
      {
        title: 'Introduction to Shell Scripting',
        description: 'Turn repeated commands into small, reliable automation scripts.',
        lessons: ['Shebang, variables and quoting', 'Command arguments and exit codes', 'Conditionals and loops in bash', 'Writing your first automation script', 'Cron jobs and scheduling']
      }
    ]
  },
  {
    title: 'DevOps Engineering — Beginner to Practical',
    slug: 'devops-engineering-beginner-to-practical',
    shortDescription: 'Learn practical DevOps concepts, automation tools, CI/CD workflows, containerization, cloud infrastructure, and monitoring through structured learning and hands-on projects.',
    description: 'A practical, tool-by-tool path through the DevOps lifecycle. You start on Linux and Git, then automate delivery with Jenkins pipelines, package workloads as Docker containers, and operate them on Kubernetes. From there the course moves into cloud infrastructure on AWS and Azure, declarative automation with Terraform and Ansible, and closes with observability using Prometheus and Grafana plus portfolio-ready project work.\n\nCourse access is granted for 3 calendar months after Admin approval, including all PDF guides, lab sheets and reference material.',
    curriculumTitle: 'DevOps Learning Roadmap',
    level: 'All Levels',
    language: 'English',
    duration: '',
    isFree: false,
    price: 4999,
    discountPrice: 0,
    status: 'published',
    learningOutcomes: [
      'Understand the DevOps lifecycle',
      'Learn Git and source control',
      'Understand Jenkins and CI/CD pipelines',
      'Learn Docker and containerization',
      'Understand Kubernetes fundamentals',
      'Explore AWS and Azure cloud concepts',
      'Learn Terraform and Ansible',
      'Understand Prometheus and Grafana monitoring'
    ],
    prerequisites: [
      'Basic computer literacy and comfort with the command line',
      'The free Linux Fundamentals course, or equivalent Linux knowledge'
    ],
    accentColor: BRAND.gold,
    modules: [
      {
        title: 'Linux Foundations',
        description: 'The operating-system skills every DevOps engineer relies on daily.',
        lessons: ['Linux refresher: filesystem, permissions, users', 'Networking basics for engineers: ports, DNS, SSH', 'Process management and services', 'Shell scripting for automation']
      },
      {
        title: 'Git and Source Control',
        description: 'Collaborate safely and build repeatable workflows for application changes.',
        lessons: ['Repositories, commits and branching', 'Remotes, pull requests and code review', 'Resolving merge conflicts and rebasing', 'Git workflow strategies for teams']
      },
      {
        title: 'Jenkins and Continuous Integration',
        description: 'Automate build, test and delivery pipelines end to end.',
        lessons: ['Jenkins architecture and setup', 'Freestyle vs pipeline jobs', 'Declarative Jenkinsfile walkthrough', 'Build, test and deploy stages', 'Credentials, webhooks and notifications']
      },
      {
        title: 'Docker and Containerization',
        description: 'Package applications into portable, consistent containers.',
        lessons: ['Images, containers and the Dockerfile', 'Layers, caching and multi-stage builds', 'Docker networking and volumes', 'Docker Compose for multi-service apps', 'Registry and image security basics']
      },
      {
        title: 'Kubernetes and Container Orchestration',
        description: 'Deploy, scale and operate containers on a resilient platform.',
        lessons: ['Cluster architecture: control plane and nodes', 'Pods, deployments, replica sets', 'Services, ingress and DNS', 'ConfigMaps, secrets and resource limits', 'Scaling, health probes and rolling updates']
      },
      {
        title: 'Cloud Computing — AWS and Azure',
        description: 'Core cloud services and deployment patterns across two platforms.',
        lessons: ['Cloud accounts, IAM and regions', 'Compute: EC2 and Azure VMs', 'Storage, networking and load balancing', 'Managed databases and serverless', 'Deploying a containerised app to the cloud']
      },
      {
        title: 'Infrastructure Automation — Terraform and Ansible',
        description: 'Provision and configure environments with reviewable, repeatable code.',
        lessons: ['Terraform fundamentals: providers, resources, state', 'Modules, variables and outputs', 'Planning and applying safely', 'Ansible inventory, playbooks and roles', 'Templates, handlers and idempotency', 'Terraform + Ansible together']
      },
      {
        title: 'Monitoring — Prometheus and Grafana',
        description: 'Measure systems, investigate incidents and improve reliability.',
        lessons: ['Metrics, logs and traces explained', 'Prometheus architecture and PromQL', 'Exporters, scraping and alert rules', 'Alertmanager routing and silences', 'Grafana dashboards and variables', 'SLOs, incident response and troubleshooting']
      }
    ]
  }
];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
const xmlEscape = value => String(value)
  .replace(/&/g, '&amp;')
  .replace(/</g, '&lt;')
  .replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;');

/**
 * Wrap long text so SVG/PDF layouts stay readable.
 */
const wrapText = (text, maxChars) => {
  const words = String(text).split(/\s+/);
  const lines = [];
  let line = '';
  for (const word of words) {
    if ((line + ' ' + word).trim().length > maxChars && line) {
      lines.push(line.trim());
      line = word;
    } else {
      line = `${line} ${word}`.trim();
    }
  }
  if (line) lines.push(line.trim());
  return lines;
};

const ensureDir = dir => {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
};

/**
 * Branded, self-hosted course thumbnail served from the existing /uploads
 * static route. Local SVG = no external CDN that can 404.
 */
const buildThumbnailSvg = (course, moduleCount) => {
  const titleLines = wrapText(course.title, 22).slice(0, 3);
  const subLines = wrapText(course.shortDescription, 46).slice(0, 2);
  const tag = course.isFree ? 'FREE COURSE' : 'PAID COURSE';

  return `<svg xmlns="http://www.w3.org/2000/svg" width="1280" height="720" viewBox="0 0 1280 720" role="img" aria-label="${xmlEscape(course.title)}">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="${BRAND.ink}"/>
      <stop offset="55%" stop-color="${BRAND.navy}"/>
      <stop offset="100%" stop-color="${BRAND.blue}"/>
    </linearGradient>
    <linearGradient id="glow" x1="0" y1="0" x2="1" y2="0">
      <stop offset="0%" stop-color="${course.accentColor}" stop-opacity="0.9"/>
      <stop offset="100%" stop-color="${BRAND.gold}" stop-opacity="0.15"/>
    </linearGradient>
  </defs>
  <rect width="1280" height="720" fill="url(#bg)"/>
  <g opacity="0.18" stroke="${BRAND.gold}" stroke-width="1">
    ${Array.from({ length: 9 }, (_, i) => `<line x1="${80 + i * 140}" y1="0" x2="${80 + i * 140}" y2="720"/>`).join('\n    ')}
    ${Array.from({ length: 5 }, (_, i) => `<line x1="0" y1="${80 + i * 150}" x2="1280" y2="${80 + i * 150}"/>`).join('\n    ')}
  </g>
  <circle cx="1120" cy="150" r="200" fill="url(#glow)" opacity="0.35"/>
  <rect x="72" y="72" width="6" height="120" rx="3" fill="${course.accentColor}"/>

  <g font-family="Segoe UI, Helvetica, Arial, sans-serif">
    <text x="110" y="118" font-size="26" letter-spacing="6" fill="${BRAND.gold}" font-weight="600">AUTOOPS SCHOOL</text>
    <text x="110" y="168" font-size="24" letter-spacing="3" fill="#9FB6D4">DEVOPS TRAINING TRACK</text>

    ${titleLines.map((line, i) => `<text x="110" y="${300 + i * 82}" font-size="72" font-weight="700" fill="#FFFFFF">${xmlEscape(line)}</text>`).join('\n    ')}

    ${subLines.map((line, i) => `<text x="110" y="${560 + i * 40}" font-size="26" fill="#C8D7EA">${xmlEscape(line)}</text>`).join('\n    ')}

    <g>
      <rect x="110" y="${628}" width="230" height="52" rx="26" fill="${course.accentColor}" opacity="0.92"/>
      <text x="225" y="${661}" font-size="22" font-weight="700" fill="${course.isFree ? '#0B1B33' : '#0B1B33'}" text-anchor="middle">${tag}</text>
      <rect x="356" y="${628}" width="290" height="52" rx="26" fill="none" stroke="#5C7BA6" stroke-width="2"/>
      <text x="501" y="${661}" font-size="22" text-anchor="middle" fill="#DCE7F5">${moduleCount} Modules · 3 Months Access</text>
    </g>
  </g>
</svg>`;
};

/**
 * A real, openable PDF generated with the project's existing pdfkit dependency:
 * course title, intro and the module list.
 */
const buildSamplePdf = (course, filePath) => {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: 'A4', margin: 56 });
    const stream = fs.createWriteStream(filePath);
    stream.on('finish', () => resolve(filePath));
    stream.on('error', reject);
    doc.pipe(stream);

    doc.rect(0, 0, doc.page.width, 120).fill(course.accentColor);
    doc.fillColor(BRAND.ink).fontSize(11).text('AUTOOPS SCHOOL  ·  COURSE STUDY SHEET', 56, 46, { characterSpacing: 1.2 });
    doc.fillColor('#FFFFFF').fontSize(26).text(course.title, 56, 68, { width: doc.page.width - 112 });

    doc.fillColor(BRAND.ink).fontSize(13)
      .text(`${course.isFree ? 'Free course' : `Paid course — ₹${course.price.toLocaleString('en-IN')}`}  ·  ${course.modules.length} modules  ·  3 calendar months of access after Admin approval`, 56, 150, { width: doc.page.width - 112 });

    doc.moveDown(1.4);
    doc.fontSize(15).fillColor(BRAND.blue).text('About this course', 56);
    doc.fontSize(11).fillColor('#2F3B4C').text(course.shortDescription, 56, doc.y + 6, { width: doc.page.width - 112, lineGap: 3 });

    doc.moveDown(1.2);
    doc.fontSize(15).fillColor(BRAND.blue).text('What you will learn', 56);
    doc.fontSize(11).fillColor('#2F3B4C');
    course.learningOutcomes.forEach(item => {
      doc.text(`•  ${item}`, 62, doc.y + 3, { width: doc.page.width - 120, lineGap: 2 });
    });

    doc.moveDown(1.2);
    doc.fontSize(15).fillColor(BRAND.blue).text('Modules in this course', 56);
    course.modules.forEach((mod, index) => {
      if (doc.y > doc.page.height - 140) doc.addPage();
      doc.fontSize(12).fillColor(BRAND.ink).text(`${index + 1}. ${mod.title}`, 62, doc.y + 4);
      doc.fontSize(10).fillColor('#5A6779').text(mod.description, 74, doc.y + 2, { width: doc.page.width - 140 });
      doc.fontSize(9).fillColor('#7A889C').text(`Topics: ${mod.lessons.join(', ')}`, 74, doc.y + 2, { width: doc.page.width - 140 });
      doc.moveDown(0.6);
    });

    doc.moveDown(1);
    const footerY = Math.max(doc.y + 10, doc.page.height - 120);
    doc.fontSize(10).fillColor(BRAND.blue).text('How to use this sheet', 56, footerY);
    doc.fontSize(10).fillColor('#2F3B4C').text(
      `Sign in at the AutoOps School student portal, open “${course.title}”, and enroll. After Admin approval your 3-month access window starts and every PDF in the course materials section becomes available to view and download.`,
      56, doc.y + 4, { width: doc.page.width - 112, lineGap: 2 }
    );

    doc.end();
  });
};

// ---------------------------------------------------------------------------
// Admin API client (same endpoints the Admin panel uses)
// ---------------------------------------------------------------------------
let adminToken = '';

const api = async (method, endpoint, body, isForm = false) => {
  const headers = { Accept: 'application/json' };
  if (adminToken) headers.Authorization = `Bearer ${adminToken}`;
  if (body && !isForm) headers['Content-Type'] = 'application/json';

  const res = await fetch(`${API_URL}${endpoint}`, {
    method,
    headers,
    body: body ? (isForm ? body : JSON.stringify(body)) : undefined
  });

  const text = await res.text();
  let json;
  try {
    json = text ? JSON.parse(text) : {};
  } catch (e) {
    throw new Error(`${method} ${endpoint} → HTTP ${res.status}: ${text.slice(0, 200)}`);
  }
  if (!res.ok) {
    throw new Error(`${method} ${endpoint} → HTTP ${res.status}: ${json.message || 'request failed'}`);
  }
  return json;
};

const uploadMaterialFile = async ({ filePath, fileName, title, description, courseId, moduleTitle }) => {
  ensureDir(TMP_DIR);
  const buffer = fs.readFileSync(filePath);
  const form = new FormData();
  form.append('file', new Blob([buffer], { type: 'application/pdf' }), fileName);
  form.append('title', title);
  form.append('description', description);
  form.append('courseId', courseId);
  if (moduleTitle) form.append('moduleId', moduleTitle);
  form.append('isPublished', 'true');
  return api('POST', '/materials/upload', form, true);
};

// ---------------------------------------------------------------------------
// Course creation through the Admin API
// ---------------------------------------------------------------------------
const findExistingCourse = async slug => {
  const res = await api('GET', '/courses/admin/list?limit=100&status=all');
  const list = res.data || res.courses || [];
  return list.find(c => c.slug === slug) || null;
};

const syncCurriculum = async (courseId, course) => {
  const existingRes = await api('GET', `/curriculum/courses/${courseId}/curriculum`);
  const existingModules = existingRes.modules || [];

  for (let index = 0; index < course.modules.length; index += 1) {
    const spec = course.modules[index];
    let module = existingModules.find(m => m.title === spec.title);

    if (module) {
      await api('PUT', `/curriculum/modules/${module._id}`, {
        title: spec.title,
        description: spec.description,
        order: index + 1
      });
    } else {
      const created = await api('POST', '/curriculum/modules', {
        courseId,
        title: spec.title,
        description: spec.description,
        order: index + 1
      });
      module = created.module;
      console.log(`      + module: ${spec.title}`);
    }

    const existingLessons = module.lessons || [];
    for (let lessonIndex = 0; lessonIndex < spec.lessons.length; lessonIndex += 1) {
      const lessonTitle = spec.lessons[lessonIndex];
      const present = existingLessons.find(l => l.title === lessonTitle);
      if (present) continue;

      await api('POST', '/curriculum/lessons', {
        courseId,
        moduleId: module._id,
        title: lessonTitle,
        description: `${lessonTitle} — lesson from the Admin-managed “${spec.title}” module.`,
        duration: 0,
        order: lessonIndex + 1,
        // One public preview lesson per course so visitors can see the classroom.
        isPreview: index === 0 && lessonIndex === 0
      });
      console.log(`        + lesson: ${lessonTitle}`);
    }
  }
};

const createSampleCourse = async (course, categoryId, adminId) => {
  ensureDir(THUMB_DIR);
  const thumbFile = path.join(THUMB_DIR, `${course.slug}.svg`);
  fs.writeFileSync(thumbFile, buildThumbnailSvg(course, course.modules.length), 'utf8');
  const thumbnailUrl = `/uploads/thumbnails/${course.slug}.svg`;

  let courseId;
  const existing = await findExistingCourse(course.slug);
  const payload = {
    ...course,
    category: categoryId,
    thumbnail: thumbnailUrl,
    status: course.status
  };
  delete payload.modules;
  delete payload.accentColor;

  if (existing) {
    await api('PUT', `/courses/${existing._id}`, payload);
    courseId = existing._id;
    console.log(`Updated existing course via Admin API: ${course.title}`);
  } else {
    const created = await api('POST', '/courses', payload);
    courseId = created.course._id;
    console.log(`Created course via Admin API: ${course.title} (slug: ${created.course.slug})`);
  }

  if (FORCE) {
    // Optional reset path so repeated authoring runs stay predictable.
    const res = await api('GET', `/curriculum/courses/${courseId}/curriculum`);
    for (const m of res.modules || []) {
      await api('DELETE', `/curriculum/modules/${m._id}`);
    }
    console.log('  SEED_FORCE=true: curriculum cleared before re-seeding.');
  }

  await syncCurriculum(courseId, course);

  // One sample PDF per course, uploaded through the Admin materials endpoint.
  ensureDir(TMP_DIR);
  ensureDir(MATERIALS_DIR);
  const materialsRes = await api('GET', `/materials/course/${courseId}`);
  const existingMaterials = materialsRes.data || materialsRes.materials || [];
  const materialTitle = `${course.title} — Course Starter Guide`;

  if (existingMaterials.some(m => m.title === materialTitle)) {
    console.log('  = PDF material already attached, skipping upload.');
  } else {
    const pdfPath = path.join(TMP_DIR, `${course.slug}-starter-guide.pdf`);
    await buildSamplePdf(course, pdfPath);
    const fileName = `${course.slug}-starter-guide.pdf`;
    await uploadMaterialFile({
      filePath: pdfPath,
      fileName,
      title: materialTitle,
      description: course.shortDescription,
      courseId,
      moduleTitle: course.modules[0].title
    });
    console.log(`  + uploaded PDF via /materials/upload: ${fileName}`);
  }

  return { courseId, thumbnailUrl, adminId };
};

const main = async () => {
  console.log(`--- AutoOps School · sample course creator ---`);
  console.log(`Admin API base: ${API_URL}`);

  // Reachability check before doing any work.
  let health;
  try {
    health = await fetch(`${API_URL.replace(/\/api\/v1$/, '')}/health`).then(r => r.json());
  } catch (err) {
    console.error(`\nCannot reach the LMS API at ${API_URL}.`);
    console.error('Start the backend first (cd server && npm run dev), then re-run this script.');
    process.exit(1);
  }
  console.log(`Server health check OK (${health.status})`);

  // Mongo is only used to resolve the category + confirm persistence.
  await mongoose.connect(process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/lms_db');

  const login = await api('POST', '/auth/login', { email: ADMIN_EMAIL, password: ADMIN_PASSWORD });
  if (login.user?.role !== 'admin') throw new Error('The supplied account is not an Admin account.');
  adminToken = login.token;
  console.log(`Signed in as Admin: ${login.user.email}`);

  // Ensure the DevOps category exists (reuse when present).
  const categories = await api('GET', '/categories');
  let category = (categories.categories || []).find(c => c.name.toLowerCase() === CATEGORY_NAME.toLowerCase());
  if (!category) {
    const created = await api('POST', '/categories', {
      name: CATEGORY_NAME,
      description: 'Linux, CI/CD, containers, cloud, infrastructure automation and observability.'
    });
    category = created.category;
    console.log(`Created category “${CATEGORY_NAME}” via Admin API.`);
  } else {
    console.log(`Using existing category “${category.name}”.`);
  }

  const results = [];
  for (const course of COURSES) {
    console.log(`\n# ${course.title} (${course.isFree ? 'FREE' : `PAID ₹${course.price.toLocaleString('en-IN')}`})`);
    const result = await createSampleCourse(course, category._id, login.user._id);
    results.push({ title: course.title, ...result });
  }

  // Persistence proof straight from MongoDB.
  const Course = require('../models/Course');
  const Module = require('../models/Module');
  const Lesson = require('../models/Lesson');
  const CourseMaterial = require('../models/CourseMaterial');
  console.log('\n--- MongoDB verification ---');
  for (const item of results) {
    const doc = await Course.findById(item.courseId).lean();
    const [modules, lessons, materials] = await Promise.all([
      Module.countDocuments({ courseId: item.courseId }),
      Lesson.countDocuments({ courseId: item.courseId }),
      CourseMaterial.countDocuments({ course: item.courseId })
    ]);
    console.log(`  ${doc.title} → status=${doc.status}, isFree=${doc.isFree}, price=${doc.price}, category=${doc.category}, modules=${modules}, lessons=${lessons}, pdfs=${materials}, thumbnail=${doc.thumbnail}`);
  }

  fs.rmSync(TMP_DIR, { recursive: true, force: true });
  await mongoose.disconnect();

  console.log('\nDone. Both records are managed by the Admin panel (Courses, Curriculum Builder, Course Materials, Approvals & Access).');
  console.log('Admin panel: http://localhost:5174  ·  Student site: http://localhost:5173');
};

main().catch(err => {
  console.error('Sample course creation failed:', err.message || err);
  process.exit(1);
});
