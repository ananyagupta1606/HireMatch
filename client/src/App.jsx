import { Routes, Route, Navigate } from "react-router-dom";
import { useAuth } from "./AuthContext.jsx";
import Navbar from "./components/Navbar.jsx";
import Auth from "./pages/Auth.jsx";
import Jobs from "./pages/Jobs.jsx";
import JobDetail from "./pages/JobDetail.jsx";
import Profile from "./pages/Profile.jsx";
import MyApplications from "./pages/MyApplications.jsx";
import Dashboard from "./pages/Dashboard.jsx";
import Applicants from "./pages/Applicants.jsx";

// Route guard: checks login status and user role
function Guard({ role, children }) {
	const { user } = useAuth();

	// Redirect users who are not logged in
	if (!user) {
		return <Navigate to="/login" replace />;
	}

	// Redirect users who have the wrong role
	if (role && user.role !== role) {
		return (
			<Navigate
				to={user.role === "recruiter" ? "/dashboard" : "/"}
				replace
			/>
		);
	}

	// Allow authorized users to access the page
	return children;
}

export default function App() {
	const { user } = useAuth();

	return (
		<>
			<Navbar />

			<main className="wrap">
				<Routes>
					{/* Candidate-only pages */}
					<Route
						path="/"
						element={
							user?.role === "recruiter" ? (
								<Navigate to="/dashboard" replace />
							) : (
								<Jobs />
							)
						}
					/>

					<Route
						path="/jobs/:id"
						element={
							<Guard role="candidate">
								<JobDetail />
							</Guard>
						}
					/>

					<Route
						path="/profile"
						element={
							<Guard role="candidate">
								<Profile />
							</Guard>
						}
					/>

					<Route
						path="/applications"
						element={
							<Guard role="candidate">
								<MyApplications />
							</Guard>
						}
					/>

					{/* Recruiter-only pages */}
					<Route
						path="/dashboard"
						element={
							<Guard role="recruiter">
								<Dashboard />
							</Guard>
						}
					/>

					<Route
						path="/dashboard/jobs/:id"
						element={
							<Guard role="recruiter">
								<Applicants />
							</Guard>
						}
					/>

					{/* Authentication pages */}
					<Route
						path="/login"
						element={
							user ? (
								<Navigate
									to={
										user.role === "recruiter"
											? "/dashboard"
											: "/"
									}
									replace
								/>
							) : (
								<Auth mode="login" />
							)
						}
					/>

					<Route
						path="/register"
						element={
							user ? (
								<Navigate
									to={
										user.role === "recruiter"
											? "/dashboard"
											: "/"
									}
									replace
								/>
							) : (
								<Auth mode="register" />
							)
						}
					/>

					{/* Unknown routes */}
					<Route path="*" element={<p>Page not found.</p>} />
				</Routes>
			</main>
		</>
	);
}
