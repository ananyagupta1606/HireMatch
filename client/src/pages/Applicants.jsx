import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import api, { errMsg } from '../api.js';
import MatchRing from '../components/MatchRing.jsx';
import StageBar from '../components/StageBar.jsx';

export default function Applicants() {
  const { id } = useParams();
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [resumeAction, setResumeAction] = useState(null);
  const [notes, setNotes] = useState({});
  const [savingNoteId, setSavingNoteId] = useState(null);

  const load = () => api.get(`/jobs/${id}/applicants`).then((r) => {
    setData(r.data);
    setNotes(Object.fromEntries(
      r.data.applicants.map((applicant) => [applicant._id, applicant.privateNote || ''])
    ));
  }).catch((e) => setError(errMsg(e)));
  useEffect(() => { load(); }, [id]);

  const move = async (appId, stage) => {
    try { await api.patch(`/applications/${appId}/stage`, { stage }); load(); }
    catch (e) { setError(errMsg(e)); }
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

    try {
      const { data: result } = await api.put(
        `/applications/${applicationId}/private-note`,
        { note: notes[applicationId] || '' },
      );
      setNotes((current) => ({ ...current, [applicationId]: result.note }));
    } catch (e) {
      setError(errMsg(e));
    } finally {
      setSavingNoteId(null);
    }
  };

  if (error) return <p className="error">{error}</p>;
  if (!data) return <p className="muted">Loading…</p>;
  return (
    <>
      <Link to="/dashboard">← Back to dashboard</Link>
      <h1>{data.job.title}: applicants</h1>
      <p className="muted">Ranked by how well their skills cover the job ({data.job.skills.join(', ')}).</p>
      {data.applicants.length === 0 && <p>No applications yet.</p>}
      {data.applicants.map((a) => (
        <div className="card applicant" key={a._id}>
          <MatchRing score={a.match.score} />
          <div className="grow">
            <strong>{a.candidate.name}</strong> <span className="muted">{a.candidate.email}</span>
            <p className="muted">{a.profile?.headline || 'No profile yet'}{a.profile && ` · ${a.profile.experienceYears} yrs`}</p>
            <div className="chips">
              {(a.profile?.skills || []).map((s) => <span key={s} className="chip">{s}</span>)}
            </div>
            {a.match.missing.length > 0 && <p className="muted">Missing: {a.match.missing.join(', ')}</p>}
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
                onChange={(e) => setNotes((current) => ({
                  ...current,
                  [a._id]: e.target.value,
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
            <StageBar stage={a.stage} />
          </div>
          <div className="actions">
            {a.next.map((s) => (
              <button key={s} className={`btn small ${s === 'rejected' ? 'danger' : 'ghost'}`} onClick={() => move(a._id, s)}>
                {s === 'rejected' ? 'Reject' : `Move to ${s}`}
              </button>
            ))}
          </div>
        </div>
      ))}
    </>
  );
}
