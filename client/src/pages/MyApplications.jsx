import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import api, { errMsg } from '../api.js';
import StageBar from '../components/StageBar.jsx';

const getStageHistory = (application) => {
  const history = Array.isArray(application.stageHistory)
    ? application.stageHistory
    : [];
  const validHistory = history.filter((entry) =>
    typeof entry?.stage === 'string' &&
    entry?.at &&
    !Number.isNaN(new Date(entry.at).getTime())
  );

  if (validHistory.length > 0) return validHistory;
  return application.createdAt &&
    !Number.isNaN(new Date(application.createdAt).getTime())
    ? [{ stage: 'applied', at: application.createdAt }]
    : [];
};

const formatStage = (stage) => stage.charAt(0).toUpperCase() + stage.slice(1);
const getInterviewMode = (details = {}) => (
  details.mode || (details.meetingLink ? 'online' : details.location ? 'offline' : 'online')
);

const applicationFilters = [
  { stage: 'all', label: 'All' },
  { stage: 'applied', label: 'Applied' },
  { stage: 'shortlisted', label: 'Shortlisted' },
  { stage: 'interview', label: 'Interview' },
  { stage: 'offered', label: 'Offered' },
  { stage: 'rejected', label: 'Rejected' },
  { stage: 'withdrawn', label: 'Withdrawn' },
];

const toLocalDateTime = (value) => {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return new Date(date.getTime() - date.getTimezoneOffset() * 60_000)
    .toISOString()
    .slice(0, 16);
};

const escapeCalendarText = (value = '') => String(value)
  .replace(/\\/g, '\\\\')
  .replace(/\r\n|\r|\n/g, '\\n')
  .replace(/,/g, '\\,')
  .replace(/;/g, '\\;');

const foldCalendarLine = (line) => {
  const encoder = new TextEncoder();
  const segments = [];
  let segment = '';
  let byteLength = 0;

  for (const character of line) {
    const characterLength = encoder.encode(character).length;
    if (byteLength + characterLength > 75) {
      segments.push(segment);
      segment = ` ${character}`;
      byteLength = 1 + characterLength;
    } else {
      segment += character;
      byteLength += characterLength;
    }
  }

  segments.push(segment);
  return segments.join('\r\n');
};

const downloadInterviewCalendar = (application) => {
  const start = new Date(application.interviewAt);
  const end = new Date(start.getTime() + (application.interviewDurationMinutes || 60) * 60_000);
  const toCalendarDate = (date) => date.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
  const details = application.interviewDetails || {};
  const location = [details.location, details.meetingLink].filter(Boolean).join(' · ');
  const description = [
    `Interview for ${application.job.title}`,
    details.instructions,
    details.meetingLink,
  ].filter(Boolean).join('\n\n');
  const content = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//HireMatch//Interview//EN',
    'CALSCALE:GREGORIAN',
    'BEGIN:VEVENT',
    `UID:${application._id}@hirematch`,
    `DTSTAMP:${toCalendarDate(new Date())}`,
    `DTSTART:${toCalendarDate(start)}`,
    `DTEND:${toCalendarDate(end)}`,
    `SUMMARY:${escapeCalendarText(`Interview: ${application.job.title}`)}`,
    `LOCATION:${escapeCalendarText(location)}`,
    `DESCRIPTION:${escapeCalendarText(description)}`,
    'BEGIN:VALARM',
    'ACTION:DISPLAY',
    'DESCRIPTION:Interview reminder',
    'TRIGGER:-PT30M',
    'END:VALARM',
    'END:VEVENT',
    'END:VCALENDAR',
  ].map(foldCalendarLine).join('\r\n');
  const url = URL.createObjectURL(new Blob([content], { type: 'text/calendar;charset=utf-8' }));
  const link = document.createElement('a');
  const jobSlug = application.job.title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  link.href = url;
  link.download = `${jobSlug || 'interview'}.ics`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
};

export default function MyApplications() {
  const [apps, setApps] = useState(null);
  const [selectedStage, setSelectedStage] = useState('all');
  const [error, setError] = useState('');
  const [actionError, setActionError] = useState('');
  const [actionMessage, setActionMessage] = useState('');
  const [withdrawingId, setWithdrawingId] = useState(null);
  const [applicationToWithdraw, setApplicationToWithdraw] = useState(null);
  const [concernFormForId, setConcernFormForId] = useState(null);
  const [concernMessage, setConcernMessage] = useState('');
  const [concernPreferredAt, setConcernPreferredAt] = useState('');
  const [savingConcernId, setSavingConcernId] = useState(null);
  const withdrawDialogRef = useRef(null);

  useEffect(() => {
    api.get('/applications/me')
      .then((response) => setApps(response.data))
      .catch((requestError) => setError(errMsg(requestError)));
  }, []);

  useEffect(() => {
    if (applicationToWithdraw && withdrawDialogRef.current && !withdrawDialogRef.current.open) {
      withdrawDialogRef.current.showModal();
    }
  }, [applicationToWithdraw]);

  const closeWithdrawDialog = () => {
    if (withdrawDialogRef.current?.open) {
      withdrawDialogRef.current.close();
    } else {
      setApplicationToWithdraw(null);
    }
  };

  const overview = apps?.reduce((counts, application) => {
    counts.total += 1;
    if (['applied', 'shortlisted', 'interview'].includes(application.stage)) {
      counts.active += 1;
    }
    if (application.stage === 'interview') counts.interviews += 1;
    if (application.stage === 'offered') counts.offers += 1;
    return counts;
  }, { total: 0, active: 0, interviews: 0, offers: 0 });
  const visibleApps = selectedStage === 'all'
    ? apps
    : apps?.filter((application) => application.stage === selectedStage);

  const withdraw = async (application) => {
    setWithdrawingId(application._id);
    setActionError('');
    setActionMessage('');
    try {
      const { data } = await api.patch(`/applications/${application._id}/withdraw`);
      const withdrawnAt = new Date().toISOString();
      setApps((current) => current.map((item) => (
        item._id === application._id
          ? {
              ...item,
              stage: data.stage,
              interviewAt: data.interviewAt,
              stageHistory: [
                ...(item.stageHistory || []),
                { stage: data.stage, at: withdrawnAt },
              ],
            }
          : item
      )));
      setActionMessage(`Your application for ${application.job.title} was withdrawn.`);
      closeWithdrawDialog();
    } catch (requestError) {
      setActionError(errMsg(requestError));
    } finally {
      setWithdrawingId(null);
    }
  };

  const submitInterviewConcern = async (application) => {
    setSavingConcernId(application._id);
    setActionError('');
    setActionMessage('');
    try {
      const { data } = await api.post(
        `/applications/${application._id}/interview-concern`,
        {
          message: concernMessage,
          preferredAt: concernPreferredAt
            ? new Date(concernPreferredAt).toISOString()
            : null,
        },
      );
      setApps((current) => current.map((item) => (
        item._id === application._id
          ? { ...item, interviewConcern: data.interviewConcern }
          : item
      )));
      setConcernFormForId(null);
      setConcernMessage('');
      setConcernPreferredAt('');
      setActionMessage('Your scheduling concern was sent to the recruiter.');
    } catch (requestError) {
      setActionError(errMsg(requestError));
    } finally {
      setSavingConcernId(null);
    }
  };

  return (
    <div className="candidate-dashboard">
      <section className="candidate-dashboard-overview" aria-labelledby="applications-title">
        <div className="candidate-dashboard-heading">
          <div>
            <span className="candidate-dashboard-eyebrow">YOUR JOB SEARCH</span>
            <h1 id="applications-title">My applications</h1>
            <p>Keep track of every opportunity and what comes next.</p>
          </div>
          <Link className="candidate-browse-action" to="/">
            Explore jobs <span aria-hidden="true">→</span>
          </Link>
        </div>

        <div className="candidate-dashboard-stats" role="group" aria-label="Application overview">
          {[
            ['Applications', overview?.total],
            ['In progress', overview?.active],
            ['Interviews', overview?.interviews],
            ['Offers', overview?.offers],
          ].map(([label, value]) => (
            <div className="candidate-stat-card" key={label}>
              <span>{label}</span>
              <strong>{apps ? value : '—'}</strong>
            </div>
          ))}
        </div>
      </section>

      <section className="candidate-applications" aria-labelledby="application-list-title">
        <div className="candidate-list-heading">
          <div>
            <h2 id="application-list-title">Application activity</h2>
            <p>
              {apps
                ? `${visibleApps.length} ${visibleApps.length === 1 ? 'opportunity' : 'opportunities'}${selectedStage === 'all' ? ' in your pipeline' : ` with status ${formatStage(selectedStage)}`}`
                : 'Your applications will appear here.'}
            </p>
          </div>
        </div>

        {actionMessage && <p className="ok" role="status">{actionMessage}</p>}

        {apps?.length > 0 && (
          <nav className="candidate-application-filters" aria-label="Filter applications by status">
            {applicationFilters.map(({ stage, label }) => {
              const count = stage === 'all'
                ? apps.length
                : apps.filter((application) => application.stage === stage).length;
              return (
                <button
                  type="button"
                  className={`candidate-application-filter${selectedStage === stage ? ' is-active' : ''}`}
                  key={stage}
                  aria-pressed={selectedStage === stage}
                  onClick={() => setSelectedStage(stage)}
                >
                  {label}<span>{count}</span>
                </button>
              );
            })}
          </nav>
        )}

        {error ? (
          <div className="candidate-state-card candidate-state-card--error" role="alert">
            <strong>We couldn’t load your applications.</strong>
            <p>{error}</p>
          </div>
        ) : !apps ? (
          <div className="candidate-state-card" role="status">
            <span className="candidate-state-spinner" aria-hidden="true" />
            <span>Loading your applications...</span>
          </div>
        ) : apps.length === 0 ? (
          <div className="candidate-state-card candidate-state-card--empty">
            <span className="candidate-empty-mark" aria-hidden="true">↗</span>
            <strong>Your next opportunity starts here</strong>
            <p>
              You haven’t applied to any jobs yet. Find a role that matches your
              skills and apply when you’re ready.
            </p>
            <Link className="btn" to="/">Browse open jobs</Link>
          </div>
        ) : visibleApps.length === 0 ? (
          <div className="candidate-state-card candidate-state-card--empty">
            <strong>No {formatStage(selectedStage).toLowerCase()} applications yet</strong>
            <p>Applications with this status will appear here.</p>
            <button type="button" className="btn ghost" onClick={() => setSelectedStage('all')}>
              Show all applications
            </button>
          </div>
        ) : (
          <div className="candidate-application-list">
            {visibleApps.map((application) => (
              <article className="candidate-application-card" key={application._id}>
                <div className="candidate-application-main">
                  <div className="candidate-application-heading">
                    <div>
                      <Link
                        className="candidate-job-title"
                        to={`/jobs/${application.job._id}`}
                      >
                        {application.job.title}
                      </Link>
                      <p className="candidate-job-meta">
                        {application.job.company}
                        <span aria-hidden="true"> · </span>
                        {application.job.location}
                      </p>
                    </div>
                  </div>

                  {application.stage === 'interview' && !application.interviewAt && (
                    <p className="candidate-interview-notice">
                      Interview stage reached. The recruiter has not scheduled a time yet.
                    </p>
                  )}

                  {application.interviewAt && (
                    <section className="candidate-interview-card" aria-label="Interview details">
                      <div className="candidate-interview-heading">
                        <div>
                          <span className="candidate-dashboard-eyebrow">UPCOMING INTERVIEW</span>
                          <h3>
                            <time dateTime={new Date(application.interviewAt).toISOString()}>
                              {new Date(application.interviewAt).toLocaleString()}
                            </time>
                          </h3>
                          <p>
                            Duration: {application.interviewDurationMinutes || 60} minutes
                          </p>
                        </div>
                        <button
                          type="button"
                          className="btn ghost small"
                          onClick={() => downloadInterviewCalendar(application)}
                        >
                          Add to calendar
                        </button>
                      </div>
                      {application.interviewDetails && (
                        <div className="candidate-interview-logistics">
                          <p>
                            <strong>Format:</strong>{' '}
                            {getInterviewMode(application.interviewDetails) === 'online'
                              ? 'Online meeting'
                              : 'Offline / in person'}
                          </p>
                          {getInterviewMode(application.interviewDetails) === 'offline'
                            ? application.interviewDetails.location
                              ? <p><strong>Address:</strong> {application.interviewDetails.location}</p>
                              : <p>The recruiter will share the interview address.</p>
                            : application.interviewDetails.meetingLink
                              ? (
                                <p>
                                  <strong>Meeting link:</strong>{' '}
                                  <a href={application.interviewDetails.meetingLink} target="_blank" rel="noopener noreferrer">
                                    Join interview
                                  </a>
                                </p>
                              )
                              : <p>The recruiter will share the meeting link.</p>}
                        </div>
                      )}
                      {application.interviewDetails?.instructions && (
                        <p className="candidate-interview-instructions">
                          {application.interviewDetails.instructions}
                        </p>
                      )}
                      <p className="field-hint">
                        The calendar event includes a reminder 30 minutes before the interview.
                      </p>

                      {application.interviewConcern && (
                        <div className={`candidate-concern-status candidate-concern-status--${application.interviewConcern.status}`}>
                          <strong>
                            Scheduling concern {application.interviewConcern.status === 'pending' ? 'sent' : 'reviewed'}
                          </strong>
                          <p>{application.interviewConcern.message}</p>
                          {application.interviewConcern.preferredAt && (
                            <p>
                              Your preferred alternative: {new Date(application.interviewConcern.preferredAt).toLocaleString()}
                            </p>
                          )}
                        </div>
                      )}

                      {application.stage === 'interview' && (
                        <>
                          <button
                            type="button"
                            className="candidate-conflict-button"
                            onClick={() => {
                              setActionError('');
                              setConcernFormForId(application._id);
                              setConcernMessage(application.interviewConcern?.status === 'pending'
                                ? application.interviewConcern.message
                                : '');
                              setConcernPreferredAt(application.interviewConcern?.status === 'pending'
                                ? toLocalDateTime(application.interviewConcern.preferredAt)
                                : '');
                            }}
                          >
                            {application.interviewConcern?.status === 'pending'
                              ? 'Update conflict request'
                              : 'Report a scheduling conflict'}
                          </button>
                          {concernFormForId === application._id && (
                            <form
                              className="candidate-conflict-form"
                              onSubmit={(event) => {
                                event.preventDefault();
                                submitInterviewConcern(application);
                              }}
                            >
                              <label htmlFor={`conflict-message-${application._id}`}>
                                Tell the recruiter what conflicts
                                <textarea
                                  id={`conflict-message-${application._id}`}
                                  value={concernMessage}
                                  onChange={(event) => setConcernMessage(event.target.value)}
                                  maxLength="1000"
                                  rows="3"
                                  required
                                  placeholder="For example, I have another commitment at this time."
                                />
                              </label>
                              <label htmlFor={`conflict-time-${application._id}`}>
                                Preferred alternative time (optional)
                                <input
                                  id={`conflict-time-${application._id}`}
                                  type="datetime-local"
                                  min={toLocalDateTime(Date.now() + 60_000)}
                                  value={concernPreferredAt}
                                  onChange={(event) => setConcernPreferredAt(event.target.value)}
                                />
                              </label>
                              {actionError && <p className="error" role="alert">{actionError}</p>}
                              <div className="actions">
                                <button
                                  type="submit"
                                  className="btn small"
                                  disabled={savingConcernId === application._id}
                                >
                                  {savingConcernId === application._id ? 'Sending...' : 'Send to recruiter'}
                                </button>
                                <button
                                  type="button"
                                  className="btn ghost small"
                                  disabled={savingConcernId === application._id}
                                  onClick={() => {
                                    setConcernFormForId(null);
                                    setActionError('');
                                  }}
                                >
                                  Cancel
                                </button>
                              </div>
                            </form>
                          )}
                        </>
                      )}
                    </section>
                  )}

                  <div className="candidate-application-progress">
                    <span className="candidate-progress-label">Application status</span>
                    <StageBar stage={application.stage} />
                  </div>

                  <details className="candidate-stage-history">
                    <summary>View status history</summary>
                    <ol aria-label="Application status history">
                      {getStageHistory(application).map((entry, index) => (
                        <li key={`${entry.stage}-${entry.at}-${index}`}>
                          <span className="candidate-stage-history-marker" aria-hidden="true" />
                          <strong>{formatStage(entry.stage)}</strong>
                          <time dateTime={new Date(entry.at).toISOString()}>
                            {new Date(entry.at).toLocaleString()}
                          </time>
                        </li>
                      ))}
                    </ol>
                  </details>
                </div>
                <div className="candidate-application-actions">
                  <Link
                    className="candidate-view-job"
                    to={`/jobs/${application.job._id}`}
                    aria-label={`${application.stage === 'withdrawn' && application.job.status === 'open' ? 'Reapply to' : 'View'} ${application.job.title}`}
                  >
                    {application.stage === 'withdrawn' && application.job.status === 'open'
                      ? 'Reapply'
                      : 'View job'} <span aria-hidden="true">→</span>
                  </Link>
                  {['applied', 'shortlisted', 'interview'].includes(application.stage) && (
                    <button
                      type="button"
                      className="candidate-withdraw-button"
                      onClick={() => {
                        setActionError('');
                        setApplicationToWithdraw(application);
                      }}
                      disabled={withdrawingId === application._id}
                    >
                      {withdrawingId === application._id ? 'Withdrawing...' : 'Withdraw'}
                    </button>
                  )}
                </div>
              </article>
            ))}
          </div>
        )}
      </section>

      {applicationToWithdraw && (
        <dialog
          ref={withdrawDialogRef}
          className="confirm-dialog candidate-withdraw-dialog"
          role="alertdialog"
          aria-modal="true"
          aria-labelledby="withdraw-application-title"
          aria-describedby="withdraw-application-description"
          onClose={() => {
            setApplicationToWithdraw(null);
            setActionError('');
          }}
          onCancel={(event) => {
            if (withdrawingId) event.preventDefault();
          }}
          onClick={(event) => {
            if (event.target === event.currentTarget && !withdrawingId) {
              closeWithdrawDialog();
            }
          }}
        >
          <div className="confirm-icon" aria-hidden="true">!</div>
          <h2 id="withdraw-application-title">Withdraw application?</h2>
          <p id="withdraw-application-description">
            Your application for <strong>{applicationToWithdraw.job.title}</strong> will be withdrawn.
            You can apply again while the job is open and you meet its requirements.
          </p>
          {actionError && <p className="error" role="alert">{actionError}</p>}
          <div className="confirm-actions">
            <button
              type="button"
              className="btn ghost"
              autoFocus
              disabled={withdrawingId === applicationToWithdraw._id}
              onClick={closeWithdrawDialog}
            >
              Keep application
            </button>
            <button
              type="button"
              className="btn danger"
              disabled={withdrawingId === applicationToWithdraw._id}
              onClick={() => withdraw(applicationToWithdraw)}
            >
              {withdrawingId === applicationToWithdraw._id
                ? 'Withdrawing...'
                : 'Withdraw application'}
            </button>
          </div>
        </dialog>
      )}
    </div>
  );
}
