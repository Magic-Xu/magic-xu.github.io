import type { LocaleContent } from "../types";
import { siteConfig } from "../../data/site";

export const zhCN: LocaleContent = {
	navigation: [
		{ href: "/projects", label: "Projects" },
		{ href: "/writing", label: "Writing" },
		{ href: "/about", label: "About" }
	],
	home: {
		metaTitle: "首页",
		metaDescription: "MagicXu 的个人网站：Android 工程实践、AI 产品探索与独立开发项目。",
		title: siteConfig.title,
		subtitle: "Android 工程师 / AI 探索者 / 独立开发者",
		slogan: siteConfig.slogan,
		intro:
			"我长期专注 Android 工程实践，也持续在 AI 产品方向做实验。相比追逐概念，我更在意问题边界是否清晰、方案是否可维护，以及结果能否被真实使用。对我来说，工程的价值在于把想法打磨成稳定、可交付的产品。",
		actions: [
			{ href: siteConfig.github, label: "GitHub", external: true, variant: "primary" },
			{ href: "/projects", label: "Projects", variant: "secondary" },
			{ href: "/writing", label: "Writing", variant: "secondary" },
			{ href: "/about", label: "About", variant: "secondary" }
		]
	},
	about: {
		metaTitle: "About",
		metaDescription: "关于 MagicXu 的工作方向与技术关注",
		title: "About",
		description:
			"我是 MagicXu，长期专注 Android 工程实践，同时在 AI 产品方向持续探索。偏好用工程方法解决真实问题，并把结果打磨成可交付的产品。",
		summaryTitle: "简介",
		workTitle: "工作经历",
		keywordsTitle: "技术关键词",
		focusTitle: "当前关注",
		work: {
			companies: [
				{ name: "字节跳动", logo: "/company-icons/bytedance.png" },
				{ name: "腾讯 Tencent", logo: "/company-icons/tencent.ico" },
				{ name: "拼多多", logo: "/company-icons/pinduoduo.png", variant: "app" },
				{ name: "OPPO", logo: "/company-icons/oppo.ico" },
				{ name: "乐逗游戏", logo: "/company-icons/ledou-icon.png" }
			]
		},
		keywords: [
			"Android 原生开发",
			"Kotlin / Java",
			"架构设计与工程化",
			"AI 应用落地",
			"产品原型与独立开发"
		],
		focuses: [
			"移动端与 AI 能力结合的真实场景",
			"可维护、可演进的小型工程体系",
			"从想法到上线的快速闭环"
		]
	},
	projects: {
		metaTitle: "Projects",
		metaDescription: "进行中的项目与工程实践",
		title: "Projects",
		description: "进行中的项目、实验和长期迭代方向。",
		items: [
			{
				name: "SnapMosaic",
				status: "已上线 / 迭代中",
				tagline: "Private photo masking, on device.",
				description:
					"A local-first privacy image editor for quickly masking faces, names, license plates, receipts, screenshots, and other sensitive details before sharing.",
				stack: ["Android", "Privacy", "Local-first", "Product Design"],
				theme: "dark",
				links: [
					{ label: "Website", href: "https://magic-xu.github.io/mosaic-legal/" },
					{ label: "Google Play", href: "https://play.google.com/store/apps/details?id=com.magic.snapmosaic" },
					{ label: "X / Twitter", href: "https://x.com/snapmosaic_app" }
				]
			},
			{
				name: "MeloNest",
				status: "开发中",
				tagline: "AI music generation, kept in your local library.",
				description:
					"一个面向 AI 音乐生成与本地导入播放的轻量音乐 App，围绕生成、导入、本地曲库、播放与导出形成最小闭环。",
				stack: ["Kotlin", "Android", "Jetpack Compose", "AI Music", "Local-first"]
			},
			{
				name: "App Dev Skills",
				status: "开源 / 维护中",
				description:
					"一套从独立 App 开发实践中沉淀的 Codex skills，覆盖 local-first Android App 启动、架构守护、设备 QA 和 GitHub 发布流程。",
				stack: ["Codex Skills", "Android", "MVI", "Jetpack Compose", "Workflow"],
				linkHref: "https://github.com/Magic-Xu/app-dev-skills",
				linkLabel: "查看项目"
			},
			{
				name: "Pulse",
				status: "进行中",
				description:
					"一个面向 Android 的轻量 MVI 架构实践，强调状态流可读、模块边界清晰和工程落地成本可控。",
				stack: ["Kotlin", "Android", "MVI", "Jetpack"],
				linkHref: "https://github.com/Magic-Xu/pulse",
				linkLabel: "查看项目"
			}
		]
	},
	writing: {
		metaTitle: "Writing",
		metaDescription: "工程实践、AI 产品与独立开发写作",
		title: "Writing",
		description: "记录 Android 工程、AI 实践与产品思考。",
		hint: "",
		emptyMessage: "暂时还没有可展示的文章。"
	},
	footer: {
		note: "保持热忱，持续交付。",
		githubLabel: "GitHub",
		emailLabel: "邮箱"
	}
};
