const Client = require("../models/Client");

// 🟢 barcha klientlar yoki qarzdorlarni olish
exports.getClients = async (req, res) => {
  const { debt } = req.query;
  const filter = debt === "true" ? { total_debt: { $gt: 0 } } : {};
  const clients = await Client.find(filter);
  res.status(200).json(clients);
};

// 🟢 qarz to‘lash
exports.payDebt = async (req, res) => {
  const { clientId } = req.params;
  const { amount, note } = req.body;

  const client = await Client.findById(clientId);
  if (!client) return res.status(404).json({ message: "Mijoz topilmadi" });

  client.total_debt = Math.max(0, client.total_debt - amount);
  client.payment_history.push({ amount, note });
  await client.save();

  res.status(200).json({ message: "To‘lov qabul qilindi", client });
};
// 🟢 Mijoz tafsilotlari (qarzdorlik + to‘lovlar + sotuvlar)
exports.getClientById = async (req, res) => {
    try {
      const { id } = req.params;
  
      const client = await Client.findById(id)
        .populate("sales.sale_id") // agar kerak bo‘lsa sale tafsilotlari bilan
        .lean();
  
      if (!client) {
        return res.status(404).json({ message: "Mijoz topilmadi" });
      }
  
      res.status(200).json(client);
    } catch (error) {
      res.status(500).json({ message: "Server xatoligi", error });
    }
  };
  