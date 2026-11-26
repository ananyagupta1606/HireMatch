import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import api, { errMsg } from '../api.js';
import MatchRing from '../components/MatchRing.jsx';
import StageBar from '../components/StageBar.jsx';
import DateTimePicker from '../components/DateTimePicker.jsx';

const STAGES = ['applied', 'shortlisted', 'interview', 'offered', 'rejected', 'withdrawn'];

const lastAppliedAt = (application) => {
  const history = [...(application.stageHistory || [])].reverse();
  return history.find((entry) => entry.stage === 'applied')?.at || application.createdAt;
};

const toLocalDateTime = (value) => {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return new Date(date.getTime() - date.getTimezoneOffset() * 60_000)
    .toISOString()
    .slice(0, 16);
};

export default function Applicants() {
  const { id, applicationId } = useParams();
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [search, setSearch] = useState('');
  const [stageFilter, setStageFilter] = useState('');
  const [sortBy, setSortBy] = useState('match');
  const [resumeAction, setResumeAction] = useState(null);
  const [notes, setNotes] = useState({});
  const [interviewTimes, setInterviewTimes] = useState({});
  const [interviewDurations, setInterviewDurations] = useState({});
  const [interviewDetails, setInterviewDetails] = useState({});
  const [savingNoteId, setSavingNoteId] = useState(null);
  const [savingInterviewId, setSavingInterviewId] = useState(null);
  const [resolvingConcernId, setResolvingConcernId] = useState(null);
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
      setInterviewDurations(Object.fromEntries(
        result.applicants.map((applicant) => [
          applicant._id,
          applicant.interviewDurationMinutes || 60,
        ])
      ));
      setInterviewDetails(Object.fromEntries(
        result.applicants.map((applicant) => [
          applicant._id,
          {
            mode: applicant.interviewDetails?.mode ||
              (applicant.interviewDetails?.meetingLink
                ? 'online'
                : applicant.interviewDetails?.location ? 'offline' : 'online'),
            location: applicant.interviewDetails?.location || '',
            meetingLink: applicant.interviewDetails?.meetingLink || '',
            instructions: applicant.interviewDetails?.instructions || '',
          },
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
    .filter((applicant) => !applicationId || applicant._id === applicationId)
    .filter((applicant) => applicationId || !stageFilter || applicant.stage === stageFilter)
    .filter((applicant) => {
      if (applicationId) return true;
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
        return new Date(lastAppliedAt(b)) - new Date(lastAppliedAt(a));
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

  const saveInterview = async (applicant, cancel = false) => {
    const localDateTime = cancel ? '' : interviewTimes[applicant._id] || '';
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
        interviewDurationMinutes: Number(interviewDurations[applicant._id] || 60),
        interviewDetails: interviewDetails[applicant._id] || {
          location: '',
          meetingLink: '',
          instructions: '',
        },
      });
      setMessage(
        selectedTime
          ? 'Interview details saved. The candidate has been notified.'
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

  const resolveConcern = async (applicant) => {
    setResolvingConcernId(applicant._id);
    setError('');
    setMessage('');
    try {
      await api.patch(`/applications/${applicant._id}/interview-concern/resolve`);
      setMessage('Interview concern marked as addressed. The candidate has been notified.');
      await load();
    } catch (e) {
      setError(errMsg(e));
    } finally {
      setResolvingConcernId(null);
    }
  };

  const hasInterviewChanges = (applicant) => {
    const savedDetails = {
      location: applicant.interviewDetails?.location || '',
      meetingLink: applicant.interviewDetails?.meetingLink || '',
      instructions: applicant.interviewDetails?.instructions || '',
    };
    const draftDetails = interviewDetails[applicant._id] || savedDetails;
    return (
      (interviewTimes[applicant._id] || '') !== toLocalDateTime(applicant.interviewAt) ||
      Number(interviewDurations[applicant._id] || 60) !== (applicant.interviewDurationMinutes || 60) ||
      Object.keys(savedDetails).some((key) => draftDetails[key] !== savedDetails[key])
    );
  };

  if (!data) {
    return error
      ? <p className="error" role="alert">{error}</p>
      : <p className="muted">Loading…</p>;
  }

  const focusedApplicant = applicationId
    ? data.applicants.find((applicant) => applicant._id === applicationId)
    : null;

  return (
    <>
      <Link className="back-link" to="/dashboard">
        <span className="back-link-arrow" aria-hidden="true">←</span>
        <span>Back to dashboard</span>
      </Link>
      {applicationId ? (
        <header className="applicant-detail-header">
          <h1 className="applicant-detail-heading">
            {focusedApplicant
              ? <span className="applicant-detail-name">{focusedApplicant.candidate.name}</span>
              : 'Applicant not found'}
          </h1>
          {focusedApplicant && (
            <p className="applicant-role">
              <span>Applying for:</span>
              <strong>{data.job.title}</strong>
            </p>
          )}
        </header>
      ) : (
        <h1>{`${data.job.title}: applicants`}</h1>
      )}
      {error && <p className="error" role="alert">{error}</p>}
      {message && <p className="ok" role="status">{message}</p>}

      {applicationId && !focusedApplicant ? (
        <p className="error" role="alert">This applicant could not be found for this job.</p>
      ) : (
        <>
          {!applicationId && (
            <>
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
            </>
          )}

      {applicants.map((a) => (
        <div className={`card applicant${applicationId ? ' applicant-detail' : ''}`} key={a._id}>
          <MatchRing score={a.match.score} />
          <div className="grow">
            <strong>{a.candidate.name}</strong> <span className="muted">{a.candidate.email}</span>
            <p className="muted">
              {a.profile?.headline || 'No profile yet'}
              {a.profile && ` · ${a.profile.experienceYears} yrs`}
              {` · applied ${new Date(lastAppliedAt(a)).toLocaleDateString()}`}
            </p>
            <div className="chips">
              {(a.profile?.skills || []).map((skill) => (
                <span
                  key={skill}
                  className={`chip ${
                    a.match.missing.some(
                      (missing) => missing.toLowerCase() === skill.toLowerCase()
                    )
                      ? 'miss'
                      : 'hit'
                  }`}
                >
                  {skill}
                </span>
              ))}
            </div>
            {a.match.missing.length > 0 && (
              <div className="chips applicant-missing-skills" aria-label="Missing skills">
                {a.match.missing.map((skill) => (
                  <span key={skill} className="chip miss">{skill}</span>
                ))}
              </div>
            )}
            {a.coverNote && <p className="note">“{a.coverNote}”</p>}
            {a.profile?.resume && (
              <div className="resume-current applicant-resume">
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
            <div className="profile-label applicant-notes">
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

            {a.interviewConcern && (
              <section className={`interview-concern interview-concern--${a.interviewConcern.status}`}>
                <strong>
                  Candidate scheduling concern · {a.interviewConcern.status}
                </strong>
                <p>{a.interviewConcern.message}</p>
                {a.interviewConcern.preferredAt && (
                  <p>
                    Preferred alternative: {new Date(a.interviewConcern.preferredAt).toLocaleString()}
                  </p>
                )}
                {a.interviewConcern.status === 'pending' && (
                  <button
                    type="button"
                    className="btn ghost small"
                    onClick={() => resolveConcern(a)}
                    disabled={resolvingConcernId === a._id}
                  >
                    {resolvingConcernId === a._id ? 'Updating...' : 'Mark concern addressed'}
                  </button>
                )}
              </section>
            )}

            {a.stage === 'interview' && (
              <div className="interview-schedule">
                <header className="interview-schedule-heading">
                  <div>
                    <span className="interview-schedule-eyebrow">INTERVIEW PLAN</span>
                    <h3>Coordinate the interview</h3>
                    <p>Set a time and share the details the candidate needs.</p>
                  </div>
                  <span className={`interview-schedule-status${a.interviewAt ? ' is-scheduled' : ''}`}>
                    {a.interviewAt ? 'Scheduled' : 'Needs scheduling'}
                  </span>
                </header>

                <div className="interview-schedule-layout">
                  <section className="interview-schedule-section" aria-labelledby={`interview-timing-title-${a._id}`}>
                    <div className="interview-schedule-section-heading">
                      <h4 id={`interview-timing-title-${a._id}`}>Date and time</h4>
                      <p>Choose when the conversation will happen.</p>
                    </div>
                    <label htmlFor={`interview-time-${a._id}`}>Interview date and time</label>
                    <DateTimePicker
                      id={`interview-time-${a._id}`}
                      value={interviewTimes[a._id] || ''}
                      minValue={toLocalDateTime(Date.now() + 60_000)}
                      onChange={(value) => setInterviewTimes((current) => ({
                        ...current,
                        [a._id]: value,
                      }))}
                    />
                    <label htmlFor={`interview-duration-${a._id}`}>
                      Duration
                      <select
                        id={`interview-duration-${a._id}`}
                        value={interviewDurations[a._id] || 60}
                        onChange={(event) => setInterviewDurations((current) => ({
                          ...current,
                          [a._id]: Number(event.target.value),
                        }))}
                      >
                        {[15, 30, 45, 60, 90, 120].map((minutes) => (
                          <option key={minutes} value={minutes}>
                            {minutes < 60 ? `${minutes} minutes` : `${minutes / 60} hour${minutes > 60 ? 's' : ''}`}
                          </option>
                        ))}
                      </select>
                    </label>
                  </section>

                  <section className="interview-schedule-section" aria-labelledby={`interview-format-title-${a._id}`}>
                    <div className="interview-schedule-section-heading">
                      <h4 id={`interview-format-title-${a._id}`}>Format and location</h4>
                      <p>Tell the candidate how to join.</p>
                    </div>
                    <label htmlFor={`interview-mode-${a._id}`}>
                      Interview format
                      <select
                        id={`interview-mode-${a._id}`}
                        value={interviewDetails[a._id]?.mode || 'online'}
                        onChange={(event) => setInterviewDetails((current) => ({
                          ...current,
                          [a._id]: {
                            ...current[a._id],
                            mode: event.target.value,
                            location: event.target.value === 'offline' ? current[a._id]?.location || '' : '',
                            meetingLink: event.target.value === 'online' ? current[a._id]?.meetingLink || '' : '',
                          },
                        }))}
                      >
                        <option value="online">Online meeting</option>
                        <option value="offline">Offline / in person</option>
                      </select>
                    </label>
                    {interviewDetails[a._id]?.mode === 'offline' ? (
                      <label htmlFor={`interview-location-${a._id}`}>
                        Interview address
                        <input
                          id={`interview-location-${a._id}`}
                          value={interviewDetails[a._id]?.location || ''}
                          maxLength="300"
                          onChange={(event) => setInterviewDetails((current) => ({
                            ...current,
                            [a._id]: { ...current[a._id], location: event.target.value },
                          }))}
                          placeholder="Full office or meeting address"
                        />
                      </label>
                    ) : (
                      <label htmlFor={`interview-link-${a._id}`}>
                        Video meeting link
                        <input
                          id={`interview-link-${a._id}`}
                          type="url"
                          value={interviewDetails[a._id]?.meetingLink || ''}
                          maxLength="500"
                          onChange={(event) => setInterviewDetails((current) => ({
                            ...current,
                            [a._id]: { ...current[a._id], meetingLink: event.target.value },
                          }))}
                          placeholder="https://..."
                        />
                      </label>
                    )}
                  </section>
                </div>

                <section className="interview-schedule-section interview-schedule-notes">
                  <label htmlFor={`interview-instructions-${a._id}`}>
                    Additional details
                    <textarea
                      id={`interview-instructions-${a._id}`}
                      rows="3"
                      value={interviewDetails[a._id]?.instructions || ''}
                      maxLength="2000"
                      onChange={(event) => setInterviewDetails((current) => ({
                        ...current,
                        [a._id]: { ...current[a._id], instructions: event.target.value },
                      }))}
                      placeholder="Agenda, preparation, or who the candidate will meet"
                    />
                  </label>
                </section>

                <footer className="interview-schedule-footer">
                  <div>
                    <p className="field-hint">
                      The candidate sees these details in My Applications and is notified of changes.
                    </p>
                    {a.interviewAt && (
                      <p className="muted">
                        Current schedule: {new Date(a.interviewAt).toLocaleString()}
                      </p>
                    )}
                  </div>
                  <div className="interview-schedule-actions">
                    {a.interviewAt && (
                      <button
                        type="button"
                        className="btn danger small"
                        onClick={() => {
                          if (window.confirm(`Cancel the interview for ${a.candidate.name}?`)) {
                            saveInterview(a, true);
                          }
                        }}
                        disabled={savingInterviewId === a._id}
                      >
                        Cancel interview
                      </button>
                    )}
                    {interviewTimes[a._id] && hasInterviewChanges(a) && (
                      <button
                        type="button"
                        className="btn recruiter-interview-submit"
                        onClick={() => saveInterview(a)}
                        disabled={savingInterviewId === a._id}
                      >
                        {savingInterviewId === a._id
                          ? 'Saving interview...'
                          : a.interviewAt ? 'Update interview' : 'Schedule interview'}
                      </button>
                    )}
                  </div>
                </footer>
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
      )}
    </>
  );
}
