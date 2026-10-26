const router = require("express").Router();

const Application = require("../models/Application");
const Job = require("../models/Job");
const Profile = require("../models/CandidateProfile");

const wrap = require("../utils/wrap");
const { protect, allow } = require("../middleware/auth");
const { TRANSITIONS } = require("../utils/stages");

// POST /api/applications
// Candidates can apply only if they meet the job's experience requirement.
router.post(
	"/",
	protect,
	allow("candidate"),
	wrap(async (req, res) => {
		const { jobId, coverNote } = req.body;

		if (!jobId) {
			return res.status(400).json({
				message: "Job ID is required",
			});
		}

		const job = await Job.findById(jobId);

		if (!job || job.status !== "open") {
			return res.status(400).json({
				message: "This job is not open",
			});
		}

		// Retrieve the candidate's saved profile.
		const profile = await Profile.findOne({
			userId: req.user._id,
		}).lean();

		// Treat missing experience as zero years.
		const candidateExperience = Number(profile?.experienceYears ?? 0);

		const requiredExperience = Number(job.minExp ?? 0);

		// Enforce eligibility on the server, not just the frontend.
		if (candidateExperience < requiredExperience) {
			return res.status(403).json({
				message: `You need at least ${requiredExperience} year(s) of experience to apply. Your profile currently shows ${candidateExperience} year(s). Please update your profile if your experience information is incorrect.`,
				eligibleByExperience: false,
				candidateExperience,
				requiredExperience,
			});
		}

		try {
			const app = await Application.create({
				job: job._id,
				candidate: req.user._id,
				coverNote: (coverNote || "").slice(0, 1000),
				stageHistory: [{ stage: "applied" }],
			});

			return res.status(201).json(app);
		} catch (e) {
			if (e.code === 11000) {
				return res.status(409).json({
					message: "You already applied to this job",
				});
			}

			throw e;
		}
	}),
);

// GET /api/applications/me
// Return the logged-in candidate's applications.
router.get(
	"/me",
	protect,
	allow("candidate"),
	wrap(async (req, res) => {
		const apps = await Application.find({
			candidate: req.user._id,
		})
			.sort({ createdAt: -1 })
			.populate("job", "title company location workMode status minExp")
			.lean();

		res.json(apps);
	}),
);

// PATCH /api/applications/:id/stage
// Recruiters can update application stages only for their own jobs.
router.patch(
	"/:id/stage",
	protect,
	allow("recruiter"),
	wrap(async (req, res) => {
		const app = await Application.findById(req.params.id).populate(
			"job",
			"recruiter",
		);

		if (!app || !app.job || !app.job.recruiter.equals(req.user._id)) {
			return res.status(404).json({
				message: "Application not found",
			});
		}

		const { stage } = req.body;

		if (
			!TRANSITIONS[app.stage] ||
			!TRANSITIONS[app.stage].includes(stage)
		) {
			return res.status(400).json({
				message: `Cannot move from ${app.stage} to ${stage}`,
			});
		}

		app.stage = stage;
		app.stageHistory.push({ stage });

		await app.save();

		res.json({
			_id: app._id,
			stage: app.stage,
			next: TRANSITIONS[app.stage] || [],
		});
	}),
);

module.exports = router;
