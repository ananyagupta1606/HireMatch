const { Schema, model } = require('mongoose');
const jobSchema = new Schema({
  recruiter: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  company: { type: String, required: true },
  title: { type: String, required: true, trim: true },
  description: { type: String, required: true },
  skills: { type: [String], default: [] }, // stored lowercase
  location: { type: String, required: true },
  workMode: { type: String, enum: ['onsite', 'remote', 'hybrid'], default: 'onsite' },
  minExp: { type: Number, default: 0 },
  ctcMin: { type: Number, default: 0 }, // LPA
  ctcMax: { type: Number, default: 0 },
  status: { type: String, enum: ['open', 'closed'], default: 'open' },
}, { timestamps: true });

// Compound index for the main search: equality fields first, then range, then sort
jobSchema.index({ status: 1, workMode: 1, minExp: 1, createdAt: -1 });
jobSchema.index({ status: 1, skills: 1 });
module.exports = model('Job', jobSchema);
