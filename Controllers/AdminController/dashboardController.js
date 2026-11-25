
const AdminModel = require("../../models/adminModule");
const ProductModel = require("../../models/Product");
const CategoryModel = require("../../models/Category");
const CollectionModel = require("../../models/Collection");
const WarehouseModel = require("../../models/Warehouse");

exports.dashboard = async (req, res) => {
  try {
    const admin = await AdminModel.findById(req.admin._id).select(
      "name email role permissions"
    );

    if (!admin) {
      return res.status(404).json({
        status: false,
        message: "Admin not found",
      });
    }

    const [
      totalProducts,
      totalCategories,
      totalCollections,
      totalWarehouses,
      totalSubAdmins,
      inventoryData,
      lowStockItems,
      outOfStockItems,
    ] = await Promise.all([
      ProductModel.countDocuments(),

      CategoryModel.countDocuments(),

      CollectionModel.countDocuments(),

      WarehouseModel.countDocuments(),

      AdminModel.countDocuments({ role: "SUB_ADMIN" }),

      ProductModel.aggregate([
        {
          $group: {
            _id: null,
            total: { $sum: "$quantity" },
          },
        },
      ]),

      ProductModel.countDocuments({
        quantity: { $gt: 0 },
        $expr: {
          $lte: [
            "$quantity",
            { $ifNull: ["$lowStockThreshold", 5] },
          ],
        },
      }),

      ProductModel.countDocuments({
        quantity: { $lte: 0 },
      }),
    ]);

    const stats = {
      totalProducts,
      totalCategories,
      totalCollections,
      totalInventory: inventoryData[0]?.total || 0,
      lowStockItems,
      outOfStockItems,
      totalWarehouses,
      totalSubAdmins,
    };

    return res.status(200).json({
      status: true,
      message: "Dashboard data fetched successfully",
      data: {
        role: admin.role,
        permissions:
          admin.role === "SUPER_ADMIN" ? [] : admin.permissions || [],
        stats,
      },
    });
  } catch (error) {
    console.error("Dashboard Controller Error:", error);

    return res.status(500).json({
      status: false,
      message: "Unable to load dashboard",
      error: error.message,
    });
  }
};
