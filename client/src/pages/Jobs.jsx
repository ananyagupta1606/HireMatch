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
		<>
			<h1>Find a role that fits your skills</h1>

			{user?.role === "candidate" ? (
				<p className="muted">
					The ring on each card shows how many of the job's skills you
					already have. <Link to="/profile">Update your skills</Link>{" "}
					to improve it.
				</p>
			) : (
				!user && (
					<p className="muted">
						<Link to="/register">Sign up as a candidate</Link> to
						see your skill match on every job.
					</p>
				)
			)}

			<form className="filters card" onSubmit={search}>
				<input
					placeholder="Job title"
					value={form.role}
					onChange={set("role")}
				/>

				<input
					placeholder="Location"
					value={form.location}
					onChange={set("location")}
				/>

				<select value={form.workMode} onChange={set("workMode")}>
					<option value="">Any work mode</option>
					<option value="onsite">Onsite</option>
					<option value="hybrid">Hybrid</option>
					<option value="remote">Remote</option>
				</select>

				{/* Separate experience-level filter */}
				<select
					value={form.experienceLevel}
					onChange={set("experienceLevel")}
				>
					<option value="">All experience levels</option>
					<option value="0">Fresher (0+ years required)</option>
					<option value="1">1+ years required</option>
					<option value="2">2+ years required</option>
					<option value="3">3+ years required</option>
					<option value="4">4+ years required</option>
					<option value="5">5+ years required</option>
				</select>

				<input
					type="number"
					min="0"
					placeholder="Min CTC (LPA)"
					value={form.ctc}
					onChange={set("ctc")}
				/>

				<input
					placeholder="Skills: react, node"
					value={form.skills}
					onChange={set("skills")}
				/>

				<button type="submit" className="btn">
					Search
				</button>

				<button type="button" className="link" onClick={reset}>
					Clear
				</button>
			</form>

			{error && <p className="error">{error}</p>}

			{loading ? (
				<p className="muted">Loading jobs…</p>
			) : (
				<>
					<p className="muted">
						{data.total} job{data.total === 1 ? "" : "s"} found
					</p>

					{data.jobs.length === 0 && (
						<p>No jobs match these filters. Try removing one.</p>
					)}

					{/* Backend returns jobs in the correct order */}
					<div className="grid">
						{data.jobs.map((job) => (
							<JobCard key={job._id} job={job} />
						))}
					</div>

					<div className="pager">
						<button
							type="button"
							className="btn ghost"
							disabled={page <= 1}
							onClick={() => setPage((prev) => prev - 1)}
						>
							Previous
						</button>

						<span>
							Page {data.page || page} of {data.pages}
						</span>

						<button
							type="button"
							className="btn ghost"
							disabled={page >= data.pages}
							onClick={() => setPage((prev) => prev + 1)}
						>
							Next
						</button>
					</div>
				</>
			)}
		</>
	);
}
