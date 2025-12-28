// const express = require("express");
// const router = express.Router();
// const User = require("../models/User");
// const jwt = require("jsonwebtoken");

// // ==== MIDDLEWARE ==== //
// const authenticateToken = (req, res, next) => {
//     const authHeader = req.headers["authorization"];
//     const token = authHeader && authHeader.split(" ")[1];

//     if (!token) {
//         return res.status(401).json({ success: false, message: "Access token required" });
//     }

//     jwt.verify(token, process.env.JWT_SECRET || "your-secret-key", (err, user) => {
//         if (err) {
//             return res.status(403).json({ success: false, message: "Invalid or expired token" });
//         }
//         req.user = user;
//         next();
//     });
// };

// const isAdmin = (req, res, next) => {
//     if (req.user.role !== "admin") {
//         return res.status(403).json({ success: false, message: "Admin access required" });
//     }
//     next();
// };

// // ==================== ROUTES ==================== //

// // GET ALL USERS
// router.get("/", async (req, res) => {
//     try {
//         const users = await User.find({}, "-password");
//         res.json({ success: true, users });
//     } catch (error) {
//         res.status(500).json({
//             success: false,
//             message: "Failed to fetch users",
//         });
//     }
// });
// // REGISTER USER
// router.post("/register", authenticateToken, isAdmin, async (req, res) => {
//     try {
//         const { username, password, role } = req.body;

//         if (!username || !password) {
//             return res.status(400).json({ success: false, message: "Username and password required" });
//         }

//         const existing = await User.findOne({ username });
//         if (existing) {
//             return res.status(400).json({ success: false, message: "Username already exists" });
//         }

//         const newUser = new User({ username, password, role: role || "sales" });
//         await newUser.save();

//         res.status(201).json({ success: true, message: "User created" });
//     } catch (error) {
//         res.status(500).json({ success: false, message: "Failed to create user" });
//     }
// });

// // DELETE USER
// router.delete("/:userId", authenticateToken, isAdmin, async (req, res) => {
//     try {
//         const { userId } = req.params;

//         if (userId === req.user.id) {
//             return res.status(400).json({ success: false, message: "You cannot delete your own account" });
//         }

//         const deleted = await User.findByIdAndDelete(userId);
//         if (!deleted) {
//             return res.status(404).json({ success: false, message: "User not found" });
//         }

//         res.json({ success: true, message: "User deleted" });
//     } catch (error) {
//         res.status(500).json({ success: false, message: "Failed to delete user" });
//     }
// });

// // CHANGE PASSWORD
// router.post("/password/change", async (req, res) => {
//     try {
//         const { userId, newPassword } = req.body;

//         if (!userId || !newPassword) {
//             return res.status(400).json({ success: false, message: "Required fields missing" });
//         }

//         const user = await User.findById(userId);
//         if (!user) return res.status(404).json({ success: false, message: "User not found" });

//         user.password = newPassword;
//         await user.save();

//         res.json({ success: true, message: "Password updated" });
//     } catch (error) {
//         res.status(500).json({ success: false, message: "Failed to update password" });
//     }
// });

// module.exports = router;



const express = require("express");
const router = express.Router();
const User = require("../models/User"); // Adjust path as needed
const jwt = require("jsonwebtoken");
const bcrypt = require("bcrypt");

const SECRET = process.env.JWT_SECRET || "supersecretkey";

// ======================= MIDDLEWARES ======================
function authenticate(req, res, next) {
    const header = req.headers.authorization;
    if (!header) {
        return res.status(401).json({ success: false, message: "No token provided" });
    }

    const token = header.split(" ")[1];
    if (!token) {
        return res.status(401).json({ success: false, message: "Token missing" });
    }

    try {
        const decoded = jwt.verify(token, SECRET);
        req.user = decoded;
        next();
    } catch (err) {
        return res.status(401).json({ success: false, message: "Invalid or expired token" });
    }
}

function adminOnly(req, res, next) {
    if (req.user.role !== "admin") {
        return res.status(403).json({ success: false, message: "Access denied. Admin only." });
    }
    next();
}

// ======================= ROUTES ======================

// GET /api/users - Get all users (admin only)
router.get("/", authenticate, adminOnly, async (req, res) => {
    try {
        const users = await User.find().select("-password");
        res.json({ success: true, users });
    } catch (err) {
        console.error("Get users error:", err);
        res.status(500).json({ success: false, message: "Failed to fetch users", error: err.message });
    }
});

// POST /api/users/register - Register new user (admin only)
router.post("/register", authenticate, adminOnly, async (req, res) => {
    try {
        const { username, password, role } = req.body;

        console.log("Register request body:", req.body);
        console.log("Authenticated user:", req.user);

        // Validation
        if (!username || !password) {
            return res.status(400).json({
                success: false,
                message: "Username and password are required"
            });
        }

        if (password.length < 6) {
            return res.status(400).json({
                success: false,
                message: "Password must be at least 6 characters"
            });
        }

        // Default to sales if role not provided
        const userRole = role || "sales";

        // Validate role
        if (!["admin", "sales"].includes(userRole)) {
            return res.status(400).json({
                success: false,
                message: "Invalid role. Must be 'admin' or 'sales'"
            });
        }

        // Check if username exists
        const existingUser = await User.findOne({ username });
        if (existingUser) {
            return res.status(400).json({
                success: false,
                message: "Username already exists"
            });
        }

        // Create new user
        const newUser = new User({
            username,
            password, // Will be hashed by pre-save hook
            role: userRole
        });

        await newUser.save();

        console.log("✅ User created successfully:", newUser.username);

        res.status(201).json({
            success: true,
            message: "User registered successfully",
            user: {
                id: newUser._id,
                username: newUser.username,
                role: newUser.role
            }
        });

    } catch (err) {
        console.error("❌ Register user error:", err);
        res.status(500).json({
            success: false,
            message: "Failed to register user",
            error: err.message
        });
    }
});

// POST /api/users/password/change - Change user password (admin only)
router.post("/password/change", authenticate, adminOnly, async (req, res) => {
    try {
        const { userId, newPassword } = req.body;

        if (!userId || !newPassword) {
            return res.status(400).json({
                success: false,
                message: "User ID and new password are required"
            });
        }

        if (newPassword.length < 6) {
            return res.status(400).json({
                success: false,
                message: "Password must be at least 6 characters"
            });
        }

        const user = await User.findById(userId);
        if (!user) {
            return res.status(404).json({
                success: false,
                message: "User not found"
            });
        }

        // Update password (will be hashed by pre-save hook)
        user.password = newPassword;
        await user.save();

        console.log("✅ Password changed for user:", user.username);

        res.json({
            success: true,
            message: "Password changed successfully"
        });

    } catch (err) {
        console.error("❌ Change password error:", err);
        res.status(500).json({
            success: false,
            message: "Failed to change password",
            error: err.message
        });
    }
});

// DELETE /api/users/:id - Delete user (admin only)
router.delete("/:id", authenticate, adminOnly, async (req, res) => {
    try {
        const userId = req.params.id;

        // Prevent admin from deleting themselves
        if (userId === req.user.id) {
            return res.status(400).json({
                success: false,
                message: "You cannot delete your own account"
            });
        }

        const user = await User.findById(userId);
        if (!user) {
            return res.status(404).json({
                success: false,
                message: "User not found"
            });
        }

        // Prevent deleting admin users
        if (user.role === "admin") {
            return res.status(403).json({
                success: false,
                message: "Cannot delete admin users"
            });
        }

        await User.findByIdAndDelete(userId);

        console.log("✅ User deleted:", user.username);

        res.json({
            success: true,
            message: "User deleted successfully"
        });

    } catch (err) {
        console.error("❌ Delete user error:", err);
        res.status(500).json({
            success: false,
            message: "Failed to delete user",
            error: err.message
        });
    }
});

module.exports = router;
