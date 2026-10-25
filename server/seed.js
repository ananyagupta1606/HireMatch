require('dotenv').config();
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const User = require('./models/User');
const Job = require('./models/Job');
const Profile = require('./models/CandidateProfile');
const Application = require('./models/Application');

const jobs = [
  ['MERN Stack Developer', 'Build dashboards and REST APIs for our hiring tools.', ['react', 'node', 'mongodb', 'express'], 'Bengaluru', 'hybrid', 1, 8, 14],
  ['Frontend Developer', 'Own the component library and ship polished UI.', ['react', 'css', 'javascript', 'tailwind'], 'Chandigarh', 'remote', 0, 4, 8],
  ['Backend Engineer', 'Design scalable APIs and background workers.', ['node', 'express', 'mongodb', 'redis'], 'Pune', 'onsite', 2, 10, 18],
  ['Full Stack Intern', 'Learn by shipping real features with a mentor.', ['javascript', 'react', 'node'], 'Mohali', 'onsite', 0, 2, 4],
  ['React Native Developer', 'Build our candidate mobile app.', ['react', 'javascript', 'redux'], 'Hyderabad', 'hybrid', 2, 9, 16],
  ['DevOps Engineer', 'CI/CD, Docker and cloud deployments.', ['docker', 'aws', 'linux', 'node'], 'Gurugram', 'onsite', 3, 12, 22],
  ['UI/UX Developer', 'Turn Figma designs into accessible interfaces.', ['css', 'javascript', 'react', 'figma'], 'Remote', 'remote', 1, 5, 9],
  ['Node.js Developer', 'Maintain payment and notification services.', ['node', 'mongodb', 'jwt', 'express'], 'Noida', 'hybrid', 1, 6, 12],
  ['Data Analyst', 'Build funnel reports for recruiters.', ['sql', 'python', 'excel'], 'Mumbai', 'onsite', 0, 4, 8],
  ['Senior MERN Developer', 'Lead a squad, review code, mentor juniors.', ['react', 'node', 'mongodb', 'typescript', 'aws'], 'Bengaluru', 'hybrid', 4, 18, 30],
];

(async () => {
  await mongoose.connect(process.env.MONGO_URI);
  await Promise.all([User.deleteMany(), Job.deleteMany(), Profile.deleteMany(), Application.deleteMany()]);
  const passwordHash = await bcrypt.hash('demo1234', 10);
  const rec = await User.create({ name: 'Riya Recruiter', email: 'recruiter@demo.com', role: 'recruiter', company: 'Nimbus Labs', passwordHash });
  const cand = await User.create({ name: 'Arjun Candidate', email: 'candidate@demo.com', role: 'candidate', passwordHash });
  await Profile.create({ userId: cand._id, headline: 'Final-year CS student, MERN enthusiast', skills: ['react', 'node', 'javascript', 'css'], experienceYears: 0, expectedCtc: 6 });
  const created = await Job.insertMany(jobs.map(([title, description, skills, location, workMode, minExp, ctcMin, ctcMax]) =>
    ({ recruiter: rec._id, company: 'Nimbus Labs', title, description, skills, location, workMode, minExp, ctcMin, ctcMax })));
  await Application.create({ job: created[1]._id, candidate: cand._id, coverNote: 'Love building UIs!', stageHistory: [{ stage: 'applied' }] });
  console.log('Seeded. Logins -> recruiter@demo.com / candidate@demo.com  (password: demo1234)');
  process.exit(0);
})();
