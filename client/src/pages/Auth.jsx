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
  const [showPassword, setShowPassword] = useState(false);

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
          <div className="password-input">
            <input
              type={showPassword ? 'text' : 'password'}
              value={f.password}
              onChange={set('password')}
              minLength={6}
              required
              disabled={busy}
            />
            <button
              className="password-toggle"
              type="button"
              onClick={() => setShowPassword((shown) => !shown)}
              aria-label={showPassword ? 'Hide password' : 'Show password'}
              aria-pressed={showPassword}
              disabled={busy}
            >
              <svg
                aria-hidden="true"
                viewBox="0 0 24 24"
                width="20"
                height="20"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7-10-7-10-7Z" />
                <circle cx="12" cy="12" r="3" />
                {showPassword && <path d="m4 4 16 16" />}
              </svg>
            </button>
          </div>
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
