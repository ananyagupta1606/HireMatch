const router = require("express").Router();
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const { OAuth2Client } = require("google-auth-library");

const User = require("../models/User");
const Job = require("../models/Job");
const Notification = require("../models/Notification");
const RecruiterNote = require("../models/RecruiterNote");
const wrap = require("../utils/wrap");
const { protect } = require("../middleware/auth");

const googleClient = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);

const sign = (u) =>
	jwt.sign({ id: u._id }, process.env.JWT_SECRET, { expiresIn: "7d" });

const pub = (u) => ({
	id: u._id,
	name: u.name,
	email: u.email,
	role: u.role,
	company: u.company,
});

// Register using email and password
router.post(
	"/register",
	wrap(async (req, res) => {
		const { name, email, password, role, company } = req.body;

		if (!name || !email || !password || password.length < 6) {
			return res.status(400).json({
				message: "Name, email and a 6+ character password are required",
			});
		}

		if (!["candidate", "recruiter"].includes(role)) {
			return res.status(400).json({
				message: "Choose candidate or recruiter",
			});
		}

		if (role === "recruiter" && !company) {
			return res.status(400).json({
				message: "Company name is required for recruiters",
			});
		}

		const normalizedEmail = email.trim().toLowerCase();

		if (await User.findOne({ email: normalizedEmail })) {
			return res.status(409).json({
				message: "Email already registered",
			});
		}

		const user = await User.create({
			name: name.trim(),
			email: normalizedEmail,
			role,
			company: role === "recruiter" ? company.trim() : undefined,
			passwordHash: await bcrypt.hash(password, 10),
		});

		res.status(201).json({
			token: sign(user),
			user: pub(user),
		});
	}),
);

// Login using email and password
router.post(
	"/login",
	wrap(async (req, res) => {
		const { email, password } = req.body;

		const user = await User.findOne({
			email: (email || "").trim().toLowerCase(),
		}).select("+passwordHash");

		if (
			!user ||
			!user.passwordHash ||
			!(await bcrypt.compare(password || "", user.passwordHash))
		) {
			return res.status(401).json({
				message: "Wrong email or password",
			});
		}

		res.json({
			token: sign(user),
			user: pub(user),
		});
	}),
);

// Login or register using Google
router.post(
	"/google",
	wrap(async (req, res) => {
		const { credential, intent, role, company } = req.body;

		if (!credential) {
			return res.status(400).json({
				message: "Google credential is required",
			});
		}

		if (!["register", "login"].includes(intent)) {
			return res.status(400).json({
				message: "Choose whether to sign up or log in",
			});
		}

		if (!process.env.GOOGLE_CLIENT_ID) {
			return res.status(500).json({
				message: "Google authentication is not configured",
			});
		}

		// Verify the Google ID token on the backend.
		const ticket = await googleClient.verifyIdToken({
			idToken: credential,
			audience: process.env.GOOGLE_CLIENT_ID,
		});

		const payload = ticket.getPayload();

		if (
			!payload ||
			!payload.sub ||
			!payload.email ||
			payload.email_verified !== true
		) {
			return res.status(401).json({
				message: "Google account could not be verified",
			});
		}

		const googleId = payload.sub;
		const email = payload.email.trim().toLowerCase();

		// Look for an existing account linked to this Google identity.
		let user = await User.findOne({ googleId });

		if (!user) {
			// Do not silently link Google to an existing password account.
			const existingUser = await User.findOne({ email });

			if (existingUser) {
				return res.status(409).json({
					message:
						"An account with this email already exists. Please log in using your existing method.",
				});
			}

			// A login attempt must not register an account implicitly.
			if (intent === "login") {
				return res.status(404).json({
					message: "No account found. Please sign up first.",
				});
			}

			if (!["candidate", "recruiter"].includes(role)) {
				return res.status(400).json({
					message: "Choose candidate or recruiter",
				});
			}

			if (
				role === "recruiter" &&
				(typeof company !== "string" || !company.trim())
			) {
				return res.status(400).json({
					message: "Company name is required for recruiters",
				});
			}

			user = await User.create({
				name: payload.name || email.split("@")[0],
				email,
				googleId,
				role,
				company: role === "recruiter" ? company.trim() : undefined,
			});
		}

		res.json({
			token: sign(user),
			user: pub(user),
		});
	}),
);

// Get the currently authenticated user
router.get("/me", protect, (req, res) =>
	res.json({ user: pub(req.user) }),
);

// Update the authenticated user's account details.
router.put(
	"/me",
	protect,
	wrap(async (req, res) => {
		const body =
			req.body && typeof req.body === "object" ? req.body : {};
		const updates = {};
		const fields = [
			["name", 100],
			["email", 254],
		];
		if (req.user.role === "recruiter") fields.push(["company", 120]);
		for (const [field, maxLength] of fields) {
			if (body[field] === undefined) continue;
			if (
				typeof body[field] !== "string" ||
				!body[field].trim() ||
				body[field].trim().length > maxLength
			) {
				return res.status(400).json({
					message: `${field[0].toUpperCase()}${field.slice(1)} is required and must be no longer than ${maxLength} characters`,
				});
			}
			updates[field] =
				field === "email"
					? body[field].trim().toLowerCase()
					: body[field].trim();
		}

		if (
			updates.email &&
			!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(updates.email)
		) {
			return res.status(400).json({
				message: "Enter a valid email address",
			});
		}

		if (
			updates.email &&
			updates.email !== req.user.email &&
			(await User.exists({
				email: updates.email,
				_id: { $ne: req.user._id },
			}))
		) {
			return res.status(409).json({
				message: "Email already registered",
			});
		}

		Object.assign(req.user, updates);
		try {
			await req.user.save();
		} catch (error) {
			if (error.code === 11000 && updates.email) {
				return res.status(409).json({
					message: "Email already registered",
				});
			}
			throw error;
		}

		res.json({ user: pub(req.user) });
	}),
);

// Change or set a password for the authenticated user.
router.patch(
	"/me/password",
	protect,
	wrap(async (req, res) => {
		const body =
			req.body && typeof req.body === "object" ? req.body : {};
		const newPassword = body.newPassword;
		if (
			typeof newPassword !== "string" ||
			newPassword.length < 6 ||
			Buffer.byteLength(newPassword, "utf8") > 72
		) {
			return res.status(400).json({
				message: "New password must be at least 6 characters and no longer than 72 UTF-8 bytes",
			});
		}

		const user = await User.findById(req.user._id).select("+passwordHash");
		if (!user) {
			return res.status(404).json({ message: "Account not found" });
		}

		if (
			user.passwordHash &&
			(typeof body.currentPassword !== "string" ||
				!(await bcrypt.compare(body.currentPassword, user.passwordHash)))
		) {
			return res.status(401).json({
				message: "Current password is incorrect",
			});
		}

		user.passwordHash = await bcrypt.hash(newPassword, 10);
		await user.save();

		res.json({ message: "Password updated successfully." });
	}),
);

// Close open jobs and remove the recruiter's account while retaining application history.
router.delete(
	"/me",
	protect,
	wrap(async (req, res) => {
		if (req.user.role !== "recruiter") {
			return res.status(403).json({
				message: "Only recruiters can delete accounts here",
			});
		}

		const body =
			req.body && typeof req.body === "object" ? req.body : {};
		const confirmationEmail =
			typeof body.confirmationEmail === "string"
				? body.confirmationEmail.trim().toLowerCase()
				: "";
		if (confirmationEmail !== req.user.email) {
			return res.status(400).json({
				message: "Enter your account email to confirm deletion",
			});
		}

		const user = await User.findById(req.user._id).select("+passwordHash");
		if (!user) {
			return res.status(404).json({ message: "Account not found" });
		}

		if (
			user.passwordHash &&
			(typeof body.password !== "string" ||
				!(await bcrypt.compare(body.password, user.passwordHash)))
		) {
			return res.status(401).json({
				message: "Current password is incorrect",
			});
		}

		await Job.updateMany(
			{ recruiter: user._id, status: "open" },
			{ $set: { status: "closed" } },
		);
		await RecruiterNote.deleteMany({ recruiter: user._id });
		await Notification.deleteMany({ recipient: user._id });
		await user.deleteOne();

		res.json({
			message: "Account deleted. Open jobs were closed and applications were preserved.",
		});
	}),
);

module.exports = router;
;
