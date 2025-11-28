const mongoose = require("mongoose");

const itemSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, unique: true },
    description: { type: String, default: "" },
    nrp: { type: Number, required: true, default: 0 },
    mrp: { type: Number, required: true, default: 0 },
    image: { type: String, default: null },
  },
  { timestamps: true }
);

module.exports = mongoose.model("Item", itemSchema);


// const mongoose = require("mongoose");

// const itemSchema = new mongoose.Schema(
//   {
//     name: { type: String, required: true },
//     description: { type: String, default: "" },
//     nrp: { type: Number, required: true, default: 0 },
//     mrp: { type: Number, required: true, default: 0 },
//     image: { type: String, default: null },
//     // 🔥 NEW: User ownership fields (optional - won't break existing data)
//     createdBy: { 
//       type: mongoose.Schema.Types.ObjectId, 
//       ref: 'User'
//       // NOT required - so existing data without this field will still work
//     },
//     createdByUsername: { 
//       type: String
//       // NOT required - so existing data without this field will still work
//     }
//   },
//   { timestamps: true }
// );

// // 🔥 Compound index for unique name per user (only for new data)
// // This allows same item names for different users
// itemSchema.index({ name: 1, createdBy: 1 }, { unique: true, sparse: true });

// module.exports = mongoose.model("Item", itemSchema);


