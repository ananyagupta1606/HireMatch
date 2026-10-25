// The signature element: a ring showing how much of the job's skill list you cover
export default function MatchRing({ score }) {
  const color = score >= 75 ? 'var(--good)' : score >= 40 ? 'var(--mid)' : 'var(--bad)';
  return (
    <div className="ring" style={{ background: `conic-gradient(${color} ${score * 3.6}deg, var(--line) 0)` }} title="Skill match">
      <span>{score}%</span>
    </div>
  );
}
