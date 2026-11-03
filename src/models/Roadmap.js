const mongoose = require('mongoose');

const stageSchema = new mongoose.Schema({
  stageNumber: { type: String, required: true, trim: true },
  title: { type: String, required: true, trim: true },
  shortDescription: { type: String, required: true, trim: true },
  tools: [{ type: String, trim: true }],
  toolDetails: [{
    name: { type: String, trim: true },
    description: { type: String, trim: true },
    iconName: { type: String, trim: true }
  }],
  learningObjectives: [{ type: String, trim: true }],
  topics: [{ type: String, trim: true }],
  order: { type: Number, default: 0 },
  isEnabled: { type: Boolean, default: true }
}, { _id: true });

const workflowStepSchema = new mongoose.Schema({
  stepNumber: { type: Number, required: true },
  title: { type: String, required: true, trim: true },
  subtitle: { type: String, default: '', trim: true },
  category: { type: String, default: 'DevOps', trim: true },
  description: { type: String, required: true, trim: true },
  tools: [{ type: String, trim: true }],
  iconName: { type: String, default: 'Workflow', trim: true },
  order: { type: Number, default: 0 }
}, { _id: true });

const projectCardSchema = new mongoose.Schema({
  projectNumber: { type: String, required: true, trim: true },
  title: { type: String, required: true, trim: true },
  description: { type: String, required: true, trim: true },
  technologies: [{ type: String, trim: true }],
  difficulty: {
    type: String,
    enum: ['Beginner', 'Intermediate', 'Advanced'],
    default: 'Intermediate'
  },
  learningOutcomes: [{ type: String, trim: true }],
  detailsUrl: { type: String, default: '', trim: true },
  order: { type: Number, default: 0 },
  isEnabled: { type: Boolean, default: true }
}, { _id: true });

const roadmapSchema = new mongoose.Schema({
  slug: {
    type: String,
    required: true,
    unique: true,
    default: 'devops-roadmap',
    trim: true,
    lowercase: true
  },
  title: {
    type: String,
    required: true,
    default: 'DevOps Learning Roadmap',
    trim: true
  },
  eyebrow: {
    type: String,
    default: 'AUTOOPS SCHOOL · DEVOPS LEARNING PATH',
    trim: true
  },
  heading: {
    type: String,
    default: 'Your Complete DevOps Learning Roadmap',
    trim: true
  },
  description: {
    type: String,
    default: 'Master the tools, technologies, and practices used to build, automate, deploy, and monitor modern applications. Follow a structured learning path with hands-on projects and real-world workflows.',
    trim: true
  },
  stats: {
    stagesCount: { type: Number, default: 8 },
    technologiesCount: { type: Number, default: 22 },
    projectsCount: { type: Number, default: 5 }
  },
  primaryCta: {
    text: { type: String, default: 'Explore Practical Projects' },
    link: { type: String, default: '/projects' }
  },
  secondaryCta: {
    text: { type: String, default: 'View Learning Roadmap' },
    link: { type: String, default: '#roadmap-stages' }
  },
  stages: [stageSchema],
  cloudPaths: {
    aws: {
      title: { type: String, default: 'AWS Cloud Learning Path' },
      badge: { type: String, default: 'Amazon Web Services' },
      description: { type: String, default: 'Core AWS cloud infrastructure, security, virtual networking, scalable compute, and deployment automation.' },
      tools: [{ type: String, trim: true }],
      topics: [{ type: String, trim: true }]
    },
    azure: {
      title: { type: String, default: 'Azure Cloud Learning Path' },
      badge: { type: String, default: 'Microsoft Azure' },
      description: { type: String, default: 'Enterprise Azure virtual networking, cloud compute, Entra ID identity management, and automated cloud deployments.' },
      tools: [{ type: String, trim: true }],
      topics: [{ type: String, trim: true }]
    }
  },
  workflowSteps: [workflowStepSchema],
  projects: [projectCardSchema],
  finalCta: {
    heading: { type: String, default: 'Start Your Cloud & DevOps Journey Today' },
    description: { type: String, default: 'Learn industry-relevant tools, build real-world projects, and prepare for your DevOps career with AutoOps School.' },
    primaryButtonText: { type: String, default: 'Explore All Courses' },
    primaryButtonLink: { type: String, default: '/courses' },
    secondaryButtonText: { type: String, default: 'Explore Projects' },
    secondaryButtonLink: { type: String, default: '/projects' }
  },
  isEnabled: {
    type: Boolean,
    default: true
  }
}, {
  timestamps: true
});

module.exports = mongoose.model('Roadmap', roadmapSchema);

