import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import api, { errMsg } from '../api.js';
import StageBar from '../components/StageBar.jsx';

export default function MyApplications() {
  const [apps, setApps] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    api.get('/applications/me').then((r) => setApps(r.data)).catch((e) => setError(errMsg(e)));
  }, []);

  if (error) return <p className="error">{error}</p>;
  if (!apps) return <p className="muted">Loading…</p>;
  return (
    <>
      <h1>My applications</h1>
      {apps.length === 0 && <p>You have not applied yet. <Link to="/">Browse jobs</Link></p>}
      {apps.map((a) => (
        <div className="card app" key={a._id}>
          <div>
            <Link to={`/jobs/${a.job._id}`}><strong>{a.job.title}</strong></Link>
            <p className="muted">{a.job.company} · {a.job.location} · applied {new Date(a.createdAt).toLocaleDateString()}</p>
          </div>
          <StageBar stage={a.stage} />
        </div>
      ))}
    </>
  );
}
