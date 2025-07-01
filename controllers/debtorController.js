const Debtor = require("../models/Debtor");
const Sale = require("../models/Sale");
const Store = require("../models/Store");
const Product = require("../models/Product");

// ✅ 1. Qarzdor qo‘shish
exports.createDebtor = async (req, res) => {
  try {
    const { name, phone, due_date, currency = "sum", products = [] } = req.body;

    if (!Array.isArray(products) || products.length === 0) {
      return res.status(400).json({ message: "Mahsulotlar kerak" });
    }

    let total_debt = 0;

    for (const product of products) {
      if (
        !product.product_id ||
        !product.product_name ||
        !product.sell_price ||
        !product.product_quantity
      ) {
        return res
          .status(400)
          .json({ message: "Mahsulotdagi qiymatlar to‘liq emas" });
      }

      if (product.product_quantity <= 0 || product.sell_price <= 0) {
        return res
          .status(400)
          .json({
            message: "Mahsulot miqdor yoki narx 0 dan katta bo'lishi kerak",
          });
      }

      product.currency = product.currency || currency;
      total_debt += product.sell_price * product.product_quantity;
    }

    const newDebtor = new Debtor({
      name,
      phone,
      due_date,
      currency,
      debt_amount: total_debt,
      products,
    });

    await newDebtor.save();
    res.status(201).json(newDebtor);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// ✅ 2. Qarzdorni tahrirlash
exports.editDebtor = async (req, res) => {
  try {
    const { id } = req.params;
    await Debtor.findByIdAndUpdate(id, req.body, { new: true });
    res.status(200).json({ message: "Qarzdor yangilandi" });
  } catch (err) {
    res.status(500).json({ message: "Serverda xatolik" });
  }
};

// ✅ 3. Qarz to‘lash (oddiy)
exports.updateDebtor = async (req, res) => {
  try {
    const { id } = req.params;
    const { amount } = req.body;

    const parsedAmount = parseFloat(amount);
    if (!parsedAmount || parsedAmount <= 0) {
      return res.status(400).json({ message: "To‘lov summasi noto‘g‘ri" });
    }

    const debtor = await Debtor.findById(id);
    if (!debtor) return res.status(404).json({ message: "Qarzdor topilmadi" });

    debtor.debt_amount -= parsedAmount;
    debtor.payment_log.push({ amount: parsedAmount, date: new Date() });

    if (debtor.debt_amount <= 0) {
      for (const p of debtor.products) {
        const product = await Product.findById(p.product_id);
        if (!product) continue;

        await Sale.create({
          product_id: p.product_id,
          product_name: p.product_name,
          sell_price: p.sell_price,
          buy_price: product.purchase_price,
          quantity: p.product_quantity,
          total_price: p.sell_price * p.product_quantity,
          payment_method: "qarz",
          debtor_name: debtor.name,
          debtor_phone: debtor.phone,
          debt_due_date: debtor.due_date,
        });
      }

      await debtor.deleteOne();
      return res
        .status(200)
        .json({ message: "Qarz to‘liq to‘landi va sotuvga qo‘shildi" });
    }

    await debtor.save();
    res.status(200).json(debtor);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// ✅ 4. Barcha qarzdorlar
exports.getAllDebtors = async (req, res) => {
  try {
    const debtors = await Debtor.find().populate("products.product_id");
    res.status(200).json(debtors);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// ✅ 5. Qarzdorni o‘chirish
exports.deleteDebtor = async (req, res) => {
  try {
    const { id } = req.params;
    await Debtor.findByIdAndDelete(id);
    res.status(200).json({ message: "Qarzdor o‘chirildi" });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// ✅ 6. Mahsulotni qaytarish
exports.vazvratDebt = async (req, res) => {
  try {
    const { quantity, id, product_id } = req.body;

    const debtor = await Debtor.findById(id);
    if (!debtor) return res.status(404).json({ message: "Qarzdor topilmadi" });

    const itemIndex = debtor.products.findIndex((p) => {
      const pId =
        typeof p.product_id === "object"
          ? p.product_id._id?.toString()
          : p.product_id?.toString();
      return pId === product_id;
    });

    if (itemIndex === -1) {
      return res.status(404).json({ message: "Mahsulot qarzdorda topilmadi" });
    }

    const item = debtor.products[itemIndex];
    if (quantity > item.product_quantity) {
      return res
        .status(400)
        .json({ message: "Qaytarilayotgan miqdor mavjudidan ko‘p" });
    }

    item.product_quantity -= quantity;
    debtor.debt_amount -= item.sell_price * quantity;

    if (item.product_quantity <= 0) {
      debtor.products.splice(itemIndex, 1);
    }

    // Store ga qaytarish
    const storeProduct = await Store.findOne({ product_id });
    if (!storeProduct) {
      await Store.create({
        product_id,
        product_name: item.product_name,
        quantity,
      });
    } else {
      storeProduct.quantity += quantity;
      await storeProduct.save();
    }

    await debtor.save();
    res.status(200).json({ message: "Mahsulot qaytarildi" });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// ✅ 7. Valyuta bilan qarzni qisman yoki to‘liq to‘lash
exports.createPayment = async (req, res) => {
  try {
    const { id, amount, currency, rate, payment_method = "naqd" } = req.body;

    if (!id || !amount || !currency || !rate) {
      return res.status(400).json({ message: "Kerakli maydonlar to‘liq emas" });
    }

    if (rate <= 0) {
      return res.status(400).json({ message: "Kurs noto‘g‘ri" });
    }

    const debtor = await Debtor.findById(id);
    if (!debtor) return res.status(404).json({ message: "Qarzdor topilmadi" });

    const amountInUsd =
      currency === "usd" ? parseFloat(amount) : parseFloat(amount / rate);
    const remainingDebt = debtor.debt_amount - amountInUsd;

    // ✅ To‘liq to‘lov
    if (remainingDebt <= 0) {
      for (const item of debtor.products) {
        const product = await Product.findById(item.product_id);
        if (!product) continue;

        const total_price = item.sell_price * item.product_quantity;
        const total_price_sum =
          item.currency === "usd" ? total_price : total_price * rate;

        await Sale.create({
          product_id: product._id,
          product_name: item.product_name,
          sell_price: item.sell_price,
          buy_price: product.purchase_price,
          currency: item.currency,
          quantity: item.product_quantity,
          total_price,
          total_price_sum,
          payment_method,
          debtor_name: debtor.name,
          debtor_phone: debtor.phone,
          debt_due_date: debtor.due_date,
        });
      }

      await Debtor.findByIdAndDelete(id);
      return res
        .status(200)
        .json({ message: "Qarz to‘liq yopildi va sotuv yozildi" });
    }

    // ♻️ Qisman to‘lov
    debtor.debt_amount = remainingDebt;
    debtor.payment_log.push({
      amount: parseFloat(amount),
      date: new Date(),
      currency,
    });
    await debtor.save();

    return res.status(200).json({ message: "Qisman to‘lov qabul qilindi" });
  } catch (err) {
    res.status(500).json({ message: "Serverda xatolik", error: err.message });
  }
};

// Sotuvni o'chirish
exports.deleteSale = async (req, res) => {
  try {
    const { id } = req.params;

    const deleted = await Sale.findByIdAndDelete(id);
    if (!deleted) {
      return res.status(404).json({ message: "Sotuv topilmadi" });
    }

    res.status(200).json({ message: "Sotuv muvaffaqiyatli o'chirildi" });
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
};
