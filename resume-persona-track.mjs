/**
 * resume-persona-track.mjs — Multi-Track Persona Presets & Architectural Reframing
 * Supports:
 *   - java_fullstack: Java, Spring Boot, React, Kafka, RabbitMQ, AWS, Cloud Microservices
 *   - python_fastapi: Python, FastAPI, React, PostgreSQL, Redis, Azure/AWS/GCP, Docker
 *   - dotnet_azure: .NET, C#, Azure Cloud, Microservices, SQL Server, Redis
 *   - node_ts_fullstack: Node.js, TypeScript, React, PostgreSQL, Redis, AWS
 *   - senior_fullstack: TypeScript, React, Node.js, Python, PostgreSQL, Cloud Microservices
 *   - track_a: Linux, Python & Distributed Data Platform (PostgreSQL at scale, PgBouncer, Ingestion)
 *   - track_b: Node.js, TypeScript & Cloud Microservices (Redis, Docker/K8s, Latency Optimization)
 */

export const TRACK_A_ID = 'track_a';
export const TRACK_B_ID = 'track_b';
export const TRACK_JAVA_FULLSTACK = 'java_fullstack';
export const TRACK_PYTHON_FASTAPI = 'python_fastapi';
export const TRACK_DOTNET_AZURE = 'dotnet_azure';
export const TRACK_NODE_TS_FULLSTACK = 'track_b';
export const TRACK_SENIOR_FULLSTACK = 'senior_fullstack';

export const BUILTIN_TRACK_PRESETS = {
  [TRACK_JAVA_FULLSTACK]: {
    id: TRACK_JAVA_FULLSTACK,
    name: 'Senior Full Stack Java Developer',
    headline: 'Senior Full Stack Java Developer: Java, Spring Boot, React, TypeScript, Kafka, AWS, Microservices',
    exit_story: '7+ years architecting scalable full-stack web applications and cloud-native microservices. At Quest Global and INTVERSE: led high-throughput event-driven microservices, Spring Boot and modern RESTful APIs, React/TypeScript UI dashboards, Kafka/RabbitMQ messaging, PostgreSQL database tuning, and containerized Docker/Kubernetes deployments.',
    superpowers: [
      'Java & Spring Boot cloud-native microservices architecture',
      'React & TypeScript modern front-end engineering',
      'Event-driven messaging with Kafka & RabbitMQ',
      'PostgreSQL & SQL/NoSQL database performance tuning',
      'Docker, Kubernetes & AWS/Azure cloud deployment',
      'RESTful APIs & GraphQL contract design',
    ],
    proof_points: [
      { name: 'SKF IoT API Latency', hero_metric: 'Sub-100ms p99 API latency under high-frequency telemetry load' },
      { name: 'Telemetry Scale', hero_metric: 'Millions of daily industrial telemetry events at 99.9% uptime' },
      { name: 'Deployment Velocity', hero_metric: 'Rollouts from ~40 minutes to under 8 minutes via Docker/Kubernetes' },
    ],
    experience_reframes: {
      quest: {
        role: 'Senior Full Stack Java Developer',
        tech_stack: ['Java', 'Spring Boot', 'React', 'TypeScript', 'Kafka', 'RabbitMQ', 'PostgreSQL', 'Docker', 'Kubernetes', 'AWS', 'microservices', 'RESTful APIs'],
        bullets: [
          'Architected and scaled event-driven cloud microservices and RESTful APIs with Java and Spring Boot, processing millions of industrial telemetry and MQTT sensor events daily with 99.9% uptime.',
          'Designed scalable API services using modern Java/Spring Boot and Node.js patterns, integrating Kafka event streaming and multi-tier Redis caching to achieve sub-100ms p99 write latency.',
          'Engineered PostgreSQL table partitioning (time-based chunks) and PgBouncer connection pooling, eliminating lock contention and connection pool starvation under peak batch ingest bursts.',
          'Standardized Docker containerization and Kubernetes deployment strategies across Linux environments, cutting rollout times from ~40 minutes to under 8 minutes.',
          'Defined RESTful and GraphQL API contracts, DB access patterns, and automated schema validation rules, mentoring 4-6 engineers across software architecture, code reviews, and testing.',
        ],
      },
      intverse: {
        role: 'Senior Full Stack Developer',
        tech_stack: ['Java', 'Spring Boot', 'React', 'TypeScript', 'Node.js', 'Kafka', 'RabbitMQ', 'PostgreSQL', 'Redis', 'Docker', 'AWS', 'JWT'],
        bullets: [
          'Engineered high-throughput enterprise backend microservices in Spring Boot and Node.js with multi-process workers and structured validation schemas, processing document and metadata streams reliably.',
          'Developed reusable, responsive UI components and dashboards in React and TypeScript with secure JWT authentication and real-time backend API streaming.',
          'Architected asynchronous messaging pipelines using Kafka and RabbitMQ message brokers, reliably ingesting high-throughput sensor telemetry into PostgreSQL.',
          'Automated AWS container orchestration via Terraform, Docker, and CI/CD pipelines, introducing automated pre-flight validation gates that cut deployment failure rates by 85%.',
        ],
      },
      glidewell: {
        role: 'Software Engineer 2',
        tech_stack: ['Java', 'Spring Boot', 'Node.js', 'Kafka', 'RabbitMQ', 'PostgreSQL', 'ELK Stack', 'RedHat Linux', 'Docker', 'microservices'],
        bullets: [
          'Designed service integration layers with Kafka and RabbitMQ message queues and exponential backoff retry mechanics, ensuring zero data loss during upstream rate limit spikes and timeouts.',
          'Diagnosed database performance bottlenecks, remodeling complex SQL queries, connection pooling, and table indexing for enterprise ordering systems to cut server CPU load by 35%.',
          'Hardened distributed tracing telemetry and structured logging frameworks (ELK Stack) across microservices on RedHat Linux, slashing incident resolution times.',
          'Ran peer code reviews and mentored junior engineers on transaction safety, unit/integration testing with JUnit and Jest, and backend security best practices.',
        ],
      },
      srijan: {
        role: 'Software Engineer',
        tech_stack: ['Java', 'Spring Boot', 'React', 'TypeScript', 'Node.js', 'Express', 'Kafka', 'RabbitMQ', 'PostgreSQL', 'AWS', 'Docker'],
        bullets: [
          'Designed and shipped resilient backend microservices and RESTful APIs for multi-tenant SaaS applications, owning data modeling, API delivery, and comprehensive unit testing.',
          'Connected third-party payment gateways with intelligent event retry logic and an automated Kafka and RabbitMQ-backed reconciliation engine to safely process financial transactions and prevent data loss.',
          'Built reusable frontend features in React and TypeScript, integrating CI linting and automated test suites to hold a high code-quality bar.',
        ],
      },
      athena: {
        role: 'Full-Stack Developer',
        tech_stack: ['Java', 'Spring Boot', 'Node.js', 'TypeScript', 'Kafka', 'RabbitMQ', 'PostgreSQL', 'GraphQL', 'RESTful APIs'],
        bullets: [
          'Architected distributed backend microservices and API gateways using Java and Node.js with Kafka-based event streaming and RabbitMQ queues between services.',
          'Engineered automated database migration pipelines and PostgreSQL data access layers, ensuring strict ACID consistency and zero record degradation.',
        ],
      },
      rubico: {
        role: 'Associate Software Engineer',
        tech_stack: ['Java', 'Node.js', 'Express', 'RabbitMQ', 'PostgreSQL', 'MongoDB', 'AWS', 'RESTful APIs'],
        bullets: [
          'Architected backend services and asynchronous messaging pipelines with RabbitMQ, handling event processing and high-throughput API requests.',
          'Engineered resilient RESTful APIs, data validation schemas, and AWS cloud infrastructure configurations (EC2, S3, IAM, VPC) for client production releases.',
        ],
      },
      artisans: {
        role: 'Associate Developer',
        tech_stack: ['Node.js', 'Express', 'TypeScript', 'MongoDB', 'Mongoose', 'RESTful APIs'],
        bullets: [
          'Developed and deployed backend endpoints using Node.js/Express, integrating third-party payment gateways and authentication flows that processed high volumes of transactions with zero security incidents.',
        ],
      },
    },
  },
  [TRACK_PYTHON_FASTAPI]: {
    id: TRACK_PYTHON_FASTAPI,
    name: 'Senior Python Full Stack Engineer (FastAPI & Cloud)',
    headline: 'Lead / Senior Python Full Stack Engineer: Python, FastAPI, React, PostgreSQL, Redis, Azure/AWS/GCP, Docker',
    exit_story: '7+ years designing high-throughput Python backends and full-stack web platforms. At Quest Global and INTVERSE: built asynchronous FastAPI and Python microservices, React frontends, PostgreSQL query optimization at scale, Redis multi-layer caching, and automated cloud deployments across Azure, AWS, and GCP.',
    superpowers: [
      'Python & FastAPI asynchronous high-throughput microservices',
      'React & TypeScript modern UI component development',
      'PostgreSQL database scaling, PgBouncer pooling & query tuning',
      'Cloud platforms: Azure, AWS & GCP container orchestration',
      'Redis multi-layer caching & distributed messaging',
      'Automated testing (pytest, unit/integration testing) & CI/CD',
    ],
    proof_points: [
      { name: 'PostgreSQL Scaling', hero_metric: 'Eliminated database lock contention and connection starvation via table partitioning and PgBouncer pooling' },
      { name: 'Telemetry Latency', hero_metric: 'Slashing p99 write latency from 3.8s to <110ms under peak ingest bursts' },
      { name: 'Platform Availability', hero_metric: 'Sustained 99.9% uptime processing millions of daily sensor telemetry events' },
    ],
    experience_reframes: {
      quest: {
        role: 'Senior Python Backend Engineer',
        tech_stack: ['Python', 'FastAPI', 'PostgreSQL', 'Redis', 'Docker', 'AWS', 'Azure', 'GCP', 'Linux', 'Kafka', 'RabbitMQ', 'RESTful APIs', 'microservices'],
        bullets: [
          'Architected high-throughput Python ingestion engines and RESTful APIs implementing asyncio workers, handling millions of high-frequency telemetry events daily into PostgreSQL with 99.9% uptime.',
          'Engineered PostgreSQL table partitioning (time-based chunks) and PgBouncer connection pooling, eliminating lock contention and connection pool starvation under peak bursts.',
          'Optimized p99 API write latencies from ~3.8s down to <110ms by profiling SQL query plans, tuning autovacuum thresholds, and decoupling incoming payloads via an asynchronous buffer.',
          'Containerized services with Docker/LXC and automated cloud deployment workflows across AWS, Azure, and GCP, reducing deployment cycle times from ~40 minutes to under 8 minutes.',
        ],
      },
      intverse: {
        role: 'Senior Full Stack Developer',
        tech_stack: ['Python', 'FastAPI', 'React', 'TypeScript', 'PostgreSQL', 'Redis', 'Docker', 'AWS', 'Azure', 'GCP', 'Kafka', 'RabbitMQ', 'JWT'],
        bullets: [
          'Built high-performance document and metadata ingestion microservices using Python and FastAPI with multi-process workers and Pydantic validation schemas.',
          'Architected asynchronous messaging pipelines using Kafka and RabbitMQ message brokers, reliably ingesting high-throughput sensor telemetry into PostgreSQL.',
          'Engineered custom React/TypeScript dashboards integrating FastAPI streaming endpoints (Server-Sent Events) and secure JWT authentication.',
          'Optimized search and query latency by implementing Redis multi-layer caching over large-scale indexed PostgreSQL datasets.',
          'Automated cloud container orchestration across staging and production using Terraform, Docker, and CI/CD pipelines, cutting deployment failure rates by 85%.',
        ],
      },
      glidewell: {
        role: 'Software Engineer 2',
        tech_stack: ['Python', 'FastAPI', 'PostgreSQL', 'Kafka', 'RabbitMQ', 'ELK Stack', 'RedHat Linux', 'Docker'],
        bullets: [
          'Built resilient Python backend integration layers with tenacity-based exponential backoff and Kafka/RabbitMQ message queues, guaranteeing zero data loss during upstream rate spikes.',
          'Diagnosed database performance bottlenecks, remodeling complex SQL queries, connection pooling, and table indexing for enterprise ordering systems to cut CPU load by 35%.',
          'Led distributed tracing and telemetry across microservices using ELK Stack on Linux, reducing incident response time on production issues.',
        ],
      },
      srijan: {
        role: 'Software Engineer',
        tech_stack: ['Python', 'FastAPI', 'React', 'TypeScript', 'Node.js', 'PostgreSQL', 'Kafka', 'RabbitMQ', 'AWS', 'Docker'],
        bullets: [
          'Designed and shipped resilient backend microservices and RESTful APIs, owning data modeling, automated testing (pytest/Jest), and CI linting for multi-tenant SaaS applications.',
          'Integrated third-party payment gateways with intelligent event retry logic and an automated Kafka and RabbitMQ reconciliation engine to safely process financial transactions.',
        ],
      },
      athena: {
        role: 'Full-Stack Developer',
        tech_stack: ['Python', 'FastAPI', 'Node.js', 'PostgreSQL', 'Kafka', 'RabbitMQ', 'GraphQL', 'RESTful APIs'],
        bullets: [
          'Engineered high-throughput Python ETL pipelines and asynchronous microservices, streaming event payloads into PostgreSQL with zero record degradation.',
          'Designed scalable API endpoints and Kafka/RabbitMQ message integration layers for enterprise multi-tenant platform modules.',
        ],
      },
      rubico: {
        role: 'Associate Software Engineer',
        tech_stack: ['Python', 'Node.js', 'PostgreSQL', 'MongoDB', 'RabbitMQ', 'AWS', 'RESTful APIs'],
        bullets: [
          'Architected backend web systems and RESTful APIs, integrating asynchronous task workers and AWS cloud infrastructure for client deliverables.',
          'Engineered database schemas and transaction-safe data access models across PostgreSQL and MongoDB, reducing query latency across core endpoints.',
        ],
      },
      artisans: {
        role: 'Associate Developer',
        tech_stack: ['Node.js', 'Express', 'TypeScript', 'MongoDB', 'Mongoose', 'RESTful APIs'],
        bullets: [
          'Developed and deployed backend endpoints using Node.js/Express, integrating third-party payment gateways and authentication flows that processed high volumes of transactions with zero security incidents.',
        ],
      },
    },
  },
  [TRACK_DOTNET_AZURE]: {
    id: TRACK_DOTNET_AZURE,
    name: 'Senior Backend Developer (.NET / C# / Azure)',
    headline: 'Senior Backend Developer: C#, .NET Core, Azure Cloud, Microservices, SQL Server, Redis, Docker',
    exit_story: '7+ years architecting enterprise backend microservices and cloud platforms with C#, .NET Core, Azure, and distributed messaging. At Quest Global and Glidewell: owned high-throughput cloud APIs, Azure Functions, database query optimization across SQL Server and PostgreSQL, and distributed incident telemetry.',
    superpowers: [
      'C# & .NET Core microservices architecture',
      'Azure Cloud Services (Functions, Service Bus, App Services, AKS)',
      'Microsoft SQL Server & PostgreSQL database optimization',
      'High-throughput RESTful APIs & event-driven messaging with Kafka & RabbitMQ',
      'Distributed telemetry, observability & incident response',
      'CI/CD automation & enterprise testing standards',
    ],
    proof_points: [
      { name: 'Throughput Optimization', hero_metric: 'Processed millions of daily events with sub-100ms latency' },
      { name: 'Database Scale', hero_metric: 'Cut database lock contention and CPU load by 35%' },
      { name: 'Cloud Rollouts', hero_metric: 'Accelerated release deployment cycles from 40 mins to under 8 mins' },
    ],
    experience_reframes: {
      quest: {
        role: 'Senior Backend Engineer',
        tech_stack: ['C#', '.NET Core', 'Azure', 'PostgreSQL', 'SQL Server', 'Redis', 'Kafka', 'RabbitMQ', 'Docker', 'microservices', 'RESTful APIs'],
        bullets: [
          'Architected scalable event-driven microservices on Linux and Azure, ingesting millions of real-time industrial telemetry events daily with 99.9% uptime.',
          'Optimized backend API throughput and response latencies by eliminating thread pool contention, introducing multi-tier Redis caching, and tuning SQL query plans.',
          'Restructured database schemas and connection pooling to eliminate peak-traffic lock contention, slashing p99 write latency from 3.8s down to <110ms.',
          'Automated deployment workflows via Docker and Azure cloud container pipelines, cutting release rollout time from ~40 minutes to under 8 minutes.',
        ],
      },
      intverse: {
        role: 'Senior Backend Developer',
        tech_stack: ['C#', '.NET Core', 'Azure', 'PostgreSQL', 'Redis', 'Kafka', 'RabbitMQ', 'Docker', 'CI/CD'],
        bullets: [
          'Engineered high-throughput document and metadata ingestion microservices with structured validation schemas and asynchronous background workers.',
          'Architected messaging pipelines using Kafka, RabbitMQ, and Azure Service Bus, reliably ingesting high-volume sensor telemetry into PostgreSQL and SQL databases.',
          'Automated cloud container deployments across staging and production using Terraform, Docker, and CI/CD pipelines, diminishing deployment failure rates by 85%.',
        ],
      },
      glidewell: {
        role: 'Software Engineer 2',
        tech_stack: ['C#', '.NET Core', 'SQL Server', 'Azure', 'Kafka', 'RabbitMQ', 'ELK Stack', 'RedHat Linux'],
        bullets: [
          'Designed service integration layers with exponential backoff retry mechanics and message queues (Kafka / RabbitMQ / Azure Service Bus), ensuring zero data loss during upstream spikes.',
          'Diagnosed database performance bottlenecks, remodeling complex SQL queries, connection pooling, and table indexing for enterprise ordering systems to reduce server CPU load by 35%.',
          'Hardened distributed tracing telemetry and structured logging frameworks (ELK Stack) across microservices, significantly enhancing incident RCA times.',
        ],
      },
      srijan: {
        role: 'Software Engineer',
        tech_stack: ['C#', '.NET Core', 'SQL Server', 'Azure', 'Kafka', 'RabbitMQ', 'Docker', 'RESTful APIs'],
        bullets: [
          'Designed and shipped resilient backend microservices for multi-tenant SaaS applications, integrating comprehensive unit testing and CI linting to maintain high code quality.',
          'Connected third-party payment gateways with event retry logic and an automated Kafka and RabbitMQ reconciliation engine to safely process financial transactions with zero data loss.',
        ],
      },
      athena: {
        role: 'Full-Stack Developer',
        tech_stack: ['C#', '.NET Core', 'Node.js', 'TypeScript', 'PostgreSQL', 'RabbitMQ', 'Kafka', 'RESTful APIs'],
        bullets: [
          'Architected backend microservices and message queues with RabbitMQ and Kafka for high-availability event communication across multi-tenant services.',
          'Engineered relational database migration pipelines and data validation routines across PostgreSQL schemas, preserving 100% record integrity.',
        ],
      },
      rubico: {
        role: 'Associate Software Engineer',
        tech_stack: ['C#', '.NET Core', 'PostgreSQL', 'SQL Server', 'RabbitMQ', 'AWS', 'RESTful APIs'],
        bullets: [
          'Architected backend API endpoints and asynchronous message queues, ensuring resilient event processing and delivery across client systems.',
          'Configured cloud infrastructure, secure networking, and database optimization routines for production application rollouts.',
        ],
      },
      artisans: {
        role: 'Associate Developer',
        tech_stack: ['Node.js', 'Express', 'TypeScript', 'MongoDB', 'Mongoose', 'RESTful APIs'],
        bullets: [
          'Developed and deployed backend endpoints using Node.js/Express, integrating third-party payment gateways and authentication flows that processed high volumes of transactions with zero security incidents.',
        ],
      },
    },
  },
  [TRACK_NODE_TS_FULLSTACK]: {
    id: TRACK_NODE_TS_FULLSTACK,
    name: 'Lead / Senior Full Stack Engineer (Node.js / TypeScript)',
    headline: 'Lead / Senior Full Stack Engineer: Node.js, TypeScript, React, Redis, PostgreSQL, AWS Microservices',
    exit_story: '7+ years architecting and scaling distributed backends and modern web applications. At Quest Global (SKF Telemetry Cloud): millions of daily telemetry events, sub-100ms p99 API latency, high-throughput Node.js stream ingestion, React dashboards, Docker deploy speedups, and engineering standards.',
    superpowers: [
      'Node.js & TypeScript scalable backend APIs & microservices',
      'React & modern TypeScript front-end architecture',
      'Redis caching & PostgreSQL performance tuning',
      'Event-driven architecture with Kafka & RabbitMQ',
      'Docker, Kubernetes & AWS cloud infrastructure',
      'API contracts, unit testing, and engineering leadership',
    ],
    proof_points: [
      { name: 'SKF IoT API Latency', hero_metric: 'Sub-100ms p99 API latency under high-frequency telemetry load' },
      { name: 'Telemetry Scale', hero_metric: 'Millions of daily industrial telemetry events at 99.9% uptime' },
      { name: 'Node.js Worker Ingestion', hero_metric: 'Implemented Node.js worker threads and stream pipelines cutting container memory overhead on hot paths' },
      { name: 'Deploy Speed', hero_metric: 'Rollouts from ~40 minutes to under 8 minutes via Docker/LXC' },
    ],
    experience_reframes: {
      quest: {
        role: 'Lead Backend Engineer',
        tech_stack: ['Node.js', 'TypeScript', 'React', 'PostgreSQL', 'Redis', 'GraphQL', 'Docker', 'AWS', 'Kafka', 'RabbitMQ', 'microservices'],
        bullets: [
          "Architected and scaled event-driven microservices for SKF's global Telemetry Cloud, handling millions of real-time industrial IoT telemetry and MQTT sensor events daily with 99.9% uptime.",
          'Optimized API throughput and response times by eliminating Node.js event-loop blocking, introducing multi-tier Redis caching for hot device metadata, and tuning PostgreSQL query execution plans.',
          'Implemented Node.js Worker Threads and stream pipelines for async telemetry ingestion, significantly reducing per-container memory footprint on high-throughput event queues.',
          'Eliminated peak-traffic database lock contention by restructuring PostgreSQL schema partitioning and replacing unindexed table scans with targeted composite indexes.',
          'Standardized Docker & LXC container strategies across environments, cutting rollout time from ~40 minutes to under 8 minutes.',
        ],
      },
      intverse: {
        role: 'Senior Full Stack Developer',
        tech_stack: ['Node.js', 'TypeScript', 'React', 'PostgreSQL', 'Redis', 'AWS', 'Docker', 'Kafka', 'RabbitMQ', 'JWT'],
        bullets: [
          'Engineered high-throughput document and metadata ingestion microservices in Node.js and TypeScript with structured validation schemas and asynchronous background workers.',
          'Developed reusable TypeScript and React UI components integrating streaming backend APIs and secure JWT authentication for enterprise dashboards.',
          'Built asynchronous device messaging pipelines using Kafka, RabbitMQ, and MQTT brokers with Node.js microservices, reliably ingesting sensor telemetry payloads into PostgreSQL.',
          'Automated AWS environments with Terraform, Jenkins pipelines, and container orchestration, cutting deployment failure rates by 85%.',
        ],
      },
      glidewell: {
        role: 'Software Engineer 2',
        tech_stack: ['Node.js', 'TypeScript', 'React', 'PostgreSQL', 'GraphQL', 'Kafka', 'RabbitMQ', 'ELK Stack', 'RedHat Linux'],
        bullets: [
          'Designed service integration layers with exponential backoff retry mechanics, fallback handling, and Kafka/RabbitMQ message queues, ensuring zero data loss during upstream rate limit spikes.',
          'Architected internal workforce and laboratory management web application workflows covering time tracking, product assignment, and logistics tracking integrations.',
          'Diagnosed PostgreSQL performance bottlenecks, remodeling complex SQL queries, connection pooling, and table indexing for enterprise ordering systems to cut CPU load by 35%.',
        ],
      },
      srijan: {
        role: 'Software Engineer',
        tech_stack: ['Node.js', 'Express', 'React', 'TypeScript', 'PostgreSQL', 'MongoDB', 'GraphQL', 'Kafka', 'RabbitMQ', 'AWS'],
        bullets: [
          'Designed and shipped resilient backend services using Node.js and Express for multi-tenant SaaS applications, owning the full technical cycle from data modeling through API delivery.',
          'Integrated a third-party payment gateway with intelligent event retry logic and an automated Kafka and RabbitMQ reconciliation engine to safely process financial transactions.',
          'Built responsive React UI components and wrote Jenkinsfile CI pipelines that enforced automated backend code linting and unit testing.',
        ],
      },
      athena: {
        role: 'Full-Stack Developer',
        tech_stack: ['Node.js', 'TypeScript', 'PostgreSQL', 'MongoDB', 'Kafka', 'RabbitMQ', 'GraphQL', 'RESTful APIs'],
        bullets: [
          'Designed and built the complete backend architecture for a multi-tenant platform, breaking down business logic into scalable Node.js microservices with Kafka-based event communication.',
          'Engineered data migration pipelines and GraphQL/RESTful APIs, delivering reliable cross-service data exchange with zero data corruption.',
        ],
      },
      rubico: {
        role: 'Associate Software Engineer',
        tech_stack: ['Node.js', 'TypeScript', 'Express', 'PostgreSQL', 'MongoDB', 'RabbitMQ', 'AWS', 'RESTful APIs'],
        bullets: [
          'Architected backend web systems end-to-end, from database schema design through RESTful API construction and RabbitMQ message queue integration.',
          'Owned core application infrastructure across AWS environments (EC2, S3, IAM, VPC), configuring secure deployments and high-availability endpoints.',
        ],
      },
      artisans: {
        role: 'Associate Developer',
        tech_stack: ['Node.js', 'Express', 'TypeScript', 'MongoDB', 'Mongoose', 'RESTful APIs'],
        bullets: [
          'Developed and deployed backend endpoints using Node.js/Express, integrating third-party payment gateways and authentication flows that processed high volumes of transactions with zero security incidents.',
        ],
      },
    },
  },
  [TRACK_SENIOR_FULLSTACK]: {
    id: TRACK_SENIOR_FULLSTACK,
    name: 'Senior Full Stack Developer',
    headline: 'Senior Full Stack Developer: TypeScript, React, Node.js, Python, PostgreSQL, Cloud Microservices',
    exit_story: '7+ years building end-to-end web applications, modern responsive UIs, and resilient cloud microservices. Across Quest Global, INTVERSE, and Glidewell: engineered full-stack architectures spanning React/TypeScript frontends, high-throughput APIs in Node.js/Python, database tuning in PostgreSQL, and Docker/cloud deployments.',
    superpowers: [
      'Full-stack web application design & component architecture (React / TypeScript)',
      'Scalable RESTful & GraphQL backend APIs (Node.js / Python)',
      'PostgreSQL & SQL/NoSQL schema modeling and query optimization',
      'Cloud deployment & containerization (AWS, Docker, Kubernetes)',
      'Secure authentication (JWT, OAuth) & state management',
      'End-to-end testing, CI/CD pipelines, and technical leadership',
    ],
    proof_points: [
      { name: 'SKF IoT API Latency', hero_metric: 'Sub-100ms p99 API latency under high-frequency telemetry load' },
      { name: 'Telemetry Scale', hero_metric: 'Millions of daily industrial telemetry events at 99.9% uptime' },
      { name: 'Deploy Speed', hero_metric: 'Rollouts from ~40 minutes to under 8 minutes via Docker/LXC' },
    ],
    experience_reframes: {
      quest: {
        role: 'Senior Full Stack Engineer',
        tech_stack: ['TypeScript', 'React', 'Node.js', 'Python', 'PostgreSQL', 'Redis', 'Docker', 'AWS', 'Kafka', 'RabbitMQ', 'microservices', 'RESTful APIs'],
        bullets: [
          "Architected and shipped end-to-end features for SKF's industrial telemetry platform, building responsive React dashboards and high-throughput backend microservices.",
          'Optimized API latency from 3.8s down to <110ms by eliminating event-loop blocking, introducing multi-tier Redis caching, and tuning PostgreSQL query execution plans.',
          'Engineered PostgreSQL table partitioning and connection pooling, eliminating lock contention under peak batch ingest bursts.',
          'Standardized containerized Docker deployments and CI/CD pipelines, cutting release rollout time from ~40 minutes to under 8 minutes.',
        ],
      },
      intverse: {
        role: 'Senior Full Stack Developer',
        tech_stack: ['React', 'TypeScript', 'Node.js', 'Python', 'PostgreSQL', 'Redis', 'Docker', 'AWS', 'Kafka', 'RabbitMQ', 'JWT'],
        bullets: [
          'Engineered reusable TypeScript and React UI components integrating custom frontend dashboards with streaming backend APIs and secure JWT authentication.',
          'Built high-performance document ingestion pipelines in Python and Node.js with multi-process workers and structured validation schemas.',
          'Architected asynchronous messaging pipelines using Kafka and RabbitMQ message brokers, reliably ingesting high-throughput sensor telemetry into PostgreSQL.',
          'Designed multi-layer caching and query rewriting strategies that cut backend search latency across large indexed PostgreSQL datasets.',
          'Automated AWS container orchestration via Terraform and Jenkins CI/CD, introducing automated pre-flight validation gates that cut deployment failure rates by 85%.',
        ],
      },
      glidewell: {
        role: 'Software Engineer 2',
        tech_stack: ['React', 'TypeScript', 'Node.js', 'PostgreSQL', 'Kafka', 'RabbitMQ', 'ELK Stack', 'RedHat Linux'],
        bullets: [
          'Architected internal workforce and laboratory management web applications covering time tracking, product assignment, and logistics tracking integrations.',
          'Designed service integration layers with Kafka and RabbitMQ message queues and exponential backoff retry mechanics, ensuring zero data loss during upstream spikes.',
          'Diagnosed PostgreSQL performance bottlenecks, remodeling complex SQL queries, connection pooling, and table indexing for enterprise ordering systems to reduce server CPU load by 35%.',
        ],
      },
      srijan: {
        role: 'Software Engineer',
        tech_stack: ['React', 'Node.js', 'Express', 'TypeScript', 'PostgreSQL', 'MongoDB', 'Kafka', 'RabbitMQ', 'AWS'],
        bullets: [
          'Shipped resilient backend services using Node.js and Express alongside responsive React frontends for multi-tenant SaaS applications.',
          'Connected third-party payment gateways with intelligent event retry logic and an automated Kafka and RabbitMQ reconciliation engine to safely process financial transactions.',
        ],
      },
      athena: {
        role: 'Full-Stack Developer',
        tech_stack: ['React', 'TypeScript', 'Node.js', 'PostgreSQL', 'Kafka', 'RabbitMQ', 'GraphQL', 'RESTful APIs'],
        bullets: [
          'Architected full-stack web applications and reusable React UI modules backed by scalable Node.js microservices and Kafka event messaging.',
          'Engineered database schema migrations and secure RESTful/GraphQL endpoints across multi-tenant platform services.',
        ],
      },
      rubico: {
        role: 'Associate Software Engineer',
        tech_stack: ['React', 'Node.js', 'TypeScript', 'PostgreSQL', 'MongoDB', 'RabbitMQ', 'AWS'],
        bullets: [
          'Architected end-to-end web applications, interactive dashboards, and RESTful APIs with AWS cloud infrastructure for client production deliverables.',
          'Optimized frontend rendering performance and backend database query latency across high-traffic user workflows.',
        ],
      },
      artisans: {
        role: 'Associate Developer',
        tech_stack: ['Node.js', 'Express', 'TypeScript', 'MongoDB', 'Mongoose', 'RESTful APIs'],
        bullets: [
          'Developed and deployed backend endpoints using Node.js/Express, integrating third-party payment gateways and authentication flows that processed high volumes of transactions with zero security incidents.',
        ],
      },
    },
  },
};

// Aliases
BUILTIN_TRACK_PRESETS[TRACK_B_ID] = BUILTIN_TRACK_PRESETS[TRACK_NODE_TS_FULLSTACK];
BUILTIN_TRACK_PRESETS['node_ts_fullstack'] = BUILTIN_TRACK_PRESETS[TRACK_B_ID];

const TRACK_A_PATTERNS = [
  /\bpython(?:\d+)?\b/gi,
  /\bpostgres(?:ql)?\b/gi,
  /\bdata platform\b/gi,
  /\bdistributed systems?\b/gi,
  /\btelemetry\b/gi,
  /\bingestion\b/gi,
  /\blinux\b/gi,
  /\bkernel\b/gi,
  /\bpgbouncer\b/gi,
  /\bpartition(?:ing|ed)?\b/gi,
  /\bautovacuum\b/gi,
  /\bclickhouse\b/gi,
  /\bkafka\b/gi,
  /\bspark\b/gi,
  /\betl\b/gi,
  /\bpipeline\b/gi,
  /\bsre\b/gi,
];

const TRACK_B_PATTERNS = [
  /\bnode(?:\.?js)?\b/gi,
  /\btypescript\b/gi,
  /\bbun\b/gi,
  /\bjavascript\b/gi,
  /\bnest(?:js)?\b/gi,
  /\bexpress(?:js)?\b/gi,
  /\breact(?:\.js)?\b/gi,
  /\bfull[\s-]?stack\b/gi,
  /\bfrontend\b/gi,
  /\bnext(?:\.js)?\b/gi,
];

/**
 * Detect the target persona track based on explicit override or JD analysis.
 * @param {string} jdText 
 * @param {string} [requestedTrack] - CLI argument like 'data', 'node', 'java', 'dotnet', 'fastapi', 'track_a', 'track_b'
 * @param {object} [profile] 
 * @returns {{ trackId: string, trackName: string, source: 'cli' | 'profile' | 'auto', scoreA: number, scoreB: number }}
 */
export function detectPersonaTrack(jdText, requestedTrack, profile) {
  // 1. Explicit CLI argument override
  if (requestedTrack) {
    const norm = String(requestedTrack).toLowerCase().trim();
    if (['java', 'spring', 'java_fullstack', 'spring boot'].includes(norm)) {
      return {
        trackId: TRACK_JAVA_FULLSTACK,
        trackName: 'Senior Full Stack Java Developer',
        source: 'cli',
        scoreA: 0,
        scoreB: 0,
      };
    }
    if (['dotnet', '.net', 'c#', 'csharp', 'azure', 'dotnet_azure'].includes(norm)) {
      return {
        trackId: TRACK_DOTNET_AZURE,
        trackName: 'Senior Backend Developer (.NET / C# / Azure)',
        source: 'cli',
        scoreA: 0,
        scoreB: 0,
      };
    }
    if (['fastapi', 'python_fastapi', 'python fullstack'].includes(norm)) {
      return {
        trackId: TRACK_PYTHON_FASTAPI,
        trackName: 'Senior Python Full Stack Engineer (FastAPI & Cloud)',
        source: 'cli',
        scoreA: 999,
        scoreB: 0,
      };
    }
    if (['fullstack', 'senior_fullstack', 'web'].includes(norm)) {
      return {
        trackId: TRACK_SENIOR_FULLSTACK,
        trackName: 'Senior Full Stack Developer',
        source: 'cli',
        scoreA: 0,
        scoreB: 500,
      };
    }
    if (['data', 'track_a', 'a', 'python', 'linux', 'postgres'].includes(norm)) {
      return {
        trackId: TRACK_A_ID,
        trackName: 'Track A: Linux, Python & Distributed Data Platform',
        source: 'cli',
        scoreA: 999,
        scoreB: 0,
      };
    }
    if (['node', 'track_b', 'b', 'ts', 'typescript', 'cloud', 'bun', 'node_ts_fullstack'].includes(norm)) {
      return {
        trackId: TRACK_NODE_TS_FULLSTACK,
        trackName: 'Lead / Senior Full Stack Engineer (Node.js / TypeScript)',
        source: 'cli',
        scoreA: 0,
        scoreB: 999,
      };
    }
  }

  // 2. Profile default setting if explicitly set
  const profileSetting = profile?.narrative?.active_track;
  if (profileSetting && profileSetting !== 'auto' && BUILTIN_TRACK_PRESETS[profileSetting]) {
    return {
      trackId: profileSetting,
      trackName: BUILTIN_TRACK_PRESETS[profileSetting]?.name || profileSetting,
      source: 'profile',
      scoreA: 0,
      scoreB: 0,
    };
  }

  // 3. Autonomous Lexical Scoring from JD Text
  const jd = String(jdText || '');
  const jdLower = jd.toLowerCase();

  // A. Java / Spring Boot Full Stack
  if (/\b(java|spring\s*boot|spring\s*framework|jvm)\b/i.test(jdLower)) {
    return {
      trackId: TRACK_JAVA_FULLSTACK,
      trackName: 'Senior Full Stack Java Developer',
      source: 'auto',
      scoreA: 0,
      scoreB: 0,
    };
  }

  // B. .NET / C# / Azure Backend
  if (
    /(?:^|[^\w])(?:\.net|dotnet|c#|asp\.net|entity\s*framework)(?=[^\w]|$)/i.test(jdLower)
    || /\bcsharp\b/i.test(jdLower)
  ) {
    return {
      trackId: TRACK_DOTNET_AZURE,
      trackName: 'Senior Backend Developer (.NET / C# / Azure)',
      source: 'auto',
      scoreA: 0,
      scoreB: 0,
    };
  }

  // C. Python FastAPI / Python-lead Full Stack
  const isPythonLead = /\b(fastapi|flask|django)\b/i.test(jdLower)
    || /\bpython\s*(?:full[-\s]?stack|backend|engineer|developer)\b/i.test(jdLower)
    || /\bfull[-\s]?stack\s*python\b/i.test(jdLower);
  if (isPythonLead) {
    return {
      trackId: TRACK_PYTHON_FASTAPI,
      trackName: 'Senior Python Full Stack Engineer (FastAPI & Cloud)',
      source: 'auto',
      scoreA: 99,
      scoreB: 0,
    };
  }

  // D. Explicit Node.js Full Stack (e.g. "NodeJS/Typescript full stack")
  const isFullStack = /\b(full[-\s]?stack|frontend|front[-\s]?end|web developer)\b/i.test(jdLower);
  if (/\bnode(?:\.?js)?\b/i.test(jdLower) && isFullStack && !/\bsenior full[-\s]?stack developer\b/i.test(jdLower)) {
    return {
      trackId: TRACK_B_ID,
      trackName: 'Lead / Senior Full Stack Engineer (Node.js / TypeScript)',
      source: 'auto',
      scoreA: 0,
      scoreB: 999,
    };
  }

  // E. Senior Full Stack Generalist (React / TypeScript / Web)
  if (isFullStack) {
    return {
      trackId: TRACK_SENIOR_FULLSTACK,
      trackName: 'Senior Full Stack Developer',
      source: 'auto',
      scoreA: 0,
      scoreB: 500,
    };
  }

  let scoreA = 0;
  for (const pat of TRACK_A_PATTERNS) {
    const matches = jd.match(pat);
    if (matches) scoreA += matches.length;
  }

  let scoreB = 0;
  for (const pat of TRACK_B_PATTERNS) {
    const matches = jd.match(pat);
    if (matches) scoreB += matches.length;
  }

  // F. Heavy data platform / Linux ingestion
  const isHeavyData = /\bdata platform\b/i.test(jd) ||
    ((jd.match(/\bpython\b/gi) || []).length >= 2 && (jd.match(/\bpostgres\b/gi) || []).length >= 1 && !isFullStack);

  if (isHeavyData || (scoreA > scoreB && scoreA >= 3 && !isFullStack)) {
    return {
      trackId: TRACK_A_ID,
      trackName: 'Track A: Linux, Python & Distributed Data Platform',
      source: 'auto',
      scoreA,
      scoreB,
    };
  }

  // G. Default to Node.js / TypeScript / Cloud
  return {
    trackId: TRACK_NODE_TS_FULLSTACK,
    trackName: 'Lead / Senior Full Stack Engineer (Node.js / TypeScript)',
    source: 'auto',
    scoreA,
    scoreB,
  };
}

/**
 * Reframe candidate profile based on the selected track preset.
 * @param {object} profile 
 * @param {string} trackId 
 * @returns {object} reframed profile clone
 */
export function applyPersonaTrackToProfile(profile, trackId) {
  if (!profile) return profile;
  const cloned = JSON.parse(JSON.stringify(profile));

  const tracks = cloned?.narrative?.tracks || {};
  const userTrack = tracks[trackId] || {};
  const preset = BUILTIN_TRACK_PRESETS[trackId] || BUILTIN_TRACK_PRESETS[TRACK_NODE_TS_FULLSTACK] || {};

  const activePreset = {
    ...preset,
    ...userTrack,
    experience_reframes: userTrack.experience_reframes || preset.experience_reframes,
  };

  // Guarantee STEM annotation in education without em-dashes
  if (Array.isArray(cloned.education)) {
    cloned.education = cloned.education.map((edu) => {
      const degree = String(edu.degree || '');
      if ((degree.includes('MCA') || degree.includes('BCA') || degree.includes('Computer')) && !degree.includes('STEM')) {
        return { ...edu, degree: `${degree}, STEM` };
      }
      return edu;
    });
  }

  if (!activePreset || Object.keys(activePreset).length === 0) {
    return cloned;
  }

  // Apply narrative overrides
  if (!cloned.narrative) cloned.narrative = {};
  if (activePreset.headline) cloned.narrative.headline = activePreset.headline;
  if (activePreset.exit_story) cloned.narrative.exit_story = activePreset.exit_story;
  if (Array.isArray(activePreset.superpowers) && activePreset.superpowers.length > 0) {
    cloned.narrative.superpowers = [...activePreset.superpowers];
  }
  if (Array.isArray(activePreset.proof_points) && activePreset.proof_points.length > 0) {
    cloned.narrative.proof_points = [...activePreset.proof_points];
  }

  // Apply track-specific experience reframings if present
  if (activePreset.experience_reframes && Array.isArray(cloned.experience)) {
    cloned.experience = cloned.experience.map((exp) => {
      const comp = String(exp?.company || '').toLowerCase();
      let ref = null;
      if (comp.includes('quest') && activePreset.experience_reframes.quest) {
        ref = activePreset.experience_reframes.quest;
      } else if (comp.includes('intverse') && activePreset.experience_reframes.intverse) {
        ref = activePreset.experience_reframes.intverse;
      } else if (comp.includes('glidewell') && activePreset.experience_reframes.glidewell) {
        ref = activePreset.experience_reframes.glidewell;
      } else if (comp.includes('srijan') && activePreset.experience_reframes.srijan) {
        ref = activePreset.experience_reframes.srijan;
      } else if (comp.includes('athena') && activePreset.experience_reframes.athena) {
        ref = activePreset.experience_reframes.athena;
      } else if (comp.includes('rubico') && activePreset.experience_reframes.rubico) {
        ref = activePreset.experience_reframes.rubico;
      } else if ((comp.includes('artisans') || comp.includes('artisanssoft')) && activePreset.experience_reframes.artisans) {
        ref = activePreset.experience_reframes.artisans;
      }

      if (ref) {
        return {
          ...exp,
          role: ref.role || exp.role,
          bullets: Array.isArray(ref.bullets) ? [...ref.bullets] : exp.bullets,
          tech_stack: Array.isArray(ref.tech_stack) ? [...ref.tech_stack] : exp.tech_stack,
        };
      }
      return exp;
    });
  }

  return cloned;
}
