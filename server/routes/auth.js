const router = require("express").Router();
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const { OAuth2Client } = require("google-auth-library");

const User = require("../models/User");
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
		const { credential } = req.body;

		if (!credential) {
			return res.status(400).json({
				message: "Google credential is required",
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

			// Create a new candidate account.
			user = await User.create({
				name: payload.name || email.split("@")[0],
				email,
				googleId,
				role: "candidate",
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

module.exports = router;
;
