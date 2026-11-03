const Roadmap = require('../models/Roadmap');
const { defaultDevOpsRoadmap } = require('../utils/defaultRoadmap');

/**
 * @desc Get public roadmap by slug (defaults to 'devops-roadmap')
 * Auto-creates from default data if not yet present in database
 * @route GET /api/v1/roadmap or GET /api/v1/roadmap/:slug
 * @access Public
 */
exports.getRoadmap = async (req, res, next) => {
  try {
    const slug = req.params.slug || 'devops-roadmap';
    let roadmap = await Roadmap.findOne({ slug });

    if (!roadmap) {
      // Auto-initialize with default curriculum data
      roadmap = await Roadmap.create({
        ...defaultDevOpsRoadmap,
        slug
      });
    }

    res.status(200).json({
      success: true,
      roadmap
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc Update roadmap content, stages, cloud paths, workflow, and projects
 * @route PUT /api/v1/roadmap or PUT /api/v1/roadmap/:slug
 * @access Admin only
 */
exports.updateRoadmap = async (req, res, next) => {
  try {
    const slug = req.params.slug || 'devops-roadmap';
    const updateData = req.body;

    let roadmap = await Roadmap.findOne({ slug });

    if (!roadmap) {
      roadmap = new Roadmap({
        ...defaultDevOpsRoadmap,
        ...updateData,
        slug
      });
      await roadmap.save();
    } else {
      // Update top-level fields if provided
      if (updateData.title !== undefined) roadmap.title = updateData.title;
      if (updateData.eyebrow !== undefined) roadmap.eyebrow = updateData.eyebrow;
      if (updateData.heading !== undefined) roadmap.heading = updateData.heading;
      if (updateData.description !== undefined) roadmap.description = updateData.description;
      if (updateData.stats !== undefined) roadmap.stats = updateData.stats;
      if (updateData.primaryCta !== undefined) roadmap.primaryCta = updateData.primaryCta;
      if (updateData.secondaryCta !== undefined) roadmap.secondaryCta = updateData.secondaryCta;
      if (updateData.finalCta !== undefined) roadmap.finalCta = updateData.finalCta;
      if (updateData.isEnabled !== undefined) roadmap.isEnabled = updateData.isEnabled;

      // Update collections if provided
      if (Array.isArray(updateData.stages)) roadmap.stages = updateData.stages;
      if (updateData.cloudPaths) roadmap.cloudPaths = updateData.cloudPaths;
      if (Array.isArray(updateData.workflowSteps)) roadmap.workflowSteps = updateData.workflowSteps;
      if (Array.isArray(updateData.projects)) roadmap.projects = updateData.projects;

      await roadmap.save();
    }

    res.status(200).json({
      success: true,
      message: 'DevOps learning roadmap updated successfully',
      roadmap
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc Reset roadmap to standard approved default curriculum
 * @route POST /api/v1/roadmap/reset
 * @access Admin only
 */
exports.resetRoadmap = async (req, res, next) => {
  try {
    const slug = req.body.slug || 'devops-roadmap';
    let roadmap = await Roadmap.findOne({ slug });

    if (roadmap) {
      Object.assign(roadmap, defaultDevOpsRoadmap, { slug });
      await roadmap.save();
    } else {
      roadmap = await Roadmap.create({
        ...defaultDevOpsRoadmap,
        slug
      });
    }

    res.status(200).json({
      success: true,
      message: 'Roadmap reset to default curriculum successfully',
      roadmap
    });
  } catch (error) {
    next(error);
  }
};

