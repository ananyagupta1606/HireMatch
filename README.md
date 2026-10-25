# HireMatch: Job Portal & Applicant Tracking (MERN) - Phase 1 (~50%)

A two-sided job portal. The unique feature is the **Skill Match Ring**: every job shows
how much of its skill list the logged-in candidate already has, plus a "skill gap" list.
Recruiters see applicants ranked by the same score.

## What is done in this phase
- JWT auth with roles (candidate / recruiter)
- Candidate skills profile
- Faceted job search API (title, location, work mode, experience, CTC, skills) with pagination
- Job posting and closing (recruiter, ownership enforced)
- Apply with unique index (no duplicates), "My applications" tracker
- Recruiter applicant list (owner only), ranked by match score
- Stage changes with a server-side state machine
- React UI that fetches and displays all of this from the API

## Left for phase 2
Resume upload + signed URLs, admin panel, email notifications, recruiter notes,
analytics aggregation, helmet / rate limiting / sanitize, deployment.

## Run it
Requires Node 18+ and MongoDB (local or Atlas).

    # terminal 1: API
    cd server
    npm install
    # edit .env: set MONGO_URI (Atlas string if not using local Mongo)
    npm run seed      # demo data
    npm run dev       # http://localhost:4000

    # terminal 2: UI
    cd client
    npm install
    npm run dev       # http://localhost:5173

Demo logins (password `demo1234`): candidate@demo.com, recruiter@demo.com

## API summary
| Method | Route | Who |
|---|---|---|
| POST | /api/auth/register, /api/auth/login | public |
| GET / PUT | /api/profile/me | candidate |
| GET | /api/jobs?role=&location=&workMode=&minExp=&ctc=&skills=&page= | public (adds match if candidate) |
| GET | /api/jobs/:id | public |
| POST | /api/jobs | recruiter |
| PATCH | /api/jobs/:id/close | owner recruiter |
| GET | /api/jobs/mine | recruiter |
| GET | /api/jobs/:id/applicants | owner recruiter |
| POST | /api/applications | candidate |
| GET | /api/applications/me | candidate |
| PATCH | /api/applications/:id/stage | owner recruiter |
