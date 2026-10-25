require("dotenv").config();

const express = require("express");
const cors = require("cors");
const mongoose = require("mongoose");

const app = express();

// Middleware
app.use(
	cors({
		origin: process.env.CLIENT_URL || "http://localhost:5173",
	}),
);

app.use(express.json());

// Health check
app.get("/api/health", (req, res) => {
	res.json({ ok: true });
});

// API routes
app.use("/api/auth", require("./routes/auth"));
app.use("/api/profile", require("./routes/profile"));
app.use("/api/jobs", require("./routes/jobs"));
app.use("/api/applications", require("./routes/applications"));

// Handle unknown routes
app.use((req, res) => {
	res.status(404).json({ message: "Route not found" });
});

// Central error handler
app.use((err, req, res, next) => {
	if (res.headersSent) {
		return next(err);
	}

	if (err.name === "CastError") {
		return res.status(400).json({ message: "Invalid id" });
	}

	if (err.name === "ValidationError") {
		return res.status(400).json({ message: err.message });
	}

	if (err.name === "JsonWebTokenError" || err.name === "TokenExpiredError") {
		return res.status(401).json({ message: "Invalid or expired token" });
	}

	console.error(err);

	res.status(500).json({ message: "Server error" });
});

// Connect to MongoDB before starting the server
mongoose
	.connect(process.env.MONGO_URI)
	.then(() => {
		const port = process.env.PORT || 4000;

		app.listen(port, () => {
			console.log(`API running on http://localhost:${port}`);
		});
	})
	.catch((err) => {
		console.error("Mongo connection failed:", err.message);
		process.exit(1);
	});
