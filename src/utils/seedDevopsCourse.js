/**
 * Idempotent seed for the DevOps Engineering course curriculum.
 *
 * This moves the former standalone "/roadmap" content into real, admin-managed
 * MongoDB records (Course + Modules + Lessons) so the curriculum is rendered
 * dynamically inside the course details page. Running it repeatedly is safe:
 * if the course already exists it will not be duplicated.
 *
 * Usage: npm run seed:devops   (optionally SEED_DEVOPS_FORCE=true to reset the
 * course curriculum before re-seeding)
 */
const mongoose = require('mongoose');
const dotenv = require('dotenv');

dotenv.config();

const User = require('../models/User');
const Category = require('../models/Category');
const Course = require('../models/Course');
const Module = require('../models/Module');
const Lesson = require('../models/Lesson');

const COURSE_SLUG = 'devops-engineering-course';

// The eight learning stages from the original roadmap, now modelled as
// admin-managed modules. Each stage's tools become lessons/topics so the
// curriculum lives in the database instead of being hardcoded in React.
const CURRICULUM = [
  {
    title: 'Module 01 — Linux Foundations',
    description: 'Linux administration, processes, networking, permissions, and troubleshooting.',
    tools: ['Linux Administration', 'Linux Commands', 'Processes', 'Networking', 'Permissions', 'Shell Scripting']
  },
  {
    title: 'Module 02 — Source Control',
    description: 'Collaborate safely and create repeatable workflows for application changes.',
    tools: ['Git', 'GitHub']
  },
  {
    title: 'Module 03 — Continuous Integration',
    description: 'Automate builds, tests, approvals, and delivery pipelines.',
    tools: ['Jenkins', 'CI/CD Pipelines']
  },
  {
    title: 'Module 04 — Containerization',
    description: 'Package applications consistently and operate portable workloads.',
    tools: ['Docker']
  },
  {
    title: 'Module 05 — Container Orchestration',
    description: 'Understand resilient deployments, services, scaling, and cluster operations.',
    tools: ['Kubernetes']
  },
  {
    title: 'Module 06 — Cloud Computing',
    description: 'Explore infrastructure and deployment patterns across two major cloud platforms.',
    tools: ['AWS', 'Azure']
  },
  {
    title: 'Module 07 — Infrastructure Automation',
    description: 'Provision and configure environments with repeatable, reviewable code.',
    tools: ['Terraform', 'Ansible']
  },
  {
    title: 'Module 08 — Monitoring and Observability',
    description: 'Measure systems, investigate incidents, and improve reliability.',
    tools: ['Prometheus', 'Grafana']
  },
  {
    title: 'Module 09 — Hands-on Projects',
    description: 'Apply the toolchain through practical, portfolio-ready project scenarios.',
    tools: [
      'Automated application delivery (Git · Jenkins · Docker)',
      'Containerized service platform (Docker · Linux)',
      'Kubernetes deployment lab (Kubernetes · Docker)',
      'Cloud infrastructure baseline (AWS · Terraform)',
      'Monitoring and troubleshooting (Prometheus · Grafana)'
    ]
  }
];

const seedDevopsCourse = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/lms_db');
    console.log('Connected to DB for DevOps curriculum seeding...');

    const admin = await User.findOne({ role: 'admin' });
    if (!admin) {
      console.error('No admin user found. Run "npm run seed" first to create the admin account.');
      await mongoose.disconnect();
      process.exit(1);
    }

    // Ensure a DevOps category exists (reuse if present).
    let category = await Category.findOne({ name: 'Cloud & DevOps' });
    if (!category) {
      category = await Category.create({
        name: 'Cloud & DevOps',
        description: 'Linux, containers, CI/CD, cloud, infrastructure automation, and observability.',
        icon: 'Cloud'
      });
      console.log('Created category "Cloud & DevOps".');
    }

    let course = await Course.findOne({ slug: COURSE_SLUG });

    if (process.env.SEED_DEVOPS_FORCE === 'true' && course) {
      await Module.deleteMany({ courseId: course._id });
      await Lesson.deleteMany({ courseId: course._id });
      console.log('SEED_DEVOPS_FORCE=true: reset curriculum before re-seeding.');
    }

    if (!course) {
      course = await Course.create({
        title: 'DevOps Engineering Course',
        slug: COURSE_SLUG,
        shortDescription: 'A structured DevOps journey from Linux foundations to automation, cloud deployment, and observability.',
        description: 'A hands-on, structured DevOps program that takes learners from Linux and Git through CI/CD, containers, orchestration, cloud, infrastructure automation, and monitoring. The curriculum is managed by Admin and rendered dynamically on the course details page.',
        category: category._id,
        instructor: admin._id,
        level: 'All Levels',
        language: 'English',
        duration: '',
        curriculumTitle: 'DevOps Learning Roadmap',
        learningOutcomes: [
          'Operate Linux systems: administration, processes, networking, permissions, and shell scripting',
          'Collaborate with Git and build automated CI/CD pipelines using Jenkins',
          'Containerize and orchestrate applications with Docker and Kubernetes',
          'Deploy infrastructure across AWS and Azure',
          'Provision and configure environments with Terraform and Ansible',
          'Monitor and troubleshoot systems with Prometheus and Grafana'
        ],
        prerequisites: [
          'Beginner-friendly; designed for students, fresh graduates, and career switchers',
          'Basic computer literacy; prior DevOps experience is not required'
        ],
        // No fee/duration is invented; Admin sets real pricing in Course Management.
        isFree: false,
        price: 0,
        discountPrice: 0,
        status: 'published'
      });
      console.log('Created DevOps Engineering course.');
    } else {
      console.log('DevOps course already exists; ensuring curriculum modules/lessons are present.');
    }

    // Idempotently create modules + lessons (skip those already present).
    let order = 1;
    for (const stage of CURRICULUM) {
      let module = await Module.findOne({ courseId: course._id, title: stage.title });
      if (!module) {
        module = await Module.create({
          title: stage.title,
          courseId: course._id,
          description: stage.description,
          order: order
        });
        console.log(`  + Module: ${stage.title}`);
      }
      order += 1;

      let lessonOrder = 1;
      const existingLessons = await Lesson.find({ moduleId: module._id });
      for (const tool of stage.tools) {
        const exists = existingLessons.some(l => l.title === tool);
        if (!exists) {
          await Lesson.create({
            title: tool,
            courseId: course._id,
            moduleId: module._id,
            description: `${tool} — part of ${stage.title.replace(/^Module \d+ — /, '')}.`,
            duration: 0,
            order: lessonOrder,
            // Make the very first topic of the first module a public preview
            // so students can see the structure (and access it) before purchase.
            isPreview: stage.title.startsWith('Module 01') && lessonOrder === 1
          });
          console.log(`      + Lesson: ${tool}`);
        }
        lessonOrder += 1;
      }
    }

    console.log('DevOps curriculum seeding complete. Course slug:', course.slug);
    await mongoose.disconnect();
    process.exit(0);
  } catch (error) {
    console.error('DevOps seeding error:', error);
    process.exit(1);
  }
};

seedDevopsCourse();
