import type { LocaleContent } from "../types";
import { siteConfig } from "../../data/site";

export const zhCN: LocaleContent = {
	navigation: [
		{ href: "/writing/", label: "文章" },
		{ href: "/projects/", label: "作品" },
		{ href: "/about/", label: "关于" }
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
			{ href: "/projects", label: "作品", variant: "secondary" },
			{ href: "/writing", label: "文章", variant: "secondary" },
			{ href: "/about", label: "关于", variant: "secondary" }
		]
	},
	about: {
		metaTitle: "关于",
		metaDescription: "关于 MagicXu 的工作方向与技术关注",
		title: "关于",
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
		featuredName: "SnapMosaic",
		metaTitle: "作品",
		metaDescription: "小麦的独立产品、开源项目、生活工具与兴趣创作。",
		title: "作品",
		items: [
			{
				name: "SnapMosaic",
				category: "Android 应用",
				status: "已上线 / 迭代中",
				tagline: "在设备上，保护照片隐私。",
				description:
					"一款本地优先的图片隐私工具。在分享照片和截图前，遮挡人脸、姓名、车牌和票据信息。",
				stack: ["Android", "Privacy", "Local-first", "Product Design"],
				theme: "dark",
				links: [
					{ label: "产品网站", href: "https://magic-xu.github.io/mosaic-legal/" },
					{ label: "Google Play", href: "https://play.google.com/store/apps/details?id=com.magic.snapmosaic" },
					{ label: "X / Twitter", href: "https://x.com/snapmosaic_app" }
				]
			},
			{
				name: "LifeOS",
				status: "公开模板",
				tagline: "记录生活，让 AI 帮忙整理。",
				description:
					"用 Obsidian 记录生活，用 Codex 整理、检索和回顾。公开模板包含目录、记录模板、规则和脚本，可以用来建立自己的个人知识库。",
				stack: ["Obsidian", "Markdown", "Codex"],
				linkHref: "https://github.com/Magic-Xu/LifeOS_Template",
				linkLabel: "获取模板"
			},
			{
				name: "MeloNest",
				status: "开发中",
				tagline: "生成音乐，整理自己的曲库。",
				description:
					"一个面向 AI 音乐生成与本地导入播放的轻量音乐 App，围绕生成、导入、本地曲库、播放与导出形成最小闭环。",
				stack: ["Kotlin", "Android", "Jetpack Compose", "AI Music", "Local-first"],
				linkHref: "https://magic-xu.github.io/MeloNestLegal/",
				linkLabel: "产品网站"
			},
			{
				name: "Magic App Dev",
				tagline: "独立 App 开发的 Codex 工作流。",
				status: "可安装 / 持续迭代",
				description:
					"把需求调研、开发验证、Google Play 发布准备和上线后的分析，整理成可复用的 Codex 插件。",
				stack: ["Codex", "Android", "Google Play"],
				links: [
					{ label: "查看插件", href: "https://github.com/Magic-Xu/magic-app-dev-plugin" },
					{ label: "配套工程工具", href: "https://github.com/Magic-Xu/magic-android-platform" }
				]
			},
			{
				name: "Pulse",
				tagline: "基于 Kotlin 的开源 MVI 框架。",
				status: "已发布 / 持续迭代",
				description:
					"通过 Kotlin 协程管理状态与事件，支持纯 Kotlin/JVM、Android 和 Jetpack Compose，已发布至 Maven Central。",
				stack: ["Kotlin", "Android", "MVI", "Jetpack Compose"],
				linkHref: "https://github.com/Magic-Xu/pulse",
				linkLabel: "查看项目"
			}
		],
		smallWorks: [
			{
				id: "yinyue",
				name: "银月",
				category: "Codex 宠物 · 同人创作",
				description: "给 Codex 做的一只桌面宠物。",
				linkLabel: "预览与安装",
				linkHref: "https://github.com/Magic-Xu/codex-pets"
			},
			{
				id: "fanren",
				name: "凡人 · 角色造型集",
				category: "AI 图像 · 同人创作",
				description: "八位角色，十六张 Q 版手办成图。",
				linkLabel: "打开造型集",
				linkHref: "https://magic-xu.github.io/fanren-character-gallery/"
			},
			{
				id: "daily-skills",
				name: "Magic Daily Skills",
				category: "日常工具",
				description: "写文章、做调研、整理工作目录时用到的 Codex Skills。",
				linkLabel: "查看工具集",
				linkHref: "https://github.com/Magic-Xu/MagicDailySkills"
			},
			{
				id: "obsidian",
				name: "Magic Obsidian",
				category: "工作台预设",
				description: "把自己用的 Obsidian 配色、布局和工作台整理成可复用的预设。",
				linkLabel: "查看预设",
				linkHref: "https://github.com/Magic-Xu/magic-obsidian"
			}
		]
	},
	writing: {
		featuredPostId: "google-play-closed-testing",
		metaTitle: "文章",
		metaDescription: "工程实践、AI 产品与独立开发写作",
		title: "文章",
		emptyMessage: "暂时还没有可展示的文章。"
	},
	footer: {
		note: "保持热忱，持续交付。",
		githubLabel: "GitHub",
		emailLabel: "邮箱"
	}
};
