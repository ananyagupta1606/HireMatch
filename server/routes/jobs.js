const router = require("express").Router();
const Job = require("../models/Job");
const Application = require("../models/Application");
const Profile = require("../models/CandidateProfile");
const wrap = require("../utils/wrap");
const { protect, optionalAuth, allow } = require("../middleware/auth");
const { matchScore, cleanSkills } = require("../utils/match");
const { TRANSITIONS } = require("../utils/stages");

const esc = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const getCandidateProfile = async (user) => {
	if (user?.role !== "candidate") {
		return null;
	}

	return Profile.findOne({ userId: user._id }).lean();
};

// GET /api/jobs
router.get(
	"/",
	optionalAuth,
	wrap(async (req, res) => {
		const { role, location, workMode, minExp, ctc, skills } = req.query;

		const page = Math.max(+req.query.page || 1, 1);
		const limit = Math.min(+req.query.limit || 9, 50);

		const q = { status: "open" };

		if (role) q.title = new RegExp(esc(role), "i");
		if (location) q.location = new RegExp(esc(location), "i");
		if (workMode) q.workMode = workMode;

		// Experience dropdown filters by the job's minimum requirement.
		if (minExp !== undefined && minExp !== "") {
			q.minExp = { $gte: Number(minExp) };
		}

		if (ctc) {
			q.ctcMax = { $gte: Number(ctc) };
		}

		if (skills) {
			q.skills = { $in: cleanSkills(skills) };
		}

		const profile = await getCandidateProfile(req.user);
		const mine = profile?.skills || [];

		let jobs = await Job.find(q).lean();

		if (profile) {
			const candidateExperience = Number(profile.experienceYears ?? 0);

			jobs = jobs.map((job) => ({
				...job,
				match: matchScore(job.skills || [], mine),
				candidateExperience,
				eligibleByExperience:
					candidateExperience >= Number(job.minExp ?? 0),
			}));

			jobs.sort(
				(a, b) =>
					b.match.score - a.match.score ||
					new Date(b.createdAt) - new Date(a.createdAt),
			);
		} else {
			jobs.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
		}

		const total = jobs.length;
		const start = (page - 1) * limit;
		const paginatedJobs = jobs.slice(start, start + limit);

		res.json({
			jobs: paginatedJobs,
			total,
			page,
			pages: Math.ceil(total / limit) || 1,
		});
	}),
);

// GET /api/jobs/mine
router.get(
	"/mine",
	protect,
	allow("recruiter"),
	wrap(async (req, res) => {
		const jobs = await Job.find({
			recruiter: req.user._id,
		})
			.sort({ createdAt: -1 })
			.lean();

		const counts = await Application.aggregate([
			{
				$match: {
					job: { $in: jobs.map((j) => j._id) },
				},
			},
			{
				$group: {
					_id: "$job",
					n: { $sum: 1 },
				},
			},
		]);

		const map = Object.fromEntries(counts.map((c) => [String(c._id), c.n]));

		res.json(
			jobs.map((j) => ({
				...j,
				applicants: map[String(j._id)] || 0,
			})),
		);
	}),
);

// GET /api/jobs/:id
router.get(
	"/:id",
	optionalAuth,
	wrap(async (req, res) => {
		const job = await Job.findById(req.params.id).lean();

		if (!job) {
			return res.status(404).json({
				message: "Job not found",
			});
		}

		const profile = await getCandidateProfile(req.user);

		if (profile) {
			const candidateExperience = Number(profile.experienceYears ?? 0);

			job.match = matchScore(job.skills || [], profile.skills || []);

			job.candidateExperience = candidateExperience;

			job.eligibleByExperience =
				candidateExperience >= Number(job.minExp ?? 0);

			job.applied = !!(await Application.exists({
				job: job._id,
				candidate: req.user._id,
			}));
		}

		res.json(job);
	}),
);

// POST /api/jobs
router.post(
	"/",
	protect,
	allow("recruiter"),
	wrap(async (req, res) => {
		const {
			title,
			description,
			skills,
			location,
			workMode,
			minExp,
			ctcMin,
			ctcMax,
		} = req.body;

		if (!title || !description || !location) {
			return res.status(400).json({
				message: "Title, description and location are required",
			});
		}

		const job = await Job.create({
			recruiter: req.user._id,
			company: req.user.company,
			title,
			description,
			location,
			workMode,
			skills: cleanSkills(skills),
			minExp: Number(minExp) || 0,
			ctcMin: Number(ctcMin) || 0,
			ctcMax: Number(ctcMax) || 0,
		});

		res.status(201).json(job);
	}),
);

// PATCH /api/jobs/:id/close
router.patch(
	"/:id/close",
	protect,
	allow("recruiter"),
	wrap(async (req, res) => {
		const job = await Job.findOneAndUpdate(
			{
				_id: req.params.id,
				recruiter: req.user._id,
			},
			{ status: "closed" },
			{ new: true },
		);

		if (!job) {
			return res.status(404).json({
				message: "Job not found",
			});
		}

		res.json(job);
	}),
);

// GET /api/jobs/:id/applicants
router.get(
	"/:id/applicants",
	protect,
	allow("recruiter"),
	wrap(async (req, res) => {
		const job = await Job.findOne({
			_id: req.params.id,
			recruiter: req.user._id,
		}).lean();

		if (!job) {
			return res.status(404).json({
				message: "Job not found",
			});
		}

		const apps = await Application.find({
			job: job._id,
		})
			.populate("candidate", "name email")
			.lean();

		const validApps = apps.filter((a) => a.candidate);

		const profiles = await Profile.find({
			userId: {
				$in: validApps.map((a) => a.candidate._id),
			},
		}).lean();

		const byUser = Object.fromEntries(
			profiles.map((p) => [String(p.userId), p]),
		);

		const list = validApps
			.map((a) => {
				const p = byUser[String(a.candidate._id)];

				return {
					...a,
					profile: p
						? {
								headline: p.headline,
								skills: p.skills,
								experienceYears: p.experienceYears,
							}
						: null,
					match: matchScore(job.skills || [], p?.skills || []),
					next: TRANSITIONS[a.stage] || [],
				};
			})
			.sort((a, b) => b.match.score - a.match.score);

		res.json({
			job,
			applicants: list,
		});
	}),
);

module.exports = router;
