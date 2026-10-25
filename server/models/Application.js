const { Schema, model } = require('mongoose');
const appSchema = new Schema({
  job: { type: Schema.Types.ObjectId, ref: 'Job', required: true },
  candidate: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  coverNote: { type: String, default: '' },
  stage: { type: String, enum: ['applied', 'shortlisted', 'interview', 'offered', 'rejected'], default: 'applied' },
  stageHistory: [{ stage: String, at: { type: Date, default: Date.now }, _id: false }],
}, { timestamps: true });

// DB-level duplicate protection (safer than find-then-insert)
appSchema.index({ job: 1, candidate: 1 }, { unique: true });
module.exports = model('Application', appSchema);
