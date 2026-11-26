const router = require('express').Router();
const Profile = require('../models/CandidateProfile');
const wrap = require('../utils/wrap');
const { protect, allow } = require('../middleware/auth');
const { cleanSkills } = require('../utils/match');

router.use(protect, allow('candidate'));

router.get('/me', wrap(async (req, res) => {
  const p = await Profile.findOne({ userId: req.user._id });
  res.json(p || { headline: '', skills: [], experienceYears: 0, expectedCtc: 0 });
}));

router.put('/me', wrap(async (req, res) => {
  const { headline, skills, experienceYears, expectedCtc, preferredLocation } = req.body;
  if (preferredLocation !== undefined && typeof preferredLocation !== 'string') {
    return res.status(400).json({ message: 'Preferred location must be text' });
  }
  if (preferredLocation?.trim().length > 100) {
    return res.status(400).json({ message: 'Preferred location must be 100 characters or fewer' });
  }

  const updates = {
    headline,
    skills: cleanSkills(skills),
    experienceYears: +experienceYears || 0,
    expectedCtc: +expectedCtc || 0,
  };
  if (preferredLocation !== undefined) {
    updates.preferredLocation = preferredLocation.trim();
  }

  const p = await Profile.findOneAndUpdate(
    { userId: req.user._id },
    updates,
    { new: true, upsert: true, runValidators: true }
  );
  res.json(p);
}));

module.exports = router;
