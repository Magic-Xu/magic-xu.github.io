export interface NavItem {
	href: string;
	label: string;
}

export interface HomeLink {
	href: string;
	label: string;
	external?: boolean;
	variant?: "primary" | "secondary";
}

export interface ProjectItem {
	name: string;
	status: string;
	description: string;
	stack: string[];
	tagline?: string;
	theme?: "dark" | "light";
	linkHref?: string;
	linkLabel?: string;
	links?: {
		label: string;
		href: string;
	}[];
}

export interface LocaleContent {
	navigation: NavItem[];
	home: {
		metaTitle: string;
		metaDescription: string;
		title: string;
		subtitle: string;
		slogan: string;
		intro: string;
		actions: HomeLink[];
	};
	about: {
		metaTitle: string;
		metaDescription: string;
		title: string;
		description: string;
		summaryTitle: string;
		workTitle: string;
		keywordsTitle: string;
		focusTitle: string;
		work: {
			companies: {
				name: string;
				logo: string;
				variant?: "app";
			}[];
		};
		keywords: string[];
		focuses: string[];
	};
	projects: {
		metaTitle: string;
		metaDescription: string;
		title: string;
		description: string;
		items: ProjectItem[];
	};
	writing: {
		metaTitle: string;
		metaDescription: string;
		title: string;
		description: string;
		hint: string;
		emptyMessage: string;
	};
	footer: {
		note: string;
		githubLabel: string;
		emailLabel: string;
	};
}
