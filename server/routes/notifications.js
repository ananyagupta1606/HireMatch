const router = require("express").Router();
const Notification = require("../models/Notification");
const wrap = require("../utils/wrap");
const { protect } = require("../middleware/auth");

router.get(
	"/",
	protect,
	wrap(async (req, res) => {
		const notifications = await Notification.find({
			recipient: req.user._id,
		})
			.sort({ createdAt: -1 })
			.limit(50)
			.lean();

		res.json(notifications);
	}),
);

router.patch(
	"/read-all",
	protect,
	wrap(async (req, res) => {
		await Notification.updateMany(
			{ recipient: req.user._id, readAt: null },
			{ readAt: new Date() },
		);

		res.json({ ok: true });
	}),
);

router.patch(
	"/:id/read",
	protect,
	wrap(async (req, res) => {
		const notification = await Notification.findOneAndUpdate(
			{ _id: req.params.id, recipient: req.user._id, readAt: null },
			{ readAt: new Date() },
			{ new: true },
		);

		if (!notification) {
			const exists = await Notification.exists({
				_id: req.params.id,
				recipient: req.user._id,
			});
			if (!exists) {
				return res.status(404).json({ message: "Notification not found" });
			}
		}

		res.json({ ok: true });
	}),
);

module.exports = router;
