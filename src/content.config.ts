import { defineCollection } from "astro:content";
import { glob } from "astro/loaders";
import { z } from "astro/zod";

const journalContent = process.env.JOURNAL_TEST_DATA === "1" ? "./tests/fixtures/journal" : "./src/content";
const includeJournalDrafts = process.env.JOURNAL_PREVIEW === "1" && process.env.JOURNAL_TEST_DATA !== "1";

// Schema images are emitted even when their entries are filtered out of pages.
// Remove draft image references before validation in a normal build.
const hideDraftImages = (data: unknown) => {
	const entry = data as Record<string, unknown>;
	return entry.draft && !includeJournalDrafts ? { ...entry, images: [], photos: [] } : entry;
};

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
	loader: glob({ pattern: "**/*.md", base: `${journalContent}/notes`, deferRender: true }),
	schema: ({ image }) => z.preprocess(hideDraftImages, z.object({
		date: z.date(),
		topic: z.string(),
		title: z.string().optional(),
		dateLabel: z.string().optional(),
		images: z.array(z.object({ src: image(), caption: z.string() })).default([]),
		imageLayout: z.enum(["stack", "comparison"]).default("stack"),
		reference: z.object({ label: z.string(), url: z.string().url() }).optional(),
		footprint: z.string().optional(),
		draft: z.boolean().default(false),
		demo: z.boolean().default(false)
	}))
});

const footprints = defineCollection({
	loader: glob({ pattern: "**/*.md", base: `${journalContent}/footprints`, deferRender: true }),
	schema: z.object({
		place: z.string(),
		locality: z.string().optional(),
		locationType: z.enum(["city", "region"]).default("city"),
		region: z.string(),
		country: z.string().default("中国"),
		visitedAt: z.date().optional(),
		summary: z.string().default(""),
		longitude: z.number().min(-180).max(180).optional(),
		latitude: z.number().min(-90).max(90).optional(),
		draft: z.boolean().default(false),
		demo: z.boolean().default(false)
	})
});

const footprintAlbums = defineCollection({
	loader: glob({ pattern: "**/*.json", base: `${journalContent}/footprint-albums` }),
	schema: ({ image }) => z.preprocess(hideDraftImages, z.object({
		title: z.string(),
		draft: z.boolean().default(false),
		photos: z.array(z.object({ src: image(), caption: z.string() }))
	}))
});

export const collections = { blog, notes, footprints, footprintAlbums };
