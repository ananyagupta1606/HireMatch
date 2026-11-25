const { Schema, model } = require("mongoose");

const notificationSchema = new Schema(
	{
		recipient: {
			type: Schema.Types.ObjectId,
			ref: "User",
			required: true,
			index: true,
		},
		type: {
			type: String,
			enum: [
				"job_match",
				"application_received",
				"application_status",
				"interview_set",
			],
			required: true,
		},
		title: { type: String, required: true },
		message: { type: String, required: true },
		link: { type: String, required: true },
		readAt: { type: Date, default: null },
	},
	{ timestamps: true },
);

notificationSchema.index({ recipient: 1, createdAt: -1 });

module.exports = model("Notification", notificationSchema);
