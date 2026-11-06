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