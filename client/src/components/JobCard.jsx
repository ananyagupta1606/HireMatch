import { Link } from "react-router-dom";
import MatchRing from "./MatchRing.jsx";

export default function JobCard({ job }) {
	return (
		<Link to={`/jobs/${job._id}`} className="card job jobs-job-card">
			<div className="jobs-card-heading">
				<div className="jobs-card-title">
					<h3>{job.title}</h3>
					<p>{job.company}</p>
				</div>
				{job.match && (
					<div className="jobs-card-match">
						<MatchRing score={job.match.score} />
						<span>skill match</span>
					</div>
				)}
			</div>
			<div className="jobs-card-tags">
				<span>{job.location}</span>
				<span>{job.workMode}</span>
			</div>
			<div className="jobs-card-details">
				<span>
					<strong>{job.minExp}+</strong> yrs experience
				</span>
				<span>
					<strong>{job.ctcMin}–{job.ctcMax}</strong> LPA
				</span>
			</div>
			{job.skills?.length > 0 && (
				<div className="chips">
					{job.skills.slice(0, 4).map((skill) => (
						<span
							key={skill}
							className={`chip ${job.match ? (job.match.missing.includes(skill) ? "miss" : "hit") : ""}`}
						>
							{skill}
						</span>
					))}
					{job.skills.length > 4 && (
						<span className="chip jobs-extra-skill">
							+{job.skills.length - 4}
						</span>
					)}
				</div>
			)}
			<span className="jobs-card-link">
				View job details <span aria-hidden="true">→</span>
			</span>
		</Link>
	);
}
