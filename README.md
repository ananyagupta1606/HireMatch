# HireMatch — Job Portal & Applicant Tracking

HireMatch is a MERN-based job portal connecting candidates and recruiters. Its key feature, the **Skill Match Ring**, shows candidates their skill-match percentage and missing skills, while helping recruiters rank applicants by compatibility.

##  Features

- **Authentication:** JWT-based login and role-based access (Candidate / Recruiter).
- **Candidate Profiles:** Manage skills and experience.
- **Smart Job Search:** Filter by title, location, work mode, experience, CTC, and skills, with pagination.
- **Skill Match Ring:** View match scores and skill gaps.
- **Job Management:** Recruiters can post and close jobs, with ownership checks.
- **Applications:** Apply for jobs, prevent duplicate applications, and track application status.
- **Recruiter Dashboard:** View and rank applicants by skill-match score.
- **Stage Management:** Server-side validation of application stage transitions.

##  Tech Stack

**MongoDB · Express.js · React · Node.js · JWT · Vite**

##  Getting Started

**Prerequisites:** Node.js 18+ and MongoDB (local or Atlas).

### 1. Backend

```bash
cd server
npm install
```

Configure `server/.env` with your MongoDB connection string (`MONGO_URI`) and required secrets.

```bash
npm run seed
npm run dev
```

API: `http://localhost:4000`

### 2. Frontend

In a new terminal:

```bash
cd client
npm install
npm run dev
```

Frontend: `http://localhost:5173`

##  Demo Accounts

Both accounts use password `demo1234`.

| Role | Email |
|---|---|
| Candidate | `candidate@demo.com` |
| Recruiter | `recruiter@demo.com` |

Run the seed script before using these accounts.

##  API Overview

| Method | Endpoint | Access |
|---|---|---|
| POST | `/api/auth/register` | Public |
| POST | `/api/auth/login` | Public |
| GET / PUT | `/api/profile/me` | Candidate |
| GET | `/api/jobs` | Public |
| GET | `/api/jobs/:id` | Public |
| POST | `/api/jobs` | Recruiter |
| PATCH | `/api/jobs/:id/close` | Job owner |
| GET | `/api/jobs/mine` | Recruiter |
| GET | `/api/jobs/:id/applicants` | Job owner |
| POST | `/api/applications` | Candidate |
| GET | `/api/applications/me` | Candidate |
| PATCH | `/api/applications/:id/stage` | Job owner |

Job search supports `role`, `location`, `workMode`, `minExp`, `ctc`, `skills`, and `page`.

##  Roadmap

**Phase 2:** Resume uploads with signed URLs, admin panel, email notifications, recruiter notes, analytics, enhanced security (Helmet, rate limiting, sanitization), and deployment.