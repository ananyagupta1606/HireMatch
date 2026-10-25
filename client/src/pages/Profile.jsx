import { useEffect, useState } from 'react';
import api, { errMsg } from '../api.js';

export default function Profile() {
  const [f, setF] = useState({ headline: '', skills: '', experienceYears: 0, expectedCtc: 0 });
  const [msg, setMsg] = useState({ type: '', text: '' });
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });

  useEffect(() => {
    api.get('/profile/me').then((r) => setF({ ...r.data, skills: (r.data.skills || []).join(', ') }))
      .catch((e) => setMsg({ type: 'error', text: errMsg(e) }));
  }, []);

  const save = async (e) => {
    e.preventDefault();
    try {
      await api.put('/profile/me', f);
      setMsg({ type: 'ok', text: 'Saved. Your match scores are updated.' });
    } catch (err) { setMsg({ type: 'error', text: errMsg(err) }); }
  };

  return (
    <form className="card narrow" onSubmit={save}>
      <h2>My skills</h2>
      <p className="muted">These power the match ring on every job.</p>
      <label>Headline<input value={f.headline} onChange={set('headline')} placeholder="e.g. Final-year CS student" /></label>
      <label>Skills (comma separated)<input value={f.skills} onChange={set('skills')} placeholder="react, node, mongodb" /></label>
      <label>Experience (years)<input type="number" min="0" value={f.experienceYears} onChange={set('experienceYears')} /></label>
      <label>Expected CTC (LPA)<input type="number" min="0" value={f.expectedCtc} onChange={set('expectedCtc')} /></label>
      <button className="btn">Save profile</button>
      {msg.text && <p className={msg.type}>{msg.text}</p>}
    </form>
  );
}
