const router = require('express').Router();
const crypto = require('crypto');
const path = require('path');
const { pipeline } = require('stream/promises');
const multer = require('multer');
const Profile = require('../models/CandidateProfile');
const { protect, allow } = require('../middleware/auth');
const wrap = require('../utils/wrap');
const cloudinary = require('../services/cloudinary');

const allowedResumeTypes = {
  '.pdf': 'application/pdf',
  '.doc': 'application/msword',
  '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
};

const uploadResume = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 5 * 1024 * 1024,
    files: 1,
    fields: 0,
    parts: 1,
  },
  fileFilter: (req, file, callback) => {
    const extension = path.extname(file.originalname).toLowerCase();
    if (allowedResumeTypes[extension] !== file.mimetype) {
      return callback(new Error('Select a PDF, DOC, or DOCX resume.'));
    }
    callback(null, true);
  },
});

const handleResumeUpload = (req, res, next) => {
  uploadResume.single('resume')(req, res, (err) => {
    if (err instanceof multer.MulterError) {
      return res.status(400).json({
        message: err.code === 'LIMIT_FILE_SIZE'
          ? 'Resume must be 5 MB or smaller.'
          : 'Invalid resume upload.',
      });
    }
    if (err) return res.status(400).json({ message: err.message });
    next();
  });
};

router.use(protect, allow('candidate'));

router.post('/', handleResumeUpload, wrap(async (req, res) => {
  if (!cloudinary.isConfigured()) {
    return res.status(503).json({
      message: 'Resume storage is not configured. Set the Cloudinary credentials on the server.',
    });
  }

  if (!req.file) {
    return res.status(400).json({
      message: 'Select a PDF, DOC, or DOCX resume to upload.',
    });
  }

  const extension = path.extname(req.file.originalname).toLowerCase();
  const originalName = path.basename(req.file.originalname);
  const publicId = `${req.user._id}-${crypto.randomUUID()}${extension}`;
  const previousProfile = await Profile.findOne({ userId: req.user._id })
    .select('resume')
    .lean();
  const uploaded = await cloudinary.uploadResume(req.file, publicId);

  try {
    const profile = await Profile.findOneAndUpdate(
      { userId: req.user._id },
      {
        resume: {
          publicId: uploaded.public_id,
          originalName,
          mimeType: req.file.mimetype,
          size: uploaded.bytes,
          uploadedAt: new Date(uploaded.created_at),
        },
      },
      { new: true, upsert: true, runValidators: true },
    );

    if (previousProfile?.resume?.publicId) {
      cloudinary.deleteResume(previousProfile.resume.publicId)
        .catch((err) => console.error('Could not remove replaced Cloudinary resume:', err));
    }

    return res.json({ resume: profile.resume });
  } catch (err) {
    await cloudinary.deleteResume(uploaded.public_id)
      .catch((cleanupErr) => console.error('Could not remove failed Cloudinary resume upload:', cleanupErr));
    throw err;
  }
}));

router.get('/', wrap(async (req, res) => {
  if (!cloudinary.isConfigured()) {
    return res.status(503).json({
      message: 'Resume storage is not configured. Set the Cloudinary credentials on the server.',
    });
  }

  const profile = await Profile.findOne({ userId: req.user._id }).select('resume').lean();
  const resume = profile?.resume;

  if (!resume?.publicId) {
    return res.status(404).json({ message: 'No resume has been uploaded.' });
  }

  res.type(resume.mimeType || 'application/octet-stream');
  res.attachment(resume.originalName);
  if (resume.size) res.set('Content-Length', String(resume.size));
  await pipeline(await cloudinary.downloadResume(resume), res);
}));

module.exports = router;
