const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });
const mongoose = require('mongoose');
const Course = require('./src/models/Course');
const Category = require('./src/models/Category');
const User = require('./src/models/User');
const Module = require('./src/models/Module');
const Lesson = require('./src/models/Lesson');

async function updateCourses() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('Connected to MongoDB');

    // 1. Find Admin User to assign as instructor
    const admin = await User.findOne({ role: 'admin' });
    if (!admin) {
      throw new Error('Admin user not found');
    }
    console.log(`Using admin instructor: ${admin.email} (${admin._id})`);

    // 2. Archive existing courses without deleting records (preserving enrollments, payments, progress)
    const existingOldCourses = await Course.find({
      title: { $in: [
        'testing',
        'Production Kubernetes & Cloud Architecture Masterclass',
        'GitOps & CI/CD Pipeline Fundamentals'
      ]}
    });

    for (const c of existingOldCourses) {
      c.status = 'archived';
      await c.save();
      console.log(`Archived course safely: "${c.title}" (ID: ${c._id})`);
    }

    // 3. Ensure Categories exist: "DevOps & SRE" and "Programming"
    let devopsCategory = await Category.findOne({ name: 'DevOps & SRE' });
    if (!devopsCategory) {
      devopsCategory = await Category.create({
        name: 'DevOps & SRE',
        slug: 'devops-sre',
        description: 'Cloud infrastructure, CI/CD, and site reliability engineering'
      });
      console.log('Created category: DevOps & SRE');
    }

    let programmingCategory = await Category.findOne({ name: 'Programming' });
    if (!programmingCategory) {
      programmingCategory = await Category.create({
        name: 'Programming',
        slug: 'programming',
        description: 'Modern programming languages, application development and software craftsmanship'
      });
      console.log('Created category: Programming');
    }

    // 4. Course Specs to Add / Upsert
    const coursesToCreate = [
      {
        title: 'DevOps Engineering',
        category: devopsCategory._id,
        level: 'All Levels',
        shortDescription: 'Learn modern DevOps practices, automation, CI/CD pipelines, containerization, cloud infrastructure, and deployment workflows.',
        description: 'Comprehensive DevOps Engineering program designed from beginner to advanced. Master Linux essentials, Git/GitHub collaborative workflows, Docker containerization, Kubernetes orchestration, CI/CD with Jenkins, Terraform Infrastructure-as-Code, Ansible configuration management, AWS cloud deployment, and Prometheus & Grafana observability. Access granted for 3 calendar months upon approval.',
        thumbnail: '/uploads/thumbnails/devops-engineering.svg',
        isFree: false,
        price: 4999,
        discountPrice: 2499,
        duration: '40 Hours',
        videoDuration: 40,
        status: 'published',
        curriculumTitle: 'DevOps Engineering Career Roadmap',
        learningOutcomes: [
          'Master Linux terminal, shell scripting, and server administration',
          'Build automated CI/CD pipelines using Git, GitHub Actions, and Jenkins',
          'Containerize microservices with Docker and deploy clusters with Kubernetes',
          'Provision cloud infrastructure declaratively using Terraform and Ansible',
          'Implement full-stack monitoring and alerting with Prometheus and Grafana'
        ],
        prerequisites: [
          'Basic computer fundamentals and eagerness to learn',
          'No prior DevOps or programming background required'
        ],
        modules: [
          {
            title: 'Module 1: Linux Fundamentals & Shell Automation',
            lessons: [
              { title: 'Introduction to Linux & Command Line Basics', duration: 45, isPreview: true },
              { title: 'User Management, Permissions & File System Architecture', duration: 55, isPreview: false },
              { title: 'Bash Shell Scripting & Task Automation', duration: 60, isPreview: false }
            ]
          },
          {
            title: 'Module 2: Version Control with Git & GitHub',
            lessons: [
              { title: 'Git Core Concepts: Commits, Branches, and Merging', duration: 40, isPreview: true },
              { title: 'GitHub Workflows, Pull Requests, and Team Collaboration', duration: 50, isPreview: false }
            ]
          },
          {
            title: 'Module 3: Containerization with Docker',
            lessons: [
              { title: 'Docker Containers, Images, and Dockerfile Best Practices', duration: 65, isPreview: false },
              { title: 'Docker Compose for Multi-Container Microservices', duration: 50, isPreview: false }
            ]
          },
          {
            title: 'Module 4: Container Orchestration with Kubernetes',
            lessons: [
              { title: 'Kubernetes Architecture: Pods, Services, Deployments & ConfigMaps', duration: 75, isPreview: false },
              { title: 'Scaling, Self-Healing, and Ingress Controller Management', duration: 70, isPreview: false }
            ]
          },
          {
            title: 'Module 5: CI/CD Pipelines with Jenkins & Cloud Deployment',
            lessons: [
              { title: 'Declarative Jenkins Pipelines & Automated Build Triggers', duration: 80, isPreview: false },
              { title: 'Terraform Infrastructure as Code on AWS Cloud', duration: 90, isPreview: false },
              { title: 'Production Monitoring with Prometheus & Grafana Dashboards', duration: 60, isPreview: false }
            ]
          }
        ]
      },
      {
        title: 'Java Programming',
        category: programmingCategory._id,
        level: 'All Levels',
        shortDescription: 'Master Java programming fundamentals, object-oriented programming, collections, exception handling, JDBC, and practical application development.',
        description: 'Complete hands-on Java course covering core syntax, classes, inheritance, polymorphism, encapsulation, Java Collections Framework, lambda expressions, streams, robust exception handling, JDBC database connectivity, and Spring Boot foundations. Gain 3 calendar months access to dynamic lessons, practical assignments, and verified certificates.',
        thumbnail: '/uploads/thumbnails/java-programming.svg',
        isFree: false,
        price: 3999,
        discountPrice: 1999,
        duration: '35 Hours',
        videoDuration: 35,
        status: 'published',
        curriculumTitle: 'Java Masterclass Learning Curriculum',
        learningOutcomes: [
          'Understand core Java syntax, data types, and control structures',
          'Implement solid Object-Oriented Design (OOP) patterns',
          'Leverage Java Collections (Lists, Sets, Maps) and Stream API',
          'Connect to relational databases with JDBC and execute SQL queries',
          'Build robust REST APIs using Java and Spring Boot fundamentals'
        ],
        prerequisites: [
          'Basic computer literacy',
          'No prior programming knowledge required'
        ],
        modules: [
          {
            title: 'Module 1: Java Fundamentals & Control Structures',
            lessons: [
              { title: 'Java Setup (JDK, IntelliJ), Syntax, and Variables', duration: 40, isPreview: true },
              { title: 'Conditionals, Loops, and Arrays in Java', duration: 50, isPreview: false }
            ]
          },
          {
            title: 'Module 2: Object-Oriented Programming (OOP) in Java',
            lessons: [
              { title: 'Classes, Objects, Methods, and Constructors', duration: 60, isPreview: true },
              { title: 'Inheritance, Polymorphism, Abstract Classes, and Interfaces', duration: 70, isPreview: false },
              { title: 'Encapsulation and Access Modifiers', duration: 45, isPreview: false }
            ]
          },
          {
            title: 'Module 3: Collections Framework & Generics',
            lessons: [
              { title: 'ArrayList, LinkedList, HashSet, and HashMap', duration: 65, isPreview: false },
              { title: 'Java Streams API and Lambda Expressions', duration: 55, isPreview: false }
            ]
          },
          {
            title: 'Module 4: Exception Handling, JDBC & Database Integration',
            lessons: [
              { title: 'Try-Catch, Custom Exceptions, and Best Practices', duration: 50, isPreview: false },
              { title: 'Connecting to MySQL with JDBC and CRUD Operations', duration: 60, isPreview: false },
              { title: 'Introduction to Spring Boot & Building Your First REST Endpoint', duration: 75, isPreview: false }
            ]
          }
        ]
      },
      {
        title: 'Python Programming',
        category: programmingCategory._id,
        level: 'All Levels',
        shortDescription: 'Learn Python from fundamentals to practical programming, automation, data handling, APIs, and real-world application development.',
        description: 'Comprehensive Python training for beginners and aspiring software engineers. Master Python syntax, functions, object-oriented concepts, file handling, automation scripting, data processing with NumPy and Pandas, database integration, and building modern web APIs with Flask. Access granted for 3 calendar months upon approval.',
        thumbnail: '/uploads/thumbnails/python-programming.svg',
        isFree: false,
        price: 3999,
        discountPrice: 1999,
        duration: '32 Hours',
        videoDuration: 32,
        status: 'published',
        curriculumTitle: 'Python Practical Development Syllabus',
        learningOutcomes: [
          'Write idiomatic Python scripts using clean code best practices',
          'Apply Object-Oriented Programming (OOP) principles in Python',
          'Automate repetitive workflows, file tasks, and data processing',
          'Analyze and manipulate data using NumPy and Pandas',
          'Develop and deploy RESTful APIs using Python and Flask'
        ],
        prerequisites: [
          'Basic computer skills',
          'Suitable for complete beginners'
        ],
        modules: [
          {
            title: 'Module 1: Python Basics & Data Structures',
            lessons: [
              { title: 'Installing Python, VS Code, and Running First Scripts', duration: 35, isPreview: true },
              { title: 'Variables, Operators, Strings, and Numbers', duration: 45, isPreview: false },
              { title: 'Lists, Tuples, Dictionaries, and Sets', duration: 55, isPreview: false }
            ]
          },
          {
            title: 'Module 2: Functions, Modules & Object-Oriented Programming',
            lessons: [
              { title: 'Defining Functions, Parameters, and Return Values', duration: 45, isPreview: true },
              { title: 'Classes, Objects, Inheritance, and Encapsulation in Python', duration: 60, isPreview: false },
              { title: 'File Handling, JSON, and Working with Modules', duration: 50, isPreview: false }
            ]
          },
          {
            title: 'Module 3: Practical Automation & Data Handling',
            lessons: [
              { title: 'Scripting OS Automations and Web Scraping Basics', duration: 65, isPreview: false },
              { title: 'Data Analysis Fundamentals with NumPy & Pandas', duration: 70, isPreview: false }
            ]
          },
          {
            title: 'Module 4: Web APIs & Database Connectivity',
            lessons: [
              { title: 'Connecting Python to SQLite and SQL Databases', duration: 50, isPreview: false },
              { title: 'Building RESTful Web APIs with Flask', duration: 80, isPreview: false }
            ]
          }
        ]
      }
    ];

    for (const spec of coursesToCreate) {
      let course = await Course.findOne({ title: spec.title });
      if (!course) {
        course = new Course({
          title: spec.title,
          category: spec.category,
          instructor: admin._id,
          level: spec.level,
          shortDescription: spec.shortDescription,
          description: spec.description,
          thumbnail: spec.thumbnail,
          isFree: spec.isFree,
          price: spec.price,
          discountPrice: spec.discountPrice,
          duration: spec.duration,
          videoDuration: spec.videoDuration,
          status: spec.status,
          curriculumTitle: spec.curriculumTitle,
          learningOutcomes: spec.learningOutcomes,
          prerequisites: spec.prerequisites
        });
        await course.save();
        console.log(`Created course: "${course.title}" (ID: ${course._id})`);
      } else {
        // Update existing to ensure published and updated metadata
        course.category = spec.category;
        course.level = spec.level;
        course.shortDescription = spec.shortDescription;
        course.description = spec.description;
        course.thumbnail = spec.thumbnail;
        course.isFree = spec.isFree;
        course.price = spec.price;
        course.discountPrice = spec.discountPrice;
        course.duration = spec.duration;
        course.videoDuration = spec.videoDuration;
        course.status = spec.status;
        course.curriculumTitle = spec.curriculumTitle;
        course.learningOutcomes = spec.learningOutcomes;
        course.prerequisites = spec.prerequisites;
        await course.save();
        console.log(`Updated course: "${course.title}" (ID: ${course._id})`);
      }

      // Populate Modules and Lessons if not already created
      const existingModules = await Module.find({ courseId: course._id });
      if (existingModules.length === 0) {
        for (let mIdx = 0; mIdx < spec.modules.length; mIdx++) {
          const modSpec = spec.modules[mIdx];
          const newModule = await Module.create({
            courseId: course._id,
            title: modSpec.title,
            order: mIdx + 1
          });

          for (let lIdx = 0; lIdx < modSpec.lessons.length; lIdx++) {
            const lesSpec = modSpec.lessons[lIdx];
            await Lesson.create({
              courseId: course._id,
              moduleId: newModule._id,
              title: lesSpec.title,
              duration: lesSpec.duration,
              order: lIdx + 1,
              isPreview: lesSpec.isPreview
            });
          }
        }
        console.log(`Populated curriculum modules & lessons for "${course.title}"`);
      }
    }

    console.log('\n--- SUCCESS: Courses update completed dynamically ---');
  } catch (err) {
    console.error('Update failed:', err);
  } finally {
    await mongoose.disconnect();
    console.log('MongoDB connection closed');
  }
}

updateCourses();

