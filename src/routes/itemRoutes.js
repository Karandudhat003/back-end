// // const express = require("express");
// // const router = express.Router();
// // const itemController = require("../controllers/itemController");

// // // Add item
// // router.post("/", itemController.addItem);

// // // Get all items
// // router.get("/", itemController.getAllItems);

// // // Delete item by ID
// // router.delete("/:id", itemController.deleteItem);

// // module.exports = router;


// const express = require("express");
// const router = express.Router();
// const multer = require("multer");
// const path = require("path");
// const itemController = require("../controllers/itemController");

// // 🧱 Multer storage setup
// const storage = multer.diskStorage({
//     destination: (req, file, cb) => cb(null, "uploads/"),
//     filename: (req, file, cb) =>
//         cb(null, Date.now() + "-" + Math.round(Math.random() * 1e9) + path.extname(file.originalname)),
// });

// const upload = multer({
//     storage,
//     limits: { fileSize: 5 * 1024 * 1024 }, // 5 MB
//     fileFilter: (req, file, cb) => {
//         const allowed = /jpeg|jpg|png|gif/;
//         const ext = allowed.test(path.extname(file.originalname).toLowerCase());
//         const mime = allowed.test(file.mimetype);
//         if (mime && ext) cb(null, true);
//         else cb(new Error("Only image files are allowed"));
//     },
// });

// // ➕ Add new item
// router.post("/", upload.single("image"), itemController.addItem);

// // 📋 Get all items
// router.get("/", itemController.getAllItems);

// // ❌ Delete item by ID
// router.delete("/:id", itemController.deleteItem);

// module.exports = router;


const express = require("express");
const router = express.Router();
const multer = require("multer");
const path = require("path");
const itemController = require("../controllers/itemController");

// Multer storage setup
const storage = multer.diskStorage({
    destination: (req, file, cb) => cb(null, "uploads/"),
    filename: (req, file, cb) =>
        cb(
            null,
            Date.now() + "-" + Math.round(Math.random() * 1e9) + path.extname(file.originalname)
        ),
});

const upload = multer({
    storage,
    limits: { fileSize: 5 * 1024 * 1024 }, // 5 MB
    fileFilter: (req, file, cb) => {
        const allowed = /jpeg|jpg|png|gif/;
        const ext = allowed.test(path.extname(file.originalname).toLowerCase());
        const mime = allowed.test(file.mimetype);
        if (mime && ext) cb(null, true);
        else cb(new Error("Only image files are allowed"));
    },
});

// Routes
router.post("/", upload.single("image"), itemController.addItem);
router.get("/", itemController.getAllItems);
router.get("/:id", itemController.getItemById);
router.put("/:id", upload.single("image"), itemController.updateItem);
router.delete("/:id", itemController.deleteItem);

module.exports = router;
