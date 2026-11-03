/**
 * Canonical Complete DevOps Learning Roadmap for AutoOps School
 * Sourced directly from "Flow of DevOps Tools.pdf" (Pages 1 - 20)
 * Exact tools, 8 stages, separate AWS & Azure tracks, 5 exact projects, and complete CI/CD workflow
 */

const defaultDevOpsRoadmap = {
  slug: 'devops-roadmap',
  title: 'DevOps Learning Roadmap',
  eyebrow: 'AUTOOPS SCHOOL · DEVOPS LEARNING PATH',
  heading: 'Your Complete DevOps Learning Roadmap',
  description: 'From Linux fundamentals to cloud infrastructure, CI/CD automation, container orchestration, and production monitoring — follow a structured learning path designed to develop practical DevOps skills.',
  stats: {
    stagesCount: 8,
    technologiesCount: 22,
    projectsCount: 5
  },
  primaryCta: {
    text: 'Explore Practical Projects',
    link: '/projects'
  },
  secondaryCta: {
    text: 'View Roadmap',
    link: '#roadmap-stages'
  },
  stages: [
    {
      stageNumber: 'Stage 01',
      title: 'DevOps Foundations',
      shortDescription: 'Linux OS installation on VirtualBox & Ubuntu, filesystem hierarchy, administration commands, user/group security, and comprehensive shell scripting automation.',
      tools: ['Linux', 'Ubuntu', 'VirtualBox', 'Bash', 'Shell Scripting', 'Networking'],
      topics: [
        'DevOps Overview & DevOps lifecycle',
        'Software concepts & Types of Software',
        'Linux OS introduction & history of Linux',
        'Linux installation using Oracle VirtualBox and Ubuntu (Jammy Jellyfish)',
        'Linux architecture & Difference between LinuxOS and Windows OS',
        'Flavours and distributions of Linux OS',
        'Linux file systems hierarchy & Types of file systems',
        'File management: absolute vs relative paths, creation, modification',
        'User management: Types of users & commands (useradd, usermod, userdel)',
        'Group management: Commands (groupadd, groupmod, groupdel)',
        'File permissions: Permissions using alphabet series (rwx) & number series (777, 755, 644)',
        'File compressions: Types of compression (tar, gzip, bzip2, zip)',
        'System commands: top, du, df, ps, kill, systemctl, uname -a',
        'Text filtering commands: grep, pgrep, find, locate, head & tail, wc, cut, awk, pipeline chaining',
        'Package managers: yum and apt',
        'Networking commands: ifconfig, ping, ss -tuln, netstat, curl, wget, ports, SSH',
        'Shell Scripting: What is shell scripting, features, and script creation',
        'Input & output commands: echo, read',
        'Variables: Declaring variables & utilizing variable value ($)',
        'Operators & types: Arithmetic, Relational, Logical, String, and File operators',
        'Conditional statements: if, if-else, elif, nested condition',
        'Looping statements: For loop, While loop, Until loop',
        'Functions: Creation of functions and modular scripts',
        'Automation scripts: User management scripts',
        'Automation scripts: Backup & Restore scripts',
        'Automation scripts: Monitoring CPU usage & system performance',
        'Automation scripts: Creating cron jobs & service management scripts',
        'Automating software installation and updating'
      ],
      order: 1,
      isEnabled: true
    },
    {
      stageNumber: 'Stage 02',
      title: 'Git & GitHub',
      shortDescription: 'Distributed version control systems, Git working stages, branch strategies, conflict resolution, collaboration, and pull request workflows.',
      tools: ['Git', 'GitHub'],
      topics: [
        'VCS (Version Control System): Examples & Types of VCS (Centralized vs Distributed)',
        'GIT (Global Information Tracker): Introduction & History of Git',
        'Features of Git & architecture',
        'Working stages of Git (Working Directory, Staging Area, Local Repository)',
        'Workflow of Git & basic commands with hands-on practice',
        'GitHub: Introduction to GitHub & account creation',
        'Push & pull into remote repositories',
        'GitHub authentication with personal access tokens',
        'Branching: Introduction to branching, types of branching, and branching commands',
        'Merging: Merging commands and hands-on merge execution',
        'Merge conflicts: Understanding conflict causes and conflict resolution',
        'Undoing changes: git checkout, git reset (soft/hard), and git revert',
        'Additional commands: Git collaboration workflows',
        'Git Stash (saving and applying stashed changes)',
        'Git Tag (lightweight and annotated release tags)',
        '.gitignore file patterns and ignoring tracked files',
        'README file formatting with markdown',
        'Forking repositories and upstream sync',
        'Rebase & Squash commits for clean commit history'
      ],
      order: 2,
      isEnabled: true
    },
    {
      stageNumber: 'Stage 03',
      title: 'Build Automation & Code Quality',
      shortDescription: 'Traditional build comparison, Maven lifecycle, POM.xml configuration, JaCoCo/JUnit testing, Nexus artifact repository, SonarQube quality analysis, and Nginx/Tomcat web servers.',
      tools: ['Maven', 'JUnit', 'TestNG', 'JaCoCo', 'Nexus', 'SonarQube', 'Nginx', 'Tomcat'],
      topics: [
        'Recap of traditional approach to building software',
        'What is Build? Processes involved in developing builds & why build tools are needed',
        'Introduction to Maven: History and features of Maven',
        'What is POM.xml? Structure, groupId, artifactId, and versioning',
        'Plugins & dependencies configuration (JaCoCo code coverage, JUnit, TestNG)',
        'Types of repositories: Local Repository, Central Repository, and Remote Repository (Nexus)',
        'Maven phases explained with commands (validate, compile, test, package, verify, install, deploy)',
        'Maven Lifecycles: Clean Lifecycle, Default Lifecycle, Site Lifecycle',
        'Configuring settings.xml for integrating Maven with Nexus Repository',
        'Copying and downloading dependencies from Maven repositories',
        'Code Quality inspection & static analysis using SonarQube',
        'Configuring quality gates and code rules in SonarQube',
        'Web servers: Nginx configuration, reverse proxy, and static file serving',
        'Application servers: Apache Tomcat deployment (WAR files and webapps)'
      ],
      order: 3,
      isEnabled: true
    },
    {
      stageNumber: 'Stage 04',
      title: 'Jenkins & CI/CD Automation',
      shortDescription: 'Continuous integration and continuous deployment, Jenkins installation, pipeline jobs, GitHub webhooks, Jenkinsfile creation, and master-slave distributed architecture.',
      tools: ['Jenkins', 'Maven', 'Git', 'SonarQube', 'Nexus', 'Tomcat'],
      topics: [
        'Traditional build & release process challenges and bottlenecks',
        'Introduction to Jenkins: What is CI, CD (Continuous Delivery) & CD (Continuous Deployment)',
        'History and features of Jenkins & CI/CD tool landscape',
        'Installation & setup of Jenkins on Linux servers',
        'Explaining the Jenkins dashboard and administrative menus',
        'Jobs and its types: What is a job, Freestyle jobs, Pipeline jobs & types, Maven Project integration',
        'Role-Based Authorization: What is a plugin, Role-Based Strategy Plugin, and enabling authorization',
        'Build Triggers: Build periodically (cron), Poll SCM, and GitHub webhooks integration',
        'Pre-build and post-build actions',
        'Email notification configuration for build statuses',
        'CI/CD Implementation: Creating complete CI/CD pipeline by integrating Git, Maven, Nexus, SonarQube, and Tomcat',
        'Jenkinsfile: What is Jenkinsfile and creation of declarative multi-stage Jenkinsfiles',
        'Master-Slave Architecture: What is master-slave architecture with diagram, and creating agent nodes'
      ],
      order: 4,
      isEnabled: true
    },
    {
      stageNumber: 'Stage 05',
      title: 'Docker & Containerization',
      shortDescription: 'Application architectures, Docker engine, container lifecycle, multi-stage Dockerfiles, Docker Compose networking, volumes, and AWS ECS/ECR integration.',
      tools: ['Docker', 'Docker Compose', 'Docker Hub', 'AWS ECS', 'AWS ECR'],
      topics: [
        'Application Architecture: Monolithic, Microservices, and 3-tier architecture',
        'Introduction to Containers: What are containers, and Containers vs. Virtual Machines',
        'Introduction to Docker: Tools available, history, features, architecture, and components',
        'Installation of Docker on Linux',
        'Introduction to Docker Hub & creating an account in Docker Hub',
        'Dockerfile: What is a Dockerfile, instructions (FROM, RUN, CMD, COPY, EXPOSE), and Dockerfile creation',
        'Basic commands in Docker: Dockerfile to Docker image',
        'List Docker images and image inspect commands',
        'Docker image to Docker container & container execution',
        'List running and stopped Docker containers (docker ps -a)',
        'Stop, start, and delete containers',
        'Delete Docker images (docker rmi)',
        'Push & pull Docker images from Docker Hub',
        'Copying files from host to container and vice versa (docker cp)',
        'Advanced Concepts: Multi-stage Docker builds for minimal production images',
        'Docker Volume: Anonymous volumes, named volumes, and persistent storage',
        'Docker Networking: Bridge, Host, Overlay, and custom network drivers',
        'Introduction to YAML syntax and data structures',
        'Docker Compose: Defining and running multi-container applications (docker-compose.yml)',
        'Cloud Container Services: AWS ECS (Elastic Container Service) & AWS ECR (Elastic Container Registry)'
      ],
      order: 5,
      isEnabled: true
    },
    {
      stageNumber: 'Stage 06',
      title: 'Kubernetes & Container Orchestration',
      shortDescription: 'Container orchestration, Kubernetes control plane and worker components, Pods, Deployments, Services, Ingress, Minikube, AWS EKS, and Helm chart deployments.',
      tools: ['Kubernetes', 'kubectl', 'Minikube', 'AWS EKS', 'Helm'],
      topics: [
        'Problems with containers at scale & introduction to container orchestration',
        'Container orchestration tools overview',
        'Kubernetes: History, features, and comprehensive Kubernetes architecture',
        'Components of Kubernetes Cluster: API Server, etcd, Scheduler, Controller Manager, Kubelet, Kube-proxy',
        'Kubernetes Objects overview & Stateful vs Stateless applications',
        'YAML in Kubernetes: What is YAML, components of YAML, and creating Pods using YAML',
        'Kubernetes Namespaces: What is a namespace, and creation of namespaces for multi-tenancy',
        'ConfigMaps & Secrets: Store and manage environment variables & secure sensitive data with Secrets',
        'ReplicaSet: What is a ReplicaSet, and creation of ReplicaSets for high availability',
        'Deployment: What is a deployment, creating deployments, and zero-downtime rolling updates',
        'Kubernetes Services: What are Kubernetes services & Types (ClusterIP, NodePort, LoadBalancer)',
        'Creating service.yml and configuring service discovery',
        'Ingress Controllers: Routing HTTP/HTTPS traffic to cluster services',
        'Persistent Storage & Volumes: Types of Kubernetes volumes, Persistent Volumes (PV) & PVC',
        'Installation & Setup: Minikube local single-node cluster',
        'Installation & Setup: AWS EKS (Elastic Kubernetes Service) managed cluster',
        'Understanding and practicing kubectl CLI commands for cluster administration',
        'Advanced Kubernetes Concepts: Helm Charts architecture',
        'Deploying complex multi-tier applications using Helm',
        'Jenkins & Kubernetes Integration for dynamic containerized build agents'
      ],
      order: 6,
      isEnabled: true
    },
    {
      stageNumber: 'Stage 07',
      title: 'Infrastructure as Code & Configuration Management',
      shortDescription: 'Declarative infrastructure provisioning with Terraform across AWS/Azure/GCP, state management, and configuration automation with Ansible playbooks and inventories.',
      tools: ['Terraform', 'Ansible'],
      topics: [
        'Introduction to Infrastructure as Code (IaC) & why we need Infrastructure as Code',
        'Terraform: What is Terraform, Terraform architecture, and history',
        'Terraform Lifecycle: init, plan, apply, destroy',
        'Installation of Terraform on Linux',
        'Basic Terraform commands and configuration syntax',
        'Providers: AWS, Azure, GCP cloud providers',
        'Variables and Output values configuration',
        'Terraform state management (terraform.tfstate, remote backend, state locking)',
        'Terraform modules: Creating and consuming reusable infrastructure blueprints',
        'Introduction to Configuration Management & uses of Configuration Management',
        'Introduction to Ansible & agentless architecture over SSH',
        'Installation process of Ansible control node',
        'Creation of Ansible inventory files (hosts, groups, variables)',
        'Introduction to Ansible Ad-Hoc commands for fast administrative tasks',
        'Ansible Playbook syntax, plays, tasks, handlers, and execution',
        'Ansible variables and facts gathering',
        'Ansible modules for package management, service configuration, file operations, and templates'
      ],
      order: 7,
      isEnabled: true
    },
    {
      stageNumber: 'Stage 08',
      title: 'Cloud Platforms & Monitoring',
      shortDescription: 'Dual independent cloud paths (AWS & Azure) paired with enterprise Prometheus metrics instrumentation and Grafana observability dashboards.',
      tools: ['AWS', 'Azure', 'Prometheus', 'Grafana'],
      topics: [
        'Comprehensive multi-cloud infrastructure and enterprise observability overview'
      ],
      order: 8,
      isEnabled: true
    }
  ],
  cloudPaths: {
    aws: {
      title: 'AWS Cloud Learning Path',
      badge: 'Amazon Web Services',
      description: 'Complete AWS syllabus covering global infrastructure, EC2, EBS, ELB, Auto Scaling, S3, CloudFront, IAM, VPC, Lambda, SNS, CloudWatch, DynamoDB, RDS, AWS CLI, and Free-tier billing management.',
      tools: ['AWS Console', 'EC2', 'S3', 'IAM', 'VPC', 'ELB & ASG', 'Lambda', 'SNS', 'CloudWatch', 'DynamoDB', 'RDS', 'AWS CLI'],
      topics: [
        'Introduction to IT Resources: Types of IT resources & problems with traditional resources',
        'Introduction to Cloud Computing: What is cloud computing, types, advantages, and top cloud providers',
        'Introduction to AWS: History, features, economic models, ways to use AWS, global infrastructure (Regions, Availability Zones, Edge Locations), and AWS Console',
        'EC2 (Elastic Compute Cloud): Components, sizing & configuration options, types of instances, features, pricing, hands-on Linux instance creation, AMI, Windows instances, EBS volumes, EC2 Auto Scaling, Elastic Load Balancing (ELB)',
        'S3 (Simple Storage Service): Drawbacks of EBS, S3 intro, use cases, S3 buckets, S3 objects, bucket creation, static web hosting, storage classes, accessing S3 using EC2 (with IAM)',
        'CloudFront: Introduction to CloudFront & creating content delivery distributions',
        'IAM (Identity & Access Management): Roles, permission policies, users & groups, creation of roles & policies, IAM users & groups management',
        'VPC (Virtual Private Cloud): Why we need VPC, components, IPv4 & IPv6, security groups, Elastic IP, ACLs, and hands-on VPC creation',
        'Lambda: Difference between EC2 & Lambda, features, pricing, structure, types of event sources, creation of functions, author from scratch (4 scripts & S3 objects), canary blueprint',
        'SNS (Simple Notification Service): Introduction to SNS, creation of topics, creation of subscriptions, using SNS with S3 as event source',
        'CloudWatch: Components, explaining metrics, creating dashboards (at least 2 dashboards), creating alarms for EC2',
        'DynamoDB: Introduction, creating NoSQL tables and inserting data',
        'Amazon RDS: Intro to AWS databases, relational vs non-relational, Amazon RDS hands-on practice',
        'Amazon CLI: Intro to CLI, explaining commands, and hands-on practice',
        'AWS Account & Billing: AWS billing, payments, and AWS free-tier status management'
      ]
    },
    azure: {
      title: 'Azure Cloud Learning Path',
      badge: 'Microsoft Azure',
      description: 'Enterprise Azure syllabus covering management hierarchy, Virtual Machines, Blob Storage, Entra ID / IAM, Virtual Networks (VNet), Azure SQL, CosmosDB, Azure Monitor, Azure CLI, and Cost Management.',
      tools: ['Azure Portal', 'Azure VMs', 'Storage Accounts', 'Entra ID', 'VNet', 'Azure SQL', 'CosmosDB', 'Azure Monitor', 'Azure CLI'],
      topics: [
        'Azure Account: Hierarchy of Azure, management groups, subscriptions, resource groups, resources and services',
        'Introduction to IT Resources & Cloud Computing: Types, advantages, and cloud models',
        'Introduction to Azure: History, features, economic models, global infrastructure (Geography, Regions, Availability Zones, Datacenters, Availability Sets), and Azure portal',
        'VM (Virtual Machine): Sizing & configuration options, types of sizes, features, pricing, hands-on creation of Linux VM, connection methods, capture images, Windows instances, disks',
        'Storage Account: Introduction to Blob storage, creation of containers, uploading objects, object versioning, and static web hosting',
        'Entra ID and IAM: Users and groups, creating users & groups, assigning policies on services, adding groups, and bulk user provisioning',
        'VNet (Virtual Network): Why we need VNet, creation of VNet, Network Security Groups (NSGs), network interfaces, public and private connections, NAT gateway, and VNet peering',
        'Azure SQL: Azure deployment models, creation of Azure SQL Database, and connection with database engines',
        'CosmosDB: Introduction, creation of CosmosDB, creating tables, and adding key-value documents',
        'Azure Monitor: Components, different types of metrics, and creating alerts for Virtual Machines',
        'Azure CLI: Introduction to CLI, explaining commands, and command line practice',
        'Billings and Cost Management: Managing bills and Azure free-tier management'
      ]
    },
    monitoring: {
      title: 'Monitoring & Observability',
      badge: 'Prometheus & Grafana',
      description: 'System health monitoring, PromQL query language, Prometheus exporters, Alertmanager notifications, and Grafana dashboard visualization for applications and Kubernetes.',
      tools: ['Prometheus', 'Grafana', 'Node Exporter', 'Alertmanager'],
      topics: [
        'Prometheus: Why Prometheus & Prometheus architecture',
        'Prometheus: Installation & configuration on Linux',
        'PromQL (Prometheus Query Language) metrics querying',
        'Prometheus Exporters (Node Exporter, application metrics)',
        'Service discovery mechanisms in Prometheus',
        'Alerting with Alertmanager and notification channels',
        'Monitoring Kubernetes clusters with Prometheus',
        'Grafana: What is Grafana & installation and configuration',
        'Connecting Grafana with Prometheus data sources',
        'Creating rich visual dashboards with panels, graphs, and gauges',
        'Grafana alerts & notifications',
        'Data sources configuration in Grafana',
        'Kubernetes monitoring and cluster health visualization with Grafana'
      ]
    }
  },
  workflowSteps: [
    {
      stepNumber: 1,
      title: 'Developer',
      subtitle: 'Code Authoring',
      category: 'Source Code',
      description: 'Developers write application code and local tests using modern IDEs, committing to Git feature branches.',
      tools: ['Git', 'VS Code', 'Shell'],
      iconName: 'Code',
      order: 1
    },
    {
      stepNumber: 2,
      title: 'Git & GitHub',
      subtitle: 'Version Control',
      category: 'Source Control',
      description: 'Code is pushed to GitHub repositories with branch protection, peer code reviews, and automated webhook triggers.',
      tools: ['Git', 'GitHub'],
      iconName: 'GitBranch',
      order: 2
    },
    {
      stepNumber: 3,
      title: 'Jenkins',
      subtitle: 'CI Orchestration',
      category: 'Continuous Integration',
      description: 'GitHub webhooks trigger Jenkins declarative pipeline jobs immediately upon pull requests or code merges.',
      tools: ['Jenkins', 'Webhooks'],
      iconName: 'Zap',
      order: 3
    },
    {
      stepNumber: 4,
      title: 'Maven Build',
      subtitle: 'Compile & Package',
      category: 'Build Automation',
      description: 'Maven reads pom.xml, resolves project dependencies, compiles Java code, and packages into WAR/JAR artifacts.',
      tools: ['Maven', 'pom.xml'],
      iconName: 'Wrench',
      order: 4
    },
    {
      stepNumber: 5,
      title: 'JaCoCo Testing',
      subtitle: 'Test Coverage',
      category: 'Automated Testing',
      description: 'Automated unit tests run via JUnit/TestNG while JaCoCo measures line and branch code coverage.',
      tools: ['JaCoCo', 'JUnit', 'TestNG'],
      iconName: 'CheckCircle2',
      order: 5
    },
    {
      stepNumber: 6,
      title: 'SonarQube Quality',
      subtitle: 'Quality Gates',
      category: 'Code Quality',
      description: 'SonarQube inspects code quality, identifies vulnerabilities, security hotspots, and enforces strict quality gates.',
      tools: ['SonarQube'],
      iconName: 'Shield',
      order: 6
    },
    {
      stepNumber: 7,
      title: 'Nexus Repository',
      subtitle: 'Artifact Management',
      category: 'Artifact Storage',
      description: 'Verified build artifacts and packaged binaries are uploaded to Nexus Repository with semantic versioning.',
      tools: ['Nexus', 'Tomcat'],
      iconName: 'Archive',
      order: 7
    },
    {
      stepNumber: 8,
      title: 'Docker Image Build',
      subtitle: 'Containerization',
      category: 'Containerization',
      description: 'Multi-stage Dockerfiles package the tested artifact into lightweight, secure container images.',
      tools: ['Docker', 'Dockerfile'],
      iconName: 'Box',
      order: 8
    },
    {
      stepNumber: 9,
      title: 'Docker Hub / ECR',
      subtitle: 'Image Registry',
      category: 'Container Registry',
      description: 'Tagged production container images are pushed to private registries on Docker Hub or AWS ECR.',
      tools: ['Docker Hub', 'AWS ECR'],
      iconName: 'Layers',
      order: 9
    },
    {
      stepNumber: 10,
      title: 'Kubernetes / EKS',
      subtitle: 'Cluster Deployment',
      category: 'Orchestration',
      description: 'Helm charts and kubectl deploy containers into Kubernetes / AWS EKS clusters with zero-downtime rolling updates.',
      tools: ['Kubernetes', 'Helm', 'AWS EKS', 'kubectl'],
      iconName: 'Rocket',
      order: 10
    },
    {
      stepNumber: 11,
      title: 'Terraform & Ansible',
      subtitle: 'IaC & Config',
      category: 'Infrastructure',
      description: 'Terraform provisions repeatable cloud VPCs and servers, while Ansible configures system packages and services.',
      tools: ['Terraform', 'Ansible', 'AWS / Azure'],
      iconName: 'Server',
      order: 11
    },
    {
      stepNumber: 12,
      title: 'Prometheus & Grafana',
      subtitle: 'Observability & Feedback',
      category: 'Monitoring',
      description: 'Prometheus scrapes operational metrics, Grafana visualizes performance dashboards, and alerts notify developers.',
      tools: ['Prometheus', 'Grafana', 'Alertmanager'],
      iconName: 'Activity',
      order: 12
    }
  ],
  projects: [
    {
      projectNumber: 'Project 01',
      title: 'Hosting a WebApp using Nginx, AWS ELB & ASG',
      description: 'Host a high-availability, scalable web application on AWS utilizing an Nginx web server, Application Load Balancing (ELB), and Auto Scaling Groups (ASG) across multiple Availability Zones.',
      technologies: ['Nginx', 'AWS EC2', 'AWS ELB', 'AWS Auto Scaling', 'Linux'],
      difficulty: 'Intermediate',
      learningOutcomes: [
        'Configured a custom AWS VPC with public and private subnets across multiple AZs',
        'Deployed and configured Nginx as a reverse proxy web server on Linux EC2 instances',
        'Set up AWS Elastic Load Balancer (ELB) with health checks to distribute incoming traffic',
        'Implemented AWS Auto Scaling Groups (ASG) to dynamically scale compute instances based on CPU utilization'
      ],
      detailsUrl: '/projects/hosting-webapp-nginx-aws-elb-asg',
      order: 1,
      isEnabled: true
    },
    {
      projectNumber: 'Project 02',
      title: 'Creating CI/CD Pipeline by integrating GIT, Maven, Jenkins, SonarQube, Nexus, Tomcat',
      description: 'Construct a complete end-to-end automated Continuous Integration and Continuous Deployment pipeline integrating Git, Maven, Jenkins, SonarQube, Nexus Repository, and Apache Tomcat.',
      technologies: ['Git', 'Maven', 'Jenkins', 'SonarQube', 'Nexus', 'Tomcat'],
      difficulty: 'Intermediate',
      learningOutcomes: [
        'Configured automated GitHub webhooks triggering Jenkins declarative pipelines on code push',
        'Automated Java builds and executed JaCoCo code coverage analysis via Maven',
        'Enforced static code quality analysis and quality gate pass/fail criteria in SonarQube',
        'Stored versioned build artifacts in Nexus Repository and deployed WAR files automatically to Apache Tomcat'
      ],
      detailsUrl: '/projects/complete-ci-cd-pipeline-jenkins-maven-nexus',
      order: 2,
      isEnabled: true
    },
    {
      projectNumber: 'Project 03',
      title: 'Deploying an Application in Kubernetes Cluster & configuring DNS',
      description: 'Containerize an enterprise application using Docker, deploy it into a production-grade Kubernetes cluster (or AWS EKS / Minikube), configure Ingress routing, and set up DNS resolution for public traffic access.',
      technologies: ['Docker', 'Kubernetes', 'kubectl', 'AWS EKS', 'Helm'],
      difficulty: 'Advanced',
      learningOutcomes: [
        'Authored production Kubernetes manifests: Pods, ReplicaSets, Deployments, and Services',
        'Configured Kubernetes Ingress Controllers and routing rules for domain-based traffic management',
        'Configured custom DNS resolution, health probes, and resource limits for cluster stability',
        'Packaged and deployed the complete multi-service application using modular Helm charts'
      ],
      detailsUrl: '/projects/deploying-application-kubernetes-cluster-dns',
      order: 3,
      isEnabled: true
    },
    {
      projectNumber: 'Project 04',
      title: 'Creating & Configuring Infrastructure using Terraform & Ansible',
      description: 'Automate zero-touch cloud infrastructure provisioning and configuration management by combining Terraform declarative code for cloud resources with Ansible playbooks for server software.',
      technologies: ['Terraform', 'Ansible', 'AWS / Azure', 'Linux', 'SSH'],
      difficulty: 'Intermediate',
      learningOutcomes: [
        'Developed modular Terraform scripts provisioning VPCs, subnets, route tables, and virtual machines',
        'Managed Terraform remote state backend and state locking to prevent concurrent modifications',
        'Created dynamic Ansible inventory and modular playbooks for automated server configuration',
        'Automated complete server bootstrapping, package installation, and service configuration over SSH'
      ],
      detailsUrl: '/projects/infrastructure-automation-terraform-ansible',
      order: 4,
      isEnabled: true
    },
    {
      projectNumber: 'Project 05',
      title: 'Creating dashboard using Prometheus & Grafana',
      description: 'Establish comprehensive infrastructure and application observability by configuring Prometheus metric scraping, Node Exporters, Alertmanager rules, and creating rich visual dashboards in Grafana.',
      technologies: ['Prometheus', 'Grafana', 'Node Exporter', 'Alertmanager', 'Linux'],
      difficulty: 'Intermediate',
      learningOutcomes: [
        'Installed and configured Prometheus server with service discovery and scrape targets',
        'Deployed Node Exporters to collect real-time CPU, RAM, disk I/O, and network telemetry',
        'Formulated custom PromQL queries and created interactive visualization dashboards in Grafana',
        'Configured Alertmanager thresholds and automated email/webhook incident alerts for critical events'
      ],
      detailsUrl: '/projects/monitoring-dashboard-prometheus-grafana',
      order: 5,
      isEnabled: true
    }
  ],
  finalCta: {
    heading: 'Start Your Cloud & DevOps Journey Today',
    description: 'Master industry-relevant DevOps tools, build real-world projects, and develop practical skills with AutoOps School.',
    primaryButtonText: 'Explore All Courses',
    primaryButtonLink: '/courses',
    secondaryButtonText: 'Explore Projects',
    secondaryButtonLink: '/projects'
  },
  isEnabled: true
};

module.exports = {
  defaultDevOpsRoadmap
};
