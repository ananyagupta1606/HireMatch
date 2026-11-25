const router = require("express").Router();

const Application = require("../models/Application");
const Notification = require("../models/Notification");
const RecruiterNote = require("../models/RecruiterNote");
const Job = require("../models/Job");
const Profile = require("../models/CandidateProfile");

const wrap = require("../utils/wrap");
const { protect, allow } = require("../middleware/auth");
const { TRANSITIONS } = require("../utils/stages");
const { pipeline } = require("stream/promises");
const cloudinary = require("../services/cloudinary");

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

			await Notification.create({
				recipient: job.recruiter,
				type: "application_received",
				title: "New job application",
				message: `${req.user.name} applied for ${job.title}.`,
				link: `/dashboard/jobs/${job._id}`,
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

// GET /api/applications/:id/resume
// Recruiters can view resumes only for applicants to their own jobs.
router.get(
	"/:id/resume",
	protect,
	allow("recruiter"),
	wrap(async (req, res) => {
		const application = await Application.findById(req.params.id).populate(
			"job",
			"recruiter",
		);

		if (
			!application ||
			!application.job ||
			!application.job.recruiter.equals(req.user._id)
		) {
			return res.status(404).json({
				message: "Application not found",
			});
		}

		if (!cloudinary.isConfigured()) {
			return res.status(503).json({
				message: "Resume storage is not configured.",
			});
		}

		const profile = await Profile.findOne({
			userId: application.candidate,
		})
			.select("resume")
			.lean();
		const resume = profile?.resume;

		if (!resume?.publicId) {
			return res.status(404).json({
				message: "This candidate has not uploaded a resume.",
			});
		}

		res.type(resume.mimeType || "application/octet-stream");
		if (req.query.download === "true") {
			res.attachment(resume.originalName);
		} else {
			res.set("Content-Disposition", "inline");
		}
		if (resume.size) {
			res.set("Content-Length", String(resume.size));
		}

		await pipeline(await cloudinary.downloadResume(resume), res);
	}),
);

// PUT /api/applications/:id/private-note
// Recruiters can save private notes only for applicants to their own jobs.
router.put(
	"/:id/private-note",
	protect,
	allow("recruiter"),
	wrap(async (req, res) => {
		const application = await Application.findById(req.params.id).populate(
			"job",
			"recruiter",
		);

		if (
			!application ||
			!application.job ||
			!application.job.recruiter.equals(req.user._id)
		) {
			return res.status(404).json({
				message: "Application not found",
			});
		}

		if (typeof req.body.note !== "string" || req.body.note.length > 2000) {
			return res.status(400).json({
				message: "Private note must be text no longer than 2000 characters.",
			});
		}

		const note = req.body.note.trim();
		if (!note) {
			await RecruiterNote.deleteOne({
				application: application._id,
				recruiter: req.user._id,
			});
			return res.json({ note: "" });
		}

		const saved = await RecruiterNote.findOneAndUpdate(
			{ application: application._id, recruiter: req.user._id },
			{ note },
			{ new: true, upsert: true, runValidators: true, setDefaultsOnInsert: true },
		);

		res.json({ note: saved.note });
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
			"recruiter title",
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

		const interviewSet = stage === "interview";
		await Notification.create({
			recipient: app.candidate,
			type: interviewSet ? "interview_set" : "application_status",
			title: interviewSet ? "Interview stage set" : "Application status updated",
			message: interviewSet
				? `Your application for ${app.job.title} has moved to the interview stage.`
				: `Your application for ${app.job.title} has moved to ${stage}.`,
			link: "/applications",
		});

		res.json({
			_id: app._id,
			stage: app.stage,
			next: TRANSITIONS[app.stage] || [],
		});
	}),
);

module.exports = router;
