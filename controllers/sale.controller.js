const Client = require("../models/Client"); // yangi qo‘shiladi

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
      payment_method,
      total_price_sum,
      debtor_name: payment_method === "qarz" ? client_name : null,
      currency,
      debtor_phone: payment_method === "qarz" ? client_phone : null,
      debt_due_date: null, // ixtiyoriy, hozircha kiritilmagan
    });

    await newSale.save();

    // 💸 Qarzni hisoblash
    if (payment_method === "qarz") {
      client.total_debt += total_price;
    }

    // 🧾 Sotuv tarixiga qo‘shamiz
    client.sales.push({
      sale_id: newSale._id,
      date: new Date(),
      total_price,
      payment_method,
    });

    await client.save();

    // 💼 Byudjetni yangilash
    let budget = await Budget.findOne();
    if (!budget) {
      budget = new Budget({ totalBudget: 0 });
    }
    budget.totalBudget += totalProfit;
    await budget.save();

    res.status(201).json({
      message: "Sotuv muvaffaqiyatli amalga oshirildi",
      sale: newSale,
      client,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: error.message || "Server xatoligi" });
  }
};


// Sotuvni o‘chirish
exports.deleteSale = async (req, res) => {
  try {
    const { id } = req.params;

    const sale = await Sale.findByIdAndDelete(id);
    if (!sale) {
      return res.status(404).json({ message: "Sotuv topilmadi" });
    }

    res.status(200).json({ message: "Sotuv muvaffaqiyatli o‘chirildi" });
  } catch (error) {
    res.status(500).json({ message: "Server xatosi", error: error.message });
  }
};
