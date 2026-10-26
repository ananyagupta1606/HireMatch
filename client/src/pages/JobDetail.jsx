import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import api, { errMsg } from "../api.js";
import { useAuth } from "../AuthContext.jsx";
import MatchRing from "../components/MatchRing.jsx";

export default function JobDetail() {
	const { id } = useParams();
	const { user } = useAuth();

	const [job, setJob] = useState(null);
	const [note, setNote] = useState("");
	const [msg, setMsg] = useState({ type: "", text: "" });
	const [error, setError] = useState("");

	useEffect(() => {
		setJob(null);
		setError("");

		api.get(`/jobs/${id}`)
			.then((r) => setJob(r.data))
			.catch((e) => setError(errMsg(e)));
	}, [id, user]);

	const apply = async () => {
		if (!job || job.eligibleByExperience === false) {
			return;
		}

		setMsg({ type: "", text: "" });

		try {
			await api.post("/applications", {
				jobId: id,
				coverNote: note,
			});

			setJob((prev) => ({
				...prev,
				applied: true,
			}));

			setMsg({
				type: "ok",
				text: "Application sent. Track it under My applications.",
			});
		} catch (e) {
			setMsg({
				type: "error",
				text: errMsg(e),
			});
		}
	};

	if (error) {
		return <p className="error">{error}</p>;
	}

	if (!job) {
		return <p className="muted">Loading…</p>;
	}

	// Check whether the candidate meets the minimum experience requirement.
	const experienceRequired = Number(job.minExp ?? 0);
	const candidateExperience =
		job.candidateExperience == null
			? null
			: Number(job.candidateExperience);

	const experienceMismatch =
		user?.role === "candidate" &&
		(job.eligibleByExperience === false ||
			(candidateExperience !== null &&
				candidateExperience < experienceRequired));

	return (
		<div className="card detail">
			<div className="job-top">
				<div>
					<h1>{job.title}</h1>

					<p className="muted">
						{job.company} · {job.location} · {job.workMode} ·{" "}
						{job.minExp}+ yrs · {job.ctcMin}–{job.ctcMax} LPA
					</p>
				</div>

				{job.match && <MatchRing score={job.match.score} />}
			</div>

			<p>{job.description}</p>

			<h3>Skills needed</h3>

			<div className="chips">
				{job.skills.map((skill) => (
					<span
						key={skill}
						className={`chip ${
							job.match
								? job.match.missing.includes(skill)
									? "miss"
									: "hit"
								: ""
						}`}
					>
						{skill}
					</span>
				))}
			</div>

			{job.match?.missing.length > 0 && (
				<p className="muted">
					Skill gap: learn {job.match.missing.join(", ")} to reach
					100%.
				</p>
			)}

			<hr />

			{job.status === "closed" ? (
				<p className="muted">This job is closed.</p>
			) : !user ? (
				<p>
					<Link to="/login">Log in</Link> as a candidate to apply.
				</p>
			) : user.role !== "candidate" ? (
				<p className="muted">Only candidates can apply.</p>
			) : job.applied ? (
				<p className="ok">You have applied to this job.</p>
			) : (
				<>
					{experienceMismatch && (
						<div className="eligibility-warning">
							<strong>Experience requirement not met</strong>

							<p>
								This position requires at least{" "}
								{experienceRequired}{" "}
								{experienceRequired === 1 ? "year" : "years"} of
								experience.
								{candidateExperience !== null ? (
									<>
										{" "}
										Your profile currently shows{" "}
										{candidateExperience}{" "}
										{candidateExperience === 1
											? "year"
											: "years"}
										.
									</>
								) : (
									<>
										{" "}
										Your experience could not be verified.
										Please update your profile.
									</>
								)}
							</p>
						</div>
					)}

					{!experienceMismatch && (
						<label>
							Cover note (optional)
							<textarea
								rows="3"
								maxLength="1000"
								value={note}
								onChange={(e) => setNote(e.target.value)}
							/>
						</label>
					)}

					<button
						type="button"
						className="btn"
						onClick={apply}
						disabled={experienceMismatch}
						title={
							experienceMismatch
								? "You do not meet the minimum experience requirement."
								: ""
						}
					>
						{experienceMismatch
							? "Not eligible to apply"
							: "Apply now"}
					</button>
				</>
			)}

			{msg.text && <p className={msg.type}>{msg.text}</p>}
		</div>
	);
}
