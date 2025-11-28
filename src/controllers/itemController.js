

// const Item = require("../models/Item");
// const cloudinary = require("../config/cloudinary");
// const streamifier = require("streamifier");

// const uploadToCloudinary = (buffer) => {
//   return new Promise((resolve, reject) => {
//     const uploadStream = cloudinary.uploader.upload_stream(
//       {
//         folder: "items",
//         resource_type: "auto",
//         transformation: [
//           { width: 800, height: 800, crop: "limit" },
//           { quality: "auto" }
//         ]
//       },
//       (error, result) => {
//         if (error) {
//           console.error("Cloudinary upload error:", error);
//           reject(error);
//         } else {
//           resolve(result);
//         }
//       }
//     );
//     streamifier.createReadStream(buffer).pipe(uploadStream);
//   });
// };

// const deleteFromCloudinary = async (imageUrl) => {
//   try {
//     if (!imageUrl) return;
//     const urlParts = imageUrl.split("/");
//     const uploadIndex = urlParts.indexOf("upload");

//     if (uploadIndex !== -1 && uploadIndex < urlParts.length - 1) {
//       const publicIdWithFolder = urlParts.slice(uploadIndex + 2).join("/");
//       const publicId = publicIdWithFolder.substring(0, publicIdWithFolder.lastIndexOf("."));
//       const result = await cloudinary.uploader.destroy(publicId);
//       console.log("Deleted from Cloudinary:", publicId, result);
//     }
//   } catch (error) {
//     console.error("Error deleting from Cloudinary:", error);
//   }
// };

// exports.addItem = async (req, res) => {
//   try {
//     const { name, description, nrp, mrp } = req.body;
//     let imageUrl = null;

//     console.log("📥 Received data:", { name, description, nrp, mrp });
//     console.log("📁 File received:", req.file ? "Yes" : "No");

//     if (req.file) {
//       console.log("🔍 File details:", {
//         fieldname: req.file.fieldname,
//         originalname: req.file.originalname,
//         mimetype: req.file.mimetype,
//         size: req.file.size,
//         hasBuffer: !!req.file.buffer,
//         hasPath: !!req.file.path
//       });
//     }

//     const existingItem = await Item.findOne({ name });
//     if (existingItem) {
//       return res.status(400).json({
//         success: false,
//         message: "Item with this name already exists",
//       });
//     }

//     if (req.file && req.file.buffer) {
//       console.log("☁️ Uploading to Cloudinary...");
//       try {
//         const result = await uploadToCloudinary(req.file.buffer);
//         imageUrl = result.secure_url;
//         console.log("✅ Cloudinary upload successful:", imageUrl);
//       } catch (cloudinaryError) {
//         console.error("❌ Cloudinary upload failed:", cloudinaryError);
//         return res.status(500).json({
//           success: false,
//           message: "Failed to upload image to Cloudinary",
//           error: cloudinaryError.message,
//         });
//       }
//     }

//     const newItem = new Item({
//       name,
//       description: description || "",
//       nrp: Number(nrp) || 0,
//       mrp: Number(mrp) || 0,
//       image: imageUrl,
//     });

//     await newItem.save();

//     res.status(201).json({
//       success: true,
//       message: "Item added successfully",
//       item: newItem,
//     });
//   } catch (error) {
//     console.error("❌ Error adding item:", error);
//     res.status(500).json({
//       success: false,
//       message: "Internal Server Error",
//       error: error.message,
//     });
//   }
// };

// exports.getAllItems = async (req, res) => {
//   try {
//     const items = await Item.find().sort({ createdAt: -1 });
//     res.status(200).json({
//       success: true,
//       items,
//       count: items.length,
//     });
//   } catch (error) {
//     console.error("Error fetching items:", error);
//     res.status(500).json({
//       success: false,
//       message: "Error fetching items",
//       error: error.message,
//     });
//   }
// };

// exports.getItemById = async (req, res) => {
//   try {
//     const { id } = req.params;
//     const item = await Item.findById(id);

//     if (!item) {
//       return res.status(404).json({
//         success: false,
//         message: "Item not found",
//       });
//     }

//     res.status(200).json({
//       success: true,
//       item,
//     });
//   } catch (error) {
//     console.error("Error fetching item:", error);
//     res.status(500).json({
//       success: false,
//       message: "Error fetching item",
//       error: error.message,
//     });
//   }
// };

// exports.updateItem = async (req, res) => {
//   try {
//     const { id } = req.params;
//     const { name, description, nrp, mrp } = req.body;

//     const existingItem = await Item.findById(id);
//     if (!existingItem) {
//       return res.status(404).json({
//         success: false,
//         message: "Item not found",
//       });
//     }

//     const updateData = {
//       name,
//       description,
//       nrp: Number(nrp),
//       mrp: Number(mrp),
//     };

//     if (req.file && req.file.buffer) {
//       console.log("☁️ Uploading new image to Cloudinary...");

//       try {
//         const result = await uploadToCloudinary(req.file.buffer);
//         updateData.image = result.secure_url;
//         console.log("✅ New image uploaded:", result.secure_url);

//         if (existingItem.image) {
//           console.log("🗑️ Deleting old image from Cloudinary...");
//           await deleteFromCloudinary(existingItem.image);
//         }
//       } catch (cloudinaryError) {
//         console.error("❌ Cloudinary operation failed:", cloudinaryError);
//         return res.status(500).json({
//           success: false,
//           message: "Failed to update image on Cloudinary",
//           error: cloudinaryError.message,
//         });
//       }
//     }

//     const updatedItem = await Item.findByIdAndUpdate(id, updateData, {
//       new: true,
//       runValidators: true,
//     });

//     res.status(200).json({
//       success: true,
//       message: "Item updated successfully",
//       item: updatedItem,
//     });
//   } catch (error) {
//     console.error("Error updating item:", error);
//     res.status(500).json({
//       success: false,
//       message: "Error updating item",
//       error: error.message,
//     });
//   }
// };

// exports.deleteItem = async (req, res) => {
//   try {
//     const { id } = req.params;
//     const item = await Item.findById(id);

//     if (!item) {
//       return res.status(404).json({
//         success: false,
//         message: "Item not found",
//       });
//     }

//     if (item.image) {
//       console.log("🗑️ Deleting image from Cloudinary...");
//       await deleteFromCloudinary(item.image);
//     }

//     await Item.findByIdAndDelete(id);

//     res.status(200).json({
//       success: true,
//       message: "Item deleted successfully",
//     });
//   } catch (error) {
//     console.error("Error deleting item:", error);
//     res.status(500).json({
//       success: false,
//       message: "Error deleting item",
//       error: error.message,
//     });
//   }
// };



const Item = require("../models/Item");
const cloudinary = require("../config/cloudinary");
const streamifier = require("streamifier");

const uploadToCloudinary = (buffer) => {
  return new Promise((resolve, reject) => {
    const uploadStream = cloudinary.uploader.upload_stream(
      {
        folder: "items",
        resource_type: "auto",
        transformation: [
          { width: 800, height: 800, crop: "limit" },
          { quality: "auto" }
        ]
      },
      (error, result) => {
        if (error) {
          console.error("Cloudinary upload error:", error);
          reject(error);
        } else {
          resolve(result);
        }
      }
    );
    streamifier.createReadStream(buffer).pipe(uploadStream);
  });
};

const deleteFromCloudinary = async (imageUrl) => {
  try {
    if (!imageUrl) return;
    const urlParts = imageUrl.split("/");
    const uploadIndex = urlParts.indexOf("upload");

    if (uploadIndex !== -1 && uploadIndex < urlParts.length - 1) {
      const publicIdWithFolder = urlParts.slice(uploadIndex + 2).join("/");
      const publicId = publicIdWithFolder.substring(0, publicIdWithFolder.lastIndexOf("."));
      const result = await cloudinary.uploader.destroy(publicId);
      console.log("Deleted from Cloudinary:", publicId, result);
    }
  } catch (error) {
    console.error("Error deleting from Cloudinary:", error);
  }
};

// 🔥 ADD ITEM - Auto-assign to logged-in user
exports.addItem = async (req, res) => {
  try {
    const { name, description, nrp, mrp } = req.body;
    let imageUrl = null;

    // 🔥 Get user from JWT token
    const userId = req.user.id;
    const username = req.user.username;

    console.log("📥 Received data:", { name, description, nrp, mrp, userId, username });
    console.log("📁 File received:", req.file ? "Yes" : "No");

    if (req.file) {
      console.log("🔍 File details:", {
        fieldname: req.file.fieldname,
        originalname: req.file.originalname,
        mimetype: req.file.mimetype,
        size: req.file.size,
        hasBuffer: !!req.file.buffer,
        hasPath: !!req.file.path
      });
    }

    // 🔥 Check if item with same name exists for THIS USER
    const existingItem = await Item.findOne({ name, createdBy: userId });
    if (existingItem) {
      return res.status(400).json({
        success: false,
        message: "You already have an item with this name",
      });
    }

    if (req.file && req.file.buffer) {
      console.log("☁️ Uploading to Cloudinary...");
      try {
        const result = await uploadToCloudinary(req.file.buffer);
        imageUrl = result.secure_url;
        console.log("✅ Cloudinary upload successful:", imageUrl);
      } catch (cloudinaryError) {
        console.error("❌ Cloudinary upload failed:", cloudinaryError);
        return res.status(500).json({
          success: false,
          message: "Failed to upload image to Cloudinary",
          error: cloudinaryError.message,
        });
      }
    }

    const newItem = new Item({
      name,
      description: description || "",
      nrp: Number(nrp) || 0,
      mrp: Number(mrp) || 0,
      image: imageUrl,
      createdBy: userId,           // 🔥 Assign to logged-in user
      createdByUsername: username   // 🔥 Store username
    });

    await newItem.save();

    res.status(201).json({
      success: true,
      message: "Item added successfully",
      item: newItem,
    });
  } catch (error) {
    console.error("❌ Error adding item:", error);
    res.status(500).json({
      success: false,
      message: "Internal Server Error",
      error: error.message,
    });
  }
};

// 🔥 GET ALL ITEMS - Only for logged-in user (sales see only their items)
exports.getAllItems = async (req, res) => {
  try {
    const userId = req.user.id;
    const userRole = req.user.role;

    let query = {};
    
    // 🔥 Sales users see only their own items
    // 🔥 Admin users see ALL items
    if (userRole === "sales") {
      query.createdBy = userId;
    }

    const items = await Item.find(query).sort({ createdAt: -1 });
    
    console.log(`✅ User ${req.user.username} (${userRole}) fetched ${items.length} items`);

    res.status(200).json({
      success: true,
      items,
      count: items.length,
    });
  } catch (error) {
    console.error("Error fetching items:", error);
    res.status(500).json({
      success: false,
      message: "Error fetching items",
      error: error.message,
    });
  }
};

// 🔥 GET ITEM BY ID - Only if user owns it (or is admin)
exports.getItemById = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;
    const userRole = req.user.role;

    const item = await Item.findById(id);

    if (!item) {
      return res.status(404).json({
        success: false,
        message: "Item not found",
      });
    }

    // 🔥 Check ownership (sales can only see their own)
    if (userRole === "sales" && item.createdBy.toString() !== userId) {
      return res.status(403).json({
        success: false,
        message: "Access denied - this item belongs to another user",
      });
    }

    res.status(200).json({
      success: true,
      item,
    });
  } catch (error) {
    console.error("Error fetching item:", error);
    res.status(500).json({
      success: false,
      message: "Error fetching item",
      error: error.message,
    });
  }
};

// 🔥 UPDATE ITEM - Only if user owns it (or is admin)
exports.updateItem = async (req, res) => {
  try {
    const { id } = req.params;
    const { name, description, nrp, mrp } = req.body;
    const userId = req.user.id;
    const userRole = req.user.role;

    const existingItem = await Item.findById(id);
    if (!existingItem) {
      return res.status(404).json({
        success: false,
        message: "Item not found",
      });
    }

    // 🔥 Check ownership (sales can only edit their own)
    if (userRole === "sales" && existingItem.createdBy.toString() !== userId) {
      return res.status(403).json({
        success: false,
        message: "Access denied - you can only edit your own items",
      });
    }

    const updateData = {
      name,
      description,
      nrp: Number(nrp),
      mrp: Number(mrp),
    };

    if (req.file && req.file.buffer) {
      console.log("☁️ Uploading new image to Cloudinary...");

      try {
        const result = await uploadToCloudinary(req.file.buffer);
        updateData.image = result.secure_url;
        console.log("✅ New image uploaded:", result.secure_url);

        if (existingItem.image) {
          console.log("🗑️ Deleting old image from Cloudinary...");
          await deleteFromCloudinary(existingItem.image);
        }
      } catch (cloudinaryError) {
        console.error("❌ Cloudinary operation failed:", cloudinaryError);
        return res.status(500).json({
          success: false,
          message: "Failed to update image on Cloudinary",
          error: cloudinaryError.message,
        });
      }
    }

    const updatedItem = await Item.findByIdAndUpdate(id, updateData, {
      new: true,
      runValidators: true,
    });

    res.status(200).json({
      success: true,
      message: "Item updated successfully",
      item: updatedItem,
    });
  } catch (error) {
    console.error("Error updating item:", error);
    res.status(500).json({
      success: false,
      message: "Error updating item",
      error: error.message,
    });
  }
};

// 🔥 DELETE ITEM - Only if user owns it (or is admin)
exports.deleteItem = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;
    const userRole = req.user.role;

    const item = await Item.findById(id);

    if (!item) {
      return res.status(404).json({
        success: false,
        message: "Item not found",
      });
    }

    // 🔥 Check ownership (sales can only delete their own)
    if (userRole === "sales" && item.createdBy.toString() !== userId) {
      return res.status(403).json({
        success: false,
        message: "Access denied - you can only delete your own items",
      });
    }

    if (item.image) {
      console.log("🗑️ Deleting image from Cloudinary...");
      await deleteFromCloudinary(item.image);
    }

    await Item.findByIdAndDelete(id);

    res.status(200).json({
      success: true,
      message: "Item deleted successfully",
    });
  } catch (error) {
    console.error("Error deleting item:", error);
    res.status(500).json({
      success: false,
      message: "Error deleting item",
      error: error.message,
    });
  }
};
