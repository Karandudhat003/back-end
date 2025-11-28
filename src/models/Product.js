
// const mongoose = require("mongoose");

// const productSchema = new mongoose.Schema({
//   name: { type: String, required: true },
//   number: { type: String, required: true },
//   address: { type: String, required: true, default: "SURAT" },
//   includeGst: { type: Boolean, required: true, default: false },
//   dis: { type: String, default: "0" },
//   value: { type: String, enum: ["nrp", "mrp"], required: true },
//   date: { type: Date, default: Date.now },
//   totalQuantity: { type: Number, default: 0 },
//   totalAmount: { type: Number, default: 0 },
//   items: [{
//     item: {
//       type: mongoose.Schema.Types.ObjectId,
//       ref: "Item",
//       required: true
//     },
//     quantity: {
//       type: Number,
//       default: 1,
//       min: 1
//     }
//   }],
// }, {
//   timestamps: true
// });

// // Transform output to always include includeGst as boolean
// productSchema.set('toJSON', {
//   transform: function (doc, ret) {
//     // Ensure includeGst is always a boolean
//     ret.includeGst = ret.includeGst === true;
//     // Ensure address has default
//     if (!ret.address) {
//       ret.address = "SURAT";
//     }
//     return ret;
//   }
// });

// productSchema.set('toObject', {
//   transform: function (doc, ret) {
//     // Ensure includeGst is always a boolean
//     ret.includeGst = ret.includeGst === true;
//     // Ensure address has default
//     if (!ret.address) {
//       ret.address = "SURAT";
//     }
//     return ret;
//   }
// });

// // Calculate totals before saving
// productSchema.pre("save", async function (next) {
//   try {
//     if (this.items && this.items.length > 0) {
//       const Item = mongoose.model("Item");
//       const itemIds = this.items.map(entry => entry.item);
//       const itemsData = await Item.find({ _id: { $in: itemIds } });

//       const itemMap = {};
//       itemsData.forEach(item => {
//         itemMap[item._id.toString()] = item;
//       });

//       let totalQty = 0;
//       let totalAmt = 0;

//       this.items.forEach(entry => {
//         const itemData = itemMap[entry.item.toString()];
//         if (itemData) {
//           const qty = entry.quantity || 1;
//           const rate = this.value === 'nrp' ? (itemData.nrp || 0) : (itemData.mrp || 0);
//           totalQty += qty;
//           totalAmt += qty * rate;
//         }
//       });

//       // Apply discount
//       const discountPercent = parseFloat(this.dis) || 0;
//       const discountAmount = (totalAmt * discountPercent) / 100;
//       const afterDiscount = totalAmt - discountAmount;

//       // Apply GST if includeGst is true
//       let grandTotal = afterDiscount;
//       if (this.includeGst === true) {
//         const gstAmount = afterDiscount * 0.18;
//         grandTotal = afterDiscount + gstAmount;
//       }

//       this.totalQuantity = totalQty;
//       this.totalAmount = grandTotal;
//     }
//   } catch (error) {
//     console.error("Error in pre-save hook:", error);
//   }
//   next();
// });

// // Calculate totals before updating
// productSchema.pre("findOneAndUpdate", async function (next) {
//   try {
//     const update = this.getUpdate();

//     // Get the document being updated to access current values
//     const docToUpdate = await this.model.findOne(this.getQuery());

//     if (update.items && update.items.length > 0) {
//       const Item = mongoose.model("Item");
//       const itemIds = update.items.map(entry => entry.item || entry._id);
//       const itemsData = await Item.find({ _id: { $in: itemIds } });

//       const itemMap = {};
//       itemsData.forEach(item => {
//         itemMap[item._id.toString()] = item;
//       });

//       let totalQty = 0;
//       let totalAmt = 0;

//       update.items.forEach(entry => {
//         const itemId = entry.item || entry._id;
//         const itemData = itemMap[itemId.toString()];
//         if (itemData) {
//           const qty = entry.quantity || 1;
//           const rate = update.value === 'nrp' ? (itemData.nrp || 0) : (itemData.mrp || 0);
//           totalQty += qty;
//           totalAmt += qty * rate;
//         }
//       });

//       // Apply discount
//       const discountPercent = parseFloat(update.dis) || 0;
//       const discountAmount = (totalAmt * discountPercent) / 100;
//       const afterDiscount = totalAmt - discountAmount;

//       // Determine includeGst value - use update value if provided, else use existing
//       const includeGst = update.includeGst !== undefined
//         ? update.includeGst
//         : (docToUpdate ? docToUpdate.includeGst : false);

//       // Apply GST if includeGst is true
//       let grandTotal = afterDiscount;
//       if (includeGst === true) {
//         const gstAmount = afterDiscount * 0.18;
//         grandTotal = afterDiscount + gstAmount;
//       }

//       update.totalQuantity = totalQty;
//       update.totalAmount = grandTotal;
//     }
//   } catch (error) {
//     console.error("Error in pre-update hook:", error);
//   }
//   next();
// });

// module.exports = mongoose.model("Product", productSchema);



const mongoose = require("mongoose");

const productSchema = new mongoose.Schema({
  name: { type: String, required: true },
  number: { type: String, required: true },
  address: { type: String, required: true, default: "SURAT" },
  includeGst: { type: Boolean, required: true, default: false },
  dis: { type: String, default: "0" },
  value: { type: String, enum: ["nrp", "mrp"], required: true },
  date: { type: Date, default: Date.now },
  totalQuantity: { type: Number, default: 0 },
  totalAmount: { type: Number, default: 0 },
  items: [{
    item: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Item",
      required: true
    },
    quantity: {
      type: Number,
      default: 1,
      min: 1
    }
  }],
  // 🔥 NEW: User ownership fields
  createdBy: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'User', 
    required: true 
  },
  createdByUsername: { type: String, required: true }
}, {
  timestamps: true
});

// Transform output to always include includeGst as boolean
productSchema.set('toJSON', {
  transform: function (doc, ret) {
    ret.includeGst = ret.includeGst === true;
    if (!ret.address) {
      ret.address = "SURAT";
    }
    return ret;
  }
});

productSchema.set('toObject', {
  transform: function (doc, ret) {
    ret.includeGst = ret.includeGst === true;
    if (!ret.address) {
      ret.address = "SURAT";
    }
    return ret;
  }
});

// Calculate totals before saving
productSchema.pre("save", async function (next) {
  try {
    if (this.items && this.items.length > 0) {
      const Item = mongoose.model("Item");
      const itemIds = this.items.map(entry => entry.item);
      const itemsData = await Item.find({ _id: { $in: itemIds } });

      const itemMap = {};
      itemsData.forEach(item => {
        itemMap[item._id.toString()] = item;
      });

      let totalQty = 0;
      let totalAmt = 0;

      this.items.forEach(entry => {
        const itemData = itemMap[entry.item.toString()];
        if (itemData) {
          const qty = entry.quantity || 1;
          const rate = this.value === 'nrp' ? (itemData.nrp || 0) : (itemData.mrp || 0);
          totalQty += qty;
          totalAmt += qty * rate;
        }
      });

      const discountPercent = parseFloat(this.dis) || 0;
      const discountAmount = (totalAmt * discountPercent) / 100;
      const afterDiscount = totalAmt - discountAmount;

      let grandTotal = afterDiscount;
      if (this.includeGst === true) {
        const gstAmount = afterDiscount * 0.18;
        grandTotal = afterDiscount + gstAmount;
      }

      this.totalQuantity = totalQty;
      this.totalAmount = grandTotal;
    }
  } catch (error) {
    console.error("Error in pre-save hook:", error);
  }
  next();
});

// Calculate totals before updating
productSchema.pre("findOneAndUpdate", async function (next) {
  try {
    const update = this.getUpdate();
    const docToUpdate = await this.model.findOne(this.getQuery());

    if (update.items && update.items.length > 0) {
      const Item = mongoose.model("Item");
      const itemIds = update.items.map(entry => entry.item || entry._id);
      const itemsData = await Item.find({ _id: { $in: itemIds } });

      const itemMap = {};
      itemsData.forEach(item => {
        itemMap[item._id.toString()] = item;
      });

      let totalQty = 0;
      let totalAmt = 0;

      update.items.forEach(entry => {
        const itemId = entry.item || entry._id;
        const itemData = itemMap[itemId.toString()];
        if (itemData) {
          const qty = entry.quantity || 1;
          const rate = update.value === 'nrp' ? (itemData.nrp || 0) : (itemData.mrp || 0);
          totalQty += qty;
          totalAmt += qty * rate;
        }
      });

      const discountPercent = parseFloat(update.dis) || 0;
      const discountAmount = (totalAmt * discountPercent) / 100;
      const afterDiscount = totalAmt - discountAmount;

      const includeGst = update.includeGst !== undefined
        ? update.includeGst
        : (docToUpdate ? docToUpdate.includeGst : false);

      let grandTotal = afterDiscount;
      if (includeGst === true) {
        const gstAmount = afterDiscount * 0.18;
        grandTotal = afterDiscount + gstAmount;
      }

      update.totalQuantity = totalQty;
      update.totalAmount = grandTotal;
    }
  } catch (error) {
    console.error("Error in pre-update hook:", error);
  }
  next();
});

module.exports = mongoose.model("Product", productSchema);
