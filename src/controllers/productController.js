
// const Product = require("../models/Product");
// const Item = require("../models/Item");
// const mongoose = require("mongoose");

// // Add product
// exports.addProduct = async (req, res) => {
//   try {
//     const data = req.body;

//     // 🔥 STRICT: userId is now REQUIRED
//     if (!data.userId) {
//       return res.status(400).json({
//         success: false,
//         message: "userId is required to create product. Please login first."
//       });
//     }

//     if (!data.name || !data.number || !data.address) {
//       return res.status(400).json({
//         success: false,
//         message: "Name, number and address are required."
//       });
//     }

//     const itemsWithQuantity = Array.isArray(data.items)
//       ? data.items.map(item => ({
//         item: item._id || item.item || item,
//         quantity: item.quantity || 1
//       }))
//       : [];

//     // Normalize includeGst to boolean
//     let includeGst = false;
//     if (data.includeGst !== undefined && data.includeGst !== null) {
//       if (typeof data.includeGst === "string") {
//         includeGst = data.includeGst === "true";
//       } else {
//         includeGst = Boolean(data.includeGst);
//       }
//     }

//     const newProduct = new Product({
//       name: data.name,
//       number: data.number,
//       address: data.address,
//       includeGst: includeGst,
//       dis: data.dis || "0",
//       value: data.value || "nrp",
//       date: data.date || new Date(),
//       items: itemsWithQuantity,
//       createdBy: data.userId,
//       createdByUsername: data.username || "Unknown"
//     });

//     await newProduct.save();

//     const populatedProduct = await Product.findById(newProduct._id).populate("items.item");
//     const productObj = populatedProduct.toObject();

//     // Transform items
//     productObj.items = productObj.items
//       .map(itemEntry => itemEntry.item ? { ...itemEntry.item, quantity: itemEntry.quantity } : null)
//       .filter(Boolean);

//     console.log(`✅ Product created by user ${data.username} (${data.userId})`);

//     res.status(201).json({
//       success: true,
//       message: "Product added successfully",
//       product: productObj
//     });
//   } catch (error) {
//     console.error("❌ Error adding product:", error);
//     res.status(500).json({
//       success: false,
//       message: "Error adding product",
//       error: error.message
//     });
//   }
// };

// // Get all products with populated items
// exports.getProducts = async (req, res) => {
//   try {
//     // 🔥 STRICT: userId is now REQUIRED
//     const userId = req.query.userId;
    
//     if (!userId) {
//       return res.status(400).json({
//         success: false,
//         message: "userId is required as query parameter. Example: /api/products?userId=xxx"
//       });
//     }

//     console.log(`🔍 Fetching products for userId: ${userId}`);

//     // 🔥 ALWAYS filter by userId
//     const products = await Product.find({ createdBy: userId })
//       .populate("items.item")
//       .sort({ date: -1 })
//       .lean();

//     const transformedProducts = products.map(product => {
//       product.includeGst = product.includeGst === true;

//       if (!product.address) {
//         product.address = "SURAT";
//       }

//       product.items = product.items.map(itemEntry => {
//         if (itemEntry.item) {
//           return {
//             ...itemEntry.item,
//             quantity: itemEntry.quantity,
//           };
//         }
//         return null;
//       }).filter(item => item !== null);

//       return product;
//     });

//     console.log(`✅ Found ${transformedProducts.length} products for user ${userId}`);

//     res.json({
//       success: true,
//       products: transformedProducts
//     });
//   } catch (error) {
//     console.error("❌ Error fetching products:", error);
//     res.status(500).json({
//       success: false,
//       message: "Error fetching products",
//       error: error.message
//     });
//   }
// };

// // Get product by id
// exports.getProductById = async (req, res) => {
//   try {
//     const userId = req.query.userId;

//     if (!userId) {
//       return res.status(400).json({
//         success: false,
//         message: "userId is required as query parameter"
//       });
//     }

//     console.log("📥 Fetching product:", req.params.id);

//     const product = await Product.findById(req.params.id)
//       .populate("items.item")
//       .lean();

//     if (!product) {
//       return res.status(404).json({
//         success: false,
//         message: "Product not found"
//       });
//     }

//     // 🔥 STRICT: Check ownership
//     if (product.createdBy && product.createdBy.toString() !== userId) {
//       return res.status(403).json({
//         success: false,
//         message: "Access denied - this product belongs to another user",
//       });
//     }

//     product.includeGst = product.includeGst === true;

//     if (!product.address) {
//       product.address = "SURAT";
//     }

//     product.items = product.items.map(itemEntry => {
//       if (itemEntry.item) {
//         return {
//           ...itemEntry.item,
//           quantity: itemEntry.quantity,
//         };
//       }
//       return null;
//     }).filter(item => item !== null);

//     console.log("✅ Product found:", product._id);

//     res.json({
//       success: true,
//       product: product
//     });
//   } catch (error) {
//     console.error("❌ Error fetching product:", error);
//     res.status(500).json({
//       success: false,
//       message: "Error fetching product",
//       error: error.message
//     });
//   }
// };

// // Update product
// exports.editProduct = async (req, res) => {
//   try {
//     const data = req.body;

//     if (!data.userId) {
//       return res.status(400).json({
//         success: false,
//         message: "userId is required in request body"
//       });
//     }

//     // 🔥 Check if product exists and user owns it
//     const existingProduct = await Product.findById(req.params.id);
//     if (!existingProduct) {
//       return res.status(404).json({
//         success: false,
//         message: "Product not found"
//       });
//     }

//     // 🔥 STRICT: Check ownership
//     if (existingProduct.createdBy && existingProduct.createdBy.toString() !== data.userId) {
//       return res.status(403).json({
//         success: false,
//         message: "Access denied - you can only edit your own products",
//       });
//     }

//     if (data.items && Array.isArray(data.items)) {
//       data.items = data.items.map(item => ({
//         item: item._id || item.item || item,
//         quantity: item.quantity || 1
//       }));
//     }

//     // Normalize includeGst to boolean
//     if (data.includeGst !== undefined && data.includeGst !== null) {
//       if (typeof data.includeGst === "string") {
//         data.includeGst = data.includeGst === "true";
//       } else {
//         data.includeGst = Boolean(data.includeGst);
//       }
//     }

//     console.log("📤 Update data includeGst:", data.includeGst);

//     const updatedProduct = await Product.findByIdAndUpdate(
//       req.params.id,
//       data,
//       { new: true, runValidators: true }
//     ).populate("items.item");

//     const productObj = updatedProduct.toObject();

//     productObj.items = productObj.items
//       .map(itemEntry => itemEntry.item ? { ...itemEntry.item, quantity: itemEntry.quantity } : null)
//       .filter(Boolean);

//     console.log("✅ Product updated, includeGst:", productObj.includeGst);

//     res.json({
//       success: true,
//       message: "Product updated successfully",
//       product: productObj
//     });
//   } catch (error) {
//     res.status(500).json({
//       success: false,
//       message: "Error updating product",
//       error: error.message
//     });
//   }
// };

// // Delete product
// exports.deleteProduct = async (req, res) => {
//   try {
//     const userId = req.query.userId;

//     if (!userId) {
//       return res.status(400).json({
//         success: false,
//         message: "userId is required as query parameter"
//       });
//     }

//     console.log("📥 Deleting product:", req.params.id);

//     const product = await Product.findById(req.params.id);

//     if (!product) {
//       return res.status(404).json({
//         success: false,
//         message: "Product not found"
//       });
//     }

//     // 🔥 STRICT: Check ownership
//     if (product.createdBy && product.createdBy.toString() !== userId) {
//       return res.status(403).json({
//         success: false,
//         message: "Access denied - you can only delete your own products",
//       });
//     }

//     await Product.findByIdAndDelete(req.params.id);

//     console.log("✅ Product deleted:", req.params.id);

//     res.json({
//       success: true,
//       message: "Product deleted successfully"
//     });
//   } catch (error) {
//     console.error("❌ Error deleting product:", error);
//     res.status(500).json({
//       success: false,
//       message: "Error deleting product",
//       error: error.message
//     });
//   }
// };

const Product = require("../models/Product");
const Item = require("../models/Item");
const mongoose = require("mongoose");

// Add product
exports.addProduct = async (req, res) => {
  try {
    const data = req.body;

    // 🔥 STRICT: userId is now REQUIRED
    if (!data.userId) {
      return res.status(400).json({
        success: false,
        message: "userId is required to create product. Please login first."
      });
    }

    if (!data.name || !data.number || !data.address) {
      return res.status(400).json({
        success: false,
        message: "Name, number and address are required."
      });
    }

    // 🔥 NEW: Handle manual prices in items
    const itemsWithQuantity = Array.isArray(data.items)
      ? data.items.map(item => ({
        item: item._id || item.item || item,
        quantity: item.quantity || 1,
        manualPrice: item.manualPrice || 0  // Store manual price if provided
      }))
      : [];

    // Normalize includeGst to boolean
    let includeGst = false;
    if (data.includeGst !== undefined && data.includeGst !== null) {
      if (typeof data.includeGst === "string") {
        includeGst = data.includeGst === "true";
      } else {
        includeGst = Boolean(data.includeGst);
      }
    }

    const newProduct = new Product({
      name: data.name,
      number: data.number,
      address: data.address,
      includeGst: includeGst,
      dis: data.dis || "0",
      value: data.value || "nrp", // Can now be "manual"
      date: data.date || new Date(),
      items: itemsWithQuantity,
      createdBy: data.userId,
      createdByUsername: data.username || "Unknown"
    });

    await newProduct.save();

    const populatedProduct = await Product.findById(newProduct._id).populate("items.item");
    const productObj = populatedProduct.toObject();

    // 🔥 NEW: Include manualPrice in transformed items
    productObj.items = productObj.items
      .map(itemEntry => itemEntry.item ? { 
        ...itemEntry.item, 
        quantity: itemEntry.quantity,
        manualPrice: itemEntry.manualPrice || 0  // Include manual price
      } : null)
      .filter(Boolean);

    console.log(`✅ Product created by user ${data.username} (${data.userId}) with price type: ${data.value}`);

    res.status(201).json({
      success: true,
      message: "Product added successfully",
      product: productObj
    });
  } catch (error) {
    console.error("❌ Error adding product:", error);
    res.status(500).json({
      success: false,
      message: "Error adding product",
      error: error.message
    });
  }
};

// Get all products with populated items
exports.getProducts = async (req, res) => {
  try {
    // 🔥 STRICT: userId is now REQUIRED
    const userId = req.query.userId;
    
    if (!userId) {
      return res.status(400).json({
        success: false,
        message: "userId is required as query parameter. Example: /api/products?userId=xxx"
      });
    }

    console.log(`🔍 Fetching products for userId: ${userId}`);

    // 🔥 ALWAYS filter by userId
    const products = await Product.find({ createdBy: userId })
      .populate("items.item")
      .sort({ date: -1 })
      .lean();

    const transformedProducts = products.map(product => {
      product.includeGst = product.includeGst === true;

      if (!product.address) {
        product.address = "SURAT";
      }

      // 🔥 NEW: Include manualPrice in items
      product.items = product.items.map(itemEntry => {
        if (itemEntry.item) {
          return {
            ...itemEntry.item,
            quantity: itemEntry.quantity,
            manualPrice: itemEntry.manualPrice || 0  // Include manual price
          };
        }
        return null;
      }).filter(item => item !== null);

      return product;
    });

    console.log(`✅ Found ${transformedProducts.length} products for user ${userId}`);

    res.json({
      success: true,
      products: transformedProducts
    });
  } catch (error) {
    console.error("❌ Error fetching products:", error);
    res.status(500).json({
      success: false,
      message: "Error fetching products",
      error: error.message
    });
  }
};

// Get product by id
exports.getProductById = async (req, res) => {
  try {
    const userId = req.query.userId;

    if (!userId) {
      return res.status(400).json({
        success: false,
        message: "userId is required as query parameter"
      });
    }

    console.log("📥 Fetching product:", req.params.id);

    const product = await Product.findById(req.params.id)
      .populate("items.item")
      .lean();

    if (!product) {
      return res.status(404).json({
        success: false,
        message: "Product not found"
      });
    }

    // 🔥 STRICT: Check ownership
    if (product.createdBy && product.createdBy.toString() !== userId) {
      return res.status(403).json({
        success: false,
        message: "Access denied - this product belongs to another user",
      });
    }

    product.includeGst = product.includeGst === true;

    if (!product.address) {
      product.address = "SURAT";
    }

    // 🔥 NEW: Include manualPrice in items
    product.items = product.items.map(itemEntry => {
      if (itemEntry.item) {
        return {
          ...itemEntry.item,
          quantity: itemEntry.quantity,
          manualPrice: itemEntry.manualPrice || 0  // Include manual price
        };
      }
      return null;
    }).filter(item => item !== null);

    console.log("✅ Product found:", product._id);

    res.json({
      success: true,
      product: product
    });
  } catch (error) {
    console.error("❌ Error fetching product:", error);
    res.status(500).json({
      success: false,
      message: "Error fetching product",
      error: error.message
    });
  }
};

// Update product
exports.editProduct = async (req, res) => {
  try {
    const data = req.body;

    if (!data.userId) {
      return res.status(400).json({
        success: false,
        message: "userId is required in request body"
      });
    }

    // 🔥 Check if product exists and user owns it
    const existingProduct = await Product.findById(req.params.id);
    if (!existingProduct) {
      return res.status(404).json({
        success: false,
        message: "Product not found"
      });
    }

    // 🔥 STRICT: Check ownership
    if (existingProduct.createdBy && existingProduct.createdBy.toString() !== data.userId) {
      return res.status(403).json({
        success: false,
        message: "Access denied - you can only edit your own products",
      });
    }

    // 🔥 NEW: Handle manual prices in items
    if (data.items && Array.isArray(data.items)) {
      data.items = data.items.map(item => ({
        item: item._id || item.item || item,
        quantity: item.quantity || 1,
        manualPrice: item.manualPrice || 0  // Include manual price
      }));
    }

    // Normalize includeGst to boolean
    if (data.includeGst !== undefined && data.includeGst !== null) {
      if (typeof data.includeGst === "string") {
        data.includeGst = data.includeGst === "true";
      } else {
        data.includeGst = Boolean(data.includeGst);
      }
    }

    console.log("📤 Update data - includeGst:", data.includeGst, "value:", data.value);

    const updatedProduct = await Product.findByIdAndUpdate(
      req.params.id,
      data,
      { new: true, runValidators: true }
    ).populate("items.item");

    if (!updatedProduct) {
      return res.status(404).json({
        success: false,
        message: "Product not found after update"
      });
    }

    const productObj = updatedProduct.toObject();

    // 🔥 NEW: Include manualPrice in response
    productObj.items = productObj.items
      .map(itemEntry => itemEntry.item ? { 
        ...itemEntry.item, 
        quantity: itemEntry.quantity,
        manualPrice: itemEntry.manualPrice || 0  // Include manual price
      } : null)
      .filter(Boolean);

    console.log("✅ Product updated - includeGst:", productObj.includeGst, "price type:", productObj.value);

    res.json({
      success: true,
      message: "Product updated successfully",
      product: productObj
    });
  } catch (error) {
    console.error("❌ Error updating product:", error);
    res.status(500).json({
      success: false,
      message: "Error updating product",
      error: error.message
    });
  }
};

// Delete product
exports.deleteProduct = async (req, res) => {
  try {
    const userId = req.query.userId;

    if (!userId) {
      return res.status(400).json({
        success: false,
        message: "userId is required as query parameter"
      });
    }

    console.log("📥 Deleting product:", req.params.id);

    const product = await Product.findById(req.params.id);

    if (!product) {
      return res.status(404).json({
        success: false,
        message: "Product not found"
      });
    }

    // 🔥 STRICT: Check ownership
    if (product.createdBy && product.createdBy.toString() !== userId) {
      return res.status(403).json({
        success: false,
        message: "Access denied - you can only delete your own products",
      });
    }

    await Product.findByIdAndDelete(req.params.id);

    console.log("✅ Product deleted:", req.params.id);

    res.json({
      success: true,
      message: "Product deleted successfully"
    });
  } catch (error) {
    console.error("❌ Error deleting product:", error);
    res.status(500).json({
      success: false,
      message: "Error deleting product",
      error: error.message
    });
  }
};
