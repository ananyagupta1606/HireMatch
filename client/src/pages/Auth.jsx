import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { GoogleLogin } from '@react-oauth/google';
import api, { errMsg } from '../api.js';
import { useAuth } from '../AuthContext.jsx';

export default function Auth({ mode }) {
  const isReg = mode === 'register';

  const [f, setF] = useState({
    name: '',
    email: '',
    password: '',
    role: 'candidate',
    company: '',
  });

  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const { login } = useAuth();
  const nav = useNavigate();

  const set = (k) => (e) =>
    setF({ ...f, [k]: e.target.value });

  const finishLogin = (data) => {
    login(data);
    nav(data.user.role === 'recruiter' ? '/dashboard' : '/');
  };

  const submit = async (e) => {
    e.preventDefault();
    setError('');
    setBusy(true);

    try {
      const { data } = await api.post(
        isReg ? '/auth/register' : '/auth/login',
        f
      );

      finishLogin(data);
    } catch (err) {
      setError(errMsg(err));
    } finally {
      setBusy(false);
    }
  };

  const handleGoogleSuccess = async (credentialResponse) => {
    if (!credentialResponse.credential) {
      setError('Google sign-in did not return a credential.');
      return;
    }

    setError('');
    setBusy(true);

    try {
      const { data } = await api.post('/auth/google', {
        credential: credentialResponse.credential,
      });

      finishLogin(data);
    } catch (err) {
      setError(errMsg(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="card narrow">
      <form onSubmit={submit}>
        <h2>{isReg ? 'Create your account' : 'Log in'}</h2>

        {isReg && (
          <>
            <label>
              I am a
              <select
                value={f.role}
                onChange={set('role')}
                disabled={busy}
              >
                <option value="candidate">
                  Candidate looking for jobs
                </option>
                <option value="recruiter">
                  Recruiter hiring people
                </option>
              </select>
            </label>

            <label>
              Full name
              <input
                value={f.name}
                onChange={set('name')}
                required
                disabled={busy}
              />
            </label>

            {f.role === 'recruiter' && (
              <label>
                Company
                <input
                  value={f.company}
                  onChange={set('company')}
                  required
                  disabled={busy}
                />
              </label>
            )}
          </>
        )}

        <label>
          Email
          <input
            type="email"
            value={f.email}
            onChange={set('email')}
            required
            disabled={busy}
          />
        </label>

        <label>
          Password
          <input
            type="password"
            value={f.password}
            onChange={set('password')}
            minLength={6}
            required
            disabled={busy}
          />
        </label>

        {error && <p className="error">{error}</p>}

        <button className="btn" type="submit" disabled={busy}>
          {busy
            ? 'Please wait…'
            : isReg
              ? 'Sign up'
              : 'Log in'}
        </button>

        <p className="muted">
          {isReg ? (
            <>
              Have an account? <Link to="/login">Log in</Link>
            </>
          ) : (
            <>
              New here? <Link to="/register">Sign up</Link>
            </>
          )}
        </p>
      </form>

      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '12px',
          margin: '20px 0',
        }}
      >
        <hr style={{ flex: 1 }} />
        <span className="muted">OR</span>
        <hr style={{ flex: 1 }} />
      </div>

      <div style={{ display: 'flex', justifyContent: 'center' }}>
        <GoogleLogin
          onSuccess={handleGoogleSuccess}
          onError={() => setError('Google sign-in failed. Please try again.')}
          useOneTap={false}
          theme="outline"
          size="large"
          text={isReg ? 'signup_with' : 'signin_with'}
          shape="rectangular"
        />
      </div>
    </div>
  );
}
;
