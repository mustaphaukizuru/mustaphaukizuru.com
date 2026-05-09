/* About page · Mission, Vision, Values cards.
   Each description ≤ one short line — punchy, marketed, no over-explanation. */
export const aboutMissionVisionValues = [
  {
    title: "Our Mission",
    description:
      "Help organizations and professionals modernize with practical technology.",
  },
  {
    title: "Our Vision",
    description:
      "Digital environments where technology drives real outcomes.",
  },
  {
    title: "Our Values",
    description:
      "Clarity, reliability, and user-centered design on every engagement.",
  },
]

/* About page · Areas of Focus / Expertise cards.
   Each description ≤ one short line — keywords lead, no list-stuffing. */
export const expertiseAreas = [
  {
    title: "Software Engineering",
    description:
      "Modern web applications and scalable interfaces, built to ship.",
  },
  {
    title: "Cloud Systems",
    description:
      "Cloud workflows and productivity systems that scale with the team.",
  },
  {
    title: "Digital Infrastructure",
    description:
      "Infrastructure planning, security, and modernization strategy.",
  },
  {
    title: "Education Technology",
    description:
      "Digital learning, STEM, and robotics, built for schools.",
  },
]

export const educationTimeline = [
  {
    period: "Jun 2024 – Mar 2026",
    title: "Master’s in Strategic Management in Software Engineering",
    description:
      "Universidad Europea del Atlántico. Advanced training in software strategy, leadership, systems improvement, and digital transformation.",
  },
  {
    period: "Sep 2016 – Mar 2021",
    title: "Bachelor’s in Information Technology and Accountancy",
    description:
      "Adventist University of Central Africa. Academic formation in IT systems, educational technology, and business-related digital skills.",
  },
  {
    period: "Sep 2015 – Aug 2016",
    title: "Diploma in Turkish Language",
    description:
      "Ipek University. Language and communication studies supporting international academic and professional development.",
  },
]

/* ──────────────────────────────────────────────────────────────────────────
 *  experienceTimeline · single source of truth for the public About page
 *  fallback. Each entry follows this shape:
 *    {
 *      period:   "December 2022 – Present",
 *      title:    "IT Manager · Full-Stack Developer · ICT Coordinator · CS Educator",
 *      org:      "Colegio de Excelencia Raindrop · Tlalnepantla de Baz, Mexico",
 *      summary:  "Lead end-to-end ICT operations …",
 *      bullets:  [ "Built and optimized …", … ],
 *    }
 *  TimelineEntry on AboutPage renders all four when present and falls back
 *  to legacy `description`-only rows so existing seeds keep working.
 *  ────────────────────────────────────────────────────────────────────── */
export const experienceTimeline = [
  {
    period: "December 2022 – Present",
    title: "IT Manager · Full-Stack Developer · ICT Coordinator · CS Educator",
    org: "Colegio de Excelencia Raindrop · Tlalnepantla de Baz, Estado de México, Mexico",
    summary:
      "Lead end-to-end ICT operations and full-stack engineering for a 100-plus user campus, while designing and delivering the Computer Science and STEM curriculum for secondary-level students.",
    bullets: [
      "Built and optimized the school web infrastructure on Python and Google Cloud Platform — delivered a 40% improvement in page-load performance and 99% uptime for over 100 daily users.",
      "Led a full network infrastructure upgrade across TCP/IP, DNS, DHCP, and VPN systems, reducing operational downtime by over 30% and sustaining 99% campus-wide uptime.",
      "Administered end-to-end technical support for hardware, software, and network systems across the entire campus, holding a consistent sub-two-hour issue resolution standard.",
      "Developed internal automation tools and reporting dashboards in Python, Django, and JavaScript, eliminating manual workflows across 12 departments and recovering significant staff hours each week.",
      "Integrated Google Workspace and LMS platforms into daily academic operations, fully digitalizing instructional and administrative processes and onboarding 40 faculty members.",
      "Designed, developed, and delivered the school Computer Science and STEM curriculum for secondary-level students, covering Python, Java, web development, data literacy, and computational thinking.",
      "Mentored 10 students in Python, Java, and web development — coached a project team that advanced to the XIX InfoMatrix Ibero-American Science and Technology National Finals 2025 (SOLACYT).",
    ],
  },
  {
    period: "September 2021 – September 2022",
    title: "Assistant Project Manager · Technical Systems",
    org: "Design Office of Africa Ltd. · Kigali, Rwanda",
    summary:
      "Coordinated technical project delivery and IT operations across concurrent engineering and design workstreams.",
    bullets: [
      "Coordinated technical timelines, task assignments, and delivery milestones across concurrent projects using JIRA — consistently meeting deadlines on time and within scope.",
      "Managed internal digital systems and IT infrastructure, maintaining 99% uptime and ensuring data integrity across all operational platforms.",
      "Provided direct IT support and troubleshooting to internal teams across hardware, software, and network issues, resolving incidents promptly to prevent disruption to project delivery.",
      "Produced multilingual technical documentation in English, Turkish, and Kinyarwanda for cross-functional stakeholder teams.",
    ],
  },
  {
    period: "January 2021 – August 2021",
    title: "ICT Infrastructure Director · Backend Developer · Technical Support Lead",
    org: "Intellectual Schools AC · Addis Ababa, Ethiopia",
    summary:
      "Directed all ICT operations and led the institutional web and backend redesign across a multi-building campus serving 1,000-plus students and 60 faculty.",
    bullets: [
      "Redesigned the institutional web and backend infrastructure, achieving a 50% improvement in website performance through server-side optimization, database query tuning, and caching strategies.",
      "Reduced system downtime by 30% by deploying proactive infrastructure monitoring, configuring automated alerts, and establishing scheduled preventive maintenance protocols.",
      "Managed the full scope of IT support operations across the multi-building campus — covering hardware, software, and network systems with an average issue resolution time of under two hours.",
      "Led the deployment of Google Workspace and LMS platforms across the institution, improving digital tool adoption by 60% in the first quarter and enabling hybrid e-learning at scale.",
    ],
  },
  {
    period: "January 2020 – December 2020",
    title: "Software Development Instructor · Curriculum Designer",
    org: "St. Emmanuel School Complex · Kigali, Rwanda",
    summary:
      "Designed and delivered the institutional software development curriculum from foundational programming through application deployment.",
    bullets: [
      "Designed and delivered a full-cycle STEM and software development curriculum in Python, Java, JavaScript, and web development.",
      "Introduced Git and GitHub version control practices into student workflows — reduced code integration errors by an estimated 35% and built habits of collaborative, professional-standard development.",
      "Developed structured lesson plans, rubrics, and project-based assessments aligned with international CS education standards.",
    ],
  },
  {
    period: "May 2020 – December 2020",
    title: "Sales & Marketing Officer · Digital Systems",
    org: "Blueflame Ltd. · Kigali, Rwanda",
    summary:
      "Drove digital marketing and customer-acquisition strategy through CRM-driven campaigns and conversion-optimized email systems.",
    bullets: [
      "Generated a 25% increase in company revenue through a data-driven digital marketing strategy combining CRM automation, audience segmentation, and campaign performance analytics.",
      "Built HTML, CSS, and JavaScript email marketing campaigns that measurably improved customer conversion rates and audience engagement.",
    ],
  },
  {
    period: "September 2018 – May 2020",
    title: "Translator & Interpreter",
    org: "Umut Ltd. · Kigali, Rwanda",
    summary:
      "Delivered professional interpretation and document translation services in Turkish, English, and Kinyarwanda across business, legal, and diplomatic contexts.",
    bullets: [
      "Provided professional interpretation and translation in three working languages for international stakeholders.",
      "Served clients across business, legal, and diplomatic environments — built the multilingual professional foundation that anchors the entire current brand.",
    ],
  },
]

export const certifications = [
  {
    title: "Google Certified Educator Level 2",
    description:
      "Professional recognition for advanced use of digital tools in teaching and learning environments.",
  },
  {
    title: "Practical Teaching with Technology",
    description:
      "Certification focused on effective educational technology integration and practical classroom application.",
  },
  {
    title: "Technical Support Fundamentals",
    description:
      "Foundational certification in troubleshooting, systems support, and IT operations management.",
  },
  {
    title: "English for Career Development",
    description:
      "Professional communication development for career growth, digital work, and international opportunity readiness.",
  },
]

export const skillsColumns = {
  technical: [
    { name: "HTML/CSS", value: 95 },
    { name: "JavaScript", value: 90 },
    { name: "React", value: 85 },
    { name: "Node.js", value: 80 },
  ],
  professional: [
    { name: "Communication", value: 90 },
    { name: "Teamwork", value: 85 },
    { name: "Problem Solving", value: 95 },
    { name: "Creativity", value: 75 },
  ],
  language: [
    { name: "English", value: 90 },
    { name: "Spanish", value: 70 },
    { name: "Turkish", value: 85 },
    { name: "Kinyarwanda", value: 100 },
  ],
}

export const tools = [
  "HTML5",
  "CSS3",
  "JavaScript",
  "React",
  "Node.js",
  "MongoDB",
  "Git",
  "npm",
  "Sass",
  "Figma",
  "VS Code",
  "Linux",
]

export const projects = [
  {
    title: "School Digital Transformation Framework",
    description:
      "A structured modernization initiative supporting infrastructure, tools, workflows, and digital learning adoption.",
    tags: ["Digital Transformation", "Infrastructure", "Education"],
  },
  {
    title: "Professional Portfolio Platform",
    description:
      "A modern personal technology platform integrating services, products, and a member experience.",
    tags: ["React", "Website System", "Digital Products"],
  },
  {
    title: "STEM & Robotics Program Development",
    description:
      "Progressive coding and robotics planning for student-centered technology learning environments.",
    tags: ["Robotics Program", "STEM", "Training Platform"],
  },
]

export const solutionCards = [
  {
    title: "Digital Products",
    description:
      "Ready-to-use digital resources, templates, and technology tools designed to accelerate productivity and innovation.",
  },
  {
    title: "Professional Training & Workshops",
    description:
      "Hands-on training programs that help teams and professionals develop modern technology and digital skills.",
  },
  {
    title: "Website and Digital Systems",
    description:
      "Design and development of modern websites, digital platforms, and integrated online systems.",
  },
  {
    title: "Technology Consulting",
    description:
      "Strategic technology advisory services that help organizations design, implement, and optimize digital solutions.",
  },
  {
    title: "STEM, Coding, and Robotics Program Development",
    description:
      "Development of educational STEM programs that introduce coding, robotics, and computational thinking.",
  },
  {
    title: "IT Infrastructure & Digital Transformation",
    description:
      "Modernization of IT systems, cloud infrastructure, and digital environments for scalable and secure operations.",
  },
]

export const seamlessProcess = [
  {
    title: "Discovery",
    description: "Understand the current environment, goals, and operational challenges.",
  },
  {
    title: "Strategy & Planning",
    description: "Define priorities, roadmap, and technology direction.",
  },
  {
    title: "Solution Design",
    description: "Structure interfaces, workflows, and implementation systems.",
  },
  {
    title: "Implementation",
    description: "Deploy practical systems, tools, and guided changes.",
  },
  {
    title: "Optimization",
    description: "Improve performance, adoption, and measurable impact.",
  },
  {
    title: "Ongoing Support",
    description: "Provide guidance, adjustment, and continued technical support.",
  },
]

/* Services cards · brief, marketed copy. Each ≤ 110 chars / one sentence
   so the card body never truncates with an ellipsis. */
export const servicesCards = [
  {
    title: "Branding & Digital Presence",
    description:
      "Modern websites and brand systems that lift your organization’s visibility.",
  },
  {
    title: "Digital Transformation Consulting",
    description:
      "Expert guidance to modernize workflows and roadmap your tech adoption.",
  },
  {
    title: "IT Infrastructure Setup & Management",
    description:
      "Secure networks, devices, and systems that keep operations running smoothly.",
  },
  {
    title: "Cloud Migration & Automation",
    description:
      "Move to the cloud and automate the routine work that slows teams down.",
  },
]

export const servicePricing = {
  "Professionals & Individuals": [
    {
      title: "Starter",
      description: "Perfect for individuals beginning their digital journey.",
      price: "$79",
      popular: false,
      features: [
        "Personal technology consultation",
        "Digital tools recommendations",
        "Productivity system setup",
        "Email follow-up summary",
        "Basic digital strategy guidance",
      ],
    },
    {
      title: "Professional",
      description: "Ideal for professionals building stronger digital systems.",
      price: "$249",
      popular: true,
      features: [
        "Full digital workflow optimization",
        "Personal website strategy",
        "Cloud productivity system setup",
        "Automation recommendations",
        "Digital brand guidance",
        "Priority consultation session",
      ],
    },
    {
      title: "Advanced",
      description: "For professionals scaling their digital presence.",
      price: "$499",
      popular: false,
      features: [
        "Complete digital presence strategy",
        "Website & platform planning",
        "Cloud infrastructure consultation",
        "Automation system setup",
        "Personal digital transformation roadmap",
        "Follow-up consulting session",
      ],
    },
  ],

  "SMEs & Businesses": [
    {
      title: "Business Starter",
      description: "For small teams improving their digital systems.",
      price: "$390",
      popular: false,
      features: [
        "Business digital assessment",
        "Website and platform recommendations",
        "Productivity tools implementation",
        "Team workflow optimization",
        "Technology strategy consultation",
      ],
    },
    {
      title: "Business Professional",
      description: "Best for growing businesses adopting digital infrastructure.",
      price: "$890",
      popular: true,
      features: [
        "Full digital transformation analysis",
        "Website or platform architecture plan",
        "Cloud infrastructure planning",
        "Workflow automation strategy",
        "Security and system recommendations",
        "Implementation roadmap",
      ],
    },
    {
      title: "Business Enterprise",
      description: "For organizations requiring advanced technology systems.",
      price: "$1,950",
      popular: false,
      features: [
        "Complete infrastructure audit",
        "Cloud migration strategy",
        "Automation and integration planning",
        "Security and scalability architecture",
        "Custom digital platform consultation",
        "Dedicated consulting sessions",
      ],
    },
  ],

  "Schools & Education": [
    {
      title: "Education Starter",
      description: "For schools beginning digital learning programs.",
      price: "$320",
      popular: false,
      features: [
        "School technology assessment",
        "Digital classroom recommendations",
        "Learning platform guidance",
        "Basic STEM program introduction",
        "Teacher technology consultation",
      ],
    },
    {
      title: "Education Professional",
      description: "Best for schools implementing modern STEM programs.",
      price: "$720",
      popular: true,
      features: [
        "STEM curriculum planning",
        "Coding and robotics program development",
        "Digital learning platforms setup",
        "Teacher training workshop",
        "Infrastructure recommendations",
      ],
    },
    {
      title: "Education Enterprise",
      description: "For institutions building advanced digital learning ecosystems.",
      price: "$1,500",
      popular: false,
      features: [
        "Full educational technology strategy",
        "Robotics and coding lab planning",
        "Digital infrastructure architecture",
        "Teacher professional development programs",
        "Custom STEM curriculum design",
        "Long-term implementation roadmap",
      ],
    },
  ],
}

export const testimonials = [
  {
    name: "Carlos Martinez",
    role: "Business Owner",
    rating: 5,
    text: "The digital infrastructure improvements significantly increased our efficiency and reliability.",
    initials: "CM",
  },
  {
    name: "Ana López",
    role: "School Director",
    rating: 5,
    text: "Our robotics and coding programs are now running successfully thanks to the consulting support.",
    initials: "AL",
  },
]

export const faqSupportCards = [
  {
    title: "Consult a Technology Expert",
    description:
      "Get personalized guidance for digital presence, infrastructure, and cloud systems.",
  },
  {
    title: "Browse Technical Resources",
    description:
      "Learn how our solutions improve digital operations and productivity.",
  },
  {
    title: "Book Implementation Demo",
    description:
      "See how our automation and infrastructure services work in practice.",
  },
]

export const faqItems = [
  {
    question: "How does your digital transformation service work?",
    answer:
      "The service starts with discovery and planning, followed by solution design, implementation guidance, and optimization recommendations tailored to your organization.",
  },
  {
    question: "What businesses benefit most from your solutions?",
    answer:
      "SMEs, professionals, and educational institutions benefit most when they need clearer systems, improved infrastructure, or better digital processes.",
  },
]

export const serviceBenefits = [
  {
    title: "Increase Productivity",
    description:
      "Automated workflows and cloud systems reduce repetitive tasks so teams can focus on meaningful work.",
  },
  {
    title: "Reduce Technology Problems",
    description:
      "Reliable infrastructure and professional management minimize downtime and system failures.",
  },
  {
    title: "Strengthen Your Digital Presence",
    description:
      "Modern websites and digital platforms help your organization reach more clients and partners.",
  },
  {
    title: "Gain Expert Technology Support",
    description:
      "Work with experienced specialists who guide your digital transformation and infrastructure strategy.",
  },
]

export const contactBenefits = [
  "Need guidance on digital transformation? We help organizations modernize systems and infrastructure.",
  "Fast response within 24 hours. Clear and focused consultation.",
  "Work with experienced technology specialists in infrastructure, cloud systems, and digital solutions.",
]

export const contactChannels = [
  {
    name: "Telegram",
    href: "https://t.me/",
    className: "bg-[#229ED9] text-white",
  },
  {
    name: "WhatsApp",
    href: "https://wa.me/",
    className: "bg-[#25D366] text-white",
  },
]

export const audienceBenefitNodes = [
  "Digital Products",
  "Professional Training & Workshops",
  "Website & Digital Systems",
  "Technology Consulting",
  "STEM, Coding & Robotics Program Development",
  "IT Infrastructure & Digital Transformation",
]

export const audienceBenefitOutcomes = [
  "Simplified digital workflows",
  "Faster technology adoption",
  "Better digital presence and platforms",
  "Empowered teams through training",
  "Secure and scalable infrastructure",
  "Continuous technical guidance and support",
]
