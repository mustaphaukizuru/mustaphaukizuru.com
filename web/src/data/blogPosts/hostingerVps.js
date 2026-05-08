import { AUTHOR_MUSTAPHA } from "./_author"

export default {
  slug: "self-hosting-a-react-app-on-hostinger-vps",
  title: "Self-hosting a Vite + Express app on a Hostinger VPS",
  excerpt:
    "PM2, Nginx, Let's Encrypt, BullMQ workers, GitHub Actions deploys, the parts of \"shared hosting\" nobody warns you about.",
  category: "web-development",
  tags: ["Hostinger", "Performance", "Node.js"],
  author: AUTHOR_MUSTAPHA,
  publishedAt: "2026-01-30T09:00:00Z",
  readMinutes: 14,
  cover: null,
  featured: false,
  body: [
    { type: "p", text: "Hostinger's VPS plans cost less than a single coffee per week and run a real Linux box. If you're comfortable on a terminal, you can host a production Vite + Express app there with no compromises. Here's the setup that survived launch traffic for mustaphaukizuru.com." },

    { type: "h2", text: "The pieces" },
    { type: "list", items: [
      "**Ubuntu 22.04** on a 2 vCPU / 8 GB plan.",
      "**Node 20** via `nvm`, kept on the LTS line.",
      "**PM2** for process management, `pm2 start`, `pm2 save`, `pm2 startup` and the API survives reboots.",
      "**Nginx** as the public-facing reverse proxy with HTTP/2 and gzip.",
      "**Let's Encrypt** via `certbot --nginx`, auto-renewing on a cron.",
      "**BullMQ + Redis** for background jobs (email, image resizing, payment reconciliation).",
      "**GitHub Actions** deploys via SSH on push to `main`.",
    ] },

    { type: "h2", text: "Nginx config worth copying" },
    { type: "p", text: "Three things matter: enable HTTP/2, terminate TLS at Nginx rather than Node, and serve the Vite-built static `/public` directly so Express never sees a request for an asset. The `try_files $uri @backend` pattern is the key: static first, with a fallback to Node for `/api/*` and SPA routes." },

    { type: "h2", text: "PM2 + zero-downtime deploys" },
    { type: "p", text: "Use `pm2 reload <name>` not `pm2 restart`. Reload spins up a new worker, drains the old one, and swaps. With cluster mode (`pm2 start app.js -i max`) you get true zero-downtime deploys without paying for a load balancer." },

    { type: "h2", text: "What shared hosting doesn't tell you" },
    { type: "list", items: [
      "**Mailbox limits.** Hostinger SMTP throttles aggressively. For transactional email above ~200/day, route through Resend or Postmark.",
      "**MySQL shadow-database is blocked.** Use `prisma db push`, never `prisma migrate dev`.",
      "**ulimit defaults are low.** Bump file descriptors in `/etc/security/limits.conf` before traffic catches you.",
      "**Backups are your job.** Set up `mysqldump` to S3 or Backblaze on a daily cron. Hostinger's snapshots aren't enough.",
    ] },

    { type: "callout", variant: "warning", title: "Honest caveat", text: "If you're optimising for engineer time rather than money, Render or Fly are still cheaper *per hour of your life*. Self-hosting on a VPS is the right call when you want full control and a fixed monthly cost — not when you want zero ops." }
  ]
}
