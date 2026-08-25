// Async feature bundle for LazyMotion (step 32). Loaded by MotionProvider via
// dynamic import so the animation/gesture/layout runtime ships as its own chunk
// instead of inside the critical path. `domMax` because layout/layoutId are used.
export { domMax as default } from "framer-motion"
