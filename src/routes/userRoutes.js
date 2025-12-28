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
const User = require("../models/User");
const jwt = require("jsonwebtoken");

// ==== MIDDLEWARE ==== //
const authenticateToken = (req, res, next) => {
    const authHeader = req.headers["authorization"];
    const token = authHeader && authHeader.split(" ")[1];

    if (!token) {
        return res.status(401).json({ success: false, message: "Access token required" });
    }

    jwt.verify(token, process.env.JWT_SECRET || "your-secret-key", (err, user) => {
        if (err) {
            return res.status(403).json({ success: false, message: "Invalid or expired token" });
        }
        req.user = user;
        next();
    });
};


function authenticate(req, res, next) {
    const header = req.headers.authorization;
    if (!header) return res.status(401).json({ success: false, message: "No token" });

    const token = header.split(" ")[1];
    if (!token) return res.status(401).json({ success: false, message: "Token missing" });

    try {
        const decoded = jwt.verify(token, SECRET);
        req.user = decoded;
        next();
    } catch {
        res.status(401).json({ success: false, message: "Invalid token" });
    }
}

function authorizeRoles(...roles) {
    return (req, res, next) => {
        if (!roles.includes(req.user.role)) {
            return res.status(403).json({ success: false, message: "Access denied. Admin role required." });
        }
        next();
    };
}


const isAdmin = (req, res, next) => {
    if (req.user.role !== "admin") {
        return res.status(403).json({ success: false, message: "Admin access required" });
    }
    next();
};

// ==================== ROUTES ==================== //

// GET ALL USERS
router.get("/", async (req, res) => {
    try {
        const users = await User.find({}, "-password");
        res.json({ success: true, users });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: "Failed to fetch users",
        });
    }
});
// REGISTER USER
router.post("/register", authenticateToken, isAdmin, async (req, res) => {
    try {
        const { username, password, role } = req.body;

        if (!username || !password) {
            return res.status(400).json({ success: false, message: "Username and password required" });
        }

        const existing = await User.findOne({ username });
        if (existing) {
            return res.status(400).json({ success: false, message: "Username already exists" });
        }

        const newUser = new User({ username, password, role: role || "sales" });
        await newUser.save();

        res.status(201).json({ success: true, message: "User created" });
    } catch (error) {
        res.status(500).json({ success: false, message: "Failed to create user" });
    }
});

// DELETE USER
router.delete("/:userId", authenticateToken, isAdmin, async (req, res) => {
    try {
        const { userId } = req.params;

        if (userId === req.user.id) {
            return res.status(400).json({ success: false, message: "You cannot delete your own account" });
        }

        const deleted = await User.findByIdAndDelete(userId);
        if (!deleted) {
            return res.status(404).json({ success: false, message: "User not found" });
        }

        res.json({ success: true, message: "User deleted" });
    } catch (error) {
        res.status(500).json({ success: false, message: "Failed to delete user" });
    }
});

// CHANGE PASSWORD
router.post("/password/change", async (req, res) => {
    try {
        const { userId, newPassword } = req.body;

        if (!userId || !newPassword) {
            return res.status(400).json({ success: false, message: "Required fields missing" });
        }

        const user = await User.findById(userId);
        if (!user) return res.status(404).json({ success: false, message: "User not found" });

        user.password = newPassword;
        await user.save();

        res.json({ success: true, message: "Password updated" });
    } catch (error) {
        res.status(500).json({ success: false, message: "Failed to update password" });
    }
});

// DELETE user (admin only with proper checks)
router.delete("/:id", authenticate, authorizeRoles("admin"), async (req, res) => {
    try {
        const { id } = req.params;

        // Validate ObjectId
        if (!mongoose.Types.ObjectId.isValid(id)) {
            return res.status(400).json({ success: false, message: "Invalid user ID format" });
        }

        // Check if user exists
        const userToDelete = await User.findById(id);
        if (!userToDelete) {
            return res.status(404).json({ success: false, message: "User not found" });
        }

        // Prevent self-deletion
        if (userToDelete._id.toString() === req.user.id) {
            return res.status(400).json({
                success: false,
                message: "You cannot delete your own account"
            });
        }

        // Prevent deletion of the last admin
        if (userToDelete.role === "admin") {
            const adminCount = await User.countDocuments({ role: "admin" });
            if (adminCount <= 1) {
                return res.status(400).json({
                    success: false,
                    message: "Cannot delete the last admin user"
                });
            }
        }

        // Delete the user
        await User.findByIdAndDelete(id);

        res.json({
            success: true,
            message: "User deleted successfully",
            deletedUser: {
                id: userToDelete._id,
                username: userToDelete.username,
                role: userToDelete.role
            }
        });
    } catch (err) {
        console.error("Delete user error:", err);
        res.status(500).json({
            success: false,
            message: "Error deleting user",
            error: err.message
        });
    }
});

// UPDATE user (admin only)
router.put("/:id", authenticate, authorizeRoles("admin"), async (req, res) => {
    try {
        const { id } = req.params;
        const { username, role, password } = req.body;

        if (!mongoose.Types.ObjectId.isValid(id)) {
            return res.status(400).json({ success: false, message: "Invalid user ID" });
        }

        const user = await User.findById(id);
        if (!user) {
            return res.status(404).json({ success: false, message: "User not found" });
        }

        // Prevent changing the last admin's role
        if (user.role === "admin" && role !== "admin") {
            const adminCount = await User.countDocuments({ role: "admin" });
            if (adminCount <= 1) {
                return res.status(400).json({
                    success: false,
                    message: "Cannot change role of the last admin"
                });
            }
        }

        // Update fields
        if (username) user.username = username;
        if (role) user.role = role;
        if (password) user.password = password; // Will be hashed by pre-save hook

        await user.save();

        res.json({
            success: true,
            message: "User updated successfully",
            user: {
                id: user._id,
                username: user.username,
                role: user.role
            }
        });
    } catch (err) {
        res.status(500).json({
            success: false,
            message: "Error updating user",
            error: err.message
        });
    }
});

module.exports = router;
