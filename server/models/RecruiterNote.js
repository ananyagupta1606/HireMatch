const { Schema, model } = require('mongoose');

const recruiterNoteSchema = new Schema(
  {
    application: {
      type: Schema.Types.ObjectId,
      ref: 'Application',
      unique: true,
      required: true,
    },
    recruiter: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    note: {
      type: String,
      maxlength: 2000,
      default: '',
    },
  },
  { timestamps: true },
);

module.exports = model('RecruiterNote', recruiterNoteSchema);
