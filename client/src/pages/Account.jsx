import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../AuthContext.jsx";
import api, { errMsg } from "../api.js";

function PasswordField({
	label,
	value,
	onChange,
	autoComplete,
	visible,
	onToggle,
	hint,
	inputProps = {},
}) {
	return (
		<label className="profile-label">
			{label}
			<div className="password-input account-password-input">
				<input
					{...inputProps}
					type={visible ? "text" : "password"}
					value={value}
					onChange={onChange}
					autoComplete={autoComplete}
				/>
				<button
					className="password-toggle"
					type="button"
					onClick={onToggle}
					aria-label={`${visible ? "Hide" : "Show"} ${label.toLowerCase()}`}
					aria-pressed={visible}
				>
					<svg
						aria-hidden="true"
						viewBox="0 0 24 24"
						width="20"
						height="20"
						fill="none"
						stroke="currentColor"
						strokeWidth="2"
						strokeLinecap="round"
						strokeLinejoin="round"
					>
						<path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7-10-7-10-7Z" />
						<circle cx="12" cy="12" r="3" />
						{visible && <path d="m4 4 16 16" />}
					</svg>
				</button>
			</div>
			{hint && <span className="field-hint">{hint}</span>}
		</label>
	);
}

export default function Account() {
	const { user, updateUser, logout } = useAuth();
	const isRecruiter = user.role === "recruiter";
	const navigate = useNavigate();
	const [details, setDetails] = useState({
		name: user.name,
		email: user.email,
		company: user.company || "",
	});
	const [passwordFieldsOpen, setPasswordFieldsOpen] = useState(false);
	const [deleteFieldsOpen, setDeleteFieldsOpen] = useState(false);
	const [confirmationEmail, setConfirmationEmail] = useState("");
	const [password, setPassword] = useState("");
	const [currentPassword, setCurrentPassword] = useState("");
	const [newPassword, setNewPassword] = useState("");
	const [confirmPassword, setConfirmPassword] = useState("");
	const [visiblePasswords, setVisiblePasswords] = useState({});
	const [accountMessage, setAccountMessage] = useState({ type: "", text: "" });
	const [deleteMessage, setDeleteMessage] = useState({ type: "", text: "" });
	const [saving, setSaving] = useState(false);
	const [deleting, setDeleting] = useState(false);

	const updateField = (field) => (event) => {
		setDetails((current) => ({ ...current, [field]: event.target.value }));
	};

	const togglePasswordVisibility = (field) => {
		setVisiblePasswords((current) => ({
			...current,
			[field]: !current[field],
		}));
	};

	const togglePasswordFields = () => {
		setAccountMessage({ type: "", text: "" });
		if (passwordFieldsOpen) {
			setCurrentPassword("");
			setNewPassword("");
			setConfirmPassword("");
			setVisiblePasswords({});
		}
		setPasswordFieldsOpen((open) => !open);
	};

	const toggleDeleteFields = () => {
		setDeleteMessage({ type: "", text: "" });
		if (deleteFieldsOpen) {
			setConfirmationEmail("");
			setPassword("");
			setVisiblePasswords({});
		}
		setDeleteFieldsOpen((open) => !open);
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
				setVisiblePasswords({});
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
					<span className="profile-eyebrow">ACCOUNT SETTINGS</span>
					<h1>My Account</h1>
					<p>Manage your personal account details.</p>
				</div>
			</header>

			<section className="profile-card account-settings-card">
				<form onSubmit={saveAccount}>
					<section className="account-section">
						<div className="section-heading">
							<div>
								<h2>Account details</h2>
								<p>
									{isRecruiter
										? "Your company name will appear on new job postings."
										: "Update the name and email address associated with your account."}
								</p>
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

						{isRecruiter && (
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
						)}
					</section>

					<button
						className="account-password-toggle"
						type="button"
						aria-expanded={passwordFieldsOpen}
						aria-controls={
							passwordFieldsOpen
								? "account-password-fields"
								: undefined
						}
						onClick={togglePasswordFields}
						disabled={saving || deleting}
					>
						{passwordFieldsOpen
							? "Cancel password change"
							: "Change password"}
					</button>

					{passwordFieldsOpen && (
						<div
							className="account-password-fields"
							id="account-password-fields"
						>
							<PasswordField
								label="Current password"
								value={currentPassword}
								onChange={(event) =>
									setCurrentPassword(event.target.value)
								}
								autoComplete="current-password"
								visible={visiblePasswords.currentPassword}
								onToggle={() =>
									togglePasswordVisibility("currentPassword")
								}
								hint="Required for password sign-in accounts. Google sign-in accounts can leave this blank."
								inputProps={{ autoFocus: true }}
							/>

							<PasswordField
								label="New password"
								value={newPassword}
								onChange={(event) =>
									setNewPassword(event.target.value)
								}
								autoComplete="new-password"
								visible={visiblePasswords.newPassword}
								onToggle={() =>
									togglePasswordVisibility("newPassword")
								}
								inputProps={{ minLength: 6, maxLength: 72 }}
							/>

							<PasswordField
								label="Confirm new password"
								value={confirmPassword}
								onChange={(event) =>
									setConfirmPassword(event.target.value)
								}
								autoComplete="new-password"
								visible={visiblePasswords.confirmPassword}
								onToggle={() =>
									togglePasswordVisibility("confirmPassword")
								}
								inputProps={{ minLength: 6, maxLength: 72 }}
							/>
						</div>
					)}

					{accountMessage.text && (
						<div
							className={`profile-message ${accountMessage.type}`}
							role={
								accountMessage.type === "error" ? "alert" : "status"
							}
						>
							<span>
								{accountMessage.type === "ok" ? "✓" : "!"}
							</span>
							{accountMessage.text}
						</div>
					)}

					<footer className="profile-footer">
						<span>Account details and password changes are saved together.</span>
						<button
							className="profile-save-button"
							type="submit"
							disabled={saving || deleting}
						>
							{saving ? "Saving..." : "Save changes"}
						</button>
					</footer>
				</form>

				{isRecruiter && (
					<div className="account-danger-zone">
						<div className="account-danger-toggle-row">
							<div className="account-danger-copy">
								<p>
									Deleting your account closes open jobs and preserves application history.
								</p>
							</div>
							<button
								className="account-delete-toggle"
								type="button"
								aria-expanded={deleteFieldsOpen}
								aria-controls={deleteFieldsOpen ? "account-delete-content" : undefined}
								onClick={toggleDeleteFields}
								disabled={saving || deleting}
							>
								{deleteFieldsOpen ? "Cancel deletion" : "Delete account"}
							</button>
						</div>

					{deleteFieldsOpen && (
						<div
							className="account-delete-content"
							id="account-delete-content"
						>
							<div className="account-warning">
								<strong>This action cannot be undone.</strong>
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

								<PasswordField
									label="Current password"
									value={password}
									onChange={(event) =>
										setPassword(event.target.value)
									}
									autoComplete="current-password"
									visible={visiblePasswords.deletePassword}
									onToggle={() =>
										togglePasswordVisibility("deletePassword")
									}
									hint="Required for accounts that use email and password. Leave blank for Google sign-in."
								/>

								{deleteMessage.text && (
									<div
										className={`profile-message ${deleteMessage.type}`}
										role={deleteMessage.type === "error" ? "alert" : "status"}
									>
										<span>{deleteMessage.type === "ok" ? "✓" : "!"}</span>
										{deleteMessage.text}
									</div>
								)}

								<button
									className="btn danger"
									type="submit"
									disabled={saving || deleting}
								>
									{deleting ? "Deleting account..." : "Delete my account"}
								</button>
							</form>
						</div>
					)}
					</div>
				)}
			</section>
		</main>
	);
}
