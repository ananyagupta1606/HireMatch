const { Schema, model } = require("mongoose");
module.exports = model(
	"CandidateProfile",
	new Schema(
		{
			userId: {
				type: Schema.Types.ObjectId,
				ref: "User",
				unique: true,
				required: true,
			},
			headline: { type: String, default: "" },
			skills: { type: [String], index: true, default: [] }, // stored lowercase
			experienceYears: { type: Number, default: 0 },
			expectedCtc: { type: Number, default: 0 }, // LPA
			resume: {
				type: new Schema(
					{
						publicId: { type: String, required: true },
						originalName: { type: String, required: true },
						mimeType: { type: String, required: true },
						size: { type: Number, required: true },
						uploadedAt: { type: Date, default: Date.now },
					},
					{ _id: false },
				),
				default: undefined,
			},
		},
		{ timestamps: true },
	),
);
