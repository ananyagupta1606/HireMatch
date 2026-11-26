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

	const backLink = (
		<Link
			className="btn ghost small job-detail-back"
			to={user?.role === "recruiter" ? "/dashboard" : "/"}
		>
			{user?.role === "recruiter"
				? "← Back to dashboard"
				: "← Back to jobs"}
		</Link>
	);

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
		return (
			<div className="job-detail-page">
				{backLink}
				<div className="job-detail-state job-detail-state--error" role="alert">
					<h2>We couldn’t load this job</h2>
					<p>{error}</p>
				</div>
			</div>
		);
	}

	if (!job) {
		return (
			<div className="job-detail-page">
				{backLink}
				<div className="job-detail-state" role="status">
					<span className="jobs-state-spinner" aria-hidden="true" />
					<p>Loading job details…</p>
				</div>
			</div>
		);
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
		<div className="job-detail-page">
			{backLink}
			<div className="job-detail-layout">
				<article className="job-detail-content">
					<header className="job-detail-header">
						<div className="job-detail-heading">
							<span className="job-detail-eyebrow">ROLE DETAILS</span>
							<h1>{job.title}</h1>
							<p className="job-detail-company">{job.company}</p>
							<div className="job-detail-meta">
								<span>{job.location}</span>
								<span>{job.workMode}</span>
								<span>{job.minExp}+ yrs experience</span>
								<span>{job.ctcMin}–{job.ctcMax} LPA</span>
							</div>
						</div>
						{job.match && (
							<div className="job-detail-match">
								<MatchRing score={job.match.score} />
								<strong>Skill match</strong>
								<span>Based on your profile</span>
							</div>
						)}
					</header>

					<section className="job-detail-section">
						<h2>About the role</h2>
						<p className="job-detail-description">{job.description}</p>
					</section>

					<section className="job-detail-section job-detail-skills">
						<div>
							<h2>Skills needed</h2>
							<p>Skills listed by the employer for this position.</p>
						</div>
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
							<p className="job-detail-skill-gap">
								Your profile doesn’t list{" "}
								{job.match.missing.join(", ")} yet. Adding relevant
								experience or skills to your profile may strengthen
								your match.
							</p>
						)}
					</section>
				</article>

				<aside className="job-apply-panel" aria-labelledby="job-apply-title">
					<span className="job-detail-eyebrow">APPLICATION</span>
					<h2 id="job-apply-title">Interested in this role?</h2>
					<p className="job-apply-intro">
						Review the details, then send your application to the employer.
					</p>

					{job.status === "closed" ? (
						<p className="job-apply-status">
							This job is closed and is no longer accepting applications.
						</p>
					) : !user ? (
						<p className="job-apply-status">
							<Link to="/login">Log in</Link> as a candidate to apply.
						</p>
					) : user.role !== "candidate" ? (
						<p className="job-apply-status">
							Only candidates can apply to this job.
						</p>
					) : job.applied ? (
						<p className="job-apply-success" role="status">
							<span aria-hidden="true">✓</span>
							You’ve applied to this job. Track your application from
							My Applications.
						</p>
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
											<> Your experience could not be verified. Please update your profile.</>
										)}
									</p>
								</div>
							)}

							{!experienceMismatch && (
								<div className="job-cover-note">
									<label htmlFor="cover-note">
										Cover note <span>(optional)</span>
									</label>
									<p id="cover-note-help">
										A short message to the employer about why
										you’re interested and what makes you a fit.
										It doesn’t need to be a full cover letter.
									</p>
									<textarea
										id="cover-note"
										rows="4"
										maxLength="1000"
										placeholder="Hi, I’m interested in this role because…"
										value={note}
										onChange={(e) => setNote(e.target.value)}
										aria-describedby="cover-note-help cover-note-count"
									/>
									<span
										className="job-cover-note-count"
										id="cover-note-count"
									>
										{note.length}/1000 characters
									</span>
								</div>
							)}

							<button
								type="button"
								className="btn job-apply-button"
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

					{msg.text && (
						<p
							className={`job-apply-message ${msg.type}`}
							role={msg.type === "error" ? "alert" : "status"}
						>
							{msg.text}
						</p>
					)}
				</aside>
			</div>
		</div>
	);
}
