import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import api, { errMsg } from '../api.js';

const EMPTY = { title: '', description: '', skills: '', location: '', workMode: 'onsite', minExp: 0, ctcMin: 0, ctcMax: 0 };

export default function Dashboard() {
  const [jobs, setJobs] = useState([]);
  const [f, setF] = useState(EMPTY);
  const [msg, setMsg] = useState({ type: '', text: '' });
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });

  const load = () => api.get('/jobs/mine').then((r) => setJobs(r.data)).catch((e) => setMsg({ type: 'error', text: errMsg(e) }));
  useEffect(() => { load(); }, []);

  const post = async (e) => {
    e.preventDefault();
    try {
      await api.post('/jobs', f);
      setF(EMPTY); setMsg({ type: 'ok', text: 'Job posted.' }); load();
    } catch (err) { setMsg({ type: 'error', text: errMsg(err) }); }
  };
  const close = async (id) => { await api.patch(`/jobs/${id}/close`).catch(() => {}); load(); };

  return (
    <div className="two-col">
      <section>
        <h1>Your jobs</h1>
        {jobs.length === 0 && <p className="muted">No jobs yet. Post your first one.</p>}
        {jobs.map((j) => (
          <div className="card app" key={j._id}>
            <div>
              <strong>{j.title}</strong>
              <p className="muted">{j.location} · {j.workMode} · {j.status}</p>
            </div>
            <div className="row">
              <Link className="btn ghost small" to={`/dashboard/jobs/${j._id}`}>{j.applicants} applicant{j.applicants === 1 ? '' : 's'}</Link>
              {j.status === 'open' && <button className="link" onClick={() => close(j._id)}>Close</button>}
            </div>
          </div>
        ))}
      </section>

      <form className="card" onSubmit={post}>
        <h2>Post a job</h2>
        <label>Title<input value={f.title} onChange={set('title')} required /></label>
        <label>Description<textarea rows="4" value={f.description} onChange={set('description')} required /></label>
        <label>Skills (comma separated)<input value={f.skills} onChange={set('skills')} placeholder="react, node" /></label>
        <label>Location<input value={f.location} onChange={set('location')} required /></label>
        <label>Work mode
          <select value={f.workMode} onChange={set('workMode')}><option value="onsite">Onsite</option><option value="hybrid">Hybrid</option><option value="remote">Remote</option></select>
        </label>
        <div className="row">
          <label>Min exp<input type="number" min="0" value={f.minExp} onChange={set('minExp')} /></label>
          <label>CTC min<input type="number" min="0" value={f.ctcMin} onChange={set('ctcMin')} /></label>
          <label>CTC max<input type="number" min="0" value={f.ctcMax} onChange={set('ctcMax')} /></label>
        </div>
        <button className="btn">Post job</button>
        {msg.text && <p className={msg.type}>{msg.text}</p>}
      </form>
    </div>
  );
}
