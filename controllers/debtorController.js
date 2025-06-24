const Debtor = require("../models/Debtor");
const Sale = require("../models/Sale");
const Store = require("../models/Store");
const Product = require("../models/Product");

// 🔹 1. Qarzdor yaratish
exports.createDebtor = async (req, res) => {
  try {
    const { name, phone, due_date, currency = "sum", products = [] } = req.body;

    if (!Array.isArray(products) || products.length === 0) {
      return res
        .status(400)
        .json({ message: "Mahsulotlar noto‘g‘ri formatda" });
    }

    let total_debt = 0;
    const updatedProducts = [];

    for (const p of products) {
      if (
        !p.product_id ||
        !p.product_name ||
        !p.sell_price ||
        !p.product_quantity
      ) {
        return res
          .status(400)
          .json({ message: "Mahsulotdagi qiymatlar to‘liq emas" });
      }

      const item = {
        ...p,
        currency: p.currency || currency,
        due_date: p.due_date || due_date,
      };

      updatedProducts.push(item);
      total_debt += item.sell_price * item.product_quantity;
    }

    const newDebtor = new Debtor({
      name,
      phone,
      due_date,
      currency,
      debt_amount: total_debt,
      products: updatedProducts,
    });

    await newDebtor.save();
    res.status(201).json(newDebtor);
  } catch (error) {
    console.log(error.message);
    res.status(500).json({ message: error.message });
  }
};

// 🔹 2. Qarzdorni tahrirlash
exports.editDebtor = async (req, res) => {
  try {
    const { id } = req.params;
    await Debtor.findByIdAndUpdate(id, req.body);
    res.status(200).json({ message: "Qarzdor yangilandi" });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// 🔹 3. Qarzdorni to‘lov asosida yangilash (qisman yoki to‘liq to‘lov)
exports.updateDebtor = async (req, res) => {
  try {
    const { id } = req.params;
    const { paid_amount, product_id } = req.body;

    // ID validligini tekshirish
    if (!id || !mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ message: "Noto‘g‘ri ID formati" });
    }

    const debtor = await Debtor.findById(id);
    if (!debtor) return res.status(404).json({ message: "Qarzdor topilmadi" });

    const amount = parseFloat(paid_amount);
    if (!amount || amount <= 0)
      return res.status(400).json({ message: "To‘lov noto‘g‘ri" });

    debtor.debt_amount -= amount;
    debtor.payment_log.push({ amount, date: new Date() });

    if (debtor.debt_amount <= 0) {
      for (const p of debtor.products) {
        const product = await Product.findById(p.product_id);
        await Sale.create({
          product_id: p.product_id,
          product_name: p.product_name,
          sell_price: p.sell_price,
          buy_price: product?.purchase_price || 0,
          quantity: p.product_quantity,
          total_price: p.sell_price * p.product_quantity,
          payment_method: "qarz",
          debtor_name: debtor.name,
          debtor_phone: debtor.phone,
          debt_due_date: p.due_date,
        });
      }
      await debtor.deleteOne();
      return res.status(200).json({ message: "Qarz to‘liq yopildi" });
    }

    await debtor.save();
    res.status(200).json({ message: "To‘lov saqlandi" });
  } catch (error) {
    console.error("UpdateDebtor error:", error);
    res.status(500).json({ message: error.message });
  }
};
// 🔹 4. Qarzdorlar ro‘yxati
exports.getAllDebtors = async (req, res) => {
  try {
    const debtors = await Debtor.find().populate("products.product_id");
    res.status(200).json(debtors);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// 🔹 5. Qarzdorni o‘chirish
exports.deleteDebtor = async (req, res) => {
  try {
    const { id } = req.params;
    await Debtor.findByIdAndDelete(id);
    res.status(200).json({ message: "Qarzdor o‘chirildi" });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// 🔹 6. Mahsulot qaytarish
exports.vazvratDebt = async (req, res) => {
  try {
    const { id, product_id, quantity } = req.body;

    if (!id || !mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ message: "Noto‘g‘ri ID formati" });
    }

    const debtor = await Debtor.findById(id);
    if (!debtor) return res.status(404).json({ message: "Qarzdor topilmadi" });

    // Qolgan kod o‘zgarishsiz...
  } catch (err) {
    console.error("VazvratDebt error:", err);
    res.status(500).json({ message: err.message });
  }
};

exports.createDebtor = async (req, res) => {
  try {
    const { name, phone, due_date, currency = "sum", products = [] } = req.body;

    if (!due_date) {
      return res.status(400).json({ message: "Umumiy due_date majburiy" });
    }

    if (!Array.isArray(products) || products.length === 0) {
      return res
        .status(400)
        .json({ message: "Mahsulotlar noto‘g‘ri formatda" });
    }

    let total_debt = 0;

    // Har bir mahsulotga due_date avtomatik beriladi
    const updatedProducts = products.map((p) => {
      if (
        !p.product_id ||
        !p.product_name ||
        !p.sell_price ||
        !p.product_quantity
      ) {
        throw new Error("Mahsulotdagi qiymatlar to‘liq emas");
      }
      total_debt += p.sell_price * p.product_quantity;

      return {
        ...p,
        currency: p.currency || currency,
        due_date: p.due_date || due_date, // 🔥 majburiy maydonni qo‘shish
      };
    });

    const newDebtor = new Debtor({
      name,
      phone,
      due_date,
      currency,
      debt_amount: total_debt,
      products: updatedProducts,
    });

    await newDebtor.save();
    res.status(201).json(newDebtor);
  } catch (error) {
    console.log(error);
    res.status(500).json({ message: error.message });
  }
};
