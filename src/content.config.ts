import { defineCollection } from "astro:content";
import { glob } from "astro/loaders";
import { z } from "astro/zod";

const blog = defineCollection({
	loader: glob({ pattern: "**/*.md", base: "./src/content/blog" }),
	schema: z.object({
		title: z.string(),
		description: z.string(),
		showSummary: z.boolean().default(true),
		pubDate: z.date(),
		draft: z.boolean().default(false),
		readingTime: z.number().int().positive().optional(),
		tags: z.array(z.string()).optional(),
		lang: z.enum(["zh-CN", "en"]).default("zh-CN")
	})
});

export const collections = {
	blog
};
