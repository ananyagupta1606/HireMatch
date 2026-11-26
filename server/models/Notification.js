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
				"interview_scheduled",
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

notificationSchema.statics.pruneForRecipient = async function (recipient) {
	const keptRead = await this.find({
		recipient,
		readAt: { $ne: null },
	})
		.sort({ createdAt: -1 })
		.limit(5)
		.select("_id")
		.lean();

	await this.deleteMany({
		recipient,
		readAt: { $ne: null },
		_id: { $nin: keptRead.map((notification) => notification._id) },
	});
};

notificationSchema.post("save", async function (notification) {
	await notification.constructor.pruneForRecipient(notification.recipient);
});

module.exports = model("Notification", notificationSchema);
