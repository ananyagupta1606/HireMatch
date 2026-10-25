const jwt = require("jsonwebtoken");
const User = require("../models/User");

const getUser = async (req) => {
	const h = req.headers.authorization || "";
	const token = h.startsWith("Bearer ") ? h.slice(7) : null;

	if (!token) return null;

	try {
		const { id } = jwt.verify(token, process.env.JWT_SECRET);

		return await User.findById(id).select("-passwordHash");
	} catch (err) {
		// Invalid, expired, or malformed token
		if (
			err.name === "JsonWebTokenError" ||
			err.name === "TokenExpiredError" ||
			err.name === "NotBeforeError" ||
			err.name === "CastError"
		) {
			return null;
		}

		// Unexpected errors should reach Express error handling
		throw err;
	}
};

exports.protect = async (req, res, next) => {
	try {
		const user = await getUser(req);

		if (!user) {
			return res.status(401).json({
				message: "Please log in",
			});
		}

		req.user = user;
		next();
	} catch (err) {
		next(err);
	}
};

exports.optionalAuth = async (req, res, next) => {
	try {
		req.user = await getUser(req);
		next();
	} catch (err) {
		next(err);
	}
};

exports.allow =
	(...roles) =>
	(req, res, next) => {
		if (!req.user) {
			return res.status(401).json({
				message: "Please log in",
			});
		}

		if (!roles.includes(req.user.role)) {
			return res.status(403).json({
				message: "Not allowed for your role",
			});
		}

		next();
	};
