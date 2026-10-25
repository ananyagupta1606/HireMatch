const router = require('express').Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const wrap = require('../utils/wrap');
const { protect } = require('../middleware/auth');

const sign = (u) => jwt.sign({ id: u._id }, process.env.JWT_SECRET, { expiresIn: '7d' });
const pub = (u) => ({ id: u._id, name: u.name, email: u.email, role: u.role, company: u.company });

router.post('/register', wrap(async (req, res) => {
  const { name, email, password, role, company } = req.body;
  if (!name || !email || !password || password.length < 6)
    return res.status(400).json({ message: 'Name, email and a 6+ character password are required' });
  if (!['candidate', 'recruiter'].includes(role)) return res.status(400).json({ message: 'Choose candidate or recruiter' });
  if (role === 'recruiter' && !company) return res.status(400).json({ message: 'Company name is required for recruiters' });
  if (await User.findOne({ email: email.toLowerCase() })) return res.status(409).json({ message: 'Email already registered' });
  const user = await User.create({
    name, email, role, company: role === 'recruiter' ? company : undefined,
    passwordHash: await bcrypt.hash(password, 10),
  });
  res.status(201).json({ token: sign(user), user: pub(user) });
}));

router.post('/login', wrap(async (req, res) => {
  const { email, password } = req.body;
  const user = await User.findOne({ email: (email || '').toLowerCase() });
  if (!user || !(await bcrypt.compare(password || '', user.passwordHash)))
    return res.status(401).json({ message: 'Wrong email or password' });
  res.json({ token: sign(user), user: pub(user) });
}));

router.get('/me', protect, (req, res) => res.json({ user: pub(req.user) }));
module.exports = router;
