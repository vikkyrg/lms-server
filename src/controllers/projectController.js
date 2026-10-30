const Project = require('../models/Project');
const fs = require('fs');
const path = require('path');

const SEED_PROJECTS = [
  {
    title: 'Automated CI/CD Application Delivery',
    slug: 'automated-cicd-application-delivery',
    shortDescription: 'Build a complete CI/CD pipeline that tests, packages, and deploys applications safely with zero manual intervention.',
    description: 'This hands-on industry project guides you through building a production-grade continuous integration and continuous deployment (CI/CD) delivery pipeline. Starting from Git commit triggers, you will configure Jenkins multi-branch pipelines, execute automated unit and integration tests, containerize applications using optimized Dockerfiles, publish artifacts to container registries, and trigger zero-downtime rolling deployments to production servers.\n\nKey focuses include credential masking, pipeline error handling, post-build notifications, and staging approval gates.',
    category: 'CI/CD',
    image: '',
    imageAlt: 'Automated CI/CD Pipeline Architecture',
    technologies: ['Git', 'Jenkins', 'Docker', 'Linux', 'SonarQube'],
    learningOutcomes: [
      'Automate pipeline triggers on repository events and webhooks',
      'Integrate static code analysis and automated test reporting',
      'Implement multi-stage container artifact creation and tagging',
      'Configure automated rollback upon deployment health-check failures'
    ],
    objectives: [
      'Understand end-to-end continuous delivery architecture',
      'Master Jenkinsfile pipeline-as-code scripting',
      'Eliminate manual build friction and deployment inconsistencies'
    ],
    prerequisites: 'Basic knowledge of Linux commands and Git version control',
    difficulty: 'Intermediate',
    estimatedDuration: '2 weeks',
    status: 'published',
    displayOrder: 1,
    isFeatured: true
  },
  {
    title: 'Containerized Microservices Platform',
    slug: 'containerized-microservices-platform',
    shortDescription: 'Package and run multi-service applications consistently across development, staging, and production environments.',
    description: 'Transition monolithic workloads into decomposed, lightweight containerized services. You will design isolated Docker networks, configure persistent volume storage for database backends, write multi-container orchestration manifests with Docker Compose, and establish environment variable separation across staging and production.',
    category: 'DevOps',
    image: '',
    imageAlt: 'Docker Microservices Architecture Diagram',
    technologies: ['Docker', 'Docker Compose', 'Linux', 'Nginx', 'PostgreSQL'],
    learningOutcomes: [
      'Design reproducible multi-stage Docker build files',
      'Manage container networking, service discovery, and DNS resolution',
      'Persist stateful container data using managed Docker volumes',
      'Implement reverse proxy load balancing with Nginx'
    ],
    objectives: [
      'Achieve parity across local development and production runtime',
      'Containerize multi-tier web applications cleanly',
      'Manage environment configuration and secret injection securely'
    ],
    prerequisites: 'Familiarity with web application components (frontend, API, database)',
    difficulty: 'Intermediate',
    estimatedDuration: '2 weeks',
    status: 'published',
    displayOrder: 2,
    isFeatured: true
  },
  {
    title: 'Kubernetes Resilient Cluster Lab',
    slug: 'kubernetes-resilient-cluster-lab',
    shortDescription: 'Deploy resilient web applications using Kubernetes deployments, services, ingress routing, and health checks.',
    description: 'Build and operate a fault-tolerant container orchestration cluster on Kubernetes. You will configure self-healing deployments, define cluster IP and load balancer services, configure Ingress controllers with SSL termination, and tune Horizontal Pod Autoscalers (HPA) responding to live CPU/memory load spikes.',
    category: 'Kubernetes',
    image: '',
    imageAlt: 'Kubernetes Cluster Architecture',
    technologies: ['Kubernetes', 'kubectl', 'Docker', 'Linux', 'Helm'],
    learningOutcomes: [
      'Deploy zero-downtime rolling updates and declarative rollbacks',
      'Configure liveness and readiness health probes to prevent traffic routing errors',
      'Implement resource quotas, limits, and Horizontal Pod Autoscalers',
      'Manage external traffic routing using Kubernetes Ingress controllers'
    ],
    objectives: [
      'Master core Kubernetes primitives and manifest architectures',
      'Guarantee high availability under sudden traffic surges',
      'Debug pod eviction, crash looping, and networking bottlenecks'
    ],
    prerequisites: 'Foundational container knowledge (Docker)',
    difficulty: 'Advanced',
    estimatedDuration: '3 weeks',
    status: 'published',
    displayOrder: 3,
    isFeatured: true
  },
  {
    title: 'Repeatable Cloud Infrastructure Baseline',
    slug: 'repeatable-cloud-infrastructure-baseline',
    shortDescription: 'Define and provision cloud resources and networking infrastructure declaratively using Infrastructure as Code.',
    description: 'Adopt Infrastructure as Code (IaC) to eliminate manual cloud console configuration. Using Terraform, you will provision a complete cloud network topology with public and private subnets, NAT gateways, route tables, compute instances, security groups, and automated state-locking with remote backends.',
    category: 'Infrastructure Automation',
    image: '',
    imageAlt: 'Terraform Cloud Infrastructure as Code Diagram',
    technologies: ['AWS/Azure', 'Terraform', 'Linux', 'Bash'],
    learningOutcomes: [
      'Architect modular Terraform components for repeatable reuse',
      'Configure remote backend state storage with distributed state locking',
      'Provision multi-tier virtual private clouds and network routes',
      'Apply least-privilege security group and IAM policies'
    ],
    objectives: [
      'Eliminate configuration drift with declarative infrastructure',
      'Learn Terraform state management best practices',
      'Automate cloud infrastructure tear-down and recreation'
    ],
    prerequisites: 'Basic cloud computing concepts and networking basics',
    difficulty: 'Intermediate',
    estimatedDuration: '2 weeks',
    status: 'published',
    displayOrder: 4,
    isFeatured: false
  },
  {
    title: 'Full-Stack Web Application Deployment',
    slug: 'full-stack-web-application-deployment',
    shortDescription: 'Develop and deploy full-stack database-backed applications with secure REST APIs, authentication, and responsive views.',
    description: 'Experience the entire software release lifecycle from code compilation to production runtime. You will configure automated database migrations, wire secure JWT token-based authentication, enforce CORS and rate-limiting policies, and deploy the entire solution to scalable cloud compute.',
    category: 'Cloud Computing',
    image: '',
    imageAlt: 'Full Stack Web Architecture',
    technologies: ['Java / Python', 'Node.js', 'REST APIs', 'Databases', 'Nginx'],
    learningOutcomes: [
      'Integrate frontend user interfaces with protected backend REST endpoints',
      'Manage secure connection pooling and database schema migration',
      'Apply production web server headers, compression, and security rules',
      'Implement health check endpoints and log aggregation'
    ],
    objectives: [
      'Understand full-stack deployment dependencies and environment variables',
      'Secure web applications against common vulnerabilities',
      'Build end-to-end technical confidence'
    ],
    prerequisites: 'Basic programming knowledge in Java, Python, or JavaScript',
    difficulty: 'Intermediate',
    estimatedDuration: '3 weeks',
    status: 'published',
    displayOrder: 5,
    isFeatured: false
  },
  {
    title: 'Observability, Monitoring & Troubleshooting',
    slug: 'observability-monitoring-troubleshooting',
    shortDescription: 'Instrument service metrics, establish performance dashboards, and set actionable alerts to diagnose incidents.',
    description: 'Set up an end-to-end monitoring and alerting stack using Prometheus and Grafana. You will scrape system and application performance metrics, design interactive dashboards for latency, traffic, errors, and saturation (the 4 golden signals), and configure Alertmanager to broadcast immediate alerts to Slack or email.',
    category: 'Monitoring',
    image: '',
    imageAlt: 'Prometheus & Grafana Observability Dashboard',
    technologies: ['Prometheus', 'Grafana', 'Node Exporter', 'Alertmanager', 'Linux'],
    learningOutcomes: [
      'Deploy metric scraping exporters across compute instances and containers',
      'Write PromQL queries to compute request rates, p95 latencies, and error budgets',
      'Build informative Grafana dashboards for engineering visibility',
      'Configure proactive threshold alerts and notification routing'
    ],
    objectives: [
      'Detect system degradation before users encounter outages',
      'Troubleshoot production incidents systematically with real metrics',
      'Minimize Mean Time to Detection (MTTD) and Resolution (MTTR)'
    ],
    prerequisites: 'Basic Linux system administration',
    difficulty: 'Advanced',
    estimatedDuration: '2 weeks',
    status: 'published',
    displayOrder: 6,
    isFeatured: false
  }
];

// Helper to seed projects if collection is empty
const seedProjectsIfEmpty = async () => {
  const count = await Project.countDocuments();
  if (count === 0) {
    await Project.insertMany(SEED_PROJECTS);
  }
};

/**
 * @desc    Get all published projects for public showcase
 * @route   GET /api/v1/projects
 * @access  Public
 */
exports.getPublicProjects = async (req, res, next) => {
  try {
    await seedProjectsIfEmpty();

    const { category, search, difficulty, sort } = req.query;
    const query = { status: 'published' };

    if (category && category !== 'All') {
      query.category = category;
    }

    if (difficulty && difficulty !== 'All') {
      query.difficulty = difficulty;
    }

    if (search) {
      query.$or = [
        { title: { $regex: search, $options: 'i' } },
        { shortDescription: { $regex: search, $options: 'i' } },
        { technologies: { $regex: search, $options: 'i' } }
      ];
    }

    let sortOptions = { displayOrder: 1, createdAt: -1 };
    if (sort === 'title-asc') {
      sortOptions = { title: 1 };
    } else if (sort === 'newest') {
      sortOptions = { createdAt: -1 };
    }

    const projects = await Project.find(query)
      .select('title slug shortDescription category image imageAlt technologies learningOutcomes difficulty estimatedDuration displayOrder isFeatured')
      .sort(sortOptions);

    // Get unique categories of published projects
    const allPublished = await Project.find({ status: 'published' }).select('category');
    const categoriesSet = new Set(['All']);
    allPublished.forEach((p) => {
      if (p.category) categoriesSet.add(p.category);
    });

    res.status(200).json({
      success: true,
      count: projects.length,
      categories: Array.from(categoriesSet),
      projects
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Get single published project by slug
 * @route   GET /api/v1/projects/:slug
 * @access  Public
 */
exports.getProjectBySlug = async (req, res, next) => {
  try {
    await seedProjectsIfEmpty();

    const project = await Project.findOne({
      slug: req.params.slug,
      status: 'published'
    });

    if (!project) {
      return res.status(404).json({
        success: false,
        message: 'Project not found or is currently not published.'
      });
    }

    res.status(200).json({
      success: true,
      project
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Get all projects for admin with stats and filters
 * @route   GET /api/v1/projects/admin/all
 * @access  Private/Admin
 */
exports.getAdminProjects = async (req, res, next) => {
  try {
    await seedProjectsIfEmpty();

    const { status, category, search, sort, page = 1, limit = 50 } = req.query;
    const query = {};

    if (status && status !== 'all') {
      query.status = status;
    }

    if (category && category !== 'all') {
      query.category = category;
    }

    if (search) {
      query.$or = [
        { title: { $regex: search, $options: 'i' } },
        { shortDescription: { $regex: search, $options: 'i' } },
        { technologies: { $regex: search, $options: 'i' } }
      ];
    }

    let sortOptions = { displayOrder: 1, createdAt: -1 };
    if (sort === 'title-asc') {
      sortOptions = { title: 1 };
    } else if (sort === 'order-desc') {
      sortOptions = { displayOrder: -1, createdAt: -1 };
    } else if (sort === 'newest') {
      sortOptions = { createdAt: -1 };
    }

    const projects = await Project.find(query).sort(sortOptions);

    // Compute admin dashboard stats dynamically
    const allProjects = await Project.find({});
    const totalCount = allProjects.length;
    const publishedCount = allProjects.filter((p) => p.status === 'published').length;
    const draftCount = allProjects.filter((p) => p.status === 'draft').length;

    const categoriesSet = new Set();
    allProjects.forEach((p) => {
      if (p.category) categoriesSet.add(p.category);
    });

    res.status(200).json({
      success: true,
      count: projects.length,
      stats: {
        total: totalCount,
        published: publishedCount,
        draft: draftCount,
        categoriesCount: categoriesSet.size,
        categories: Array.from(categoriesSet)
      },
      projects
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Get single project by ID for admin
 * @route   GET /api/v1/projects/admin/:id
 * @access  Private/Admin
 */
exports.getProjectById = async (req, res, next) => {
  try {
    const project = await Project.findById(req.params.id);
    if (!project) {
      return res.status(404).json({
        success: false,
        message: 'Project not found'
      });
    }

    res.status(200).json({
      success: true,
      project
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Helper to parse array inputs that may arrive as JSON strings or comma-separated lists
 */
const parseArrayField = (val) => {
  if (!val) return [];
  if (Array.isArray(val)) return val.map((s) => String(s).trim()).filter(Boolean);
  if (typeof val === 'string') {
    try {
      const parsed = JSON.parse(val);
      if (Array.isArray(parsed)) return parsed.map((s) => String(s).trim()).filter(Boolean);
    } catch (_) {}
    return val.split(',').map((s) => s.trim()).filter(Boolean);
  }
  return [];
};

/**
 * @desc    Create new project
 * @route   POST /api/v1/projects
 * @access  Private/Admin
 */
exports.createProject = async (req, res, next) => {
  try {
    const {
      title,
      slug,
      shortDescription,
      description,
      category,
      image,
      imageAlt,
      technologies,
      learningOutcomes,
      objectives,
      prerequisites,
      difficulty,
      estimatedDuration,
      githubUrl,
      liveDemoUrl,
      videoUrl,
      isFeatured,
      status,
      displayOrder
    } = req.body;

    if (!title || !shortDescription || !description) {
      return res.status(400).json({
        success: false,
        message: 'Please provide project title, short description, and detailed description'
      });
    }

    let finalImageUrl = image || '';
    if (req.file) {
      finalImageUrl = `/uploads/thumbnails/${req.file.filename}`;
    }

    // Check slug uniqueness
    let finalSlug = slug ? slug.trim().toLowerCase().replace(/[\s_-]+/g, '-') : '';
    if (!finalSlug) {
      finalSlug = title
        .toLowerCase()
        .trim()
        .replace(/[^\w\s-]/g, '')
        .replace(/[\s_-]+/g, '-')
        .replace(/^-+|-+$/g, '');
    }

    const existingSlug = await Project.findOne({ slug: finalSlug });
    if (existingSlug) {
      finalSlug = `${finalSlug}-${Date.now()}`;
    }

    const project = await Project.create({
      title: title.trim(),
      slug: finalSlug,
      shortDescription: shortDescription.trim(),
      description: description.trim(),
      category: category ? category.trim() : 'DevOps',
      image: finalImageUrl,
      imageAlt: imageAlt ? imageAlt.trim() : '',
      technologies: parseArrayField(technologies),
      learningOutcomes: parseArrayField(learningOutcomes),
      objectives: parseArrayField(objectives),
      prerequisites: prerequisites ? prerequisites.trim() : '',
      difficulty: difficulty || 'Intermediate',
      estimatedDuration: estimatedDuration ? estimatedDuration.trim() : '2-3 weeks',
      githubUrl: githubUrl ? githubUrl.trim() : '',
      liveDemoUrl: liveDemoUrl ? liveDemoUrl.trim() : '',
      videoUrl: videoUrl ? videoUrl.trim() : '',
      isFeatured: isFeatured === 'true' || isFeatured === true,
      status: status === 'draft' ? 'draft' : 'published',
      displayOrder: Number(displayOrder) || 0
    });

    res.status(201).json({
      success: true,
      message: 'Project created successfully',
      project
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Update project
 * @route   PUT /api/v1/projects/:id
 * @access  Private/Admin
 */
exports.updateProject = async (req, res, next) => {
  try {
    let project = await Project.findById(req.params.id);
    if (!project) {
      return res.status(404).json({
        success: false,
        message: 'Project not found'
      });
    }

    const {
      title,
      slug,
      shortDescription,
      description,
      category,
      image,
      imageAlt,
      technologies,
      learningOutcomes,
      objectives,
      prerequisites,
      difficulty,
      estimatedDuration,
      githubUrl,
      liveDemoUrl,
      videoUrl,
      isFeatured,
      status,
      displayOrder
    } = req.body;

    if (title !== undefined) project.title = title.trim();
    if (shortDescription !== undefined) project.shortDescription = shortDescription.trim();
    if (description !== undefined) project.description = description.trim();
    if (category !== undefined) project.category = category.trim();
    if (imageAlt !== undefined) project.imageAlt = imageAlt.trim();
    if (technologies !== undefined) project.technologies = parseArrayField(technologies);
    if (learningOutcomes !== undefined) project.learningOutcomes = parseArrayField(learningOutcomes);
    if (objectives !== undefined) project.objectives = parseArrayField(objectives);
    if (prerequisites !== undefined) project.prerequisites = prerequisites.trim();
    if (difficulty !== undefined) project.difficulty = difficulty;
    if (estimatedDuration !== undefined) project.estimatedDuration = estimatedDuration.trim();
    if (githubUrl !== undefined) project.githubUrl = githubUrl.trim();
    if (liveDemoUrl !== undefined) project.liveDemoUrl = liveDemoUrl.trim();
    if (videoUrl !== undefined) project.videoUrl = videoUrl.trim();
    if (isFeatured !== undefined) project.isFeatured = isFeatured === 'true' || isFeatured === true;
    if (status !== undefined) project.status = status;
    if (displayOrder !== undefined) project.displayOrder = Number(displayOrder) || 0;

    // Slug check if changing
    if (slug && slug.trim().toLowerCase() !== project.slug) {
      const formattedSlug = slug.trim().toLowerCase().replace(/[\s_-]+/g, '-');
      const conflict = await Project.findOne({ slug: formattedSlug, _id: { $ne: project._id } });
      if (conflict) {
        return res.status(400).json({ success: false, message: 'Slug already in use by another project' });
      }
      project.slug = formattedSlug;
    }

    if (req.file) {
      // Remove old image file if local
      if (project.image && project.image.startsWith('/uploads/thumbnails/')) {
        const oldFile = path.join(__dirname, '../../', project.image);
        if (fs.existsSync(oldFile)) fs.unlinkSync(oldFile);
      }
      project.image = `/uploads/thumbnails/${req.file.filename}`;
    } else if (image !== undefined) {
      project.image = image;
    }

    await project.save();

    res.status(200).json({
      success: true,
      message: 'Project updated successfully',
      project
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Toggle project publish status
 * @route   PATCH /api/v1/projects/:id/status
 * @access  Private/Admin
 */
exports.updateProjectStatus = async (req, res, next) => {
  try {
    const project = await Project.findById(req.params.id);
    if (!project) {
      return res.status(404).json({
        success: false,
        message: 'Project not found'
      });
    }

    const { status } = req.body;
    project.status = status === 'published' ? 'published' : 'draft';
    await project.save();

    res.status(200).json({
      success: true,
      message: `Project ${project.status === 'published' ? 'published' : 'unpublished'} successfully`,
      project
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Delete project
 * @route   DELETE /api/v1/projects/:id
 * @access  Private/Admin
 */
exports.deleteProject = async (req, res, next) => {
  try {
    const project = await Project.findById(req.params.id);
    if (!project) {
      return res.status(404).json({
        success: false,
        message: 'Project not found'
      });
    }

    // Delete image if exists
    if (project.image && project.image.startsWith('/uploads/thumbnails/')) {
      const imgPath = path.join(__dirname, '../../', project.image);
      if (fs.existsSync(imgPath)) fs.unlinkSync(imgPath);
    }

    await project.deleteOne();

    res.status(200).json({
      success: true,
      message: 'Project deleted successfully'
    });
  } catch (error) {
    next(error);
  }
};

