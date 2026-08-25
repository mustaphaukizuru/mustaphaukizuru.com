/* Authoritative experience seed · mirrors web/src/data/sitePagesData.js
 * and prisma/seed-bio.js. Used by the "Seed originals" button so the
 * owner can populate the DB without SSH access — each row becomes a normal
 * editable record. Idempotent: rows with the same role+company key are
 * skipped (case-insensitive). */
export const SEED_EXPERIENCE = [
  {
    role: "IT Manager · Full-Stack Developer · ICT Coordinator · CS Educator",
    company: "Colegio de Excelencia Raindrop",
    location: "Tlalnepantla de Baz, Estado de México, Mexico",
    startDate: "2022-12-01",
    endDate: null,
    description:
      "Lead end-to-end ICT operations and full-stack engineering for a 100-plus user campus, while designing and delivering the Computer Science and STEM curriculum for secondary-level students.",
    highlights: [
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
    role: "Assistant Project Manager · Technical Systems",
    company: "Design Office of Africa Ltd.",
    location: "Kigali, Rwanda",
    startDate: "2021-09-01",
    endDate: "2022-09-01",
    description:
      "Coordinated technical project delivery and IT operations across concurrent engineering and design workstreams.",
    highlights: [
      "Coordinated technical timelines, task assignments, and delivery milestones across concurrent projects using JIRA — consistently meeting deadlines on time and within scope.",
      "Managed internal digital systems and IT infrastructure, maintaining 99% uptime and ensuring data integrity across all operational platforms.",
      "Provided direct IT support and troubleshooting to internal teams across hardware, software, and network issues, resolving incidents promptly to prevent disruption to project delivery.",
      "Produced multilingual technical documentation in English, Turkish, and Kinyarwanda for cross-functional stakeholder teams.",
    ],
  },
  {
    role: "ICT Infrastructure Director · Backend Developer · Technical Support Lead",
    company: "Intellectual Schools AC",
    location: "Addis Ababa, Ethiopia",
    startDate: "2021-01-01",
    endDate: "2021-08-01",
    description:
      "Directed all ICT operations and led the institutional web and backend redesign across a multi-building campus serving 1,000-plus students and 60 faculty.",
    highlights: [
      "Redesigned the institutional web and backend infrastructure, achieving a 50% improvement in website performance through server-side optimization, database query tuning, and caching strategies.",
      "Reduced system downtime by 30% by deploying proactive infrastructure monitoring, configuring automated alerts, and establishing scheduled preventive maintenance protocols.",
      "Managed the full scope of IT support operations across the multi-building campus — covering hardware, software, and network systems with an average issue resolution time of under two hours.",
      "Led the deployment of Google Workspace and LMS platforms across the institution, improving digital tool adoption by 60% in the first quarter and enabling hybrid e-learning at scale.",
    ],
  },
  {
    role: "Software Development Instructor · Curriculum Designer",
    company: "St. Emmanuel School Complex",
    location: "Kigali, Rwanda",
    startDate: "2020-01-01",
    endDate: "2020-12-01",
    description:
      "Designed and delivered the institutional software development curriculum from foundational programming through application deployment.",
    highlights: [
      "Designed and delivered a full-cycle STEM and software development curriculum in Python, Java, JavaScript, and web development.",
      "Introduced Git and GitHub version control practices into student workflows — reduced code integration errors by an estimated 35% and built habits of collaborative, professional-standard development.",
      "Developed structured lesson plans, rubrics, and project-based assessments aligned with international CS education standards.",
    ],
  },
  {
    role: "Sales & Marketing Officer · Digital Systems",
    company: "Blueflame Ltd.",
    location: "Kigali, Rwanda",
    startDate: "2020-05-01",
    endDate: "2020-12-01",
    description:
      "Drove digital marketing and customer-acquisition strategy through CRM-driven campaigns and conversion-optimized email systems.",
    highlights: [
      "Generated a 25% increase in company revenue through a data-driven digital marketing strategy combining CRM automation, audience segmentation, and campaign performance analytics.",
      "Built HTML, CSS, and JavaScript email marketing campaigns that measurably improved customer conversion rates and audience engagement.",
    ],
  },
  {
    role: "Translator & Interpreter",
    company: "Umut Ltd.",
    location: "Kigali, Rwanda",
    startDate: "2018-09-01",
    endDate: "2020-05-01",
    description:
      "Delivered professional interpretation and document translation services in Turkish, English, and Kinyarwanda across business, legal, and diplomatic contexts.",
    highlights: [
      "Provided professional interpretation and translation in three working languages for international stakeholders.",
      "Served clients across business, legal, and diplomatic environments — built the multilingual professional foundation that anchors the entire current brand.",
    ],
  },
]

// One-click seed list — mirrors the 9 hardcoded fallback certs in
// AboutPage.jsx. Lets the owner migrate them into the DB so they become
// editable from admin without losing the polished PDF tile experience.
export const SEED_CERTIFICATES = [
  { title: "Python 101 for Data Science", issuer: "IBM / Cognitive Class", pdfUrl: "/documents/certificates/Certificate___Python_for_Data_Science_UKIZURU_Mustapha.pdf", category: "data" },
  { title: "English for Career Development", issuer: "UPenn / Coursera", pdfUrl: "/documents/certificates/Certificate_English_for_Career_Development_UKIZURU_Mustapha.pdf", category: "language" },
  { title: "Philosophy of Science", issuer: "UPenn / Coursera", pdfUrl: "/documents/certificates/Certificate_Philosophy_of_SCience_UKIZURU_Mustapha.pdf", category: "general" },
  { title: "Practical Teaching with Technology", issuer: "University of London / Coursera", pdfUrl: "/documents/certificates/Certificate_Teaching_with_technology_UKIZURU_Mustapha.pdf", category: "education" },
  { title: "Google Certified Educator Level 2", issuer: "Google for Education", pdfUrl: "/documents/certificates/Google_Certified_Educator_Level_2_UKIZURU_Mustapha.pdf", category: "education" },
  { title: "Google IT Support Professional", issuer: "Google / Coursera", pdfUrl: "/documents/certificates/Certificate_Google_IT_Support_Professional_UKIZURU_Mustapha.pdf", category: "it" },
  { title: "Technical Support Fundamentals", issuer: "Google / Coursera", pdfUrl: "/documents/certificates/Certificate_Technical_Support_Fundamentals_UKIZURU_Mustapha.pdf", category: "it" },
  { title: "System Administration & IT Infrastructure", issuer: "Google / Coursera", pdfUrl: "/documents/certificates/Certificate_System_Administration_and_IT_Infrastructure_UKIZURU_Mustapha.pdf", category: "it" },
  { title: "Maestras y Maestros Construimos Igualdad", issuer: "Gobierno del Estado de Mexico", pdfUrl: "/documents/certificates/Certificate_Constancia_UKIZURU_Mustapha.pdf", category: "education" },
]
