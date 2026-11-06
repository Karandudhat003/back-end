const User = require("../models/User");
const jwt = require("jsonwebtoken");
const SECRET = process.env.JWT_SECRET || "supersecretkey"; // Use strong .env key in production

exports.signup = async (req, res) => {
    try {
        const { username, password, confirmPassword, role } = req.body;
        console.log(req.body , "body data");

        // Required fields check
        if (!username || !password || !confirmPassword || !role) {
            return res.status(400).json({ success: false, message: "All fields are required." });
        }

        // Password match check
        if (password !== confirmPassword) {
            return res.status(400).json({ success: false, message: "Passwords do not match." });
        }

        // Role check
        if (!["admin", "sales"].includes(role)) {
            return res.status(400).json({ success: false, message: "Invalid role." });
        }

        // Check existing user
        const existing = await User.findOne({ username });
        if (existing) {
            return res.status(400).json({ success: false, message: "Username already exists." });
        }

        // Save user
        const user = new User({ username, password, role });
        await user.save();

        res.status(201).json({ success: true, message: "User registered successfully." });

    } catch (err) {
        res.status(500).json({ success: false, message: "Signup error", error: err.message });
    }
};


exports.login = async (req, res) => {
    try {
        const { username, password } = req.body;
        const user = await User.findOne({ username });
        if (!user || !(await user.comparePassword(password))) {
            return res.status(401).json({ success: false, message: "Invalid credentials." });
        }
        const payload = { id: user._id, username: user.username, role: user.role };
        const token = jwt.sign(payload, SECRET, { expiresIn: "24h" });
        res.json({ success: true, token, user: payload });
    } catch (err) {
        res.status(500).json({ success: false, message: "Login error", error: err.message });
    }
};
