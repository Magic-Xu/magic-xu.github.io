import { getCollection } from "astro:content";

export const getNotes = async () => (await getCollection("notes", ({ data }) => !data.draft))
	.sort((a, b) => b.data.date.getTime() - a.data.date.getTime() || a.id.localeCompare(b.id));

export const getFootprints = async () => (await getCollection("footprints", ({ data }) => !data.draft))
	.sort((a, b) => b.data.visitedAt.getTime() - a.data.visitedAt.getTime() || a.id.localeCompare(b.id));

export const journalYear = (date: Date) => date.getUTCFullYear();
export const journalDate = (date: Date) => date.toISOString().slice(0, 10);
export const journalMonthDay = (date: Date) => `${String(date.getUTCMonth() + 1).padStart(2, "0")} / ${String(date.getUTCDate()).padStart(2, "0")}`;

// The local coast outline and markers share this geographic extent.
export const mapExtent = { west: 96, east: 126, south: 20, north: 42 };
export const projectPlace = (longitude: number, latitude: number) => ({
	x: (longitude - mapExtent.west) / (mapExtent.east - mapExtent.west) * 100,
	y: (mapExtent.north - latitude) / (mapExtent.north - mapExtent.south) * 100
});
