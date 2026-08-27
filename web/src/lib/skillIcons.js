/* ──────────────────────────────────────────────────────────────────────────
 *  lib/skillIcons.js · iconKey → brand logo component
 *
 *  The Skill table stores an optional `iconKey`; this registry maps it to a
 *  react-icons glyph. Consumers:
 *    · admin/bio/IconPicker + SkillsSection (the dropdown reads the keys)
 *    · TechStackShowcase (home proof strip; only skills WITH a registered
 *      icon are shown there)
 *  Add new entries here when the catalogue needs a new logo. Keep this file
 *  free of React/UI code — the admin chunk and the home chunk both import
 *  it, and react-icons glyphs tree-shake per named import.
 *  ──────────────────────────────────────────────────────────────────────── */
import {
  FaReact, FaNodeJs, FaPython, FaJava, FaDocker, FaGitAlt, FaGithub,
  FaLinux, FaAws, FaGoogle, FaJsSquare, FaHtml5, FaCss3Alt,
} from "react-icons/fa"
import {
  SiDjango, SiFlask, SiExpress, SiTailwindcss, SiPostgresql, SiMysql,
  SiPrisma, SiSpringboot, SiFramer, SiVite, SiJsonwebtokens,
  SiBootstrap, SiSpringsecurity, SiOpenssl, SiCloudflare, SiNginx,
  SiKubernetes, SiRedis, SiMongodb, SiTypescript, SiGooglecloud,
} from "react-icons/si"

export const ICON_REGISTRY = {
  // Frontend
  react: FaReact, javascript: FaJsSquare, typescript: SiTypescript,
  html5: FaHtml5, css3: FaCss3Alt, tailwind: SiTailwindcss,
  bootstrap: SiBootstrap, framer: SiFramer, vite: SiVite,
  // Backend
  nodejs: FaNodeJs, express: SiExpress, python: FaPython,
  django: SiDjango, flask: SiFlask, java: FaJava, springboot: SiSpringboot,
  // Data
  postgresql: SiPostgresql, mysql: SiMysql, prisma: SiPrisma,
  mongodb: SiMongodb, redis: SiRedis,
  // Ship / DevOps
  docker: FaDocker, kubernetes: SiKubernetes, git: FaGitAlt,
  github: FaGithub, linux: FaLinux, aws: FaAws, gcp: SiGooglecloud,
  google: FaGoogle, nginx: SiNginx, cloudflare: SiCloudflare,
  // Secure
  jwt: SiJsonwebtokens, springsecurity: SiSpringsecurity, openssl: SiOpenssl,
}
