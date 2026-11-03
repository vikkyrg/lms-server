// One-time content upgrade for existing project documents in MongoDB.
// Matches projects by slug and updates ONLY the editorial fields
// (shortDescription, description, learningOutcomes, objectives).
// IDs, slugs, titles, categories, difficulty, ordering, and status are preserved,
// and admin panel editing stays fully dynamic.
require('dotenv').config();
const mongoose = require('mongoose');
const Project = require('./src/models/Project');
const { SEED_PROJECTS } = require('./src/utils/defaultProjects');

async function updateProjectContent() {
  const uri = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/lms_db';
  await mongoose.connect(uri);
  console.log(`Connected: ${mongoose.connection.name}`);

  for (const seed of SEED_PROJECTS) {
    const project = await Project.findOne({ slug: seed.slug });
    if (!project) {
      console.log(`SKIP  (not found): ${seed.slug}`);
      continue;
    }

    project.shortDescription = seed.shortDescription;
    project.description = seed.description;
    project.learningOutcomes = seed.learningOutcomes;
    project.objectives = seed.objectives;
    await project.save();

    console.log(`UPDATED: ${seed.slug} (id=${project._id}, title="${project.title}", order=${project.displayOrder})`);
  }

  await mongoose.disconnect();
  console.log('Done. All other fields preserved.');
}

updateProjectContent().catch((err) => {
  console.error(err);
  process.exit(1);
});
