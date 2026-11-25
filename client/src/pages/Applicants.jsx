import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import api, { errMsg } from '../api.js';
import MatchRing from '../components/MatchRing.jsx';
import StageBar from '../components/StageBar.jsx';

const STAGES = ['applied', 'shortlisted', 'interview', 'offered', 'rejected'];

const toLocalDateTime = (value) => {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return new Date(date.getTime() - date.getTimezoneOffset() * 60_000)
    .toISOString()
    .slice(0, 16);
};

export default function Applicants() {
  const { id } = useParams();
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [search, setSearch] = useState('');
  const [stageFilter, setStageFilter] = useState('');
  const [sortBy, setSortBy] = useState('match');
  const [resumeAction, setResumeAction] = useState(null);
  const [notes, setNotes] = useState({});
  const [interviewTimes, setInterviewTimes] = useState({});
  const [savingNoteId, setSavingNoteId] = useState(null);
  const [savingInterviewId, setSavingInterviewId] = useState(null);
  const [movingApplicationId, setMovingApplicationId] = useState(null);

  const load = async () => {
    try {
      const { data: result } = await api.get(`/jobs/${id}/applicants`);
      setData(result);
      setNotes(Object.fromEntries(
        result.applicants.map((applicant) => [applicant._id, applicant.privateNote || ''])
      ));
      setInterviewTimes(Object.fromEntries(
        result.applicants.map((applicant) => [
          applicant._id,
          toLocalDateTime(applicant.interviewAt),
        ])
      ));
      setError('');
    } catch (e) {
      setError(errMsg(e));
    }
  };

  useEffect(() => {
    load();
  }, [id]);

  const stageCounts = Object.fromEntries(STAGES.map((stage) => [stage, 0]));
  data?.applicants.forEach((applicant) => {
    stageCounts[applicant.stage] = (stageCounts[applicant.stage] || 0) + 1;
  });

  const normalizedSearch = search.trim().toLowerCase();
  const applicants = (data?.applicants || [])
    .filter((applicant) => !stageFilter || applicant.stage === stageFilter)
    .filter((applicant) => {
      if (!normalizedSearch) return true;
      const candidateSkills = applicant.profile?.skills || [];
      return [
        applicant.candidate.name,
        applicant.candidate.email,
        ...candidateSkills,
      ].some((value) => value.toLowerCase().includes(normalizedSearch));
    })
    .sort((a, b) => {
      if (sortBy === 'newest') {
        return new Date(b.createdAt) - new Date(a.createdAt);
      }
      if (sortBy === 'experience') {
        const experienceDifference =
          Number(b.profile?.experienceYears ?? -1) -
          Number(a.profile?.experienceYears ?? -1);
        return experienceDifference || b.match.score - a.match.score;
      }
      return b.match.score - a.match.score;
    });

  const move = async (applicant, stage) => {
    if (
      stage === 'rejected' &&
      !window.confirm(
        `Reject ${applicant.candidate.name}'s application? This action cannot be undone.`,
      )
    ) {
      return;
    }

    setMovingApplicationId(applicant._id);
    setError('');
    setMessage('');
    try {
      await api.patch(`/applications/${applicant._id}/stage`, { stage });
      setMessage(`Application moved to ${stage}.`);
      await load();
    } catch (e) {
      setError(errMsg(e));
    } finally {
      setMovingApplicationId(null);
    }
  };

  const openResume = async (applicant, download = false) => {
    const preview = download ? null : window.open('about:blank', '_blank');
    if (!download && !preview) {
      setError('Allow pop-ups to view the resume, or use Download instead.');
      return;
    }

    setResumeAction({ applicationId: applicant._id, download });
    setError('');

    try {
      const { data: file } = await api.get(
        `/applications/${applicant._id}/resume${download ? '?download=true' : ''}`,
        { responseType: 'blob' },
      );
      const url = URL.createObjectURL(file);

      if (download) {
        const link = document.createElement('a');
        link.href = url;
        link.download = applicant.profile.resume.originalName;
        link.click();
      } else {
        preview.location.href = url;
      }

      setTimeout(() => URL.revokeObjectURL(url), 60_000);
    } catch (e) {
      preview?.close();
      setError(errMsg(e));
    } finally {
      setResumeAction(null);
    }
  };

  const savePrivateNote = async (applicationId) => {
    setSavingNoteId(applicationId);
    setError('');
    setMessage('');

    try {
      const { data: result } = await api.put(
        `/applications/${applicationId}/private-note`,
        { note: notes[applicationId] || '' },
      );
      setNotes((current) => ({ ...current, [applicationId]: result.note }));
      setMessage('Private note saved.');
    } catch (e) {
      setError(errMsg(e));
    } finally {
      setSavingNoteId(null);
    }
  };

  const saveInterview = async (applicant) => {
    const localDateTime = interviewTimes[applicant._id] || '';
    const hasExistingSchedule = Boolean(applicant.interviewAt);
    const selectedTime = localDateTime ? new Date(localDateTime) : null;

    if (
      selectedTime &&
      (Number.isNaN(selectedTime.getTime()) || selectedTime.getTime() <= Date.now())
    ) {
      setError('Choose an interview time in the future.');
      return;
    }

    setSavingInterviewId(applicant._id);
    setError('');
    setMessage('');
    try {
      await api.patch(`/applications/${applicant._id}/interview`, {
        interviewAt: selectedTime ? selectedTime.toISOString() : null,
      });
      setMessage(
        selectedTime
          ? 'Interview scheduled. The candidate will see an in-app notification.'
          : hasExistingSchedule
            ? 'Interview schedule cancelled.'
            : 'No interview schedule to cancel.',
      );
      await load();
    } catch (e) {
      setError(errMsg(e));
    } finally {
      setSavingInterviewId(null);
    }
  };

  if (!data) {
    return error
      ? <p className="error" role="alert">{error}</p>
      : <p className="muted">Loading…</p>;
  }

  return (
    <>
      <Link to="/dashboard">← Back to dashboard</Link>
      <h1>{data.job.title}: applicants</h1>
      {error && <p className="error" role="alert">{error}</p>}
      {message && <p className="ok" role="status">{message}</p>}

      <div className="applicant-stage-counts" aria-label="Applicant counts by stage">
        <strong>{data.applicants.length} total</strong>
        {STAGES.map((stage) => (
          <span key={stage}>
            {stage[0].toUpperCase() + stage.slice(1)} <strong>{stageCounts[stage]}</strong>
          </span>
        ))}
      </div>

      <div className="applicant-filters card">
        <label>
          Search name or skills
          <input
            type="search"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Name, email, or skill"
          />
        </label>
        <label>
          Application stage
          <select value={stageFilter} onChange={(event) => setStageFilter(event.target.value)}>
            <option value="">All stages</option>
            {STAGES.map((stage) => (
              <option key={stage} value={stage}>
                {stage[0].toUpperCase() + stage.slice(1)} ({stageCounts[stage]})
              </option>
            ))}
          </select>
        </label>
        <label>
          Sort by
          <select value={sortBy} onChange={(event) => setSortBy(event.target.value)}>
            <option value="match">Match score</option>
            <option value="newest">Newest application</option>
            <option value="experience">Experience</option>
          </select>
        </label>
      </div>

      <p className="muted">
        Showing {applicants.length} of {data.applicants.length} applicants
      </p>
      {data.applicants.length === 0 && <p>No applications yet.</p>}
      {data.applicants.length > 0 && applicants.length === 0 && (
        <p>No applicants match your search and stage filters.</p>
      )}

      {applicants.map((a) => (
        <div className="card applicant" key={a._id}>
          <MatchRing score={a.match.score} />
          <div className="grow">
            <strong>{a.candidate.name}</strong> <span className="muted">{a.candidate.email}</span>
            <p className="muted">
              {a.profile?.headline || 'No profile yet'}
              {a.profile && ` · ${a.profile.experienceYears} yrs`}
              {` · applied ${new Date(a.createdAt).toLocaleDateString()}`}
            </p>
            <div className="chips">
              {(a.profile?.skills || []).map((skill) => (
                <span key={skill} className="chip">{skill}</span>
              ))}
            </div>
            {a.match.missing.length > 0 && (
              <p className="muted">Missing: {a.match.missing.join(', ')}</p>
            )}
            {a.coverNote && <p className="note">“{a.coverNote}”</p>}
            {a.profile?.resume && (
              <div className="resume-current">
                <span>Resume: <strong>{a.profile.resume.originalName}</strong></span>
                <div className="actions">
                  <button
                    type="button"
                    className="btn ghost small"
                    onClick={() => openResume(a)}
                    disabled={resumeAction?.applicationId === a._id}
                  >
                    {resumeAction?.applicationId === a._id && !resumeAction.download
                      ? 'Opening...'
                      : 'View'}
                  </button>
                  <button
                    type="button"
                    className="btn ghost small"
                    onClick={() => openResume(a, true)}
                    disabled={resumeAction?.applicationId === a._id}
                  >
                    {resumeAction?.applicationId === a._id && resumeAction.download
                      ? 'Downloading...'
                      : 'Download'}
                  </button>
                </div>
              </div>
            )}
            <div className="profile-label">
              <label htmlFor={`private-note-${a._id}`}>Recruiter Notes</label>
              <textarea
                id={`private-note-${a._id}`}
                rows="3"
                maxLength="2000"
                value={notes[a._id] || ''}
                onChange={(event) => setNotes((current) => ({
                  ...current,
                  [a._id]: event.target.value,
                }))}
                placeholder="Add private notes about this applicant..."
              />
              <span className="field-hint">
                Only you can see these notes. Maximum 2000 characters.
              </span>
              <button
                type="button"
                className="btn ghost small"
                onClick={() => savePrivateNote(a._id)}
                disabled={savingNoteId === a._id}
              >
                {savingNoteId === a._id ? 'Saving note...' : 'Save private note'}
              </button>
            </div>

            {a.stage === 'interview' && (
              <div className="interview-schedule">
                <label htmlFor={`interview-time-${a._id}`}>
                  Interview date and time
                  <input
                    id={`interview-time-${a._id}`}
                    type="datetime-local"
                    value={interviewTimes[a._id] || ''}
                    onChange={(event) => setInterviewTimes((current) => ({
                      ...current,
                      [a._id]: event.target.value,
                    }))}
                  />
                </label>
                <p className="field-hint">
                  Times use your local timezone. The candidate receives an in-app notification.
                </p>
                {a.interviewAt && (
                  <p className="muted">
                    Current schedule: {new Date(a.interviewAt).toLocaleString()}
                  </p>
                )}
                <button
                  type="button"
                  className="btn ghost small"
                  onClick={() => saveInterview(a)}
                  disabled={
                    savingInterviewId === a._id ||
                    (interviewTimes[a._id] || '') === toLocalDateTime(a.interviewAt)
                  }
                >
                  {savingInterviewId === a._id
                    ? 'Saving schedule...'
                    : interviewTimes[a._id]
                      ? a.interviewAt ? 'Update schedule' : 'Schedule interview'
                      : 'Cancel schedule'}
                </button>
              </div>
            )}

            <StageBar stage={a.stage} />
          </div>
          <div className="actions">
            {a.next.map((stage) => (
              <button
                type="button"
                key={stage}
                className={`btn small ${stage === 'rejected' ? 'danger' : 'ghost'}`}
                disabled={movingApplicationId === a._id}
                onClick={() => move(a, stage)}
              >
                {movingApplicationId === a._id
                  ? 'Updating...'
                  : stage === 'rejected'
                    ? 'Reject'
                    : `Move to ${stage}`}
              </button>
            ))}
          </div>
        </div>
      ))}
    </>
  );
}
