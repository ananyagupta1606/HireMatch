import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../AuthContext.jsx";
import api, { errMsg } from "../api.js";

export default function Notifications() {
	const { user } = useAuth();
	const [notifications, setNotifications] = useState([]);
	const [open, setOpen] = useState(false);
	const [error, setError] = useState("");

	useEffect(() => {
		setNotifications([]);
		setError("");
		if (!user) {
			setOpen(false);
			return undefined;
		}

		let active = true;
		const load = async () => {
			try {
				const { data } = await api.get("/notifications");
				if (active) {
					setNotifications(data);
					setError("");
				}
			} catch (e) {
				if (active) setError(errMsg(e));
			}
		};

		load();
		const interval = window.setInterval(load, 30_000);
		window.addEventListener("focus", load);

		return () => {
			active = false;
			window.clearInterval(interval);
			window.removeEventListener("focus", load);
		};
	}, [user]);

	if (!user) return null;

	const unreadCount = notifications.filter((notification) => !notification.readAt).length;

	const markRead = async (id) => {
		try {
			await api.patch(`/notifications/${id}/read`);
			setNotifications((current) =>
				current.map((notification) =>
					notification._id === id
						? { ...notification, readAt: new Date().toISOString() }
						: notification,
				),
			);
		} catch (e) {
			setError(errMsg(e));
		}
	};

	const markAllRead = async () => {
		try {
			await api.patch("/notifications/read-all");
			const { data } = await api.get("/notifications");
			setNotifications(data);
		} catch (e) {
			setError(errMsg(e));
		}
	};

	return (
		<section
			className="notification-area"
			aria-label="Notifications"
			onMouseLeave={() => setOpen(false)}
			onBlur={(event) => {
				if (!event.currentTarget.contains(event.relatedTarget)) {
					setOpen(false);
				}
			}}
			onKeyDown={(event) => {
				if (event.key === "Escape") setOpen(false);
			}}
		>
			<button
				type="button"
				className="notification-toggle"
				onClick={() => setOpen((current) => !current)}
				aria-expanded={open}
				aria-label={`Notifications${unreadCount ? `, ${unreadCount} unread` : ""}`}
			>
				<svg
					className="notification-bell"
					viewBox="0 0 24 24"
					aria-hidden="true"
				>
					<path
						d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9m-8 12a2 2 0 0 0 4 0"
						fill="none"
						stroke="currentColor"
						strokeWidth="1.8"
						strokeLinecap="round"
						strokeLinejoin="round"
					/>
				</svg>
				{unreadCount > 0 && (
					<span className="notification-count">
						{unreadCount > 99 ? "99+" : unreadCount}
					</span>
				)}
			</button>
			{open && (
				<div className="notification-panel">
					<div className="notification-heading">
						<strong>Notifications</strong>
						{unreadCount > 0 && (
							<button type="button" className="link" onClick={markAllRead}>
								Mark all read
							</button>
						)}
					</div>
					{error && <p className="error" role="alert">{error}</p>}
					{notifications.length === 0 ? (
						<p className="muted notification-empty">You’re all caught up.</p>
					) : (
						<div className="notification-list">
							{notifications.map((notification) => (
								<Link
									key={notification._id}
									to={notification.link}
									className={`notification-item${notification.readAt ? "" : " unread"}`}
									onClick={() => {
										setOpen(false);
										if (!notification.readAt) markRead(notification._id);
									}}
								>
									<strong>{notification.title}</strong>
									<span>{notification.message}</span>
									<small>{new Date(notification.createdAt).toLocaleString()}</small>
								</Link>
							))}
						</div>
					)}
				</div>
			)}
		</section>
	);
}
