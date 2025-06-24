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

    const debtor = await Debtor.findById(id);
    if (!debtor) return res.status(404).json({ message: "Qarzdor topilmadi" });

    const amount = parseFloat(paid_amount);
    if (!amount || amount <= 0)
      return res.status(400).json({ message: "To‘lov noto‘g‘ri" });

    debtor.debt_amount -= amount;
    debtor.payment_log.push({ amount, date: new Date() });

    // ✅ To‘liq to‘langan bo‘lsa — mahsulotlar sotuvga o‘tadi
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
    const debtor = await Debtor.findById(id);
    if (!debtor) return res.status(404).json({ message: "Qarzdor topilmadi" });

    const product = await Product.findById(product_id);
    const storeProduct = await Store.findOne({ product_id });

    if (!storeProduct) {
      await Store.create({
        product_id: product._id,
        product_name: product.product_name,
        quantity,
      });
    } else {
      storeProduct.quantity += quantity;
      await storeProduct.save();
    }

    const index = debtor.products.findIndex(
      (p) => p.product_id.toString() === product_id
    );
    if (index === -1)
      return res.status(404).json({ message: "Mahsulot topilmadi" });

    debtor.products[index].product_quantity -= quantity;
    debtor.debt_amount -= debtor.products[index].sell_price * quantity;

    if (debtor.products[index].product_quantity <= 0) {
      debtor.products.splice(index, 1);
    }

    await debtor.save();
    res.status(200).json({ message: "Mahsulot qaytarildi" });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// 🔹 7. Qarzdor uchun to‘lov qilish
exports.createPayment = async (req, res) => {
  try {
    const { id, amount, currency, rate, payment_method = "naqd" } = req.body;

    if (!id || !amount || !currency || !rate) {
      return res
        .status(400)
        .json({ message: "Barcha maydonlar to‘ldirilishi kerak" });
    }

    const debtor = await Debtor.findById(id);
    if (!debtor) return res.status(404).json({ message: "Qarzdor topilmadi" });

    const amountInUsd =
      currency === "usd" ? parseFloat(amount) : parseFloat(amount) / rate;

    debtor.payment_log.push({
      amount: parseFloat(amount),
      currency,
      date: new Date(),
    });

    await Sale.create({
      product_name: "Qarzdor to‘lovi",
      client_name: debtor.name,
      currency,
      total_price: parseFloat(amount),
      payment_method,
      createdAt: new Date(),
    });

    debtor.debt_amount -= amountInUsd;
    if (debtor.debt_amount <= 0) {
      for (const item of debtor.products) {
        const product = await Product.findById(item.product_id);
        const total_price = item.sell_price * item.product_quantity;

        await Sale.create({
          product_id: item.product_id,
          product_name: item.product_name,
          sell_price: item.sell_price,
          buy_price: product?.purchase_price || 0,
          currency: "usd",
          quantity: item.product_quantity,
          total_price,
          total_price_sum: total_price * rate,
          payment_method: "qarz",
          debtor_name: debtor.name,
          debtor_phone: debtor.phone,
          debt_due_date: item.due_date,
        });
      }

      debtor.products = [];
      debtor.payment_log = [];
      debtor.debt_amount = 0;
    }

    await debtor.save();
    res.status(200).json({ message: "To‘lov saqlandi" });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};
