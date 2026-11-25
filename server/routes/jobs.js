const router = require("express").Router();
const Job = require("../models/Job");
const Application = require("../models/Application");
const Notification = require("../models/Notification");
const RecruiterNote = require("../models/RecruiterNote");
const Profile = require("../models/CandidateProfile");
const wrap = require("../utils/wrap");
const { protect, optionalAuth, allow } = require("../middleware/auth");
const { matchScore, cleanSkills } = require("../utils/match");
const { STAGES, TRANSITIONS } = require("../utils/stages");

const esc = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const getCandidateProfile = async (user) => {
    if (user?.role !== "candidate") {
        return null;
    }

    const profile = await Profile.findOne({
        userId: user._id,
    }).lean();

    // Treat candidates without a saved profile as freshers.
    return profile || {
        skills: [],
        experienceYears: 0,
    };
};
;

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
			status: { $ne: "archived" },
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
					applicants: { $sum: 1 },
					...Object.fromEntries(
						STAGES.map((stage) => [
							stage,
							{
								$sum: {
									$cond: [{ $eq: ["$stage", stage] }, 1, 0],
								},
							},
						]),
					),
				},
			},
		]);

		const map = Object.fromEntries(counts.map((count) => [String(count._id), count]));

		res.json(
			jobs.map((j) => ({
				...j,
				applicants: map[String(j._id)]?.applicants || 0,
				stageCounts: Object.fromEntries(
					STAGES.map((stage) => [
						stage,
						map[String(j._id)]?.[stage] || 0,
					]),
				),
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

		if (!job || job.status === "archived") {
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

		if (job.skills.length > 0) {
			const matchingProfiles = await Profile.find({
				skills: { $in: job.skills },
			})
				.select("userId")
				.lean();

			if (matchingProfiles.length > 0) {
				await Notification.insertMany(
					matchingProfiles.map((profile) => ({
						recipient: profile.userId,
						type: "job_match",
						title: "A new job matches your skills",
						message: `${job.title} at ${job.company} matches skills on your profile.`,
						link: `/jobs/${job._id}`,
					})),
				);
			}
		}

		res.status(201).json(job);
	}),
);

// PATCH /api/jobs/:id
// Recruiters can edit their own job postings.
router.patch(
	"/:id",
	protect,
	allow("recruiter"),
	wrap(async (req, res) => {
		const job = await Job.findOne({
			_id: req.params.id,
			recruiter: req.user._id,
		});

		if (!job || job.status === "archived") {
			return res.status(404).json({
				message: "Job not found",
			});
		}

		const updates = {};
		for (const field of ["title", "description", "location"]) {
			if (req.body[field] === undefined) continue;
			if (
				typeof req.body[field] !== "string" ||
				!req.body[field].trim()
			) {
				return res.status(400).json({
					message: `${field[0].toUpperCase()}${field.slice(1)} is required`,
				});
			}
			updates[field] = req.body[field].trim();
		}

		if (req.body.skills !== undefined) {
			if (
				(typeof req.body.skills !== "string" &&
					!Array.isArray(req.body.skills)) ||
				(Array.isArray(req.body.skills) &&
					!req.body.skills.every((skill) => typeof skill === "string"))
			) {
				return res.status(400).json({
					message: "Skills must be a list or comma-separated text",
				});
			}
			updates.skills = cleanSkills(req.body.skills);
		}

		if (req.body.workMode !== undefined) {
			if (!["onsite", "remote", "hybrid"].includes(req.body.workMode)) {
				return res.status(400).json({
					message: "Choose onsite, remote, or hybrid work mode",
				});
			}
			updates.workMode = req.body.workMode;
		}

		for (const field of ["minExp", "ctcMin", "ctcMax"]) {
			if (req.body[field] === undefined) continue;
			const value = Number(req.body[field]);
			if (
				req.body[field] === null ||
				req.body[field] === "" ||
				!Number.isFinite(value) ||
				value < 0
			) {
				return res.status(400).json({
					message: `${field} must be a non-negative number`,
				});
			}
			updates[field] = value;
		}

		const nextCtcMin = updates.ctcMin ?? job.ctcMin;
		const nextCtcMax = updates.ctcMax ?? job.ctcMax;
		if (
			(updates.ctcMin !== undefined || updates.ctcMax !== undefined) &&
			nextCtcMin > nextCtcMax
		) {
			return res.status(400).json({
				message: "Minimum CTC cannot exceed maximum CTC",
			});
		}

		Object.assign(job, updates);
		await job.save();

		res.json(job);
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
				status: "open",
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

// PATCH /api/jobs/:id/reopen
router.patch(
	"/:id/reopen",
	protect,
	allow("recruiter"),
	wrap(async (req, res) => {
		const job = await Job.findOneAndUpdate(
			{
				_id: req.params.id,
				recruiter: req.user._id,
				status: "closed",
			},
			{ status: "open" },
			{ new: true, runValidators: true },
		);

		if (!job) {
			return res.status(404).json({
				message: "Closed job not found",
			});
		}

		res.json(job);
	}),
);

// DELETE /api/jobs/:id
// Archive the posting while preserving applications and their history.
router.delete(
	"/:id",
	protect,
	allow("recruiter"),
	wrap(async (req, res) => {
		const job = await Job.findOneAndUpdate(
			{
				_id: req.params.id,
				recruiter: req.user._id,
				status: { $in: ["open", "closed"] },
			},
			{ status: "archived" },
			{ new: true, runValidators: true },
		);

		if (!job) {
			return res.status(404).json({
				message: "Job not found",
			});
		}

		res.json({ message: "Job archived. Applicant records were preserved." });
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
		const notes = await RecruiterNote.find({
			application: { $in: validApps.map((app) => app._id) },
			recruiter: req.user._id,
		}).lean();

		const byUser = Object.fromEntries(
			profiles.map((p) => [String(p.userId), p]),
		);
		const noteByApplication = Object.fromEntries(
			notes.map((note) => [String(note.application), note.note]),
		);

		const list = validApps
			.map((a) => {
				const p = byUser[String(a.candidate._id)];

				return {
					...a,
					privateNote: noteByApplication[String(a._id)] || "",
					profile: p
						? {
								headline: p.headline,
								skills: p.skills,
								experienceYears: p.experienceYears,
								resume: p.resume
									? { originalName: p.resume.originalName }
									: null,
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
