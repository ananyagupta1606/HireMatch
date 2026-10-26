const { Schema, model } = require("mongoose");

const userSchema = new Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
    },

    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
    },

    // Optional for users who authenticate exclusively with Google.
    passwordHash: {
      type: String,
      required: false,
      select: false,
    },

    // Google account identifier.
    googleId: {
      type: String,
      unique: true,
      sparse: true,
    },

    role: {
      type: String,
      enum: ["candidate", "recruiter"],
      required: true,
      default: "candidate",
    },

    company: {
      type: String,
      trim: true,
    },
  },
  { timestamps: true }
);

module.exports = model("User", userSchema);
