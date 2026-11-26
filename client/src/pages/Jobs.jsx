import { useEffect, useState } from "react";
import api, { errMsg } from "../api.js";
import JobCard from "../components/JobCard.jsx";
import { useAuth } from "../AuthContext.jsx";
import { Link } from "react-router-dom";

const EMPTY = {
	role: "",
	location: "",
	workMode: "",
	experienceLevel: "",
	ctc: "",
	skills: "",
};

export default function Jobs() {
	const { user } = useAuth();

	const [form, setForm] = useState(EMPTY);
	const [filters, setFilters] = useState(EMPTY);
	const [page, setPage] = useState(1);

	const [data, setData] = useState({
		jobs: [],
		total: 0,
		pages: 1,
		page: 1,
	});

	const [loading, setLoading] = useState(true);
	const [error, setError] = useState("");
	const activeFilterCount = Object.values(filters).filter(Boolean).length;

	const set = (key) => (e) => {
		setForm((prev) => ({
			...prev,
			[key]: e.target.value,
		}));
	};

	// Fetch jobs whenever filters, page, or user changes.
	useEffect(() => {
		setLoading(true);
		setError("");

		// Convert the experience dropdown into the existing minExp API parameter.
		const { experienceLevel, ...otherFilters } = filters;

		const params = Object.fromEntries(
			Object.entries({
				...otherFilters,
				minExp: experienceLevel,
				page,
			}).filter(([, value]) => value !== ""),
		);

		api.get("/jobs", { params })
			.then((response) => setData(response.data))
			.catch((e) => setError(errMsg(e)))
			.finally(() => setLoading(false));
	}, [filters, page, user]);

	const search = (e) => {
		e.preventDefault();
		setPage(1);
		setFilters({ ...form });
	};

	const reset = () => {
		setForm(EMPTY);
		setPage(1);
		setFilters(EMPTY);
	};

	return (
		<div className="jobs-page">
			<section className="jobs-hero">
				<div className="jobs-hero-copy">
					<span className="jobs-eyebrow">YOUR NEXT CHAPTER</span>
					<h1>Find a Role That Fits You.</h1>
					<p>
						Explore opportunities that match your skills, goals, and
						the way you want to work.
					</p>
					{user?.role === "candidate" ? (
						<p className="jobs-match-note">
							Your skill match appears on each job.{" "}
							<Link to="/profile">Keep your skills up to date</Link>
							.
						</p>
					) : (
						!user && (
							<p className="jobs-match-note">
								<Link to="/register">Create a candidate account</Link>{" "}
								to see your skill match on every job.
							</p>
						)
					)}
				</div>
				<div className="jobs-hero-art" aria-hidden="true">
					<div className="jobs-art-orbit jobs-art-orbit--one" />
					<div className="jobs-art-orbit jobs-art-orbit--two" />
					<div className="jobs-art-card">
						<span className="jobs-art-mark">H</span>
						<span className="jobs-art-line jobs-art-line--long" />
						<span className="jobs-art-line" />
						<span className="jobs-art-pills">
							<i />
							<i />
							<i />
						</span>
						<span className="jobs-art-check">✓</span>
					</div>
				</div>
			</section>

			<form className="jobs-filters" onSubmit={search}>
				<div className="jobs-filter-heading">
					<div>
						<span className="jobs-section-kicker">OPPORTUNITIES</span>
						<h2>Find Your Next Role</h2>
					</div>
					{activeFilterCount > 0 && (
						<span className="jobs-active-filters">
							{activeFilterCount} filter
							{activeFilterCount === 1 ? "" : "s"} applied
						</span>
					)}
				</div>
				<div className="jobs-filter-fields">
					<label>
						Job title or keyword
						<input
							placeholder="e.g. Product designer"
							value={form.role}
							onChange={set("role")}
						/>
					</label>
					<label>
						Location
						<input
							placeholder="e.g. Bengaluru"
							value={form.location}
							onChange={set("location")}
						/>
					</label>
					<label>
						Work mode
						<select value={form.workMode} onChange={set("workMode")}>
							<option value="">Any work mode</option>
							<option value="onsite">Onsite</option>
							<option value="hybrid">Hybrid</option>
							<option value="remote">Remote</option>
						</select>
					</label>
					<label>
						Experience
						<select
							value={form.experienceLevel}
							onChange={set("experienceLevel")}
						>
							<option value="">All experience levels</option>
							<option value="0">Fresher (0+ years)</option>
							<option value="1">1+ years</option>
							<option value="2">2+ years</option>
							<option value="3">3+ years</option>
							<option value="4">4+ years</option>
							<option value="5">5+ years</option>
						</select>
					</label>
					<label>
						Minimum salary
						<input
							type="number"
							min="0"
							placeholder="LPA"
							value={form.ctc}
							onChange={set("ctc")}
						/>
					</label>
					<label>
						Skills
						<input
							placeholder="e.g. React, Node"
							value={form.skills}
							onChange={set("skills")}
						/>
					</label>
				</div>
				<div className="jobs-filter-actions">
					<button type="submit" className="btn">
						Search Jobs <span aria-hidden="true">→</span>
					</button>
					<button type="button" className="jobs-clear-button" onClick={reset}>
						Clear Filters
					</button>
				</div>
			</form>

			<section className="jobs-results" aria-live="polite">
				<div className="jobs-results-heading">
					<div>
						<span className="jobs-section-kicker">CURATED FOR YOU</span>
						<h2>{loading ? "Browse Open Roles" : "Open Roles"}</h2>
					</div>
					{!loading && !error && (
						<span className="jobs-result-count">
							<strong>{data.total}</strong>{" "}
							{data.total === 1 ? "opportunity" : "opportunities"}
						</span>
					)}
				</div>

				{error ? (
					<div className="jobs-empty-state jobs-error-state" role="alert">
						<span className="jobs-empty-icon" aria-hidden="true">!</span>
						<h3>We couldn’t load the jobs</h3>
						<p>{error}</p>
					</div>
				) : loading ? (
					<div className="jobs-grid" role="status" aria-label="Loading jobs">
						{[0, 1, 2].map((item) => (
							<div className="jobs-skeleton" key={item}>
								<span />
								<span />
								<span />
								<span />
							</div>
						))}
					</div>
				) : data.jobs.length === 0 ? (
					<div className="jobs-empty-state">
						<span className="jobs-empty-icon" aria-hidden="true">⌕</span>
						<h3>No roles found this time</h3>
						<p>Try a broader search or clear your filters to see more opportunities.</p>
						<button type="button" className="btn ghost" onClick={reset}>
							Clear all filters
						</button>
					</div>
				) : (
					<div className="jobs-grid">
						{data.jobs.map((job) => (
							<JobCard key={job._id} job={job} />
						))}
					</div>
				)}

				{!loading && !error && data.pages > 1 && (
					<div className="jobs-pager">
						<button
							type="button"
							className="btn ghost"
							disabled={page <= 1}
							onClick={() => setPage((prev) => prev - 1)}
						>
							← Previous
						</button>
						<span>
							Page <strong>{data.page || page}</strong> of{" "}
							<strong>{data.pages}</strong>
						</span>
						<button
							type="button"
							className="btn ghost"
							disabled={page >= data.pages}
							onClick={() => setPage((prev) => prev + 1)}
						>
							Next →
						</button>
					</div>
				)}
			</section>
		</div>
	);
}
