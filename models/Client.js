const mongoose = require("mongoose");

const clientSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
  },
  phone: {
    type: String,
    required: true,
    unique: true,
  },
  total_debt: {
    type: Number,
    default: 0,
  },
  sales: [
    {
      sale_id: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Sale",
      },
      date: {
        type: Date,
        default: Date.now,
      },
      total_price: Number,
      payment_method: String,
    },
  ],
  payment_history: [
    {
      amount: Number,
      date: {
        type: Date,
        default: Date.now,
      },
      note: String,
    },
  ],
});

module.exports = mongoose.model("Client", clientSchema);
