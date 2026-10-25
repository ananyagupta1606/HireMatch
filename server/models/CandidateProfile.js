const { Schema, model } = require('mongoose');
module.exports = model('CandidateProfile', new Schema({
  userId: { type: Schema.Types.ObjectId, ref: 'User', unique: true, required: true },
  headline: { type: String, default: '' },
  skills: { type: [String], index: true, default: [] }, // stored lowercase
  experienceYears: { type: Number, default: 0 },
  expectedCtc: { type: Number, default: 0 }, // LPA
}, { timestamps: true }));
