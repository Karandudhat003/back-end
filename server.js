
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

// ====================== CORS CONFIGURATION ====================
// Dynamically allows localhost (React 3000, Vite 5173), Netlify (*.netlify.app), and all frontend clients
const corsOptions = {
  origin: function (origin, callback) {
    callback(null, true); // Allow all origins dynamically
  },
  credentials: true,
  methods: ["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],
  allowedHeaders: [
    "Origin",
    "X-Requested-With",
    "Content-Type",
    "Accept",
    "Authorization",
    "sec-ch-ua",
    "sec-ch-ua-mobile",
    "sec-ch-ua-platform"
  ],
  exposedHeaders: ["Content-Range", "X-Content-Range", "Authorization"],
  optionsSuccessStatus: 200
};

app.use(cors(corsOptions));
app.options("*", cors(corsOptions));

// Explicit header middleware to guarantee CORS on every response (including 404, 500)
app.use((req, res, next) => {
  const origin = req.headers.origin;
  if (origin) {
    res.setHeader("Access-Control-Allow-Origin", origin);
  } else {
    res.setHeader("Access-Control-Allow-Origin", "*");
  }
  res.setHeader("Access-Control-Allow-Credentials", "true");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, PATCH, OPTIONS");
  res.setHeader(
    "Access-Control-Allow-Headers",
    "Origin, X-Requested-With, Content-Type, Accept, Authorization, sec-ch-ua, sec-ch-ua-mobile, sec-ch-ua-platform"
  );

  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }
  next();
});

app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true }));

// ================== MONGODB CONNECTION ========================
const Item = require("./src/models/Item");

const seedDatabase = async () => {
  try {
    // 1. Seed Admin & Test Users
    const adminExists = await User.findOne({ username: "admin" });
    if (!adminExists) {
      const admin = new User({
        username: "admin",
        password: "admin123",
        role: "admin"
      });
      await admin.save();
      console.log("✅ Admin user created (username: admin, password: admin123)");
    }

    const user1Exists = await User.findOne({ username: "user1" });
    if (!user1Exists) {
      const user1 = new User({
        username: "user1",
        password: "password123",
        role: "sales"
      });
      await user1.save();
      console.log("✅ Sales user1 created (username: user1, password: password123)");
    }

    const user2Exists = await User.findOne({ username: "user2" });
    if (!user2Exists) {
      const user2 = new User({
        username: "user2",
        password: "password123",
        role: "sales"
      });
      await user2.save();
      console.log("✅ Sales user2 created (username: user2, password: password123)");
    }

    // 2. Seed Realistic Tiles / Products if Item collection is empty
    const itemsCount = await Item.countDocuments();
    if (itemsCount === 0) {
      const sampleItems = [
        {
          name: "Statuario Classic White (600x1200 mm)",
          description: "Premium Glazed Vitrified Tile with Italian Statuario Marble finish. High Gloss Polish.",
          nrp: 520,
          mrp: 680,
          image: "https://images.unsplash.com/photo-1600585154340-be6161a56a0c?auto=format&fit=crop&w=800&q=80"
        },
        {
          name: "Calacatta Gold Luxury (800x1600 mm)",
          description: "Exclusive large format porcelain slab with golden vein accents. Mirror Polish.",
          nrp: 850,
          mrp: 1100,
          image: "https://images.unsplash.com/photo-1600565193348-f74bd3c7ccdf?auto=format&fit=crop&w=800&q=80"
        },
        {
          name: "Armani Grey High Gloss (600x1200 mm)",
          description: "Elegant contemporary grey vitrified tile suitable for modern living rooms and offices.",
          nrp: 480,
          mrp: 620,
          image: "https://images.unsplash.com/photo-1618221195710-dd6b41faaea6?auto=format&fit=crop&w=800&q=80"
        },
        {
          name: "Black Marquina Royal (600x1200 mm)",
          description: "Deep black marble texture with delicate white veins. Glossy vitrified floor tile.",
          nrp: 550,
          mrp: 720,
          image: "https://images.unsplash.com/photo-1616486338812-3dadae4b4ace?auto=format&fit=crop&w=800&q=80"
        },
        {
          name: "Travertine Beige Matt (600x1200 mm)",
          description: "Natural stone look with warm earthy beige tones and smooth anti-skid matt finish.",
          nrp: 460,
          mrp: 590,
          image: "https://images.unsplash.com/photo-1595428774223-ef52624120d2?auto=format&fit=crop&w=800&q=80"
        },
        {
          name: "Oak Natural Wood Plank (200x1200 mm)",
          description: "Realistic wood grain strip tile. Water-resistant, termite-proof, natural timber feel.",
          nrp: 390,
          mrp: 510,
          image: "https://images.unsplash.com/photo-1513694203232-719a280e022f?auto=format&fit=crop&w=800&q=80"
        },
        {
          name: "Walnut Dark Wood Plank (200x1000 mm)",
          description: "Rich dark walnut finish wooden tile for bedrooms, balconies, and deck areas.",
          nrp: 410,
          mrp: 530,
          image: "https://images.unsplash.com/photo-1540518614846-7ede433c4ef4?auto=format&fit=crop&w=800&q=80"
        },
        {
          name: "Cement Concrete Grey (600x600 mm)",
          description: "Industrial chic cement finish porcelain tile. Durable, anti-slip rustic surface.",
          nrp: 320,
          mrp: 420,
          image: "https://images.unsplash.com/photo-1584622650111-993a426fbf0a?auto=format&fit=crop&w=800&q=80"
        },
        {
          name: "Botticino Classic Beige (800x800 mm)",
          description: "Double charge vitrified tile with high durability for high foot-traffic living areas.",
          nrp: 440,
          mrp: 580,
          image: "https://images.unsplash.com/photo-1600607687939-ce8a6c25118c?auto=format&fit=crop&w=800&q=80"
        },
        {
          name: "Moroccan Mosaic Pattern (300x300 mm)",
          description: "Decorative ceramic tile with traditional geometric blue and white Spanish motif.",
          nrp: 280,
          mrp: 380,
          image: "https://images.unsplash.com/photo-1527359443443-84a48aec73d2?auto=format&fit=crop&w=800&q=80"
        },
        {
          name: "Subway Metro Glossy White (100x300 mm)",
          description: "Timeless bevelled subway wall tile for modern kitchen splashbacks and bathrooms.",
          nrp: 240,
          mrp: 320,
          image: "https://images.unsplash.com/photo-1584622781564-1d987f7333c1?auto=format&fit=crop&w=800&q=80"
        },
        {
          name: "Royal Onyx Crystal Blue (600x1200 mm)",
          description: "Translucent exotic onyx look glazed vitrified slab with deep azure and crystal veins.",
          nrp: 620,
          mrp: 800,
          image: "https://images.unsplash.com/photo-1600585152220-90363fe7e115?auto=format&fit=crop&w=800&q=80"
        },
        {
          name: "Terrazzo Multi-Chip Pastel (600x600 mm)",
          description: "Retro terrazzo style with colorful aggregate chips on off-white base. Satin finish.",
          nrp: 380,
          mrp: 490,
          image: "https://images.unsplash.com/photo-1598928506311-c55ded91a20c?auto=format&fit=crop&w=800&q=80"
        },
        {
          name: "Venetian Slate Charcoal (600x600 mm)",
          description: "Rough textured slate stone tile for exterior porches, parking, and pathways.",
          nrp: 350,
          mrp: 460,
          image: "https://images.unsplash.com/photo-1615529182904-14819c35db37?auto=format&fit=crop&w=800&q=80"
        },
        {
          name: "Emperador Dark Brown Marble (600x1200 mm)",
          description: "Spanish brown marble look vitrified tile with warm cream web veins.",
          nrp: 510,
          mrp: 660,
          image: "https://images.unsplash.com/photo-1600566753376-12c8ab7fb75b?auto=format&fit=crop&w=800&q=80"
        },
        {
          name: "Aqua Blue Mosaic Pool Tile (300x300 mm)",
          description: "Anti-slip, chemical and water-resistant glass mosaic tile for swimming pools & fountains.",
          nrp: 310,
          mrp: 410,
          image: "https://images.unsplash.com/photo-1576013551627-0cc20b96c2a7?auto=format&fit=crop&w=800&q=80"
        },
        {
          name: "Carrara Pure White Wall Tile (300x600 mm)",
          description: "Soft grey veined Carrara ceramic wall tile for luxury bathroom ambiance.",
          nrp: 290,
          mrp: 390,
          image: "https://images.unsplash.com/photo-1600573472550-8090b5e0745e?auto=format&fit=crop&w=800&q=80"
        },
        {
          name: "Sandstone Crema Exterior (600x1200 mm)",
          description: "20mm heavy outdoor paving porcelain slab with high grip surface.",
          nrp: 590,
          mrp: 750,
          image: "https://images.unsplash.com/photo-1600607687920-4e2a09cf159d?auto=format&fit=crop&w=800&q=80"
        },
        {
          name: "Forest Green Onyx Slab (800x1600 mm)",
          description: "Designer statement porcelain slab for accent feature walls and TV units.",
          nrp: 890,
          mrp: 1190,
          image: "https://images.unsplash.com/photo-1600585154526-990dced4db0d?auto=format&fit=crop&w=800&q=80"
        },
        {
          name: "Kota Green Rustic Stone (600x600 mm)",
          description: "Natural Indian Kota stone replica with zero maintenance and stain-resistance.",
          nrp: 340,
          mrp: 450,
          image: "https://images.unsplash.com/photo-160058515363-67eb9e2e2099?auto=format&fit=crop&w=800&q=80"
        }
      ];

      await Item.insertMany(sampleItems);
      console.log(`✅ Seeded ${sampleItems.length} tile products successfully into live database!`);
    } else {
      console.log(`ℹ️ Products/Items already exist in database (${itemsCount} items found)`);
    }
  } catch (err) {
    console.error("⚠️ Seeding error:", err.message);
  }
};

const connectDB = async () => {
  try {
    if (!process.env.MONGO_URI) {
      console.error("❌ MONGO_URI is not defined in environment variables!");
      return;
    }

    await mongoose.connect(process.env.MONGO_URI, {
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

    // Run database seeder for admin, test users and products
    await seedDatabase();
  } catch (err) {
    console.error("❌ MongoDB connection error:", err.message);
    console.log("🔄 Retrying MongoDB connection in 5 seconds...");
    setTimeout(connectDB, 5000);
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
app.listen(PORT, () => {
  console.log(`🚀 Server running at http://localhost:${PORT}`);
});