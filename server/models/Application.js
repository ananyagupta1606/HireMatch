const { Schema, model } = require("mongoose");
const interviewDetailsSchema = new Schema(
	{
		mode: { type: String, enum: ["online", "offline"], default: undefined },
		location: { type: String, trim: true, maxlength: 300, default: "" },
		meetingLink: { type: String, trim: true, maxlength: 500, default: "" },
		instructions: { type: String, trim: true, maxlength: 2000, default: "" },
	},
	{ _id: false },
);
const interviewConcernSchema = new Schema(
	{
		message: { type: String, required: true, trim: true, maxlength: 1000 },
		preferredAt: { type: Date, default: undefined },
		status: { type: String, enum: ["pending", "resolved"], default: "pending" },
		createdAt: { type: Date, default: Date.now },
		resolvedAt: { type: Date, default: undefined },
	},
	{ _id: false },
);

const appSchema = new Schema(
	{
		job: { type: Schema.Types.ObjectId, ref: "Job", required: true },
		candidate: { type: Schema.Types.ObjectId, ref: "User", required: true },
		coverNote: { type: String, default: "" },
		stage: {
			type: String,
			enum: [
				"applied",
				"shortlisted",
				"interview",
				"offered",
				"rejected",
				"withdrawn",
			],
			default: "applied",
		},
		interviewAt: { type: Date, default: undefined },
		interviewDurationMinutes: {
			type: Number,
			enum: [15, 30, 45, 60, 90, 120],
			default: 60,
		},
		interviewDetails: { type: interviewDetailsSchema, default: undefined },
		interviewConcern: { type: interviewConcernSchema, default: undefined },
		stageHistory: [
    {
        stage: String,
        at: { type: Date, default: Date.now },
        _id: false,
    },
],
	},
	{ timestamps: true },
);

// DB-level duplicate protection (safer than find-then-insert)
appSchema.index({ job: 1, candidate: 1 }, { unique: true });
module.exports = model("Application", appSchema);
