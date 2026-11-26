import { Link, NavLink, useNavigate } from "react-router-dom";
import { useAuth } from "../AuthContext.jsx";
import Notifications from "./Notifications.jsx";

export default function Navbar() {
	const { user, logout } = useAuth();
	const nav = useNavigate();

	return (
		<header className="nav">
			<div className="wrap nav-in">
				<Link to="/" className="brand">
					HireMatch
				</Link>

				<nav>
					{/* Candidate navigation */}
					{user?.role === "candidate" && (
						<>
							<NavLink to="/">Jobs</NavLink>
							<NavLink to="/applications">
								My Applications
							</NavLink>
							<NavLink to="/profile">My Skills</NavLink>
						</>
					)}

					{/* Recruiter navigation */}
					{user?.role === "recruiter" && (
						<NavLink to="/dashboard">Dashboard</NavLink>
					)}

					{/* Logged-in user */}
					{user ? (
						<>
							<Notifications />
							{user.role === "recruiter" ? (
								<div className="user-menu">
									<button
										className="user-menu-trigger"
										type="button"
										aria-haspopup="true"
									>
										{user.name}
										<span aria-hidden="true">▾</span>
									</button>
									<div className="user-menu-dropdown">
										<NavLink to="/account">My Account</NavLink>
										<button
											type="button"
											onClick={() => {
												logout();
												nav("/");
											}}
										>
											Log out
										</button>
									</div>
								</div>
							) : (
								<button
									className="link"
									onClick={() => {
										logout();
										nav("/");
									}}
								>
									Log out ({user.name.split(" ")[0]})
								</button>
							)}
						</>
					) : (
						/* Guest navigation */
						<>
							<NavLink to="/">Jobs</NavLink>
							<NavLink to="/login">Log in</NavLink>
							<NavLink to="/register" className="btn small">
								Sign up
							</NavLink>
						</>
					)}
				</nav>
			</div>
		</header>
	);
}
