import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import api, { errMsg } from '../api.js';
import { useAuth } from '../AuthContext.jsx';

export default function Auth({ mode }) {
  const isReg = mode === 'register';
  const [f, setF] = useState({ name: '', email: '', password: '', role: 'candidate', company: '' });
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const { login } = useAuth();
  const nav = useNavigate();
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });

  const submit = async (e) => {
    e.preventDefault();
    setError('');
    setBusy(true);

    try {
      const { data } = await api.post(isReg ? '/auth/register' : '/auth/login', f);
      login(data);
      nav(data.user.role === 'recruiter' ? '/dashboard' : '/');
    } catch (err) {
      setError(errMsg(err));
    }

    setBusy(false);
  };

  return (
    <form className="card narrow" onSubmit={submit}>
      <h2>{isReg ? 'Create your account' : 'Log in'}</h2>

      {isReg && (
        <>
          <label>
            I am a
            <select value={f.role} onChange={set('role')}>
              <option value="candidate">Candidate looking for jobs</option>
              <option value="recruiter">Recruiter hiring people</option>
            </select>
          </label>

          <label>
            Full name
            <input value={f.name} onChange={set('name')} required />
          </label>

          {f.role === 'recruiter' && (
            <label>
              Company
              <input value={f.company} onChange={set('company')} required />
            </label>
          )}
        </>
      )}

      <label>
        Email
        <input type="email" value={f.email} onChange={set('email')} required />
      </label>

      <label>
        Password
        <input
          type="password"
          value={f.password}
          onChange={set('password')}
          minLength={6}
          required
        />
      </label>

      {error && <p className="error">{error}</p>}

      <button className="btn" disabled={busy}>
        {busy ? 'Please wait…' : isReg ? 'Sign up' : 'Log in'}
      </button>

      <p className="muted">
        {isReg ? (
          <>Have an account? <Link to="/login">Log in</Link></>
        ) : (
          <>New here? <Link to="/register">Sign up</Link></>
        )}
      </p>
    </form>
  );
}
;
