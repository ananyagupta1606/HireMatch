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

		const applicationCoverNote =
			typeof coverNote === "string" ? coverNote.slice(0, 1000) : "";
		const reactivated = await Application.findOneAndUpdate(
			{
				job: job._id,
				candidate: req.user._id,
				stage: "withdrawn",
			},
			{
				$set: {
					stage: "applied",
					coverNote: applicationCoverNote,
				},
				$unset: { interviewAt: 1 },
				$push: {
					stageHistory: { stage: "applied", at: new Date() },
				},
			},
			{ new: true, runValidators: true },
		);

		if (reactivated) {
			await Notification.create({
				recipient: job.recruiter,
				type: "application_received",
				title: "Candidate reapplied",
				message: `${req.user.name} reapplied for ${job.title}.`,
				link: `/dashboard/jobs/${job._id}`,
			});

			return res.status(200).json(reactivated);
		}

		try {
			const app = await Application.create({
				job: job._id,
				candidate: req.user._id,
				coverNote: applicationCoverNote,
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

// PATCH /api/applications/:id/withdraw
// Candidates can withdraw applications that are still in progress.
router.patch(
	"/:id/withdraw",
	protect,
	allow("candidate"),
	wrap(async (req, res) => {
		const application = await Application.findOne({
			_id: req.params.id,
			candidate: req.user._id,
		}).populate("job", "recruiter title");

		if (!application || !application.job) {
			return res.status(404).json({
				message: "Application not found",
			});
		}

		if (!["applied", "shortlisted", "interview"].includes(application.stage)) {
			return res.status(400).json({
				message: "Only active applications can be withdrawn.",
			});
		}

		const withdrawnApplication = await Application.findOneAndUpdate(
			{
				_id: application._id,
				candidate: req.user._id,
				stage: application.stage,
			},
			{
				$set: { stage: "withdrawn" },
				$unset: { interviewAt: 1 },
				$push: {
					stageHistory: { stage: "withdrawn", at: new Date() },
				},
			},
			{ new: true, runValidators: true },
		).populate("job", "recruiter title");

		if (!withdrawnApplication) {
			return res.status(409).json({
				message: "Application status changed. Refresh and try again.",
			});
		}

		await Notification.create({
			recipient: withdrawnApplication.job.recruiter,
			type: "application_status",
			title: "Application withdrawn",
			message: `${req.user.name} withdrew their application for ${withdrawnApplication.job.title}.`,
			link: `/dashboard/jobs/${withdrawnApplication.job._id}`,
		});

		res.json({
			_id: withdrawnApplication._id,
			stage: withdrawnApplication.stage,
			interviewAt: withdrawnApplication.interviewAt || null,
		});
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

// PATCH /api/applications/:id/interview
// Recruiters can schedule interviews for applicants in the interview stage.
router.patch(
	"/:id/interview",
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

		if (app.stage !== "interview") {
			return res.status(400).json({
				message: "Move this application to the interview stage first.",
			});
		}

		if (!req.body || !Object.hasOwn(req.body, "interviewAt")) {
			return res.status(400).json({
				message: "Interview date and time are required.",
			});
		}

		const previousTime = app.interviewAt
			? new Date(app.interviewAt).getTime()
			: null;
		let nextInterviewAt = null;

		if (req.body.interviewAt !== null && req.body.interviewAt !== "") {
			if (typeof req.body.interviewAt !== "string") {
				return res.status(400).json({
					message: "Interview date and time must be valid.",
				});
			}

			nextInterviewAt = new Date(req.body.interviewAt);
			if (
				Number.isNaN(nextInterviewAt.getTime()) ||
				nextInterviewAt.getTime() <= Date.now()
			) {
				return res.status(400).json({
					message: "Choose an interview time in the future.",
				});
			}
		}

		const nextTime = nextInterviewAt?.getTime() ?? null;
		if (previousTime === nextTime) {
			return res.json({ interviewAt: app.interviewAt || null });
		}

		app.interviewAt = nextInterviewAt || undefined;
		await app.save();

		const action = nextInterviewAt
			? previousTime
				? "rescheduled"
				: "scheduled"
			: "cancelled";
		await Notification.create({
			recipient: app.candidate,
			type: "interview_scheduled",
			title: `Interview ${action}`,
			message: nextInterviewAt
				? `Your interview for ${app.job.title} was ${action}. View the updated time in My Applications.`
				: `Your interview for ${app.job.title} was cancelled.`,
			link: "/applications",
		});

		res.json({ interviewAt: app.interviewAt || null });
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
		if (stage !== "interview") {
			app.interviewAt = undefined;
		}
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
