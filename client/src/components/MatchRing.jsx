// The signature element: a ring showing how much of the job's skill list you cover
export default function MatchRing({ score }) {
  const tier = score >= 75 ? 'strong' : score >= 40 ? 'medium' : 'low';
  const color = {
    strong: '#3e9078',
    medium: '#d79a17',
    low: '#b85c55',
  }[tier];

  return (
    <div
      className={`ring ring--${tier}`}
      style={{ background: `conic-gradient(${color} ${score * 3.6}deg, var(--line) 0)` }}
      title={`Skill match: ${score}%`}
      aria-label={`Skill match: ${score}%`}
    >
      <span>{score}%</span>
    </div>
  );
}
