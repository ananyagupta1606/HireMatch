import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import api, { errMsg } from '../api.js';

const EMPTY = { title: '', description: '', skills: '', location: '', workMode: 'onsite', minExp: 0, ctcMin: 0, ctcMax: 0 };
const APPLICANT_STAGES = [
  ['applied', 'Applied'],
  ['shortlisted', 'Shortlisted'],
  ['interview', 'Interview'],
  ['offered', 'Offered'],
  ['rejected', 'Rejected'],
  ['withdrawn', 'Withdrawn'],
];

const parseSkills = (value) => {
  const seen = new Set();
  return value.split(',').map((skill) => skill.trim()).filter((skill) => {
    const normalized = skill.toLowerCase();
    if (!skill || seen.has(normalized)) return false;
    seen.add(normalized);
    return true;
  });
};

export default function Dashboard() {
  const [jobs, setJobs] = useState([]);
  const [recruiterApplications, setRecruiterApplications] = useState([]);
  const [applicationCounts, setApplicationCounts] = useState({});
  const [applicationTotal, setApplicationTotal] = useState(0);
  const [applicationAllCount, setApplicationAllCount] = useState(0);
  const [applicationPage, setApplicationPage] = useState(1);
  const [applicationPageSize, setApplicationPageSize] = useState(10);
  const [applicationTotalPages, setApplicationTotalPages] = useState(0);
  const [loadingJobs, setLoadingJobs] = useState(true);
  const [loadingApplications, setLoadingApplications] = useState(true);
  const [jobsLoadError, setJobsLoadError] = useState(false);
  const [applicationsLoadError, setApplicationsLoadError] = useState('');
  const [applicationsReload, setApplicationsReload] = useState(0);
  const [f, setF] = useState(EMPTY);
  const [skillDraft, setSkillDraft] = useState('');
  const [msg, setMsg] = useState({ type: '', text: '' });
  const [editingJobId, setEditingJobId] = useState(null);
  const [jobToDelete, setJobToDelete] = useState(null);
  const [busyJobId, setBusyJobId] = useState(null);
  const [savingJob, setSavingJob] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [workModeFilter, setWorkModeFilter] = useState('all');
  const [applicationView, setApplicationView] = useState('all');
  const [applicationSearch, setApplicationSearch] = useState('');
  const applicationRequestId = useRef(0);
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });
  const skills = parseSkills(f.skills);
  const summary = jobs.reduce((totals, job) => ({
    openRoles: totals.openRoles + (job.status === 'open' ? 1 : 0),
  }), { openRoles: 0 });
  const normalizedQuery = searchQuery.trim().toLowerCase();
  const visibleJobs = jobs.filter((job) => (
    `${job.title} ${job.location}`.toLowerCase().includes(normalizedQuery)
    && (statusFilter === 'all' || job.status === statusFilter)
    && (workModeFilter === 'all' || job.workMode === workModeFilter)
  ));
  const hasActiveFilters = Boolean(normalizedQuery || statusFilter !== 'all' || workModeFilter !== 'all');
  const applicationViews = [
    { id: 'all', label: 'All applicants', count: applicationCounts.all || 0 },
    { id: 'scheduled', label: 'Scheduled interviews', count: applicationCounts.scheduled || 0 },
    ...APPLICANT_STAGES.map(([stage, label]) => ({
      id: stage,
      label,
      count: applicationCounts[stage] || 0,
    })),
  ];

  const addSkills = (value) => {
    const additions = parseSkills(value);
    if (additions.length) {
      setF((prev) => {
        const currentSkills = parseSkills(prev.skills);
        additions.forEach((skill) => {
          if (!currentSkills.some((current) => current.toLowerCase() === skill.toLowerCase())) {
            currentSkills.push(skill);
          }
        });
        return { ...prev, skills: currentSkills.join(', ') };
      });
    }
    setSkillDraft('');
  };

  const removeSkill = (skillToRemove) => {
    setF((prev) => ({
      ...prev,
      skills: parseSkills(prev.skills)
        .filter((skill) => skill.toLowerCase() !== skillToRemove.toLowerCase())
        .join(', '),
    }));
  };

  const load = async () => {
    setLoadingJobs(true);
    try {
      const { data } = await api.get('/jobs/mine');
      setJobs(data);
      setJobsLoadError(false);
    } catch (e) {
      setJobsLoadError(true);
      setMsg({ type: 'error', text: errMsg(e) });
    } finally {
      setLoadingJobs(false);
    }
  };
  useEffect(() => { load(); }, []);
  useEffect(() => {
    let active = true;
    const requestId = ++applicationRequestId.current;
    const timeout = window.setTimeout(async () => {
      setLoadingApplications(true);
      setApplicationsLoadError('');
      try {
        const { data } = await api.get('/applications/recruiter', {
          params: {
            page: applicationPage,
            view: applicationView,
            search: applicationSearch.trim(),
          },
        });
        if (!active || requestId !== applicationRequestId.current) return;
        setRecruiterApplications(data.applications);
        setApplicationCounts(data.counts);
        setApplicationTotal(data.total);
        setApplicationAllCount(data.allCount);
        setApplicationPageSize(data.pageSize);
        setApplicationTotalPages(data.totalPages);
        if (applicationPage > data.totalPages) {
          setApplicationPage(Math.max(1, data.totalPages));
        }
      } catch (e) {
        if (active && requestId === applicationRequestId.current) {
          setApplicationsLoadError(errMsg(e));
        }
      } finally {
        if (active && requestId === applicationRequestId.current) {
          setLoadingApplications(false);
        }
      }
    }, applicationSearch.trim() ? 250 : 0);

    return () => {
      active = false;
      window.clearTimeout(timeout);
    };
  }, [applicationPage, applicationView, applicationSearch, applicationsReload]);
  useEffect(() => {
    if (!jobToDelete) return undefined;
    const handleKeyDown = (event) => {
      if (event.key === 'Escape' && busyJobId !== jobToDelete._id) {
        setJobToDelete(null);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [jobToDelete, busyJobId]);

  const saveJob = async (e) => {
    e.preventDefault();
    setSavingJob(true);
    setMsg({ type: '', text: '' });
    try {
      if (editingJobId) {
        await api.patch(`/jobs/${editingJobId}`, f);
        setMsg({ type: 'ok', text: 'Job updated.' });
      } else {
        await api.post('/jobs', f);
        setMsg({ type: 'ok', text: 'Job posted.' });
      }
      setF(EMPTY);
      setSkillDraft('');
      setEditingJobId(null);
      await load();
    } catch (err) {
      setMsg({ type: 'error', text: errMsg(err) });
    } finally {
      setSavingJob(false);
    }
  };

  const edit = (job) => {
    setEditingJobId(job._id);
    setF({
      title: job.title,
      description: job.description,
      skills: (job.skills || []).join(', '),
      location: job.location,
      workMode: job.workMode,
      minExp: job.minExp,
      ctcMin: job.ctcMin,
      ctcMax: job.ctcMax,
    });
    setSkillDraft('');
    setMsg({ type: '', text: '' });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const cancelEdit = () => {
    setEditingJobId(null);
    setF(EMPTY);
    setSkillDraft('');
    setMsg({ type: '', text: '' });
  };

  const updateStatus = async (id, action) => {
    setBusyJobId(id);
    setMsg({ type: '', text: '' });
    try {
      await api.patch(`/jobs/${id}/${action}`);
      setMsg({
        type: 'ok',
        text: action === 'close' ? 'Job closed.' : 'Job reopened.',
      });
      await load();
    } catch (err) {
      setMsg({ type: 'error', text: errMsg(err) });
    } finally {
      setBusyJobId(null);
    }
  };

  const archive = async () => {
    if (!jobToDelete) return;
    const job = jobToDelete;
    if (editingJobId === job._id) cancelEdit();
    setBusyJobId(job._id);
    setMsg({ type: '', text: '' });
    try {
      await api.delete(`/jobs/${job._id}`);
      setJobToDelete(null);
      setMsg({ type: 'ok', text: 'Job deleted and archived.' });
      await load();
    } catch (err) {
      setMsg({ type: 'error', text: errMsg(err) });
    } finally {
      setBusyJobId(null);
    }
  };

  return (
    <div className="recruiter-dashboard">
      <section className="recruiter-dashboard-overview">
        <div className="recruiter-dashboard-heading">
          <div>
            <span className="recruiter-form-eyebrow">RECRUITER WORKSPACE</span>
            <h1>Your hiring dashboard</h1>
            <p>Manage your openings and keep track of candidates.</p>
          </div>
          <div className="recruiter-dashboard-actions">
            <a className="recruiter-open-role-count" href="#job-openings">
              {loadingJobs && jobs.length === 0 ? '—' : summary.openRoles} Open Roles
            </a>
            <a className="recruiter-primary-action" href="#job-form">+ Post a job</a>
          </div>
        </div>
        {msg.text && !jobToDelete && <p className={msg.type} role={msg.type === 'error' ? 'alert' : 'status'}>{msg.text}</p>}
      </section>

      <section className="recruiter-applications-dashboard" aria-labelledby="recruiter-applications-title">
        <div className="recruiter-list-heading">
          <div>
            <h2 id="recruiter-applications-title">Applicants</h2>
            <p>Review candidates by application status and keep upcoming interviews in view.</p>
          </div>
        </div>
        <div className="recruiter-application-tabs" role="group" aria-label="Filter applicants by status">
          {applicationViews.map((view) => (
            <button
              type="button"
              aria-pressed={applicationView === view.id}
              className={applicationView === view.id ? 'is-active' : ''}
              key={view.id}
              onClick={() => {
                setApplicationPage(1);
                setApplicationView(view.id);
              }}
            >
              {view.label} <span>{loadingApplications ? '—' : view.count}</span>
            </button>
          ))}
        </div>
        <div className="recruiter-application-search">
          <label className="recruiter-application-search-field">
            <span className="sr-only">Search candidates or roles</span>
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <path d="m21 21-4.35-4.35m1.35-5.15a6.5 6.5 0 1 1-13 0 6.5 6.5 0 0 1 13 0Z" />
            </svg>
            <input
              type="search"
              value={applicationSearch}
              maxLength={100}
              onChange={(event) => {
                setApplicationPage(1);
                setApplicationSearch(event.target.value);
              }}
              placeholder="Search name, email, or job"
            />
          </label>
        </div>
        {loadingApplications ? (
          <div className="recruiter-state-card" role="status">
            <span className="recruiter-state-spinner" aria-hidden="true" />
            <span>Loading applicants...</span>
          </div>
        ) : applicationsLoadError ? (
          <div className="recruiter-state-card recruiter-state-card--error">
            <strong>We couldn’t load your applicants.</strong>
            <p>{applicationsLoadError}</p>
            <button
              type="button"
              className="btn ghost small"
              onClick={() => setApplicationsReload((current) => current + 1)}
            >
              Try again
            </button>
          </div>
        ) : recruiterApplications.length === 0 ? (
          <div className="recruiter-state-card recruiter-state-card--empty">
            <strong>
              {applicationAllCount === 0
                ? 'No applicants yet'
                : 'No applicants match these filters'}
            </strong>
            <p>
              {applicationAllCount === 0
                ? 'Applications from all your job openings will appear here.'
                : 'Try a different status or search term.'}
            </p>
            {(applicationView !== 'all' || applicationSearch.trim()) && (
              <button
                type="button"
                className="recruiter-clear-filters"
                onClick={() => {
                  setApplicationPage(1);
                  setApplicationView('all');
                  setApplicationSearch('');
                }}
              >
                Clear applicant filters
              </button>
            )}
          </div>
        ) : (
          <div className="recruiter-application-list">
            {recruiterApplications.map((application) => (
              <article className="recruiter-application-card" key={application._id}>
                <div className="recruiter-application-main">
                  <strong>{application.candidate.name}</strong>
                  <span>{application.candidate.email}</span>
                  <p>
                    {application.job.title} · {
                      application.candidateProfile?.headline
                      || application.candidateProfile?.skills?.slice(0, 3).join(', ')
                      || (application.candidateProfile
                        ? `${application.candidateProfile.experienceYears ?? 0} years experience`
                        : 'Profile incomplete')
                    }
                  </p>
                  <div className="recruiter-application-meta">
                    <span className={`recruiter-application-stage recruiter-application-stage--${application.stage}`}>
                      {application.stage}
                    </span>
                    {application.stage === 'interview' && application.interviewAt && (
                      <span>
                        {new Date(application.interviewAt).toLocaleString()} · {application.interviewDurationMinutes || 60} min
                      </span>
                    )}
                    {application.interviewConcern?.status === 'pending' && (
                      <span className="recruiter-application-concern">Interview concern to review</span>
                    )}
                  </div>
                </div>
                {application.stage === 'interview' && application.interviewAt && application.interviewDetails?.meetingLink && (
                  <a
                    className="recruiter-application-meeting-link"
                    href={application.interviewDetails.meetingLink}
                    target="_blank"
                    rel="noreferrer"
                  >
                    Join meeting
                  </a>
                )}
                <Link
                  className="recruiter-application-manage"
                  to={`/dashboard/jobs/${application.job._id}/applicants/${application._id}`}
                >
                  Manage applicant <span aria-hidden="true">→</span>
                </Link>
              </article>
            ))}
          </div>
        )}
        {!loadingApplications && !applicationsLoadError && applicationTotal > 0 && (
          <div className="recruiter-application-pagination">
            <span>
              Showing {(applicationPage - 1) * applicationPageSize + 1}–
              {Math.min(applicationPage * applicationPageSize, applicationTotal)} of {applicationTotal}
            </span>
            {applicationTotalPages > 1 && (
              <div className="recruiter-application-pagination-actions">
                <button
                  type="button"
                  className="recruiter-application-page-button"
                  disabled={loadingApplications || applicationPage <= 1}
                  onClick={() => setApplicationPage((page) => page - 1)}
                >
                  Previous
                </button>
                <span>Page {applicationPage} of {applicationTotalPages}</span>
                <button
                  type="button"
                  className="recruiter-application-page-button"
                  disabled={loadingApplications || applicationPage >= applicationTotalPages}
                  onClick={() => setApplicationPage((page) => page + 1)}
                >
                  Next
                </button>
              </div>
            )}
          </div>
        )}
      </section>

      <div className="two-col">
        <section className="recruiter-job-list-section" id="job-openings">
          <div className="recruiter-list-heading">
            <div>
              <h2>Job openings</h2>
              <p>
                {hasActiveFilters
                  ? `Showing ${visibleJobs.length} of ${jobs.length} posting${jobs.length === 1 ? '' : 's'}`
                  : `${jobs.length} posting${jobs.length === 1 ? '' : 's'} · newest first`}
              </p>
            </div>
          </div>
          <div className="recruiter-job-filters">
            <label>Search roles
              <input type="search" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} placeholder="Search title or location" />
            </label>
            <label>Status
              <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
                <option value="all">All statuses</option>
                <option value="open">Open</option>
                <option value="closed">Closed</option>
              </select>
            </label>
            <label>Work mode
              <select value={workModeFilter} onChange={(e) => setWorkModeFilter(e.target.value)}>
                <option value="all">All work modes</option>
                <option value="onsite">Onsite</option>
                <option value="hybrid">Hybrid</option>
                <option value="remote">Remote</option>
              </select>
            </label>
          </div>
          {loadingJobs ? (
            <div className="recruiter-state-card" role="status">
              <span className="recruiter-state-spinner" aria-hidden="true" />
              <span>Loading your job openings...</span>
            </div>
          ) : jobsLoadError && jobs.length === 0 ? (
            <div className="recruiter-state-card recruiter-state-card--error">
              <strong>We couldn’t load your job openings.</strong>
              <button
                type="button"
                className="btn ghost small"
                onClick={() => {
                  setMsg({ type: '', text: '' });
                  load();
                }}
              >
                Try again
              </button>
            </div>
          ) : jobs.length === 0 ? (
            <div className="recruiter-state-card recruiter-state-card--empty">
              <span className="recruiter-empty-mark" aria-hidden="true">+</span>
              <strong>No job openings yet</strong>
              <p>Post your first opening with the form to start finding great candidates.</p>
            </div>
          ) : visibleJobs.length === 0 ? (
            <div className="recruiter-state-card recruiter-state-card--empty">
              <strong>No jobs match those filters</strong>
              <p>Try a different title, status, or work mode.</p>
              {hasActiveFilters && (
                <button
                  type="button"
                  className="recruiter-clear-filters"
                  onClick={() => {
                    setSearchQuery('');
                    setStatusFilter('all');
                    setWorkModeFilter('all');
                  }}
                >
                  Clear filters
                </button>
              )}
            </div>
          ) : (
            visibleJobs.map((j) => (
              <div className="card recruiter-job-card" key={j._id}>
                <div className="recruiter-job-details">
                  <div className="recruiter-job-heading">
                    <strong>{j.title}</strong>
                    <span className={`recruiter-job-status recruiter-job-status--${j.status === 'open' ? 'open' : 'closed'}`}>{j.status}</span>
                  </div>
                  <p className="recruiter-job-meta">{j.location} · {j.workMode}</p>
                  <p className="recruiter-job-compensation">
                    {j.minExp}+ yrs experience <span aria-hidden="true">·</span> {j.ctcMin}–{j.ctcMax} LPA
                  </p>
                  <div className="recruiter-job-stage-counts" aria-label="Applicant counts by stage">
                    {APPLICANT_STAGES.map(([stage, label]) => (
                      <span key={stage}>{label}: <strong>{j.stageCounts?.[stage] ?? 0}</strong></span>
                    ))}
                  </div>
                </div>
                <div className="recruiter-job-actions">
                  <Link
                    className="recruiter-applicants-link"
                    to={`/dashboard/jobs/${j._id}`}
                    aria-label={`View ${j.applicants} applicant${j.applicants === 1 ? '' : 's'} for ${j.title}`}
                  >
                    <strong>{j.applicants ?? 0}</strong>
                    <span>View applicants <span aria-hidden="true">→</span></span>
                  </Link>
                  <div className="recruiter-action-group" aria-label={`Manage ${j.title}`}>
                    <button className="recruiter-action recruiter-action--edit" disabled={busyJobId === j._id} onClick={() => edit(j)}>Edit</button>
                    {j.status === 'open' ? (
                      <button className="recruiter-action" disabled={busyJobId === j._id} onClick={() => updateStatus(j._id, 'close')}>Close</button>
                    ) : (
                      <button className="recruiter-action" disabled={busyJobId === j._id} onClick={() => updateStatus(j._id, 'reopen')}>Reopen</button>
                    )}
                    <button
                      className="recruiter-action recruiter-action--delete"
                      disabled={busyJobId === j._id}
                      onClick={() => {
                        setMsg({ type: '', text: '' });
                        setJobToDelete(j);
                      }}
                    >
                      Delete
                    </button>
                  </div>
                </div>
              </div>
            ))
          )}
        </section>

        <form id="job-form" className="card recruiter-job-form" onSubmit={saveJob}>
          <div className="recruiter-form-heading">
            <div>
              <span className="recruiter-form-eyebrow">{editingJobId ? 'JOB DETAILS' : 'HIRING'}</span>
              <h2>{editingJobId ? 'Edit job opening' : 'Post a job opening'}</h2>
              <p>{editingJobId ? 'Update the details candidates see.' : 'Share the role details to find your next great hire.'}</p>
            </div>
            {/* <span className="recruiter-form-mark" aria-hidden="true">+</span> */}
          </div>
          <div className="recruiter-form-fields">
            <label className="recruiter-form-field">Job title
              <input value={f.title} onChange={set('title')} placeholder="e.g. Senior Product Designer" required />
            </label>
            <label className="recruiter-form-field">Description
              <textarea rows="4" value={f.description} onChange={set('description')} placeholder="What will this person work on?" required />
            </label>
            <div className="recruiter-form-field">
              <label htmlFor="job-skills">Skills</label>
              <div className="recruiter-skill-entry">
                <input
                  id="job-skills"
                  value={skillDraft}
                  onChange={(e) => setSkillDraft(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && skillDraft.trim()) {
                      e.preventDefault();
                      addSkills(skillDraft);
                    }
                  }}
                  placeholder="Add a skill, e.g. React"
                  aria-describedby="job-skills-hint"
                />
                <button type="button" className="recruiter-skill-add" onClick={() => addSkills(skillDraft)}>Add</button>
              </div>
              <p className="recruiter-form-hint" id="job-skills-hint">Press Enter or add several skills separated by commas.</p>
              {skills.length > 0 && (
                <div className="recruiter-job-skill-list" role="list" aria-label="Added skills">
                  {skills.map((skill) => (
                    <span className="selected-skill" role="listitem" key={skill.toLowerCase()}>
                      {skill}
                      <button type="button" onClick={() => removeSkill(skill)} aria-label={`Remove ${skill}`}>×</button>
                    </span>
                  ))}
                </div>
              )}
            </div>
            <div className="recruiter-form-row">
              <label className="recruiter-form-field">Location
                <input value={f.location} onChange={set('location')} placeholder="e.g. Bengaluru" required />
              </label>
              <label className="recruiter-form-field">Work mode
                <select value={f.workMode} onChange={set('workMode')}><option value="onsite">Onsite</option><option value="hybrid">Hybrid</option><option value="remote">Remote</option></select>
              </label>
            </div>
            <div className="recruiter-form-row recruiter-form-row--numbers">
              <label className="recruiter-form-field">Min. experience
                <div className="recruiter-number-field"><input type="number" min="0" value={f.minExp} onChange={set('minExp')} /><span>years</span></div>
              </label>
              <label className="recruiter-form-field">CTC min
                <div className="recruiter-number-field"><input type="number" min="0" value={f.ctcMin} onChange={set('ctcMin')} /><span>LPA</span></div>
              </label>
              <label className="recruiter-form-field">CTC max
                <div className="recruiter-number-field"><input type="number" min="0" value={f.ctcMax} onChange={set('ctcMax')} /><span>LPA</span></div>
              </label>
            </div>
          </div>
          <div className="recruiter-form-footer">
            <button className="btn recruiter-form-submit" disabled={savingJob}>{savingJob ? 'Saving...' : editingJobId ? 'Save changes' : 'Post job opening'}</button>
            {editingJobId && <button type="button" className="btn ghost" onClick={cancelEdit} disabled={savingJob}>Cancel edit</button>}
          </div>
        </form>
      </div>
      {jobToDelete && (
        <div className="recruiter-modal-backdrop">
          <section
            className="confirm-dialog"
            role="alertdialog"
            aria-modal="true"
            aria-labelledby="delete-job-title"
            aria-describedby="delete-job-description"
          >
            <div className="confirm-icon" aria-hidden="true">!</div>
            <h2 id="delete-job-title">Delete this job opening?</h2>
            <p id="delete-job-description">
              <strong>{jobToDelete.title}</strong> will be hidden from candidates. Applicant records and history will be preserved.
            </p>
            {msg.type === 'error' && <p className="error" role="alert">{msg.text}</p>}
            <div className="confirm-actions">
              <button
                type="button"
                className="btn ghost"
                autoFocus
                disabled={busyJobId === jobToDelete._id}
                onClick={() => setJobToDelete(null)}
              >
                Keep opening
              </button>
              <button
                type="button"
                className="btn danger"
                disabled={busyJobId === jobToDelete._id}
                onClick={archive}
              >
                {busyJobId === jobToDelete._id ? 'Deleting...' : 'Delete opening'}
              </button>
            </div>
          </section>
        </div>
      )}
    </div>
  );
}
