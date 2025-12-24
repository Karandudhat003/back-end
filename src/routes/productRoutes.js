

const express = require("express");
const router = express.Router();
const productController = require("../controllers/productController");
const pdfController = require("../controllers/pdfController");
const Product = require("../models/Product");

// Product CRUD routes
router.post("/add", productController.addProduct);
router.get("/", productController.getProducts);
router.get("/:id", productController.getProductById);
router.put("/edit/:id", productController.editProduct);
router.delete("/delete/:id", productController.deleteProduct);

// 🔥 NEW: PDF Download Route
// router.get("/:id/download-pdf", pdfController.generatePDF);

module.exports = router;

