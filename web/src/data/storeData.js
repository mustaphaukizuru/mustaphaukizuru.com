export const productCategories = [
  "All",
  "IT Toolkits",
  "Templates",
  "Training",
  "Operations",
  "Business Systems",
  "Consulting",
]

const makeGallery = (label) => ({
  cover: {
    role: "Cover",
    label: "Listing Preview",
    text: `${label} Cover`,
  },
  preview: {
    role: "Preview",
    label: "Secondary Preview",
    text: `${label} Preview`,
  },
  detail: {
    role: "Detail",
    label: "Interface / Detail",
    text: `${label} Detail`,
  },
  usage: {
    role: "Usage",
    label: "Real-world Usage",
    text: `${label} Usage`,
  },
  feature: {
    role: "Feature",
    label: "Key Feature",
    text: `${label} Feature`,
  },
  extra: {
    role: "Extra",
    label: "Additional Visual",
    text: `${label} Extra`,
  },
})

export const products = [
  {
    id: "digital-transformation-starter-toolkit",
    category: "IT Toolkits",
    title: "Digital Transformation Starter Toolkit",
    shortDescription:
      "Practical templates to guide digital planning and implementation.",
    description:
      "A structured toolkit designed to help organizations assess digital maturity, define priorities, and organize implementation steps with practical templates and planning resources.",
    price: 10,
    rating: 5,
    featured: true,
    type: "Digital Download",
    delivery: "Instant digital delivery",
    features: [
      "Digital readiness checklist",
      "Transformation planning worksheet",
      "Implementation roadmap template",
      "Priority matrix for initiatives",
      "Action plan summary sheet",
    ],
    gallery: makeGallery("Transformation Toolkit"),
  },
  {
    id: "weekly-content-calendar",
    category: "Templates",
    title: "Weekly Content Calendar for Creators",
    shortDescription:
      "A structured planning resource for consistent digital publishing.",
    description:
      "A practical planning template for organizing weekly content production, publishing priorities, and campaign coordination across digital platforms.",
    price: 12,
    rating: 5,
    featured: true,
    type: "Digital Download",
    delivery: "Instant digital delivery",
    features: [
      "Weekly posting planner",
      "Content idea tracker",
      "Priority scheduling sheet",
      "Publishing workflow layout",
      "Simple analytics follow-up block",
    ],
    gallery: makeGallery("Content Calendar"),
  },
  {
    id: "stem-program-planning-pack",
    category: "Training",
    title: "STEM Program Planning Pack",
    shortDescription:
      "Organized teaching resources for coding and robotics initiatives.",
    description:
      "A practical education-focused resource that helps schools and trainers design structured STEM, coding, and robotics activities with implementation guidance.",
    price: 18,
    rating: 5,
    featured: true,
    type: "Digital Download",
    delivery: "Instant digital delivery",
    features: [
      "Program planning outline",
      "Learning objective matrix",
      "Session scheduling template",
      "Resource planning worksheet",
      "Evaluation checklist",
    ],
    gallery: makeGallery("STEM Planning Pack"),
  },
  {
    id: "school-it-audit-checklist",
    category: "Operations",
    title: "School IT Audit Checklist",
    shortDescription:
      "A ready-to-use checklist for reviewing infrastructure and systems.",
    description:
      "A structured checklist for schools and educational institutions to review infrastructure, devices, connectivity, access, security, and operational technology readiness.",
    price: 15,
    rating: 5,
    featured: false,
    type: "Digital Download",
    delivery: "Instant digital delivery",
    features: [
      "Infrastructure review checklist",
      "Security review items",
      "Connectivity review section",
      "Device management checklist",
      "Operational recommendations sheet",
    ],
    gallery: makeGallery("School IT Audit"),
  },
  {
    id: "website-launch-planning-kit",
    category: "Business Systems",
    title: "Website Launch Planning Kit",
    shortDescription:
      "A clean framework for planning and structuring web projects.",
    description:
      "A planning kit for individuals and organizations launching modern websites, including structure mapping, content planning, delivery checkpoints, and quality review templates.",
    price: 14,
    rating: 5,
    featured: true,
    type: "Digital Download",
    delivery: "Instant digital delivery",
    features: [
      "Site structure worksheet",
      "Launch checklist",
      "Content planning template",
      "Pre-launch QA sheet",
      "Post-launch review form",
    ],
    gallery: makeGallery("Website Launch Kit"),
  },
  {
    id: "digital-workflow-optimization-pack",
    category: "Consulting",
    title: "Digital Workflow Optimization Pack",
    shortDescription:
      "Templates and guidance for improving digital efficiency.",
    description:
      "A consulting-style digital resource for identifying friction points, mapping workflows, and improving efficiency through better structure and modern digital practices.",
    price: 16,
    rating: 5,
    featured: false,
    type: "Digital Download",
    delivery: "Instant digital delivery",
    features: [
      "Workflow audit template",
      "Bottleneck review worksheet",
      "Optimization action sheet",
      "Tool assessment grid",
      "Improvement tracking form",
    ],
    gallery: makeGallery("Workflow Optimization"),
  },
  {
    id: "consulting-session-package",
    category: "Consulting",
    title: "Digital Transformation Consulting Session",
    shortDescription:
      "A focused strategy session for digital growth and system improvement.",
    description:
      "A professional consulting session designed for businesses, professionals, and schools seeking guidance on digital systems, infrastructure, workflows, and modernization priorities.",
    price: 150,
    rating: 5,
    featured: true,
    type: "Service Package",
    delivery: "Scheduled consultation",
    features: [
      "1 strategy session",
      "Needs assessment review",
      "Priority recommendations",
      "Implementation guidance",
      "Follow-up summary",
    ],
    gallery: makeGallery("Consulting Session"),
  },
  {
    id: "website-system-setup",
    category: "Business Systems",
    title: "Website & Digital System Setup",
    shortDescription:
      "Planning support for modern websites and connected digital workflows.",
    description:
      "A service-oriented package for organizations and professionals who want to define or improve website structure, digital systems, and integrated user experiences.",
    price: 300,
    rating: 5,
    featured: true,
    type: "Service Package",
    delivery: "Scheduled consultation",
    features: [
      "Architecture planning",
      "Workflow structure review",
      "Content/system alignment",
      "Platform guidance",
      "Implementation direction",
    ],
    gallery: makeGallery("Website System Setup"),
  },
  {
    id: "infrastructure-audit",
    category: "Operations",
    title: "IT Infrastructure Audit",
    shortDescription:
      "A practical review of systems, devices, access, and operational readiness.",
    description:
      "A structured service package for reviewing infrastructure condition, system organization, operational gaps, and modernization opportunities.",
    price: 120,
    rating: 4,
    featured: false,
    type: "Service Package",
    delivery: "Scheduled consultation",
    features: [
      "Infrastructure review",
      "System gap identification",
      "Operational recommendations",
      "Improvement summary",
      "Follow-up guidance",
    ],
    gallery: makeGallery("Infrastructure Audit"),
  },
]

export function getFeaturedProducts() {
  return products.filter((product) => product.featured)
}

export function getProductById(id) {
  return products.find((product) => product.id === id)
}