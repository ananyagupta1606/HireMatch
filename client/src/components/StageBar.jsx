const STEPS = ['applied', 'shortlisted', 'interview', 'offered'];

export default function StageBar({ stage }) {
  if (stage === 'rejected') return <div className="steps"><span className="step rejected">Rejected</span></div>;
  const at = STEPS.indexOf(stage);
  return (
    <div className="steps">
      {STEPS.map((s, i) => <span key={s} className={`step ${i < at ? 'done' : i === at ? 'now' : ''}`}>{s}</span>)}
    </div>
  );
}
