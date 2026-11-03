// Canonical project showcase content used by the projects API seed and the
// content-update script. Admin edits in MongoDB always take precedence.
const SEED_PROJECTS = [
  {
    title: 'Automated CI/CD Application Delivery',
    slug: 'automated-cicd-application-delivery',
    shortDescription: 'Design and implement an automated CI/CD pipeline that transforms application source code into production-ready container releases. Integrate Git event triggers, pipeline-as-code builds, automated testing, quality gates, image publishing, and gated deployments to establish a reliable, repeatable software delivery process.',
    description: 'This project mirrors how product teams ship software in real engineering organisations. Starting from a version-controlled application repository, you configure webhook-driven Jenkins jobs that execute unit and integration tests, run SonarQube static analysis against enforced quality gates, build optimized multi-stage Docker images, and publish tagged artifacts to a container registry.\n\nDelivery is completed with production-grade release controls: credential masking, staged approval gates, deployment health verification, and automated rollback on failure — so every commit produces a predictable, auditable release from source change to running service.',
    category: 'CI/CD',
    image: '',
    imageAlt: 'Automated CI/CD Pipeline Architecture',
    technologies: ['Git', 'Jenkins', 'Docker', 'Linux', 'SonarQube'],
    learningOutcomes: [
      'Configure automated pipeline triggers using Git repository events and webhooks',
      'Integrate build validation, automated testing, and SonarQube quality gates into pipeline-as-code',
      'Implement Docker image building, tagging, and registry artifact management',
      'Automate application deployment with health-check validation and rollback strategies'
    ],
    objectives: [
      'Operate an end-to-end continuous delivery architecture from commit to production',
      'Implement reusable Jenkinsfile pipeline-as-code for engineering teams',
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
    shortDescription: 'Decompose a monolithic workload into independently deployable Docker services running behind a unified reverse proxy. Design isolated container networks, persistent volumes for stateful databases, and Compose manifests that keep development, staging, and production runtimes identical.',
    description: 'Containerization is treated as a platform engineering exercise, not just writing a Dockerfile. You split a multi-tier application into frontend, API, and database services, author reproducible multi-stage builds, and connect them through isolated Docker networks with automatic service discovery and DNS resolution.\n\nStateful database storage is managed with persistent volumes, configuration is separated across staging and production through environment files, and an Nginx reverse proxy unifies routing and load balancing — producing a portfolio artifact that demonstrates production-grade container operations and secure configuration management.',
    category: 'DevOps',
    image: '',
    imageAlt: 'Docker Microservices Architecture Diagram',
    technologies: ['Docker', 'Docker Compose', 'Linux', 'Nginx', 'PostgreSQL'],
    learningOutcomes: [
      'Architect reproducible multi-stage Dockerfiles for frontend, API, and database services',
      'Implement isolated container networks with service discovery and DNS resolution',
      'Configure persistent Docker volumes to protect stateful database data',
      'Deploy the platform with Docker Compose behind Nginx reverse-proxy load balancing'
    ],
    objectives: [
      'Achieve strict parity between local development and production runtimes',
      'Integrate secure environment configuration and secret injection',
      'Operate a multi-container application stack end to end'
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
    shortDescription: 'Deploy and operate self-healing web workloads on a Kubernetes cluster that stays available through pod failures and traffic spikes. Configure declarative deployments, service exposure, Ingress routing with TLS termination, health probes, and autoscaling validated against live load.',
    description: 'You run real workloads the way a platform team does: declarative Deployments with zero-downtime rolling updates and instant rollbacks, ClusterIP and LoadBalancer services for internal and external exposure, and an Ingress controller terminating TLS for secure routing.\n\nResilience is engineered and then tested — liveness and readiness probes keep failing pods out of traffic rotation, resource requests, limits, and quotas contain noisy workloads, and a Horizontal Pod Autoscaler responds to measured CPU pressure. Incident drills reproduce crash looping, eviction, and networking faults so you diagnose and resolve each with kubectl, then package repeatable application releases with Helm.',
    category: 'Kubernetes',
    image: '',
    imageAlt: 'Kubernetes Cluster Architecture',
    technologies: ['Kubernetes', 'kubectl', 'Docker', 'Linux', 'Helm'],
    learningOutcomes: [
      'Architect declarative Kubernetes manifests with rolling updates and verified rollbacks',
      'Configure liveness and readiness probes to prevent routing traffic to failing pods',
      'Implement resource requests, limits, and Horizontal Pod Autoscalers under live load',
      'Troubleshoot pod crash loops, evictions, and cluster networking faults with kubectl'
    ],
    objectives: [
      'Master core Kubernetes primitives and production manifest patterns',
      'Guarantee high availability under sudden traffic surges',
      'Ship repeatable application versions packaged as Helm charts'
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
    shortDescription: 'Provision a complete enterprise cloud network with Terraform, replacing manual console configuration with version-controlled infrastructure. Deliver public and private subnet topology, NAT and routing, secured compute instances, and remote state with locking for team-safe apply cycles.',
    description: 'Infrastructure as Code is practised like software engineering. You write modular, reusable Terraform components that provision a multi-tier virtual private cloud — public and private subnets, route tables, NAT gateways, and compute instances — with consistent variables and tagging.\n\nState is managed professionally using a remote backend with distributed state locking, so teams plan and apply without corruption risk. Least-privilege security groups and IAM policies are built into the design, and the full plan, apply, destroy, and recreate lifecycle is rehearsed until configuration drift can be detected and eliminated from code alone.',
    category: 'Infrastructure Automation',
    image: '',
    imageAlt: 'Terraform Cloud Infrastructure as Code Diagram',
    technologies: ['AWS/Azure', 'Terraform', 'Linux', 'Bash'],
    learningOutcomes: [
      'Architect modular Terraform components for repeatable multi-environment reuse',
      'Configure remote backend state storage with distributed state locking',
      'Provision multi-tier VPC networking with least-privilege security groups and IAM policies',
      'Automate drift detection and safe infrastructure lifecycle management through plan/apply workflows'
    ],
    objectives: [
      'Eliminate manual console configuration and infrastructure drift',
      'Apply Terraform state management and collaboration best practices',
      'Rebuild or tear down complete cloud environments reproducibly from code'
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
    shortDescription: 'Take a database-backed full-stack application from local code to a secured cloud release. Integrate the frontend with JWT-protected REST APIs, run automated database migrations, enforce CORS and rate-limiting policies, and deploy the complete stack behind an optimized Nginx web server.',
    description: 'This project follows an application through the entire release lifecycle. You connect the frontend build to hardened REST endpoints, implement token-based authentication with role protection, and manage schema evolution through automated, repeatable database migrations with secure connection pooling.\n\nProduction deployment runs on scalable cloud compute behind Nginx, where you configure reverse proxying, compression, caching, and security headers, then protect the API with CORS rules and rate limiting. Health-check endpoints and aggregated logs close the feedback loop, and you troubleshoot real deployment failures — environment misconfiguration, connectivity, and performance bottlenecks — until release targets are met.',
    category: 'Cloud Computing',
    image: '',
    imageAlt: 'Full Stack Web Architecture',
    technologies: ['Java / Python', 'Node.js', 'REST APIs', 'Databases', 'Nginx'],
    learningOutcomes: [
      'Integrate frontend interfaces with authenticated, role-protected backend REST endpoints',
      'Implement automated schema migrations with secure database connection pooling',
      'Deploy the full stack behind hardened Nginx with compression, caching, and security headers',
      'Troubleshoot production releases using health checks and centralized log analysis'
    ],
    objectives: [
      'Manage full-stack deployment dependencies and environment configuration',
      'Secure web applications against common production vulnerabilities',
      'Verify releases against availability and performance targets'
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
    shortDescription: 'Instrument a live platform with Prometheus and Grafana so incidents surface from metrics before users report them. Deploy exporters, write PromQL service-level queries, build four-golden-signal dashboards, and route Alertmanager notifications into structured incident response.',
    description: 'Observability is practised the way an on-call engineer uses it. You deploy Node Exporters and instrumented application endpoints, configure Prometheus scrape targets across hosts and containers, and turn raw metrics into decisions with PromQL queries that compute request rate, error ratio, p95/p99 latency, and saturation.\n\nInteractive Grafana dashboards track the four golden signals per service, while Alertmanager groups, silences, and routes threshold alerts to Slack or email. Troubleshooting drills walk you through diagnosing system degradation, failed rollouts, and configuration drift from metrics alone — reducing time to detection and resolution.',
    category: 'Monitoring',
    image: '',
    imageAlt: 'Prometheus & Grafana Observability Dashboard',
    technologies: ['Prometheus', 'Grafana', 'Node Exporter', 'Alertmanager', 'Linux'],
    learningOutcomes: [
      'Deploy and optimize metric scraping exporters across compute instances and containers',
      'Write PromQL queries to measure request rates, p95 latencies, and error budgets',
      'Configure Alertmanager routing with grouping, silencing, and actionable notifications',
      'Troubleshoot incidents such as degradation, failed rollouts, and configuration drift from live dashboards'
    ],
    objectives: [
      'Detect system degradation before users encounter outages',
      'Investigate production incidents systematically with real metrics',
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

module.exports = { SEED_PROJECTS };
