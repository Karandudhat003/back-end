
// const express = require("express");
// const cors = require("cors");
// const mongoose = require("mongoose");
// const path = require("path");
// require("dotenv").config();

// const jwt = require("jsonwebtoken");
// const bcrypt = require("bcrypt");

// // ====================== USER MODEL ===========================
// const userSchema = new mongoose.Schema({
//   username: { type: String, required: true, unique: true },
//   password: { type: String, required: true },
//   role: { type: String, enum: ["admin", "sales"], default: "sales" }
// });

// userSchema.pre("save", async function (next) {
//   if (!this.isModified("password")) return next();
//   this.password = await bcrypt.hash(this.password, 10);
//   next();
// });

// userSchema.methods.comparePassword = function (candidatePassword) {
//   return bcrypt.compare(candidatePassword, this.password);
// };

// const User = mongoose.model("User", userSchema);

// // ====================== EXPRESS APP ===========================
// const app = express();
// app.use(cors());
// app.use(express.json({ limit: "10mb" }));
// app.use(express.urlencoded({ extended: true }));

// // ================== MONGODB CONNECTION ========================
// const connectDB = async () => {
//   try {
//     await mongoose.connect(process.env.MONGO_URI, {
//       useNewUrlParser: true,
//       useUnifiedTopology: true,
//       serverSelectionTimeoutMS: 10000,
//     });
//     console.log("✅ MongoDB connected");

//     try {
//       await User.collection.dropIndex("email_1");
//       console.log("✅ Dropped old email index");
//     } catch (err) {
//       if (err.message.includes("index not found")) {
//         console.log("ℹ️ No email index to drop (OK)");
//       }
//     }
//   } catch (err) {
//     console.error("❌ MongoDB connection error:", err.message);
//     process.exit(1);
//   }
// };

// connectDB();

// mongoose.connection.on("connected", () => console.log("🟢 Mongoose connected"));
// mongoose.connection.on("error", (err) => console.log("🔴 Mongoose error:", err));
// mongoose.connection.on("disconnected", () => console.log("🟡 Mongoose disconnected"));

// process.on("SIGINT", async () => {
//   await mongoose.connection.close();
//   console.log("👋 MongoDB disconnected");
//   process.exit(0);
// });

// // ==================== ADD DUMMY SALES USER ====================
// (async () => {
//   try {
//     const exists = await User.findOne({ username: "user1" });
//     if (!exists) {
//       const dummy = new User({
//         username: "user1",
//         password: "password123",
//         role: "sales"
//       });
//       await dummy.save();
//       console.log("✅ Dummy user1 (sales) created");
//     }
//   } catch (err) {
//     console.log("ℹ️ Dummy user creation:", err.message);
//   }
// })();

// // ======================= JWT MIDDLEWARES ======================
// const SECRET = process.env.JWT_SECRET || "supersecretkey";

// function authenticate(req, res, next) {
//   const header = req.headers.authorization;
//   if (!header) return res.status(401).json({ success: false, message: "No token" });

//   const token = header.split(" ")[1];
//   if (!token) return res.status(401).json({ success: false, message: "Token missing" });

//   try {
//     const decoded = jwt.verify(token, SECRET);
//     req.user = decoded;
//     next();
//   } catch {
//     res.status(401).json({ success: false, message: "Invalid token" });
//   }
// }

// function authorizeRoles(...roles) {
//   return (req, res, next) => {
//     if (!roles.includes(req.user.role)) {
//       return res.status(403).json({ success: false, message: "Access denied" });
//     }
//     next();
//   };
// }

// // ====================== AUTH ROUTES ===========================
// app.post("/api/auth/signup", async (req, res) => {
//   try {
//     const { username, password, role } = req.body;

//     if (!username || !password || !role)
//       return res.status(400).json({ success: false, message: "All fields required" });

//     const exists = await User.findOne({ username });
//     if (exists) return res.status(400).json({ success: false, message: "Username exists" });

//     const user = new User({ username, password, role });
//     await user.save();

//     res.json({ success: true, message: "User registered" });
//   } catch (err) {
//     console.error("Signup error:", err);
//     res.status(500).json({ success: false, message: "Signup error", error: err.message });
//   }
// });

// app.post("/api/auth/login", async (req, res) => {
//   try {
//     const { username, password } = req.body;
//     const user = await User.findOne({ username });

//     if (!user || !(await user.comparePassword(password))) {
//       return res.status(401).json({ success: false, message: "Invalid credentials" });
//     }

//     const payload = { id: user._id, username: user.username, role: user.role };
//     const token = jwt.sign(payload, SECRET, { expiresIn: "24h" });

//     res.json({ success: true, token, user: payload });
//   } catch (err) {
//     res.status(500).json({ success: false, message: "Login error", error: err.message });
//   }
// });

// // ================== BASIC TEST ROUTES =========================
// app.get("/", (req, res) => {
//   res.json({
//     message: "🚀 Raj Tiles Server Running",
//     mongodb: mongoose.connection.readyState === 1 ? "Connected" : "Disconnected",
//     time: new Date(),
//   });
// });

// app.get("/api/me", authenticate, (req, res) => {
//   res.json({ user: req.user });
// });

// // ================== IMPORT ROUTES =========================
// const productRoutes = require("./src/routes/productRoutes.js");
// const adminRoutes = require("./src/routes/adminRoutes.js");
// const itemRoutes = require("./src/routes/itemRoutes.js");
// const userRoutes = require("./src/routes/userRoutes.js");

// app.use("/api/products", productRoutes);
// app.use("/api/items", itemRoutes);
// app.use("/admin", adminRoutes);
// app.use("/api/users", userRoutes);

// // ===================== ERROR HANDLERS ==========================
// app.use((req, res) => {
//   res.status(404).json({
//     success: false,
//     message: "Route not found",
//     route: req.path,
//   });
// });

// app.use((err, req, res, next) => {
//   console.error("Server error:", err);
//   res.status(500).json({
//     success: false,
//     message: "Server error",
//     error: err.message,
//   });
// });

// // ===================== START SERVER ============================
// const PORT = process.env.PORT || 5001;
// app.listen(PORT, () => {
//   console.log(`🚀 Server running at http://localhost:${PORT}`);
// });

// const express = require("express");
// const cors = require("cors");
// const mongoose = require("mongoose");
// const path = require("path");
// require("dotenv").config();

// const jwt = require("jsonwebtoken");
// const bcrypt = require("bcrypt");

// // ====================== USER MODEL ===========================
// const userSchema = new mongoose.Schema({
//   username: { type: String, required: true, unique: true },
//   password: { type: String, required: true },
//   role: { type: String, enum: ["admin", "sales"], default: "sales" }
// });

// userSchema.pre("save", async function (next) {
//   if (!this.isModified("password")) return next();
//   this.password = await bcrypt.hash(this.password, 10);
//   next();
// });

// userSchema.methods.comparePassword = function (candidatePassword) {
//   return bcrypt.compare(candidatePassword, this.password);
// };

// const User = mongoose.model("User", userSchema);

// // ====================== EXPRESS APP ===========================
// const app = express();
// app.use(cors());
// app.use(express.json({ limit: "10mb" }));
// app.use(express.urlencoded({ extended: true }));

// // ================== MONGODB CONNECTION ========================
// const connectDB = async () => {
//   try {
//     await mongoose.connect(process.env.MONGO_URI, {
//       useNewUrlParser: true,
//       useUnifiedTopology: true,
//       serverSelectionTimeoutMS: 10000,
//     });
//     console.log("✅ MongoDB connected");

//     try {
//       await User.collection.dropIndex("email_1");
//       console.log("✅ Dropped old email index");
//     } catch (err) {
//       if (err.message.includes("index not found")) {
//         console.log("ℹ️ No email index to drop (OK)");
//       }
//     }
//   } catch (err) {
//     console.error("❌ MongoDB connection error:", err.message);
//     process.exit(1);
//   }
// };

// connectDB();

// mongoose.connection.on("connected", () => console.log("🟢 Mongoose connected"));
// mongoose.connection.on("error", (err) => console.log("🔴 Mongoose error:", err));
// mongoose.connection.on("disconnected", () => console.log("🟡 Mongoose disconnected"));

// process.on("SIGINT", async () => {
//   await mongoose.connection.close();
//   console.log("👋 MongoDB disconnected");
//   process.exit(0);
// });

// // ==================== ADD DUMMY USERS ====================
// (async () => {
//   try {
//     const exists1 = await User.findOne({ username: "user1" });
//     if (!exists1) {
//       const user1 = new User({
//         username: "user1",
//         password: "password123",
//         role: "sales"
//       });
//       await user1.save();
//       console.log("✅ Dummy user1 (sales) created");
//     }

//     const exists2 = await User.findOne({ username: "user2" });
//     if (!exists2) {
//       const user2 = new User({
//         username: "user2",
//         password: "password123",
//         role: "sales"
//       });
//       await user2.save();
//       console.log("✅ Dummy user2 (sales) created");
//     }

//     const existsAdmin = await User.findOne({ username: "admin" });
//     if (!existsAdmin) {
//       const admin = new User({
//         username: "admin",
//         password: "admin123",
//         role: "admin"
//       });
//       await admin.save();
//       console.log("✅ Dummy admin user created");
//     }
//   } catch (err) {
//     console.log("ℹ️ Dummy user creation:", err.message);
//   }
// })();

// // ======================= JWT MIDDLEWARES ======================
// const SECRET = process.env.JWT_SECRET || "supersecretkey";

// function authenticate(req, res, next) {
//   const header = req.headers.authorization;
//   if (!header) return res.status(401).json({ success: false, message: "No token" });

//   const token = header.split(" ")[1];
//   if (!token) return res.status(401).json({ success: false, message: "Token missing" });

//   try {
//     const decoded = jwt.verify(token, SECRET);
//     req.user = decoded;
//     next();
//   } catch {
//     res.status(401).json({ success: false, message: "Invalid token" });
//   }
// }

// function authorizeRoles(...roles) {
//   return (req, res, next) => {
//     if (!roles.includes(req.user.role)) {
//       return res.status(403).json({ success: false, message: "Access denied" });
//     }
//     next();
//   };
// }

// // ====================== AUTH ROUTES ===========================
// app.post("/api/auth/signup", async (req, res) => {
//   try {
//     const { username, password, role } = req.body;

//     if (!username || !password || !role)
//       return res.status(400).json({ success: false, message: "All fields required" });

//     const exists = await User.findOne({ username });
//     if (exists) return res.status(400).json({ success: false, message: "Username exists" });

//     const user = new User({ username, password, role });
//     await user.save();

//     res.json({ success: true, message: "User registered" });
//   } catch (err) {
//     console.error("Signup error:", err);
//     res.status(500).json({ success: false, message: "Signup error", error: err.message });
//   }
// });

// app.post("/api/auth/login", async (req, res) => {
//   try {
//     const { username, password } = req.body;
//     const user = await User.findOne({ username });

//     if (!user || !(await user.comparePassword(password))) {
//       return res.status(401).json({ success: false, message: "Invalid credentials" });
//     }

//     const payload = { id: user._id, username: user.username, role: user.role };
//     const token = jwt.sign(payload, SECRET, { expiresIn: "24h" });

//     console.log(`✅ User ${username} (${user.role}) logged in`);

//     res.json({ 
//       success: true, 
//       token, 
//       user: payload 
//     });
//   } catch (err) {
//     res.status(500).json({ success: false, message: "Login error", error: err.message });
//   }
// });

// // ================== BASIC TEST ROUTES =========================
// app.get("/", (req, res) => {
//   res.json({
//     message: "🚀 Raj Tiles Server Running",
//     mongodb: mongoose.connection.readyState === 1 ? "Connected" : "Disconnected",
//     time: new Date(),
//   });
// });

// app.get("/api/me", authenticate, (req, res) => {
//   res.json({ user: req.user });
// });

// // ================== IMPORT ROUTES =========================
// const productRoutes = require("./src/routes/productRoutes.js");
// const adminRoutes = require("./src/routes/adminRoutes.js");
// const itemRoutes = require("./src/routes/itemRoutes.js");
// const userRoutes = require("./src/routes/userRoutes.js");

// app.use("/api/products", productRoutes);
// app.use("/api/items", itemRoutes);
// app.use("/admin", adminRoutes);
// app.use("/api/users", userRoutes);

// // ===================== ERROR HANDLERS ==========================
// app.use((req, res) => {
//   res.status(404).json({
//     success: false,
//     message: "Route not found",
//     route: req.path,
//   });
// });

// app.use((err, req, res, next) => {
//   console.error("Server error:", err);
//   res.status(500).json({
//     success: false,
//     message: "Server error",
//     error: err.message,
//   });
// });

// // ===================== START SERVER ============================
// const PORT = process.env.PORT || 5001;
// app.listen(PORT, () => {
//   console.log(`🚀 Server running at http://localhost:${PORT}`);
//   console.log(`✅ Backward Compatible Mode`);
//   console.log(`👥 Test users: user1, user2, admin`);
// });


const express = require("express");
const cors = require("cors");
const mongoose = require("mongoose");
const path = require("path");
require("dotenv").config();

const jwt = require("jsonwebtoken");
const bcrypt = require("bcrypt");

// ====================== USER MODEL ===========================
const userSchema = new mongoose.Schema({
  username: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  role: { type: String, enum: ["admin", "sales"], default: "sales" }
});

userSchema.pre("save", async function (next) {
  if (!this.isModified("password")) return next();
  this.password = await bcrypt.hash(this.password, 10);
  next();
});

userSchema.methods.comparePassword = function (candidatePassword) {
  return bcrypt.compare(candidatePassword, this.password);
};

const User = mongoose.model("User", userSchema);

// ====================== EXPRESS APP ===========================
const app = express();

// CORS - Allow ALL origins
app.use(cors({
  origin: '*',
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: true
}));

app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true }));

// ================== MONGODB CONNECTION ========================
const connectDB = async () => {
  try {
    await mongoose.connect(process.env.MONGO_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
      serverSelectionTimeoutMS: 10000,
    });
    console.log("✅ MongoDB connected");

    try {
      await User.collection.dropIndex("email_1");
      console.log("✅ Dropped old email index");
    } catch (err) {
      if (err.message.includes("index not found")) {
        console.log("ℹ️ No email index to drop (OK)");
      }
    }
  } catch (err) {
    console.error("❌ MongoDB connection error:", err.message);
    process.exit(1);
  }
};

connectDB();

mongoose.connection.on("connected", () => console.log("🟢 Mongoose connected"));
mongoose.connection.on("error", (err) => console.log("🔴 Mongoose error:", err));
mongoose.connection.on("disconnected", () => console.log("🟡 Mongoose disconnected"));

process.on("SIGINT", async () => {
  await mongoose.connection.close();
  console.log("👋 MongoDB disconnected");
  process.exit(0);
});

// ==================== ADD DUMMY SALES USER ====================
(async () => {
  try {
    const exists = await User.findOne({ username: "user1" });
    if (!exists) {
      const dummy = new User({
        username: "user1",
        password: "password123",
        role: "sales"
      });
      await dummy.save();
      console.log("✅ Dummy user1 (sales) created");
    }
  } catch (err) {
    console.log("ℹ️ Dummy user creation:", err.message);
  }
})();

// ======================= JWT MIDDLEWARES ======================
const SECRET = process.env.JWT_SECRET || "supersecretkey";

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
      return res.status(403).json({ success: false, message: "Access denied" });
    }
    next();
  };
}

// ====================== AUTH ROUTES ===========================
app.post("/api/auth/signup", async (req, res) => {
  try {
    const { username, password, role } = req.body;

    if (!username || !password || !role)
      return res.status(400).json({ success: false, message: "All fields required" });

    const exists = await User.findOne({ username });
    if (exists) return res.status(400).json({ success: false, message: "Username exists" });

    const user = new User({ username, password, role });
    await user.save();

    res.json({ success: true, message: "User registered" });
  } catch (err) {
    console.error("Signup error:", err);
    res.status(500).json({ success: false, message: "Signup error", error: err.message });
  }
});

app.post("/api/auth/login", async (req, res) => {
  try {
    const { username, password } = req.body;
    const user = await User.findOne({ username });

    if (!user || !(await user.comparePassword(password))) {
      return res.status(401).json({ success: false, message: "Invalid credentials" });
    }

    const payload = { id: user._id, username: user.username, role: user.role };
    const token = jwt.sign(payload, SECRET, { expiresIn: "24h" });

    res.json({ success: true, token, user: payload });
  } catch (err) {
    res.status(500).json({ success: false, message: "Login error", error: err.message });
  }
});

// ================== BASIC TEST ROUTES =========================
app.get("/", (req, res) => {
  res.json({
    message: "🚀 Raj Tiles Server Running",
    mongodb: mongoose.connection.readyState === 1 ? "Connected" : "Disconnected",
    time: new Date(),
  });
});

app.get("/api/me", authenticate, (req, res) => {
  res.json({ user: req.user });
});

// ================== IMPORT ROUTES =========================
const productRoutes = require("./src/routes/productRoutes.js");
const adminRoutes = require("./src/routes/adminRoutes.js");
const itemRoutes = require("./src/routes/itemRoutes.js");
const userRoutes = require("./src/routes/userRoutes.js");

app.use("/api/products", productRoutes);
app.use("/api/items", itemRoutes);
app.use("/admin", adminRoutes);
app.use("/api/users", userRoutes);

// ===================== ERROR HANDLERS ==========================
app.use((req, res) => {
  res.status(404).json({
    success: false,
    message: "Route not found",
    route: req.path,
  });
});

app.use((err, req, res, next) => {
  console.error("Server error:", err);
  res.status(500).json({
    success: false,
    message: "Server error",
    error: err.message,
  });
});

// ===================== START SERVER ============================
const PORT = process.env.PORT || 5001;

app.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 Server running on port ${PORT}`);
  console.log(`✅ Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log(`✅ Backward Compatible Mode`);
  console.log(`👥 Test users: user1, user2, admin`);
});
