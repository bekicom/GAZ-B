const express = require("express");
const router = express.Router();

const adminController = require("../controllers/adminController");
const productController = require("../controllers/productController");
const authMiddleware = require("../middleware/authMiddleware");
const saleController = require("../controllers/saleController");
const debtorController = require("../controllers/debtorController");
const storeController = require("../controllers/storeController");
const budgetController = require("../controllers/budgetController");
const expenseController = require("../controllers/expenseController");
const usdRateController = require("../controllers/UsdRateController");
const clientController = require("../controllers/client.controller"); // ✅ klient controller

const {
  createNasiya,
  getNasiya,
  completeNasiya,
} = require("../controllers/nasiyaController");

// 🔐 ADMIN ROUTES
router.post("/register", adminController.registerAdmin);
router.post("/login", adminController.loginAdmin);
router.post(
  "/create-admin",
  authMiddleware.verifyToken,
  authMiddleware.verifyRole(["admin"]),
  adminController.createAdmin
);
router.get(
  "/admins",
  authMiddleware.verifyToken,
  authMiddleware.verifyRole(["admin"]),
  adminController.getAllAdmins
);
router.delete(
  "/admin/:id",
  authMiddleware.verifyToken,
  authMiddleware.verifyRole(["admin"]),
  adminController.deleteAdmin
);
router.put(
  "/admin/:id",
  authMiddleware.verifyToken,
  authMiddleware.verifyRole(["admin"]),
  adminController.updateAdmin
);

// 📦 PRODUCTS
router.post(
  "/products",
  authMiddleware.verifyToken,
  productController.createProduct
);
router.get(
  "/products",
  authMiddleware.verifyToken,
  productController.getAllProducts
);
router.put(
  "/products/:id",
  authMiddleware.verifyToken,
  productController.updateProduct
);
router.delete(
  "/products/:id",
  authMiddleware.verifyToken,
  productController.deleteProduct
);
router.get("/products/barcode/:barcode", productController.getProductByBarcode);

// 🛒 STORE
router.post("/store/add", storeController.addProductToStore);
router.get("/store", storeController.getStoreProducts);
router.delete("/store/:id", storeController.removeProductFromStore);
router.post("/store/sell", storeController.sellProductFromStore);
router.post("/store/return", storeController.vazvratTovar);
router.post("/store/product/create", storeController.createProductToStore);
router.post("/store/quantity/:id", storeController.updateStoreProduct);

// 💰 SALES
router.post("/sales", saleController.recordSale);
router.get("/sales", saleController.getSalesHistory);
router.get("/sales/daily", saleController.getDailySales);
router.get("/sales/weekly", saleController.getWeeklySales);
router.get("/sales/monthly", saleController.getMonthlySales);
router.get("/sales/yearly", saleController.getYearlySales);
router.get(
  "/stat/year",
  authMiddleware.verifyToken,
  saleController.getLast12MonthsSales
);
router.get("/stock/compare", saleController.compareStockLevels);

// 🧾 DEBTORS
router.post(
  "/debtors",
  authMiddleware.verifyToken,
  debtorController.createDebtor
);
router.post(
  "/debtors/return",
  authMiddleware.verifyToken,
  debtorController.vazvratDebt
);
router.get(
  "/debtors",
  authMiddleware.verifyToken,
  debtorController.getAllDebtors
);
router.put(
  "/debtors/:id",
  authMiddleware.verifyToken,
  debtorController.updateDebtor
);
router.delete(
  "/debtors/:id",
  authMiddleware.verifyToken,
  debtorController.deleteDebtor
);

// 📊 BUDGET & EXPENSES
router.get("/budget", budgetController.getBudget);
router.put("/budget", budgetController.updateBudget);
router.post("/harajat/expenses", expenseController.addExpense);
router.get("/harajat/expenses", expenseController.getExpenses);

// 💱 USD RATE
router.get("/usd", usdRateController.getUsdRate);
router.post("/usd", usdRateController.updateUsdRate);

// 📋 NASIYA
router.post("/nasiya/create", authMiddleware.verifyToken, createNasiya);
router.get("/nasiya/get", authMiddleware.verifyToken, getNasiya);
router.post("/nasiya/complete/:id", authMiddleware.verifyToken, completeNasiya);

// 👥 CLIENTS
router.get("/clients", authMiddleware.verifyToken, clientController.getClients);
router.post(
  "/clients/:clientId/pay",
  authMiddleware.verifyToken,
  clientController.payDebt
); // ✅ qarz to‘lash
router.get(
  "/clients/:id",
  authMiddleware.verifyToken,
  clientController.getClientById
);

<<<<<<< HEAD
// ✅ TEST ROUTE
router.get("/protected-route", authMiddleware.verifyToken, (req, res) => {
  res.status(200).send("This is a protected route");
});
=======
router.put('/debtor/:id', authMiddleware.verifyToken, debtorController.editDebtor)
router.post('/debtor', authMiddleware.verifyToken, debtorController.createPayment)
>>>>>>> 51e6e3938d6dc3a3c238ec0d2a08a034b25af8eb

module.exports = router;
