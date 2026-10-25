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
  const { headline, skills, experienceYears, expectedCtc } = req.body;
  const p = await Profile.findOneAndUpdate(
    { userId: req.user._id },
    { headline, skills: cleanSkills(skills), experienceYears: +experienceYears || 0, expectedCtc: +expectedCtc || 0 },
    { new: true, upsert: true, runValidators: true }
  );
  res.json(p);
}));
module.exports = router;
