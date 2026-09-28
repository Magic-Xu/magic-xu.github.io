import type { APIRoute } from "astro";
import { getPublishedPosts } from "../lib/blog";
import { siteConfig } from "../data/site";
const escape = (value: string) => value.replace(/[<>&"']/g, (c) => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;", '"': "&quot;", "'": "&apos;" }[c]!));
export const GET: APIRoute = async () => {
  const posts = await getPublishedPosts();
  const items = posts.map((post) => {
    const url = new URL(`/writing/${post.id}/`, siteConfig.url).href;
    return `<item><title>${escape(post.data.title)}</title><link>${escape(url)}</link><guid isPermaLink="true">${escape(url)}</guid><description>${escape(post.data.description)}</description><pubDate>${post.data.pubDate.toUTCString()}</pubDate></item>`;
  }).join("");
  return new Response(`<?xml version="1.0" encoding="UTF-8"?><rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom"><channel><title>${escape(siteConfig.title)}</title><link>${siteConfig.url}/</link><description>${escape(siteConfig.description)}</description><language>zh-CN</language><atom:link href="${siteConfig.url}/rss.xml" rel="self" type="application/rss+xml"/>${items}</channel></rss>`, { headers: { "Content-Type": "application/rss+xml; charset=utf-8" } });
};
