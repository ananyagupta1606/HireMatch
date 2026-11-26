import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../AuthContext.jsx";
import api, { errMsg } from "../api.js";

export default function Account() {
	const { user, updateUser, logout } = useAuth();
	const navigate = useNavigate();
	const [details, setDetails] = useState({
		name: user.name,
		email: user.email,
		company: user.company || "",
	});
	const [passwordFieldsOpen, setPasswordFieldsOpen] = useState(false);
	const [confirmationEmail, setConfirmationEmail] = useState("");
	const [password, setPassword] = useState("");
	const [currentPassword, setCurrentPassword] = useState("");
	const [newPassword, setNewPassword] = useState("");
	const [confirmPassword, setConfirmPassword] = useState("");
	const [accountMessage, setAccountMessage] = useState({ type: "", text: "" });
	const [deleteMessage, setDeleteMessage] = useState({ type: "", text: "" });
	const [saving, setSaving] = useState(false);
	const [deleting, setDeleting] = useState(false);

	const updateField = (field) => (event) => {
		setDetails((current) => ({ ...current, [field]: event.target.value }));
	};

	const togglePasswordFields = () => {
		setAccountMessage({ type: "", text: "" });
		if (passwordFieldsOpen) {
			setCurrentPassword("");
			setNewPassword("");
			setConfirmPassword("");
		}
		setPasswordFieldsOpen((open) => !open);
	};

	const saveAccount = async (event) => {
		event.preventDefault();
		setAccountMessage({ type: "", text: "" });

		const changingPassword = passwordFieldsOpen && Boolean(
			currentPassword || newPassword || confirmPassword,
		);
		if (changingPassword && !newPassword) {
			setAccountMessage({
				type: "error",
				text: "Enter a new password to change your password.",
			});
			return;
		}
		if (newPassword !== confirmPassword) {
			setAccountMessage({
				type: "error",
				text: "New passwords do not match.",
			});
			return;
		}

		setSaving(true);
		let detailsSaved = false;
		try {
			const { data } = await api.put("/auth/me", details);
			updateUser(data.user);
			detailsSaved = true;

			if (changingPassword) {
				await api.patch("/auth/me/password", {
					currentPassword,
					newPassword,
				});
				setCurrentPassword("");
				setNewPassword("");
				setConfirmPassword("");
				setPasswordFieldsOpen(false);
			}

			setAccountMessage({
				type: "ok",
				text: changingPassword
					? "Account details and password updated."
					: "Account details updated.",
			});
		} catch (error) {
			setAccountMessage({
				type: "error",
				text: detailsSaved
					? `Account details saved, but the password was not changed: ${errMsg(error)}`
					: errMsg(error),
			});
		} finally {
			setSaving(false);
		}
	};

	const deleteAccount = async (event) => {
		event.preventDefault();
		setDeleting(true);
		setDeleteMessage({ type: "", text: "" });

		try {
			await api.delete("/auth/me", {
				data: { confirmationEmail, password },
			});
			logout();
			navigate("/", { replace: true });
		} catch (error) {
			setDeleteMessage({ type: "error", text: errMsg(error) });
			setDeleting(false);
		}
	};

	return (
		<main className="profile-page account-page">
			<header className="profile-heading">
				<div>
					<span className="profile-eyebrow">RECRUITER SETTINGS</span>
					<h1>My Account</h1>
					<p>Manage your personal and company account details.</p>
				</div>
			</header>

			<form className="profile-card" onSubmit={saveAccount}>
				<section className="account-section">
					<div className="section-heading">
						<div>
							<h2>Account details</h2>
							<p>Your company name will appear on new job postings.</p>
						</div>
					</div>

					<label className="profile-label">
						Your name
						<input
							type="text"
							value={details.name}
							onChange={updateField("name")}
							autoComplete="name"
							maxLength={100}
							required
						/>
					</label>

					<label className="profile-label">
						Email address
						<input
							type="email"
							value={details.email}
							onChange={updateField("email")}
							autoComplete="email"
							maxLength={254}
							required
						/>
					</label>

					<label className="profile-label">
						Company
						<input
							type="text"
							value={details.company}
							onChange={updateField("company")}
							autoComplete="organization"
							maxLength={120}
							required
						/>
					</label>
				</section>

				<button
					className="account-password-toggle"
					type="button"
					aria-expanded={passwordFieldsOpen}
					aria-controls={passwordFieldsOpen ? "account-password-fields" : undefined}
					onClick={togglePasswordFields}
					disabled={saving || deleting}
				>
					{passwordFieldsOpen ? "Cancel password change" : "Change password"}
				</button>

				{passwordFieldsOpen && (
					<div className="account-password-fields" id="account-password-fields">
						<label className="profile-label">
							Current password
							<input
								type="password"
								value={currentPassword}
								onChange={(event) => setCurrentPassword(event.target.value)}
								autoComplete="current-password"
								autoFocus
							/>
							<span className="field-hint">
								Required for password sign-in accounts. Google sign-in accounts can leave this blank.
							</span>
						</label>

						<label className="profile-label">
							New password
							<input
								type="password"
								value={newPassword}
								onChange={(event) => setNewPassword(event.target.value)}
								autoComplete="new-password"
								minLength={6}
								maxLength={72}
							/>
						</label>

						<label className="profile-label">
							Confirm new password
							<input
								type="password"
								value={confirmPassword}
								onChange={(event) => setConfirmPassword(event.target.value)}
								autoComplete="new-password"
								minLength={6}
								maxLength={72}
							/>
						</label>
					</div>
				)}

				{accountMessage.text && (
					<div
						className={`profile-message ${accountMessage.type}`}
						role={accountMessage.type === "error" ? "alert" : "status"}
					>
						<span>{accountMessage.type === "ok" ? "✓" : "!"}</span>
						{accountMessage.text}
					</div>
				)}

				<footer className="profile-footer">
					{/* <span>
						Changing your email updates the address used to sign in.
					</span> */}
					<button
						className="profile-save-button"
						type="submit"
						disabled={saving || deleting}
					>
						{saving ? "Saving..." : "Save changes"}
					</button>
				</footer>
			</form>

			<section className="profile-card account-delete">
				<div className="section-heading">
					<div>
						<h2>Delete account</h2>
						<p>This action cannot be undone.</p>
					</div>
				</div>

				<div className="account-warning">
					<strong>What happens when you delete your account?</strong>
					<ul>
						<li>All open job postings will be closed.</li>
						<li>Existing job and application records will be preserved.</li>
						<li>Your account and recruiter notes will be deleted.</li>
					</ul>
				</div>

				<form className="account-delete-form" onSubmit={deleteAccount}>
					<label className="profile-label">
						Type your account email to confirm
						<input
							type="email"
							value={confirmationEmail}
							onChange={(event) => setConfirmationEmail(event.target.value)}
							placeholder={user.email}
							autoComplete="email"
							required
						/>
					</label>

					<label className="profile-label">
						Current password
						<input
							type="password"
							value={password}
							onChange={(event) => setPassword(event.target.value)}
							autoComplete="current-password"
						/>
						<span className="field-hint">
							Required for accounts that use email and password. Leave blank for Google sign-in.
						</span>
					</label>

					{deleteMessage.text && (
						<div
							className={`profile-message ${deleteMessage.type}`}
							role={deleteMessage.type === "error" ? "alert" : "status"}
						>
							<span>{deleteMessage.type === "ok" ? "✓" : "!"}</span>
							{deleteMessage.text}
						</div>
					)}

					<button className="btn danger" type="submit" disabled={saving || deleting}>
						{deleting ? "Deleting account..." : "Delete my account"}
					</button>
				</form>
			</section>
		</main>
	);
}
