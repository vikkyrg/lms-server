const Project = require('../models/Project');
const fs = require('fs');
const path = require('path');

const { SEED_PROJECTS } = require('../utils/defaultProjects');

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

    const param = (req.params.slug || '').trim();
    const query = { status: 'published' };

    const mongoose = require('mongoose');
    if (mongoose.isValidObjectId(param)) {
      query.$or = [{ slug: param }, { _id: param }];
    } else {
      // Direct slug match OR normalized slug match (e.g. handle dashes or minor variations)
      const normalized = param.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)+/g, '');
      query.$or = [
        { slug: param },
        { slug: normalized },
        { slug: { $regex: new RegExp(`^${param.replace(/[-_]/g, '.*')}$`, 'i') } }
      ];
    }

    let project = await Project.findOne(query);

    // Fallback: Check if this matches a project in Roadmap configuration
    if (!project) {
      const Roadmap = require('../models/Roadmap');
      const roadmap = await Roadmap.findOne({ slug: 'devops-roadmap' }).lean();
      const matchedRoadmapProject = (roadmap?.projects || []).find((rp) => {
        const rpSlug = (rp.detailsUrl || '').replace(/^\/projects\/?/, '');
        return rpSlug === param || rp.title.toLowerCase().includes(param.toLowerCase());
      });

      if (matchedRoadmapProject) {
        project = {
          _id: matchedRoadmapProject._id || `rm-${Date.now()}`,
          title: matchedRoadmapProject.title,
          slug: param,
          shortDescription: matchedRoadmapProject.description,
          description: matchedRoadmapProject.description,
          technologies: matchedRoadmapProject.technologies || [],
          difficulty: matchedRoadmapProject.difficulty || 'Intermediate',
          learningOutcomes: matchedRoadmapProject.learningOutcomes || [],
          objectives: matchedRoadmapProject.learningOutcomes || [],
          status: 'published'
        };
      }
    }

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

