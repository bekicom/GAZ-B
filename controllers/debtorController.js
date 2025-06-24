const Debtor = require("../models/Debtor");
const Sale = require("../models/Sale");
const Store = require("../models/Store");
const Product = require("../models/Product");

// Utility function for ID validation
const validateObjectId = (id) => {
  return id && id.match(/^[0-9a-fA-F]{24}$/);
};

// Utility function for phone validation
const validatePhone = (phone) => {
  const phoneRegex = /^\+998\d{9}$/;
  return phoneRegex.test(phone);
};

// 1. Yangi qarzdor yaratish yoki mavjud mijozga mahsulot qo'shish
exports.createDebtor = async (req, res) => {
  try {
    const { name, phone, due_date, currency = "sum", products = [] } = req.body;

    // Asosiy validatsiya
    if (!name || !phone || !due_date) {
      return res
        .status(400)
        .json({ message: "Ism, telefon va muddat kiritilishi shart" });
    }

    // Telefon formati tekshiruvi
    if (!validatePhone(phone)) {
      return res
        .status(400)
        .json({ message: "Telefon raqam formati noto'g'ri (+998XXXXXXXXX)" });
    }

    // Sana tekshiruvi
    const dueDateObj = new Date(due_date);
    if (isNaN(dueDateObj.getTime()) || dueDateObj < new Date()) {
      return res
        .status(400)
        .json({ message: "Muddat noto'g'ri yoki o'tmishda" });
    }

    // Mahsulotlar tekshiruvi
    if (!Array.isArray(products) || products.length === 0) {
      return res
        .status(400)
        .json({ message: "Kamida bitta mahsulot kiritilishi kerak" });
    }

    let total_debt = 0;

    // Har bir mahsulotni tekshir
    for (const product of products) {
      const { product_id, product_name, sell_price, product_quantity } =
        product;

      if (!product_id || !product_name || !sell_price || !product_quantity) {
        return res
          .status(400)
          .json({ message: "Mahsulot ma'lumotlari to'liq emas" });
      }

      // Manfiy qiymatlar tekshiruvi
      if (sell_price <= 0 || product_quantity <= 0) {
        return res
          .status(400)
          .json({ message: "Narx va miqdor musbat bo'lishi kerak" });
      }

      // Mahsulot ID validatsiya
      if (!validateObjectId(product_id)) {
        return res
          .status(400)
          .json({ message: "Noto'g'ri mahsulot ID formati" });
      }

      // Mahsulot mavjudligini tekshir
      const existingProduct = await Product.findById(product_id);
      if (!existingProduct) {
        return res
          .status(404)
          .json({ message: `Mahsulot topilmadi: ${product_name}` });
      }

      product.currency = product.currency || currency;
      total_debt += sell_price * product_quantity;
    }

    // Yangi qarzdor yaratish
    const newDebtor = new Debtor({
      name: name.trim(),
      phone,
      due_date: dueDateObj,
      currency,
      debt_amount: total_debt,
      products,
      payment_log: [],
    });

    await newDebtor.save();
    res
      .status(201)
      .json({ message: "Qarzdor muvaffaqiyatli yaratildi", debtor: newDebtor });
  } catch (error) {
    console.error("createDebtor xatoligi:", error);
    res.status(500).json({ message: "Serverda xatolik yuz berdi" });
  }
};

exports.editDebtor = async (req, res) => {
  try {
    const { id } = req.params;
    const { name, phone, due_date } = req.body;

    // ID tekshiruvi
    if (!validateObjectId(id)) {
      return res.status(400).json({ message: "Noto'g'ri ID formati" });
    }

    const debtor = await Debtor.findById(id);
    if (!debtor) {
      return res.status(404).json({ message: "Qarzdor topilmadi" });
    }

    // Yangilanish ma'lumotlarini tayyorlash
    const updateData = {};

    if (name) {
      updateData.name = name.trim();
    }

    if (phone) {
      // TUZATISH: Telefon validatsiyasi
      if (!validatePhone(phone)) {
        return res.status(400).json({
          message: "Telefon raqam formati noto'g'ri (+998XXXXXXXXX)",
        });
      }
      updateData.phone = phone;
    }

    if (due_date) {
      const dueDateObj = new Date(due_date);
      if (isNaN(dueDateObj.getTime()) || dueDateObj < new Date()) {
        return res.status(400).json({
          message: "Muddat noto'g'ri yoki o'tmishda",
        });
      }
      updateData.due_date = dueDateObj;
    }

    const updatedDebtor = await Debtor.findByIdAndUpdate(id, updateData, {
      new: true,
    });

    res.status(200).json({
      message: "Qarzdor ma'lumotlari yangilandi",
      debtor: updatedDebtor,
    });
  } catch (err) {
    console.error("editDebtor xatoligi:", err);
    res.status(500).json({ message: "Serverda xatolik yuz berdi" });
  }
};

exports.updateDebtor = async (req, res) => {
  try {
    const { id } = req.params;
    const { paid_amount } = req.body;

    // ID validatsiya
    if (!validateObjectId(id)) {
      return res.status(400).json({ message: "Noto'g'ri ID formati" });
    }

    // Validatsiya
    if (!paid_amount || isNaN(paid_amount) || paid_amount <= 0) {
      return res.status(400).json({ message: "To'langan summa noto'g'ri" });
    }

    const parsedAmount = parseFloat(paid_amount);
    const debtor = await Debtor.findById(id);

    if (!debtor) {
      return res.status(404).json({ message: "Qarzdor topilmadi" });
    }

    // Qarzdan ko'p to'lanishini oldini olish
    if (parsedAmount > debtor.debt_amount) {
      return res.status(400).json({
        message: `Maksimal to'lanishi mumkin: ${debtor.debt_amount} ${debtor.currency}`,
      });
    }

    debtor.debt_amount -= parsedAmount;
    debtor.payment_log.push({
      amount: parsedAmount,
      currency: debtor.currency,
      date: new Date(),
    });

    // Qarz to'liq to'landi
    if (debtor.debt_amount <= 0) {
      for (const p of debtor.products) {
        const product = await Product.findById(p.product_id);
        if (!product) continue;

        await Sale.create({
          product_id: p.product_id,
          product_name: p.product_name,
          sell_price: p.sell_price,
          buy_price: product.purchase_price,
          currency: debtor.currency,
          quantity: p.product_quantity,
          total_price: p.sell_price * p.product_quantity,
          payment_method: "qarz",
          debtor_name: debtor.name,
          debtor_phone: debtor.phone,
          debt_due_date: debtor.due_date,
        });
      }

      await debtor.deleteOne();
      return res.status(200).json({
        message: "Qarz to'liq to'landi va sotuvlar ro'yxatiga kiritildi",
      });
    }

    await debtor.save();
    res.status(200).json({ message: "To'lov saqlandi", debtor });
  } catch (error) {
    console.error("updateDebtor xatoligi:", error);
    res.status(500).json({ message: "Serverda xatolik yuz berdi" });
  }
};

exports.getAllDebtors = async (req, res) => {
  try {
    // Populate qilishda xatolik bo'lmasligi uchun try-catch ichida
    let debtors;
    try {
      debtors = await Debtor.find().populate("products.product_id");
    } catch (populateError) {
      console.warn("Populate xatoligi:", populateError);
      // Agar populate ishlamasa, oddiy find ishlatamiz
      debtors = await Debtor.find();
    }

    res.status(200).json(debtors);
  } catch (error) {
    console.error("getAllDebtors xatoligi:", error);
    res.status(500).json({ message: "Serverda xatolik yuz berdi" });
  }
};

exports.deleteDebtor = async (req, res) => {
  try {
    const { id } = req.params;

    if (!validateObjectId(id)) {
      return res.status(400).json({ message: "Noto'g'ri ID formati" });
    }

    const debtor = await Debtor.findByIdAndDelete(id);
    if (!debtor) {
      return res.status(404).json({ message: "Qarzdor topilmadi" });
    }

    res.status(200).json({ message: "Qarzdor o'chirildi" });
  } catch (error) {
    console.error("deleteDebtor xatoligi:", error);
    res.status(500).json({ message: "Serverda xatolik yuz berdi" });
  }
};

exports.vazvratDebt = async (req, res) => {
  try {
    const { quantity, id, product_id } = req.body;

    // Validatsiya
    if (!quantity || !id || !product_id) {
      return res
        .status(400)
        .json({ message: "Barcha maydonlar kiritilishi shart" });
    }

    if (quantity <= 0) {
      return res.status(400).json({ message: "Miqdor musbat bo'lishi kerak" });
    }

    // ID validatsiya
    if (!validateObjectId(id) || !validateObjectId(product_id)) {
      return res.status(400).json({ message: "Noto'g'ri ID formati" });
    }

    const debtor = await Debtor.findById(id);
    if (!debtor) {
      return res.status(404).json({ message: "Qarzdor topilmadi" });
    }

    const product = await Product.findById(product_id);
    if (!product) {
      return res.status(404).json({ message: "Mahsulot topilmadi" });
    }

    // TUZATISH: Xavfsizroq ID solishtirish
    const prodIndex = debtor.products.findIndex((p) => {
      const productIdStr = p.product_id ? p.product_id.toString() : "";
      return productIdStr === product_id;
    });

    if (prodIndex === -1) {
      return res.status(404).json({ message: "Mahsulot qarzdorda topilmadi" });
    }

    const item = debtor.products[prodIndex];

    // Qaytariladigan miqdor tekshiruvi
    if (quantity > item.product_quantity) {
      return res.status(400).json({
        message: `Maksimal qaytarish mumkin: ${item.product_quantity} dona`,
      });
    }

    // Ombordagi mahsulotni yangilash
    const storeProduct = await Store.findOne({ product_id });
    if (!storeProduct) {
      await Store.create({
        product_id: product._id,
        product_name: product.product_name,
        quantity: parseInt(quantity),
      });
    } else {
      storeProduct.quantity += parseInt(quantity);
      await storeProduct.save();
    }

    // Qarzdordagi ma'lumotlarni yangilash
    const returnAmount = item.sell_price * parseInt(quantity);
    item.product_quantity -= parseInt(quantity);
    debtor.debt_amount -= returnAmount;

    // TUZATISH: Manfiy qiymatlardan himoya
    if (debtor.debt_amount < 0) {
      debtor.debt_amount = 0;
    }

    if (item.product_quantity <= 0) {
      debtor.products.splice(prodIndex, 1);
    }

    // Agar qarzdorda mahsulot qolmasa yoki qarz 0 ga teng bo'lsa
    if (debtor.products.length === 0 || debtor.debt_amount === 0) {
      await Debtor.findByIdAndDelete(id);
      return res
        .status(200)
        .json({ message: "Mahsulot qaytarildi va qarzdor o'chirildi" });
    }

    await debtor.save();
    res.status(200).json({ message: "Mahsulot muvaffaqiyatli qaytarildi" });
  } catch (err) {
    console.error("vazvratDebt xatoligi:", err);
    res.status(500).json({ message: "Serverda xatolik yuz berdi" });
  }
};

exports.createPayment = async (req, res) => {
  try {
    const { id, amount, currency, rate, payment_method = "naqd" } = req.body;

    // Validatsiya
    if (!id || !amount || !currency) {
      return res
        .status(400)
        .json({ message: "ID, summa va valyuta kiritilishi shart" });
    }

    if (!validateObjectId(id)) {
      return res.status(400).json({ message: "Noto'g'ri ID formati" });
    }

    if (currency === "usd" && !rate) {
      return res
        .status(400)
        .json({ message: "USD uchun kurs kiritilishi shart" });
    }

    const debtor = await Debtor.findById(id);
    if (!debtor) {
      return res.status(404).json({ message: "Qarzdor topilmadi" });
    }

    // To'lov summasini hisoblash
    let paid = parseFloat(amount);
    const currentRate = parseFloat(rate) || 1;

    if (currency === "usd" && debtor.currency === "sum") {
      paid = paid * currentRate;
    } else if (currency === "sum" && debtor.currency === "usd") {
      paid = paid / currentRate;
    }

    // Ortiqcha to'lovni oldini olish
    if (paid > debtor.debt_amount) {
      return res.status(400).json({
        message: `Maksimal to'lanishi mumkin: ${debtor.debt_amount} ${debtor.currency}`,
      });
    }

    // To'lov logiga qo'shish
    debtor.payment_log.push({
      amount: parseFloat(amount),
      currency,
      rate: currentRate,
      date: new Date(),
    });

    // TUZATISH: Dublikat Sale yaratmaslik
    // Faqat qarz to'liq to'langanda Sale yaratish

    // Qarzni kamaytirish
    debtor.debt_amount -= paid;
    if (debtor.debt_amount < 0) debtor.debt_amount = 0;

    // Qarz to'liq to'landi
    if (debtor.debt_amount <= 0) {
      for (const item of debtor.products) {
        const product = await Product.findById(item.product_id);
        if (!product) continue;

        const total_price = item.sell_price * item.product_quantity;

        await Sale.create({
          product_id: product._id,
          product_name: item.product_name,
          sell_price: item.sell_price,
          buy_price: product.purchase_price,
          currency: debtor.currency,
          quantity: item.product_quantity,
          total_price,
          total_price_sum:
            debtor.currency === "usd" ? total_price * currentRate : total_price,
          payment_method: "qarz",
          debtor_name: debtor.name,
          debtor_phone: debtor.phone,
          debt_due_date: debtor.due_date,
          rate: currentRate,
        });
      }

      await debtor.deleteOne();
      return res.status(200).json({
        message: "Qarz to'liq to'landi va sotuvlar ro'yxatiga kiritildi",
      });
    }

    await debtor.save();
    res.status(200).json({ message: "To'lov muvaffaqiyatli saqlandi", debtor });
  } catch (err) {
    console.error("createPayment xatoligi:", err);
    res.status(500).json({ message: "Serverda xatolik yuz berdi" });
  }
};
