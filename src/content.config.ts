import { defineCollection } from "astro:content";
import { glob } from "astro/loaders";
import { z } from "astro/zod";

const journalContent = process.env.JOURNAL_TEST_DATA === "1" ? "./tests/fixtures/journal" : "./src/content";

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

const notes = defineCollection({
	loader: glob({ pattern: "**/*.md", base: `${journalContent}/notes` }),
	schema: z.object({
		date: z.date(),
		topic: z.string(),
		footprint: z.string().optional(),
		draft: z.boolean().default(false),
		demo: z.boolean().default(false)
	})
});

const footprints = defineCollection({
	loader: glob({ pattern: "**/*.md", base: `${journalContent}/footprints` }),
	schema: z.object({
		place: z.string(),
		region: z.string(),
		visitedAt: z.date(),
		summary: z.string(),
		longitude: z.number().min(-180).max(180),
		latitude: z.number().min(-90).max(90),
		draft: z.boolean().default(false),
		demo: z.boolean().default(false)
	})
});

export const collections = { blog, notes, footprints };
