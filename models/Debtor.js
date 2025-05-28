const debtorSchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    phone: { type: String, required: true },
    debt_amount: { type: Number, required: true, min: 0 },
    currency: {
      type: String,
      enum: ["sum", "usd"],
    },
    due_date: { type: Date, required: true },
    products: [
      {
        product_id: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "Product",
          required: true,
        },
        product_name: { type: String, required: true },
        product_quantity: { type: Number, required: true },
        sell_price: { type: Number, required: true },
      },
    ],
    payment_log: {
      type: [
        {
          amount: Number,
          date: Date,
        },
      ],
      default: [],
    },
  },
  { timestamps: true }
);
