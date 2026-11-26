import { Link } from "react-router-dom";
import MatchRing from "./MatchRing.jsx";
import { formatLabel } from "../format.js";

export default function JobCard({ job }) {
	return (
		<Link
			to={`/jobs/${job._id}`}
			state={{ from: "jobs" }}
			className="card job jobs-job-card"
		>
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
				<span>{formatLabel(job.location)}</span>
				<span>{formatLabel(job.workMode)}</span>
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
							{formatLabel(skill)}
						</span>
					))}
					{job.skills.length > 4 && (
						<span className="chip jobs-extra-skill">
							+{job.skills.length - 4}
						</span>
					)}
				</div>
			)}
			{job.applied || job.eligibleByExperience === false ? (
				<div className="jobs-card-status">
					<span className="jobs-card-availability">
						<span className="jobs-card-availability-icon" aria-hidden="true">
							{job.applied ? "✓" : "!"}
						</span>
						{job.applied ? "Already Applied" : "Not Eligible"}
					</span>
				</div>
			) : null}
			<span className="jobs-card-link">
				View Job Details <span aria-hidden="true">→</span>
			</span>
		</Link>
	);
}
