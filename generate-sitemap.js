// Generates public/sitemap.xml from fci-full-raw.json
// Run: node generate-sitemap.js
// Called automatically before each build via "prebuild" script

import { readFileSync, writeFileSync, existsSync } from "fs";

const BASE = "https://judge.dog";
const TODAY = new Date().toISOString().slice(0, 10);

function toSlug(name) {
  return name.toLowerCase()
    .normalize("NFD").replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

function assignSlugs(judges) {
  const counts = {};
  judges.forEach(j => { const b = toSlug(j.name); counts[b] = (counts[b] || 0) + 1; });
  const used = {};
  return judges.map(j => {
    const base = toSlug(j.name);
    if (counts[base] === 1) return { ...j, slug: base };
    used[base] = (used[base] || 0) + 1;
    return { ...j, slug: `${base}-${used[base]}` };
  });
}

const staticPages = [
  { url: "/",        priority: "1.0", changefreq: "daily" },
  { url: "/privacy", priority: "0.3", changefreq: "monthly" },
  { url: "/terms",   priority: "0.3", changefreq: "monthly" },
  { url: "/cookies", priority: "0.3", changefreq: "monthly" },
];

let judgeUrls = [];

if (existsSync("fci-full-raw.json")) {
  const raw = JSON.parse(readFileSync("fci-full-raw.json", "utf8"));
  const judges = assignSlugs(raw.judges.filter(j => j && j.name));
  judgeUrls = judges.map(j => ({
    url: `/judge/${j.slug}`,
    priority: "0.8",
    changefreq: "weekly",
  }));
  console.log(`Sitemap: included ${judgeUrls.length} judge URLs`);
} else {
  console.warn("fci-full-raw.json not found — sitemap will only include static pages");
}

const allUrls = [...staticPages, ...judgeUrls];

const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${allUrls.map(({ url, priority, changefreq }) => `  <url>
    <loc>${BASE}${url}</loc>
    <lastmod>${TODAY}</lastmod>
    <changefreq>${changefreq}</changefreq>
    <priority>${priority}</priority>
  </url>`).join("\n")}
</urlset>`;

writeFileSync("public/sitemap.xml", xml);
console.log(`Sitemap written: public/sitemap.xml (${allUrls.length} URLs)`);
