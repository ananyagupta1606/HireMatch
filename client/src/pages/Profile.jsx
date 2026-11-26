import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api, { errMsg } from '../api.js';

const SKILL_CATEGORIES = {
  Frontend: [
    'HTML', 'CSS', 'JavaScript', 'TypeScript', 'React',
    'Next.js', 'Tailwind CSS', 'Bootstrap', 'Redux', 'Angular'
  ],
  Backend: [
    'Node.js', 'Express.js', 'Python', 'Java', 'C++',
    'C#', 'PHP', 'Spring Boot', 'Django', 'Flask', 'REST APIs'
  ],
  Database: [
    'MongoDB', 'MySQL', 'PostgreSQL', 'SQL', 'Redis',
    'Firebase', 'Oracle'
  ],
  Tools: [
    'Git', 'GitHub', 'Docker', 'Postman', 'Linux',
    'AWS', 'Azure', 'Vercel', 'Figma'
  ],
  'Data & AI': [
    'Data Structures', 'Algorithms', 'Machine Learning',
    'Artificial Intelligence', 'Pandas', 'NumPy',
    'TensorFlow', 'Data Analysis'
  ],
};

const SKILL_LABELS = new Map(
  Object.values(SKILL_CATEGORIES)
    .flat()
    .map((skill) => [skill.toLowerCase(), skill])
);

const normalizeSkill = (skill) => skill.trim();
const displaySkill = (skill) => SKILL_LABELS.get(skill.toLowerCase()) || skill;

export default function Profile() {
  const [f, setF] = useState({
    headline: '',
    skills: [],
    experienceYears: 0,
    expectedCtc: 0,
  });

  const [search, setSearch] = useState('');
  const [activeCategory, setActiveCategory] = useState('All');
  const [msg, setMsg] = useState({ type: '', text: '' });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const navigate = useNavigate();
  const [resume, setResume] = useState(null);
  const [selectedResume, setSelectedResume] = useState(null);
  const [uploadingResume, setUploadingResume] = useState(false);
  const [downloadingResume, setDownloadingResume] = useState(false);
  const [removingResume, setRemovingResume] = useState(false);
  const resumeInput = useRef(null);

  const categories = ['All', ...Object.keys(SKILL_CATEGORIES)];

  useEffect(() => {
    api.get('/profile/me')
      .then(({ data }) => {
        setF({
          headline: data.headline || '',
          skills: Array.isArray(data.skills) ? data.skills : [],
          experienceYears: data.experienceYears ?? 0,
          expectedCtc: data.expectedCtc ?? 0,
        });
        setResume(data.resume || null);
      })
      .catch((err) => {
        setMsg({ type: 'error', text: errMsg(err) });
      })
      .finally(() => setLoading(false));
  }, []);

  const updateField = (key) => (e) => {
    setF((prev) => ({ ...prev, [key]: e.target.value }));
  };

  const toggleSkill = (skill) => {
    setF((prev) => {
      const exists = prev.skills.some(
        (item) => item.toLowerCase() === skill.toLowerCase()
      );

      return {
        ...prev,
        skills: exists
          ? prev.skills.filter(
              (item) => item.toLowerCase() !== skill.toLowerCase()
            )
          : [...prev.skills, skill],
      };
    });

    setMsg({ type: '', text: '' });
  };

  const toggleSkillFromPicker = (skill) => {
    toggleSkill(skill);
    setSearch('');
    setActiveCategory('All');
  };

  const addCustomSkill = (e) => {
    e.preventDefault();

    const enteredSkill = normalizeSkill(search);
    if (!enteredSkill) return;
    const skill = Object.values(SKILL_CATEGORIES)
      .flat()
      .find((suggested) => suggested.toLowerCase() === enteredSkill.toLowerCase())
      || enteredSkill;

    const exists = f.skills.some(
      (item) => item.toLowerCase() === skill.toLowerCase()
    );

    if (exists) {
      setMsg({ type: 'error', text: 'This skill is already selected.' });
      return;
    }

    setF((prev) => ({
      ...prev,
      skills: [...prev.skills, skill],
    }));

    setSearch('');
    setActiveCategory('All');
    setMsg({ type: '', text: '' });
  };

  const availableSkills = Object.entries(SKILL_CATEGORIES)
    .filter(([category]) =>
      activeCategory === 'All' || activeCategory === category
    )
    .flatMap(([category, skills]) =>
      skills.map((skill) => ({ skill, category }))
    )
    .filter(({ skill }) =>
      skill.toLowerCase().includes(search.trim().toLowerCase())
    );

  const matchingSuggestedSkill = Object.entries(SKILL_CATEGORIES)
    .flatMap(([category, skills]) => skills.map((skill) => ({ category, skill })))
    .find(({ skill }) => skill.toLowerCase() === search.trim().toLowerCase());
  const skillToAdd = matchingSuggestedSkill?.skill || normalizeSkill(search);
  const searchSkillSelected = f.skills.some(
    (skill) => skill.toLowerCase() === skillToAdd.toLowerCase()
  );

  const save = async (e) => {
    e.preventDefault();
    setSaving(true);
    setMsg({ type: '', text: '' });

    try {
      await api.put('/profile/me', {
        ...f,
        experienceYears: Number(f.experienceYears),
        expectedCtc: Number(f.expectedCtc),
        skills: f.skills,
      });

      setMsg({
        type: 'ok',
        text: 'Profile saved successfully! Your job match scores are updated.',
      });

      // Redirect to the jobs page after saving the profile
      navigate('/');
    } catch (err) {
      setMsg({ type: 'error', text: errMsg(err) });
    } finally {
      setSaving(false);
    }
  };

  const uploadResume = async () => {
    if (!selectedResume) {
      setMsg({ type: 'error', text: 'Choose a PDF, DOC, or DOCX resume to upload.' });
      return;
    }

    setUploadingResume(true);
    setMsg({ type: '', text: '' });

    try {
      const formData = new FormData();
      formData.append('resume', selectedResume);
      const { data } = await api.post('/profile/resume', formData);
      setResume(data.resume);
      setSelectedResume(null);
      if (resumeInput.current) resumeInput.current.value = '';
      setMsg({ type: 'ok', text: 'Resume uploaded successfully.' });
    } catch (err) {
      setMsg({ type: 'error', text: errMsg(err) });
    } finally {
      setUploadingResume(false);
    }
  };

  const downloadResume = async () => {
    setDownloadingResume(true);
    setMsg({ type: '', text: '' });

    try {
      const { data } = await api.get('/profile/resume', { responseType: 'blob' });
      const url = URL.createObjectURL(data);
      const link = document.createElement('a');
      link.href = url;
      link.download = resume.originalName;
      link.click();
      setTimeout(() => URL.revokeObjectURL(url), 0);
    } catch (err) {
      setMsg({ type: 'error', text: errMsg(err) });
    } finally {
      setDownloadingResume(false);
    }
  };

  const removeResume = async () => {
    if (!window.confirm('Remove your uploaded resume?')) return;

    setRemovingResume(true);
    setMsg({ type: '', text: '' });

    try {
      await api.delete('/profile/resume');
      setResume(null);
      setMsg({ type: 'ok', text: 'Resume removed successfully.' });
    } catch (err) {
      setMsg({ type: 'error', text: errMsg(err) });
    } finally {
      setRemovingResume(false);
    }
  };

  if (loading) {
    return (
      <div className="profile-loading">
        <div className="profile-spinner" />
        <p>Loading your profile...</p>
      </div>
    );
  }

  return (
    <main className="profile-page">
      <header className="profile-heading">
        {/* <div className="profile-avatar">✦</div> */}
        <div>
          <span className="profile-eyebrow">CANDIDATE PROFILE</span>
          <h1>Build your professional profile</h1>
          <p>
            Showcase your skills and discover opportunities that match your
            strengths.
          </p>
        </div>
      </header>

      <form className="profile-card" onSubmit={save}>
        <section className="profile-section">
          <div className="section-heading">
            <div>
              <h2>Professional details</h2>
              <p>Tell recruiters a little about yourself.</p>
            </div>
            {/* <span className="section-number">01</span> */}
          </div>

          <label className="profile-label">
            Professional headline
            <input
              type="text"
              value={f.headline}
              onChange={updateField('headline')}
              placeholder="e.g. CS student passionate about full-stack development"
              maxLength={120}
            />
            <span className="field-hint">
              A short introduction that represents you professionally.
            </span>
          </label>

          <div className="profile-grid">
            <label className="profile-label">
              Experience
              <div className="input-with-suffix">
                <input
                  type="number"
                  min="0"
                  max="60"
                  step="1"
                  value={f.experienceYears}
                  onChange={updateField('experienceYears')}
                  required
                />
                <span>years</span>
              </div>
            </label>

            <label className="profile-label">
              Expected CTC
              <div className="input-with-suffix">
                <input
                  type="number"
                  min="0"
                  max="1000"
                  step="0.1"
                  value={f.expectedCtc}
                  onChange={updateField('expectedCtc')}
                  required
                />
                <span>LPA</span>
              </div>
            </label>
          </div>
        </section>

        <section className="profile-section">
          <div className="section-heading">
            <div>
              <h2>Your resume</h2>
              <p>Upload a PDF, DOC, or DOCX file (maximum 5 MB).</p>
            </div>
          </div>

          {resume && (
            <div className="resume-current">
              <div className="resume-current-main">
                <span className="resume-file-icon" aria-hidden="true">
                  <svg viewBox="0 0 24 24" fill="none">
                    <path d="M7 3.75h6.5L19 9.2v10.05a1 1 0 0 1-1 1H7a2 2 0 0 1-2-2v-12a2.5 2.5 0 0 1 2-2.5Z" />
                    <path d="M13 4v5.5h5.5M8.5 13h7M8.5 16h7" />
                  </svg>
                </span>
                <span className="resume-current-details">
                  <span className="resume-current-label">Current resume</span>
                  <strong>{resume.originalName}</strong>
                </span>
              </div>
              <div className="actions resume-current-actions">
                <button
                  type="button"
                  className="btn ghost small"
                  onClick={downloadResume}
                  disabled={downloadingResume || removingResume}
                >
                  {downloadingResume ? 'Downloading...' : 'Download'}
                </button>
                <button
                  type="button"
                  className="btn danger small"
                  onClick={removeResume}
                  disabled={removingResume || uploadingResume}
                >
                  {removingResume ? 'Removing...' : 'Remove'}
                </button>
              </div>
            </div>
          )}

          <label className="profile-label resume-upload-label">
            <span className="resume-upload-title">
              {resume ? 'Choose a replacement resume' : 'Choose a resume'}
            </span>
            <input
              ref={resumeInput}
              type="file"
              accept=".pdf,.doc,.docx,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
              onChange={(e) => setSelectedResume(e.target.files?.[0] || null)}
            />
          </label>

          {selectedResume && (
            <p className="field-hint resume-selected-file">
              Ready to upload: <strong>{selectedResume.name}</strong>
            </p>
          )}

          <button
            type="button"
            className="profile-save-button resume-upload-button"
            onClick={uploadResume}
            disabled={uploadingResume || removingResume || !selectedResume}
          >
            {uploadingResume ? 'Uploading resume...' : 'Upload resume'}
          </button>
        </section>

        <section className="profile-section">
          <div className="section-heading">
            <div>
              <h2>Your skill set</h2>
              <p>Select skills to improve your job recommendations.</p>
            </div>
            <span className="skill-count">{f.skills.length} selected</span>
          </div>

          <div className="selected-skills">
            {f.skills.length > 0 ? (
              f.skills.map((skill) => {
                const label = displaySkill(skill);
                return (
                  <span className="selected-skill" key={skill.toLowerCase()}>
                    {label}
                    <button
                      type="button"
                      onClick={() => toggleSkill(skill)}
                      aria-label={`Remove ${label}`}
                      title={`Remove ${label}`}
                    >
                      ×
                    </button>
                  </span>
                );
              })
            ) : (
              <p className="empty-skills">
                No skills selected yet. Choose some below to get started.
              </p>
            )}
          </div>

          <label className="profile-label skill-search-label">
            Find or add a skill
            <div className="skill-search">
              <span aria-hidden="true">⌕</span>
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search React, Python, MongoDB..."
                aria-label="Search available skills or enter a custom skill"
              />
              {search.trim() && (
                <button type="button" onClick={() => setSearch('')}>
                  Clear
                </button>
              )}
            </div>
          </label>

          <div className="skill-categories" aria-label="Skill categories">
            {categories.map((category) => (
              <button
                type="button"
                key={category}
                className={`category-button ${
                  activeCategory === category ? 'active' : ''
                }`}
                onClick={() => setActiveCategory(category)}
              >
                {category}
              </button>
            ))}
          </div>

          <div className="skill-picker">
            {availableSkills.map(({ skill, category }) => {
              const selected = f.skills.some(
                (item) => item.toLowerCase() === skill.toLowerCase()
              );

              return (
                <button
                  type="button"
                  key={skill}
                  className={`skill-option ${selected ? 'selected' : ''}`}
                  onClick={() => toggleSkillFromPicker(skill)}
                  aria-pressed={selected}
                  title={category}
                >
                  <span className="skill-check">
                    {selected ? '✓' : '+'}
                  </span>
                  {skill}
                </button>
              );
            })}

            {availableSkills.length === 0 && (
              <p className="no-skills">
                {matchingSuggestedSkill
                  ? `${matchingSuggestedSkill.skill} is a suggested skill in ${matchingSuggestedSkill.category}.`
                  : `No suggested skills found. You can add "${search.trim()}" as a custom skill.`}
              </p>
            )}
          </div>

          {search.trim() && !searchSkillSelected && (
            <button
              type="button"
              className="custom-skill-button"
              onClick={addCustomSkill}
            >
              {matchingSuggestedSkill
                ? `Select ${matchingSuggestedSkill.skill}`
                : `+ Add "${search.trim()}" as a custom skill`}
            </button>
          )}

          <p className="field-hint skill-hint">
            Select as many relevant skills as you have. Click a selected skill
            again to remove it.
          </p>
        </section>

        {msg.text && (
          <div
            className={`profile-message ${msg.type}`}
            role={msg.type === 'error' ? 'alert' : 'status'}
          >
            <span>{msg.type === 'ok' ? '✓' : '!'}</span>
            {msg.text}
          </div>
        )}

        <footer className="profile-footer">
          <span>Your profile helps calculate job compatibility.</span>
          <button className="profile-save-button" type="submit" disabled={saving}>
            {saving ? 'Saving profile...' : 'Save profile'}
            {!saving && <span aria-hidden="true"> →</span>}
          </button>
        </footer>
      </form>
    </main>
  );
}