import { Link } from "react-router-dom";
import MatchRing from "./MatchRing.jsx";

export default function JobCard({ job }) {
	return (
		<Link to={`/jobs/${job._id}`} className="card job">
			<div className="job-top">
				<div>
					<h3>{job.title}</h3>
					<p className="muted">
						{job.company} · {job.location} · {job.workMode}
					</p>
				</div>
				{job.match && <MatchRing score={job.match.score} />}
			</div>
			<p className="muted">
				{job.minExp}+ yrs · {job.ctcMin}–{job.ctcMax} LPA
			</p>
			<div className="chips">
				{job.skills.map((s) => (
					<span
						key={s}
						className={`chip ${job.match ? (job.match.missing.includes(s) ? "miss" : "hit") : ""}`}
					>
						{s}
					</span>
				))}
			</div>
		</Link>
	);
}
