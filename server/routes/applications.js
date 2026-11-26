const router = require("express").Router();

const Application = require("../models/Application");
const Notification = require("../models/Notification");
const RecruiterNote = require("../models/RecruiterNote");
const Job = require("../models/Job");
const Profile = require("../models/CandidateProfile");
const User = require("../models/User");

const wrap = require("../utils/wrap");
const { protect, allow } = require("../middleware/auth");
const { TRANSITIONS } = require("../utils/stages");
const { pipeline } = require("stream/promises");
const cloudinary = require("../services/cloudinary");
const INTERVIEW_DURATIONS = [15, 30, 45, 60, 90, 120];
const RECRUITER_APPLICATION_PAGE_SIZE = 10;
const APPLICATION_STAGES = [
	"applied",
	"shortlisted",
	"interview",
	"offered",
	"rejected",
	"withdrawn",
];

const normalizeInterviewDetails = (details, defaultMode = "online") => {
	if (!details || typeof details !== "object" || Array.isArray(details)) {
		return null;
	}

	const mode = details.mode ?? defaultMode;
	if (!["online", "offline"].includes(mode)) {
		return null;
	}

	const normalized = {};
	for (const [field, maxLength] of [
		["location", 300],
		["meetingLink", 500],
		["instructions", 2000],
	]) {
		const value = details[field] ?? "";
		if (typeof value !== "string" || value.length > maxLength) {
			return null;
		}
		normalized[field] = value.trim();
	}
	normalized.mode = mode;

	if (normalized.meetingLink) {
		try {
			const url = new URL(normalized.meetingLink);
			if (!["http:", "https:"].includes(url.protocol)) return null;
		} catch {
			return null;
		}
	}

	return normalized;
};

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
				$unset: {
					interviewAt: 1,
					interviewDetails: 1,
					interviewConcern: 1,
				},
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

// GET /api/applications/recruiter
// Return applications across the logged-in recruiter's jobs.
router.get(
	"/recruiter",
	protect,
	allow("recruiter"),
	wrap(async (req, res) => {
		const jobs = await Job.find({ recruiter: req.user._id }).select("_id").lean();
		const jobIds = jobs.map((job) => job._id);
		const requestedPage = req.query.page === undefined ? 1 : Number(req.query.page);
		if (!Number.isSafeInteger(requestedPage) || requestedPage < 1) {
			return res.status(400).json({ message: "Page must be a positive integer." });
		}
		const page = requestedPage;
		const requestedView = req.query.view === undefined ? "all" : req.query.view;
		if (
			typeof requestedView !== "string"
			|| !["all", "scheduled", ...APPLICATION_STAGES].includes(requestedView)
		) {
			return res.status(400).json({ message: "Invalid application view." });
		}
		const view = requestedView;
		const requestedSearch = req.query.search === undefined ? "" : req.query.search;
		if (typeof requestedSearch !== "string" || requestedSearch.length > 100) {
			return res.status(400).json({ message: "Search must be 100 characters or fewer." });
		}
		const search = requestedSearch.trim();
		const escapedSearch = search.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
		const viewMatch = view === "scheduled"
			? { stage: "interview", interviewAt: { $exists: true, $ne: null } }
			: view === "all" ? null : { stage: view };
		const viewPipeline = viewMatch ? [{ $match: viewMatch }] : [];

		if (jobIds.length === 0) {
			return res.json({
				applications: [],
				counts: { all: 0, scheduled: 0, ...Object.fromEntries(APPLICATION_STAGES.map((stage) => [stage, 0])) },
				total: 0,
				allCount: 0,
				page,
				pageSize: RECRUITER_APPLICATION_PAGE_SIZE,
				totalPages: 0,
			});
		}

		const basePipeline = [
			{ $match: { job: { $in: jobIds } } },
			{
				$lookup: {
					from: User.collection.name,
					localField: "candidate",
					foreignField: "_id",
					as: "candidate",
				},
			},
			{ $unwind: "$candidate" },
			{
				$lookup: {
					from: Job.collection.name,
					localField: "job",
					foreignField: "_id",
					as: "job",
				},
			},
			{ $unwind: "$job" },
			{
				$set: {
					candidate: {
						_id: "$candidate._id",
						name: "$candidate.name",
						email: "$candidate.email",
					},
					job: {
						_id: "$job._id",
						title: "$job.title",
						location: "$job.location",
					},
				},
			},
		];

		if (escapedSearch) {
			basePipeline.push({
				$match: {
					$or: [
						{ "candidate.name": { $regex: escapedSearch, $options: "i" } },
						{ "candidate.email": { $regex: escapedSearch, $options: "i" } },
						{ "job.title": { $regex: escapedSearch, $options: "i" } },
					],
				},
			});
		}

		const [result, allCount] = await Promise.all([
			Application.aggregate([
				...basePipeline,
				{
					$facet: {
						applications: [
							...viewPipeline,
							{
								$sort: view === "scheduled"
									? { interviewAt: 1, _id: 1 }
									: { createdAt: -1, _id: -1 },
							},
							{ $skip: (page - 1) * RECRUITER_APPLICATION_PAGE_SIZE },
							{ $limit: RECRUITER_APPLICATION_PAGE_SIZE },
						],
						total: [...viewPipeline, { $count: "value" }],
						stageCounts: [
							{ $group: { _id: "$stage", count: { $sum: 1 } } },
						],
						scheduledCount: [
							{ $match: { stage: "interview", interviewAt: { $exists: true, $ne: null } } },
							{ $count: "value" },
						],
					},
				},
			]),
			Application.countDocuments({ job: { $in: jobIds } }),
		]);

		const aggregated = result[0];
		const counts = Object.fromEntries(APPLICATION_STAGES.map((stage) => [stage, 0]));
		for (const { _id, count } of aggregated.stageCounts) {
			if (APPLICATION_STAGES.includes(_id)) counts[_id] = count;
		}
		counts.all = Object.values(counts).reduce((sum, count) => sum + count, 0);
		counts.scheduled = aggregated.scheduledCount[0]?.value || 0;

		const profiles = await Profile.find({
			userId: { $in: aggregated.applications.map((application) => application.candidate._id) },
		})
			.select("userId headline experienceYears skills")
			.lean();
		const profileByCandidate = Object.fromEntries(
			profiles.map((profile) => [String(profile.userId), profile]),
		);
		const applications = aggregated.applications.map((application) => ({
			...application,
			candidateProfile: profileByCandidate[String(application.candidate._id)] || null,
		}));
		const total = aggregated.total[0]?.value || 0;

		res.json({
			applications,
			counts,
			total,
			allCount,
			page,
			pageSize: RECRUITER_APPLICATION_PAGE_SIZE,
			totalPages: Math.ceil(total / RECRUITER_APPLICATION_PAGE_SIZE),
		});
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
				$unset: {
					interviewAt: 1,
					interviewDetails: 1,
				},
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
			interviewDetails: withdrawnApplication.interviewDetails || null,
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

		const previousDetails = {
			mode:
				app.interviewDetails?.mode ||
				(app.interviewDetails?.meetingLink
					? "online"
					: app.interviewDetails?.location
						? "offline"
						: "online"),
			location: app.interviewDetails?.location || "",
			meetingLink: app.interviewDetails?.meetingLink || "",
			instructions: app.interviewDetails?.instructions || "",
		};
		let nextDetails = previousDetails;
		if (Object.hasOwn(req.body, "interviewDetails")) {
			nextDetails = normalizeInterviewDetails(
				req.body.interviewDetails,
				previousDetails.mode,
			);
			if (!nextDetails) {
				return res.status(400).json({
					message: "Interview details are invalid or exceed their character limits.",
				});
			}
		}

		const nextDuration = Object.hasOwn(req.body, "interviewDurationMinutes")
			? req.body.interviewDurationMinutes
			: app.interviewDurationMinutes || 60;
		if (!INTERVIEW_DURATIONS.includes(nextDuration)) {
			return res.status(400).json({
				message: "Choose a valid interview duration.",
			});
		}

		const nextTime = nextInterviewAt?.getTime() ?? null;
		const detailsChanged =
			JSON.stringify(previousDetails) !== JSON.stringify(nextDetails);
		const durationChanged =
			(app.interviewDurationMinutes || 60) !== nextDuration;
		if (
			previousTime === nextTime &&
			(!nextInterviewAt || (!detailsChanged && !durationChanged))
		) {
			return res.json({
				interviewAt: app.interviewAt || null,
				interviewDurationMinutes: app.interviewDurationMinutes || 60,
				interviewDetails: app.interviewDetails || null,
			});
		}

		app.interviewAt = nextInterviewAt || undefined;
		if (nextInterviewAt) {
			app.interviewDetails = nextDetails;
			app.interviewDurationMinutes = nextDuration;
		} else {
			app.interviewDetails = undefined;
		}
		await app.save();

		const action = !nextInterviewAt
			? "cancelled"
			: !previousTime
				? "scheduled"
				: previousTime !== nextTime
					? "rescheduled"
					: "updated";
		await Notification.create({
			recipient: app.candidate,
			type: "interview_scheduled",
			title: `Interview ${action}`,
			message: nextInterviewAt
				? `Your interview for ${app.job.title} was ${action}. View the details in My Applications.`
				: `Your interview for ${app.job.title} was cancelled.`,
			link: "/applications",
		});

		res.json({
			interviewAt: app.interviewAt || null,
			interviewDurationMinutes: app.interviewDurationMinutes || 60,
			interviewDetails: app.interviewDetails || null,
		});
	}),
);

// Candidates can report a scheduling conflict for their own scheduled interview.
router.post(
	"/:id/interview-concern",
	protect,
	allow("candidate"),
	wrap(async (req, res) => {
		const app = await Application.findOne({
			_id: req.params.id,
			candidate: req.user._id,
		}).populate("job", "recruiter title");

		if (!app || !app.job) {
			return res.status(404).json({ message: "Application not found" });
		}
		if (app.stage !== "interview" || !app.interviewAt) {
			return res.status(400).json({
				message: "A conflict can only be reported for a scheduled interview.",
			});
		}

		const message =
			typeof req.body?.message === "string" ? req.body.message.trim() : "";
		if (!message || message.length > 1000) {
			return res.status(400).json({
				message: "Please describe the conflict in 1,000 characters or fewer.",
			});
		}

		let preferredAt;
		if (req.body?.preferredAt) {
			if (typeof req.body.preferredAt !== "string") {
				return res.status(400).json({
					message: "The preferred time must be valid.",
				});
			}
			preferredAt = new Date(req.body.preferredAt);
			if (
				Number.isNaN(preferredAt.getTime()) ||
				preferredAt.getTime() <= Date.now()
			) {
				return res.status(400).json({
					message: "Choose a preferred time in the future.",
				});
			}
		}

		app.interviewConcern = {
			message,
			preferredAt,
			status: "pending",
			createdAt: new Date(),
			resolvedAt: undefined,
		};
		await app.save();

		await Notification.create({
			recipient: app.job.recruiter,
			type: "interview_concern",
			title: "Candidate reported an interview conflict",
			message: `${req.user.name} reported a scheduling conflict for ${app.job.title}.`,
			link: `/dashboard/jobs/${app.job._id}`,
		});

		res.status(201).json({ interviewConcern: app.interviewConcern });
	}),
);

// Recruiters can mark a candidate's interview concern as addressed.
router.patch(
	"/:id/interview-concern/resolve",
	protect,
	allow("recruiter"),
	wrap(async (req, res) => {
		const app = await Application.findById(req.params.id).populate(
			"job",
			"recruiter title",
		);

		if (!app || !app.job || !app.job.recruiter.equals(req.user._id)) {
			return res.status(404).json({ message: "Application not found" });
		}
		if (!app.interviewConcern || app.interviewConcern.status !== "pending") {
			return res.status(400).json({
				message: "There is no pending interview concern to resolve.",
			});
		}

		app.interviewConcern.status = "resolved";
		app.interviewConcern.resolvedAt = new Date();
		await app.save();

		await Notification.create({
			recipient: app.candidate,
			type: "interview_concern",
			title: "Interview concern reviewed",
			message: `The recruiter reviewed your interview concern for ${app.job.title}.`,
			link: "/applications",
		});

		res.json({ interviewConcern: app.interviewConcern });
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
			app.interviewDetails = undefined;
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
