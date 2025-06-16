const Debtor = require("../models/Debtor");
const Sale = require("../models/Sale");
const Store = require("../models/Store");
const Product = require("../models/Product");

// 1. Yangi qarzdor yaratish yoki mavjud mijozga mahsulot qo'shish
exports.createDebtor = async (req, res) => {
  try {
    const { name, phone, due_date, currency = "sum", products = [] } = req.body;

    // 1. Tekshir: products massiv bo‘lishi kerak
    if (!Array.isArray(products) || products.length === 0) {
      return res
        .status(400)
        .json({ message: "Mahsulotlar noto‘g‘ri formatda" });
    }

    let total_debt = 0;

    // 2. Har bir mahsulotni tekshir va currency biriktir
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
      product.currency = product.currency || currency;
      total_debt += product.sell_price * product.product_quantity;
    }

    // 3. Yangi qarzdor obyektini yarat
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
    console.log(error);
    res.status(500).json({ message: error.message });
  }
};

exports.editDebtor = async (req, res) => {
  try {
    const { id } = req.params;
    await Debtor.findByIdAndUpdate(id, req.body);
    res.status(200).json({ message: "Qarzdor ma'lumotlari yangilandi" });
  } catch (err) {
    console.log(err.message);
    return res.status(500).json({ message: "Serverda xatolik" });
  }
};
exports.updateDebtor = async (req, res) => {
  try {
    const { id } = req.params;
    const { paid_amount, product_id } = req.body;

    const parsedAmount = paid_amount;
    if (!paid_amount || isNaN(parsedAmount) || parsedAmount <= 0) {
      return res.status(400).json({ message: "To'langan summa noto'g'ri" });
    }

    const debtor = await Debtor.findById(id);
    if (!debtor) return res.status(404).json({ message: "Qarzdor topilmadi" });

    debtor.debt_amount -= parsedAmount;
    debtor.payment_log.push({ amount: parsedAmount, date: new Date() });

    // Qarzdor to‘liq to‘ladi, mahsulotlar sotuvga o‘tadi
    if (debtor.debt_amount <= 0) {
      for (const p of debtor.products) {
        const product = await Product.findById(p.product_id);
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
        .json({ message: "Qarz to'liq to'landi va sotuvlar yozildi" });
    }

    await debtor.save();
    res.status(200).json(debtor);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};
exports.getAllDebtors = async (req, res) => {
  try {
    const debtors = await Debtor.find().populate("products.product_id");
    res.status(200).json(debtors);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};
exports.deleteDebtor = async (req, res) => {
  try {
    const { id } = req.params;
    await Debtor.findByIdAndDelete(id);
    res.status(200).json({ message: "Qarzdor o'chirildi" });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};
exports.vazvratDebt = async (req, res) => {
  try {
    const { quantity, id, product_id } = req.body;

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

    const prodIndex = debtor.products.findIndex((p) => {
      const pId =
        typeof p.product_id === "object"
          ? p.product_id._id?.toString()
          : p.product_id?.toString();
      return pId === product_id;
    });

    if (prodIndex === -1) {
      return res.status(404).json({ message: "Mahsulot qarzdorda topilmadi" });
    }

    const item = debtor.products[prodIndex];
    item.product_quantity -= quantity;
    debtor.debt_amount -= item.sell_price * quantity;

    if (item.product_quantity <= 0) {
      debtor.products.splice(prodIndex, 1);
    }

    // if (debtor.products.length === 0) {
    //   await Debtor.findByIdAndDelete(id);
    // } else {
    await debtor.save();
    // }

    res.status(200).json({ message: "Mahsulot qaytarildi" });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};
exports.createPayment = async (req, res) => {
  const session = await mongoose.startSession();

  try {
    await session.startTransaction();

    const { id, amount, currency, rate, payment_method = "naqd" } = req.body;

    // Validatsiya
    if (!id || !amount || !currency || !rate) {
      return res.status(400).json({ message: "Kerakli maydonlar to'liq emas" });
    }

    if (parseFloat(amount) <= 0) {
      return res
        .status(400)
        .json({ message: "To'lov summasi 0 dan katta bo'lishi kerak" });
    }

    const debtor = await Debtor.findById(id).session(session);
    if (!debtor) {
      return res.status(404).json({ message: "Qarzdor topilmadi" });
    }

    // 💰 Barcha summalarni USD ga keltiramiz (yoki asosiy valyutaga)
    const amountInUsd =
      currency === "usd"
        ? parseFloat(amount)
        : parseFloat(amount) / parseFloat(rate);

    // Qarzni USD da saqlaymiz deb faraz qilamiz
    const currentDebtUsd = parseFloat(debtor.debt_amount);

    // Floating point xatolarini oldini olish uchun
    const remainingDebt =
      Math.round((currentDebtUsd - amountInUsd) * 100) / 100;

    // ✅ 1. To'lov logini yangilaymiz
    debtor.payment_log.push({
      amount: parseFloat(amount),
      currency,
      rate: parseFloat(rate),
      amount_usd: amountInUsd,
      payment_method,
      date: new Date(),
    });

    // ✅ 2. To'lov qarz yopilgandan keyin bo'lsa
    if (remainingDebt <= 0) {
      // Mahsulotlarni sotuvga yozamiz (faqat qarz yopilganda)
      for (const item of debtor.products) {
        const product = await Product.findById(item.product_id).session(
          session
        );
        if (!product) continue;

        const total_price_usd = item.sell_price * item.product_quantity;

        await Sale.create(
          [
            {
              product_id: product._id,
              product_name: item.product_name,
              sell_price: item.sell_price,
              buy_price: product.purchase_price,
              currency: "usd",
              quantity: item.product_quantity,
              total_price: total_price_usd,
              total_price_sum: total_price_usd * rate,
              payment_method: "qarz",
              debtor_name: debtor.name,
              debtor_phone: debtor.phone,
              debt_due_date: debtor.due_date,
              createdAt: new Date(),
            },
          ],
          { session }
        );

        // Mahsulot miqdorini kamaytiramiz
        product.quantity -= item.product_quantity;
        if (product.quantity < 0) product.quantity = 0;
        await product.save({ session });
      }

      // Ortiqcha to'lovni qaytarish logikasi
      if (remainingDebt < 0) {
        // Ortiqcha to'lov summasini log qilamiz
        console.log(`Ortiqcha to'lov: ${Math.abs(remainingDebt)} USD`);
        // Bu yerda ortiqcha pul qaytarish logikasini qo'shishingiz mumkin
      }

      // Qarzdorni o'chiramiz
      await Debtor.findByIdAndDelete(id).session(session);

      await session.commitTransaction();

      return res.status(200).json({
        message: "Qarz to'liq yopildi",
        overpayment: remainingDebt < 0 ? Math.abs(remainingDebt) : 0,
      });
    }

    // ♻️ 3. Qisman to'lov bo'lsa - faqat debt_amount ni yangilaymiz
    debtor.debt_amount = remainingDebt;
    await debtor.save({ session });

    await session.commitTransaction();

    return res.status(200).json({
      message: "Qisman to'lov qabul qilindi",
      remaining_debt: remainingDebt,
      paid_amount: amountInUsd,
    });
  } catch (err) {
    await session.abortTransaction();
    console.error("Payment error:", err);
    return res.status(500).json({
      message: "Serverda xatolik",
      error: process.env.NODE_ENV === "development" ? err.message : undefined,
    });
  } finally {
    await session.endSession();
  }
};
