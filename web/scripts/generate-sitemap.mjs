import fs from "node:fs/promises";
import path from "node:path";

const SITE_URL = (process.env.VITE_SITE_URL || "https://mustaphaukizuru.com").replace(/\/$/, "");
const publicDir = path.resolve(process.cwd(), "public");
const outputFile = path.join(publicDir, "sitemap.xml");
const routesFile = path.join(publicDir, "sitemap-routes.json");
const productsFile = path.join(publicDir, "sitemap-products.json");

const staticRoutes = [
  { path: "/", changefreq: "weekly", priority: "1.0" },
  { path: "/about", changefreq: "monthly", priority: "0.8" },
  { path: "/solutions", changefreq: "monthly", priority: "0.85" },
  { path: "/services", changefreq: "weekly", priority: "0.9" },
  { path: "/store", changefreq: "daily", priority: "0.9" },
  { path: "/contact", changefreq: "monthly", priority: "0.7" },
  { path: "/terms", changefreq: "yearly", priority: "0.3" },
  { path: "/privacy", changefreq: "yearly", priority: "0.3" },
  { path: "/refund", changefreq: "yearly", priority: "0.3" },
];

async function readJson(filePath) {
  try {
    const raw = await fs.readFile(filePath, "utf8");
    return JSON.parse(raw);
  } catch {
    return [];
  }
}

function normalizeEntries(entries = []) {
  return entries
    .filter(Boolean)
    .map((entry) => {
      if (typeof entry === "string") {
        return { path: entry, changefreq: "monthly", priority: "0.7" };
      }
      return {
        path: entry.path,
        lastmod: entry.lastmod,
        changefreq: entry.changefreq || "monthly",
        priority: entry.priority || "0.7",
      };
    })
    .filter((entry) => entry.path && !entry.path.startsWith("/admin") && !entry.path.startsWith("/dashboard"));
}

function routeToXml({ path: routePath, lastmod, changefreq, priority }) {
  const loc = `${SITE_URL}${routePath === "/" ? "/" : routePath.replace(/\/$/, "")}`;
  const lastModTag = lastmod ? `\n    <lastmod>${lastmod}</lastmod>` : "";
  return `  <url>\n    <loc>${loc}</loc>${lastModTag}\n    <changefreq>${changefreq}</changefreq>\n    <priority>${priority}</priority>\n  </url>`;
}

async function main() {
  const extraRoutes = normalizeEntries(await readJson(routesFile));
  const productRoutes = normalizeEntries(await readJson(productsFile));

  const merged = [...staticRoutes, ...extraRoutes, ...productRoutes]
    .filter((item, index, array) => index === array.findIndex((other) => other.path === item.path))
    .sort((a, b) => a.path.localeCompare(b.path));

  const xml = [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
    ...merged.map(routeToXml),
    '</urlset>',
    '',
  ].join("\n");

  await fs.writeFile(outputFile, xml, "utf8");
  console.log(`Sitemap written to ${outputFile}`);
}

main().catch((error) => {
  console.error("Failed to generate sitemap", error);
  process.exit(1);
});
