const SPECIAL_LABELS = {
	api: "API",
	aws: "AWS",
	c: "C",
	"c++": "C++",
	"c#": "C#",
	css: "CSS",
	docker: "Docker",
	html: "HTML",
	javascript: "JavaScript",
	jwt: "JWT",
	mongodb: "MongoDB",
	mysql: "MySQL",
	node: "Node.js",
	nodejs: "Node.js",
	python: "Python",
	react: "React",
	redis: "Redis",
	sql: "SQL",
	tailwind: "Tailwind",
	typescript: "TypeScript",
	"ui/ux": "UI/UX",
};

export function formatLabel(value = "") {
	return String(value)
		.trim()
		.split(/\s+/)
		.map((word) => {
			const lower = word.toLowerCase();
			if (SPECIAL_LABELS[lower]) return SPECIAL_LABELS[lower];
			return lower.replace(/(^|[-/])([a-z])/g, (_, separator, letter) =>
				`${separator}${letter.toUpperCase()}`
			);
		})
		.join(" ");
}
