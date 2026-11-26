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

export default function MyApplications() {
  const [apps, setApps] = useState(null);
  const [error, setError] = useState('');
  const [actionError, setActionError] = useState('');
  const [actionMessage, setActionMessage] = useState('');
  const [withdrawingId, setWithdrawingId] = useState(null);
  const [applicationToWithdraw, setApplicationToWithdraw] = useState(null);
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
                ? `${apps.length} ${apps.length === 1 ? 'opportunity' : 'opportunities'} in your pipeline`
                : 'Your applications will appear here.'}
            </p>
          </div>
        </div>

        {actionMessage && <p className="ok" role="status">{actionMessage}</p>}

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
        ) : (
          <div className="candidate-application-list">
            {apps.map((application) => (
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

                  {application.interviewAt && (
                    <p className="candidate-interview-notice">
                      <span aria-hidden="true">◷</span>
                      Interview scheduled: {new Date(application.interviewAt).toLocaleString()}
                    </p>
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
