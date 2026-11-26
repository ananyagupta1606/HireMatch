import { formatLabel } from "../format.js";

const STEPS = ['applied', 'shortlisted', 'interview', 'offered'];

export default function StageBar({ stage }) {
  if (stage === 'rejected') return <div className="steps"><span className="step rejected">Rejected</span></div>;
  if (stage === 'withdrawn') return <div className="steps"><span className="step withdrawn">Withdrawn</span></div>;
  const at = STEPS.indexOf(stage);
  return (
    <div className="steps">
      {STEPS.map((s, i) => <span key={s} className={`step step--${s} ${i < at ? 'done' : i === at ? 'now' : ''}`}>{formatLabel(s)}</span>)}
    </div>
  );
}
