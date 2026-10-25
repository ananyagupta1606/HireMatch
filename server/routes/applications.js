const router = require('express').Router();
const Application = require('../models/Application');
const Job = require('../models/Job');
const wrap = require('../utils/wrap');
const { protect, allow } = require('../middleware/auth');
const { TRANSITIONS } = require('../utils/stages');

router.post('/', protect, allow('candidate'), wrap(async (req, res) => {
  const { jobId, coverNote } = req.body;
  const job = await Job.findById(jobId);
  if (!job || job.status !== 'open') return res.status(400).json({ message: 'This job is not open' });
  try {
    const app = await Application.create({
      job: job._id, candidate: req.user._id, coverNote: (coverNote || '').slice(0, 1000),
      stageHistory: [{ stage: 'applied' }],
    });
    res.status(201).json(app);
  } catch (e) {
    if (e.code === 11000) return res.status(409).json({ message: 'You already applied to this job' });
    throw e;
  }
}));

router.get('/me', protect, allow('candidate'), wrap(async (req, res) => {
  const apps = await Application.find({ candidate: req.user._id })
    .sort({ createdAt: -1 }).populate('job', 'title company location workMode status').lean();
  res.json(apps);
}));

// Recruiter moves an applicant; server enforces ownership + valid transition
router.patch('/:id/stage', protect, allow('recruiter'), wrap(async (req, res) => {
  const app = await Application.findById(req.params.id).populate('job', 'recruiter');
  if (!app || !app.job.recruiter.equals(req.user._id)) return res.status(404).json({ message: 'Application not found' });
  const { stage } = req.body;
  if (!TRANSITIONS[app.stage].includes(stage))
    return res.status(400).json({ message: `Cannot move from ${app.stage} to ${stage}` });
  app.stage = stage;
  app.stageHistory.push({ stage });
  await app.save();
  res.json({ _id: app._id, stage: app.stage, next: TRANSITIONS[app.stage] });
}));
module.exports = router;
