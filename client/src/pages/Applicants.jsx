import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import api, { errMsg } from '../api.js';
import MatchRing from '../components/MatchRing.jsx';
import StageBar from '../components/StageBar.jsx';

export default function Applicants() {
  const { id } = useParams();
  const [data, setData] = useState(null);
  const [error, setError] = useState('');

  const load = () => api.get(`/jobs/${id}/applicants`).then((r) => setData(r.data)).catch((e) => setError(errMsg(e)));
  useEffect(() => { load(); }, [id]);

  const move = async (appId, stage) => {
    try { await api.patch(`/applications/${appId}/stage`, { stage }); load(); }
    catch (e) { setError(errMsg(e)); }
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
