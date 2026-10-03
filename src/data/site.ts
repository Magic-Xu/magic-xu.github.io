export interface SiteConfig {
	title: string;
	description: string;
	slogan: string;
	url: string;
	author: string;
	github: string;
	email: string;
}

export const siteConfig: SiteConfig = {
	title: "小麦在野",
	description: "我是小麦，也叫 MagicXu。这里记录 AI、独立开发，以及更自由的工作与生活。",
	slogan: "做自己的产品，记录真实的探索。",
	url: "https://magicxu.com",
	author: "MagicXu",
	github: "https://github.com/Magic-Xu",
	email: "magicalxu666@gmail.com"
};

export const siteConfigs = {
	zh: siteConfig
} as const;

export type SiteLocale = keyof typeof siteConfigs;

export const getSiteConfig = (locale: SiteLocale = "zh") => siteConfigs[locale];
