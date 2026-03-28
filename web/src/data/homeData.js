import {
  Building2,
  BriefcaseBusiness,
  GraduationCap,
  BookOpen,
  MonitorSmartphone,
  Wrench,
  BrainCircuit,
  Server,
  Search,
  Lightbulb,
  Settings2,
  LineChart,
} from "lucide-react"

export const audiences = [
  {
    title: "SMEs & Businesses",
    description:
      "Technology support for organizations that want stronger systems, better digital presence, and smarter operations.",
    icon: Building2,
  },
  {
    title: "Professionals & Individuals",
    description:
      "Practical consulting and digital solutions for professionals building modern workflows and online visibility.",
    icon: BriefcaseBusiness,
  },
  {
    title: "Schools & Education",
    description:
      "Education-focused technology systems, STEM programs, digital learning tools, and infrastructure guidance.",
    icon: GraduationCap,
  },
]

export const solutions = [
  { title: "Digital Products", icon: BookOpen },
  { title: "Professional Training & Workshops", icon: GraduationCap },
  { title: "Website and Digital Systems", icon: MonitorSmartphone },
  { title: "Technology Consulting", icon: BrainCircuit },
  { title: "STEM, Coding, and Robotics Program Development", icon: Wrench },
  { title: "IT Infrastructure & Digital Transformation", icon: Server },
]

export const featuredProducts = [
  {
    id: "digital-transformation-starter-toolkit",
    category: "IT Toolkits",
    title: "Digital Transformation Starter Toolkit",
    description: "Practical templates to guide digital planning and implementation.",
    price: 10,
    rating: 5,
  },
  {
    id: "weekly-content-calendar",
    category: "Templates",
    title: "Weekly Content Calendar for Creators",
    description: "A structured planning resource for consistent digital publishing.",
    price: 12,
    rating: 5,
  },
  {
    id: "stem-program-planning-pack",
    category: "Training",
    title: "STEM Program Planning Pack",
    description: "Organized teaching resources for coding and robotics initiatives.",
    price: 18,
    rating: 5,
  },
  {
    id: "school-it-audit-checklist",
    category: "Operations",
    title: "School IT Audit Checklist",
    description: "A ready-to-use checklist for reviewing infrastructure and systems.",
    price: 15,
    rating: 5,
  },
  {
    id: "website-launch-planning-kit",
    category: "Business Systems",
    title: "Website Launch Planning Kit",
    description: "A clean framework for planning and structuring web projects.",
    price: 14,
    rating: 5,
  },
  {
    id: "digital-workflow-optimization-pack",
    category: "Consulting",
    title: "Digital Workflow Optimization Pack",
    description: "Templates and guidance for improving digital efficiency.",
    price: 16,
    rating: 5,
  },
]

export const processSteps = [
  {
    title: "Discovery",
    description:
      "Understand your current systems, priorities, and the real challenges affecting progress.",
    icon: Search,
  },
  {
    title: "Strategy",
    description:
      "Define a practical roadmap with clear objectives, technology choices, and implementation direction.",
    icon: Lightbulb,
  },
  {
    title: "Implementation",
    description:
      "Translate the plan into reliable systems, platforms, workflows, and digital resources.",
    icon: Settings2,
  },
  {
    title: "Optimization",
    description:
      "Refine performance, strengthen adoption, and improve long-term digital effectiveness.",
    icon: LineChart,
  },
]

export const testimonials = [
  {
    initials: "AM",
    name: "Aline M.",
    role: "School Administrator",
    rating: 5,
    text: "The platform strategy and infrastructure guidance helped us modernize our digital learning environment with confidence.",
  },
  {
    initials: "JN",
    name: "Jean N.",
    role: "Business Owner",
    rating: 5,
    text: "The consulting approach was structured, practical, and focused on results. Our digital processes became more organized immediately.",
  },
  {
    initials: "CK",
    name: "Claudine K.",
    role: "Education Coordinator",
    rating: 4,
    text: "The STEM and technology planning support gave us a clear path for building engaging learning experiences.",
  },
  {
    initials: "TM",
    name: "Theo M.",
    role: "Operations Lead",
    rating: 5,
    text: "Strong communication, thoughtful planning, and modern systems thinking made the implementation process smooth.",
  },
  {
    initials: "SR",
    name: "Sarah R.",
    role: "Independent Professional",
    rating: 4,
    text: "The digital strategy recommendations helped me improve my online structure and work more efficiently.",
  },
  {
    initials: "DK",
    name: "David K.",
    role: "IT Coordinator",
    rating: 5,
    text: "Reliable guidance and a professional process. The solutions were practical, scalable, and easy to adopt.",
  },
]