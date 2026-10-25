// The "unique" feature: how well does a candidate's skill set cover a job's skills?
exports.matchScore = (jobSkills = [], candidateSkills = []) => {
	const mine = new Set(candidateSkills.map((s) => s.toLowerCase().trim()));

	const missing = jobSkills.filter((s) => !mine.has(s.toLowerCase().trim()));

	const score = jobSkills.length
		? Math.round(
				((jobSkills.length - missing.length) / jobSkills.length) * 100,
			)
		: 0;

	return { score, missing };
};

exports.cleanSkills = (input) => [
	...new Set(
		(Array.isArray(input) ? input : String(input || "").split(","))
			.map((s) => s.trim().toLowerCase())
			.filter(Boolean),
	),
];
