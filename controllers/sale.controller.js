const Client = require("../models/Client");
const Product = require("../models/Product");
const Sale = require("../models/Sale");
const Budget = require("../models/Budget");

exports.recordSale = async (req, res) => {
  try {
    const {
      product_id,
      product_name,
      sell_price,
      quantity,
      currency,
      total_price,
      total_price_sum,
      payment_method,
      client_name,
      client_phone,
    } = req.body;

    // 🔍 Minimal validatsiyalar
    if (
      !product_id ||
      !product_name ||
      !sell_price ||
      !quantity ||
      !total_price ||
      !payment_method
    ) {
      return res
        .status(400)
        .json({ message: "Barcha majburiy maydonlar to‘ldirilishi kerak" });
    }

    if (!client_name || !client_phone) {
      return res
        .status(400)
        .json({ message: "Mijoz ismi va telefon raqami kerak" });
    }

    // 🔍 Mijozni topamiz yoki yaratamiz
    let client = await Client.findOne({ phone: client_phone });
    if (!client) {
      client = new Client({
        name: client_name,
        phone: client_phone,
        total_debt: 0,
        sales: [],
      });
    }

    // 🔍 Mahsulotni topamiz
    const product = await Product.findById(product_id);
    if (!product) {
      return res.status(404).json({ message: "Mahsulot topilmadi" });
    }

    // 💰 Foyda hisoblash
    const totalProfit = (sell_price - product.purchase_price) * quantity;

    // 🧾 Sotuvni yaratamiz
    const newSale = new Sale({
      product_id,
      product_name,
      sell_price,
      buy_price: product.purchase_price,
      quantity,
      total_price,
      total_price_sum,
      currency,
      payment_method,
      debtor_name: payment_method === "qarz" ? client_name : null,
      debtor_phone: payment_method === "qarz" ? client_phone : null,
      debt_due_date: payment_method === "qarz" ? new Date() : null, // agar kerak bo‘lsa o‘zgartirasiz
    });

    await newSale.save();

    // 💸 Agar qarz bo‘lsa - mijozga qarz qo‘shamiz
    if (payment_method === "qarz") {
      client.total_debt += total_price;
    }

    // 🧾 Mijozga sotuv tarixini yozamiz
    client.sales.push({
      sale_id: newSale._id,
      date: new Date(),
      total_price,
      payment_method,
    });

    await client.save();

    // 💼 Byudjetga foydani qo‘shamiz
    let budget = await Budget.findOne();
    if (!budget) {
      budget = new Budget({ totalBudget: 0 });
    }

    budget.totalBudget += totalProfit;
    await budget.save();

    return res.status(201).json({
      message: "Sotuv muvaffaqiyatli amalga oshirildi",
      sale: newSale,
      client,
    });
  } catch (error) {
    console.error("recordSale xatolik:", error);
    return res.status(500).json({ message: "Server xatoligi" });
  }
};
