/**
 * feedService.js · RSS 2.0 feed generator for /feed.xml
 *
 * Queries published blog posts from the DB via blogService. A 1-hour
 * in-process cache sits in app.js to avoid a DB hit per request.
 * Falls back to an empty channel if the DB is unreachable so the feed
 * endpoint always responds (never 500s a feed reader).
 */

const blogService = require("./blogService")

const SITE_URL  = "https://mustaphaukizuru.com"
const SITE_NAME = "MUSTAPHA UKIZURU Blog"
const SITE_DESC = "Technology consulting, web development, and STEM education insights from Mustapha Ukizuru — IT Manager, Full-Stack Developer, CS Educator."
const EDITOR    = "hello@mustaphaukizuru.com (Mustapha Ukizuru)"
const YEAR      = new Date().getFullYear()

/** Wrap arbitrary text in a CDATA section so no entity escaping is needed. */
function cdata(str) {
  return `<![CDATA[${String(str || "").replace(/]]>/g, "]]]]><![CDATA[>")}]]>`
}

function buildItem(p) {
  const pub = p.publishedAt ? new Date(p.publishedAt).toUTCString() : new Date().toUTCString()
  const url = `${SITE_URL}/blog/${p.slug}`
  const tags = Array.isArray(p.tags) ? p.tags.filter(Boolean) : []
  return `
    <item>
      <title>${cdata(p.title)}</title>
      <link>${url}</link>
      <guid isPermaLink="true">${url}</guid>
      <description>${cdata(p.excerpt)}</description>
      <pubDate>${pub}</pubDate>
      <dc:creator>${cdata(p.author?.name || "Mustapha Ukizuru")}</dc:creator>
      ${tags.map((t) => `<category>${cdata(t)}</category>`).join("\n      ")}
    </item>`
}

async function buildFeed() {
  let posts = []
  try {
    const res = await blogService.listPublicPosts({ limit: 20 })
    posts = res.posts || []
  } catch (err) {
    console.error("[feedService] DB unavailable, returning empty feed:", err.message)
  }

  const items    = posts.map(buildItem).join("\n")
  const buildDate = new Date().toUTCString()

  return `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0"
     xmlns:atom="http://www.w3.org/2005/Atom"
     xmlns:dc="http://purl.org/dc/elements/1.1/"
     xmlns:content="http://purl.org/rss/1.0/modules/content/">
  <channel>
    <title>${SITE_NAME}</title>
    <link>${SITE_URL}/blog</link>
    <description>${SITE_DESC}</description>
    <language>en-us</language>
    <lastBuildDate>${buildDate}</lastBuildDate>
    <ttl>60</ttl>
    <copyright>© ${YEAR} MUSTAPHA UKIZURU. All rights reserved.</copyright>
    <managingEditor>${EDITOR}</managingEditor>
    <webMaster>${EDITOR}</webMaster>
    <atom:link href="${SITE_URL}/feed.xml" rel="self" type="application/rss+xml"/>
    <image>
      <url>${SITE_URL}/web-app-manifest-512x512.png</url>
      <title>${SITE_NAME}</title>
      <link>${SITE_URL}/blog</link>
      <width>512</width>
      <height>512</height>
    </image>
${items}
  </channel>
</rss>`
}

module.exports = { buildFeed }
