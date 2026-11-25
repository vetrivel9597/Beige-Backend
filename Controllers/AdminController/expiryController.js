
const mongoose = require("mongoose");

const InventoryModel = require("../../models/Inventory");
const StockAdjustmentModel = require("../../models/StockAdjustment");

const ProductModel = require("../../models/Product");
const ProductVariantModel = require("../../models/ProductVariant");
const WarehouseModel = require("../../models/Warehouse");

const getExpiryStatus = (expiryDate) => {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const expiry = new Date(expiryDate);
  expiry.setHours(0, 0, 0, 0);

  const daysRemaining = Math.ceil(
    (expiry.getTime() - today.getTime()) / (1000 * 60 * 60 * 24)
  );

  if (daysRemaining < 0) return "EXPIRED";
  if (daysRemaining <= 7) return "CRITICAL";
  if (daysRemaining <= 30) return "EXPIRING_SOON";

  return "ACTIVE";
};

const getDaysRemaining = (expiryDate) => {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const expiry = new Date(expiryDate);
  expiry.setHours(0, 0, 0, 0);

  return Math.ceil(
    (expiry.getTime() - today.getTime()) / (1000 * 60 * 60 * 24)
  );
};


exports.getExpiryBatches = async (req, res) => {
  try {
    const page = Math.max(parseInt(req.query.page) || 1, 1);
    const limit = Math.min(Math.max(parseInt(req.query.limit) || 10, 1), 100);
    const skip = (page - 1) * limit;

    const { search, status, warehouseId } = req.query;

    const filter = {
      expiryDate: { $exists: true, $ne: null },
    };

    if (warehouseId) {
      if (!mongoose.Types.ObjectId.isValid(warehouseId)) {
        return res.status(400).json({
          status: false,
          message: "Invalid warehouse ID",
        });
      }

      filter.warehouseId = warehouseId;
    }

    if (search) {
      const regex = new RegExp(
        search.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"),
        "i"
      );

      const [products, variants, warehouses] = await Promise.all([
        ProductModel.find({
          $or: [
            { productname: regex },
            { name: regex },
            { sku: regex },
          ],
        }).select("_id"),

        ProductVariantModel.find({
          $or: [
            { variantName: regex },
            { sku: regex },
            { barcode: regex },
          ],
        }).select("_id"),

        WarehouseModel.find({
          $or: [
            { warehouseName: regex },
            { name: regex },
            { warehouseCode: regex },
          ],
        }).select("_id"),
      ]);

      filter.$or = [
        { batchNumber: regex },
        { productId: { $in: products.map((p) => p._id) } },
        { variantId: { $in: variants.map((v) => v._id) } },
        { warehouseId: { $in: warehouses.map((w) => w._id) } },
      ];
    }

    let inventories = await InventoryModel.find(filter)
      .populate("productId", "productname name sku")
      .populate("variantId", "variantName sku")
      .populate("warehouseId", "warehouseName warehouseCode name")
      .sort({ expiryDate: 1 })
      .lean();

    // Calculate expiry status and display fields.
    inventories = inventories.map((item) => {
      const remainingQuantity = Number(
        item.remainingQuantity ?? item.stock ?? 0
      );

      return {
        ...item,
        productName:
          item.productId?.productname ||
          item.productId?.name ||
          "-",

        sku:
          item.variantId?.sku ||
          item.productId?.sku ||
          "-",

        warehouseName:
          item.warehouseId?.warehouseName ||
          item.warehouseId?.name ||
          "-",

        remainingQuantity,
        daysRemaining: getDaysRemaining(item.expiryDate),
        expiryStatus: getExpiryStatus(item.expiryDate),
      };
    });

    // Apply calculated expiry status filter.
    if (status) {
      inventories = inventories.filter(
        (item) => item.expiryStatus === status
      );
    }

    const total = inventories.length;
    const data = inventories.slice(skip, skip + limit);

    return res.status(200).json({
      status: true,
      message: "Expiry batches fetched successfully",
      data,
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error("Get expiry batches error:", error);

    return res.status(500).json({
      status: false,
      message: "Failed to fetch expiry batches",
      error: error.message,
    });
  }
};


exports.getExpirySummary = async (req, res) => {
  try {
    const inventories = await InventoryModel.find({
      expiryDate: { $exists: true, $ne: null },
    }).lean();

    const summary = {
      totalBatches: 0,
      active: 0,
      expiringSoon: 0,
      critical: 0,
      expired: 0,
      expiredQuantity: 0,
    };

    inventories.forEach((item) => {
      const remainingQuantity = Number(
        item.remainingQuantity ?? item.stock ?? 0
      );

      summary.totalBatches++;

      const expiryStatus = getExpiryStatus(item.expiryDate);

      if (expiryStatus === "ACTIVE") summary.active++;
      if (expiryStatus === "EXPIRING_SOON") summary.expiringSoon++;
      if (expiryStatus === "CRITICAL") summary.critical++;

      if (expiryStatus === "EXPIRED") {
        summary.expired++;

        if (remainingQuantity > 0) {
          summary.expiredQuantity += remainingQuantity;
        }
      }
    });

    return res.status(200).json({
      status: true,
      message: "Expiry summary fetched successfully",
      data: summary,
    });
  } catch (error) {
    console.error("Get expiry summary error:", error);

    return res.status(500).json({
      status: false,
      message: "Failed to fetch expiry summary",
      error: error.message,
    });
  }
};


exports.markBatchExpired = async (req, res) => {
  const session = await mongoose.startSession();

  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        status: false,
        message: "Invalid inventory ID",
      });
    }

    let responseData = null;

    await session.withTransaction(async () => {
      const inventory = await InventoryModel.findById(id).session(session);

      if (!inventory) {
        throw new Error("Inventory batch not found");
      }

      if (!inventory.expiryDate) {
        throw new Error("Expiry date not found for this batch");
      }

      if (getExpiryStatus(inventory.expiryDate) !== "EXPIRED") {
        throw new Error("This batch has not expired yet");
      }

      const remainingStock = Number(
        inventory.remainingQuantity ?? inventory.stock ?? 0
      );

      if (remainingStock <= 0) {
        throw new Error("This batch has no remaining stock");
      }

      const previousStock = remainingStock;
      const newStock = 0;

      // Update whichever quantity field your inventory document uses.
      if (inventory.remainingQuantity !== undefined) {
        inventory.remainingQuantity = newStock;
      } else {
        inventory.stock = newStock;
      }

      await inventory.save({ session });

      await StockAdjustmentModel.create(
        [
          {
            inventoryId: inventory._id,
            productId: inventory.productId,
            variantId: inventory.variantId,
            warehouseId: inventory.warehouseId,
            adjustmentType: "REMOVE",
            quantity: previousStock,
            previousStock,
            newStock,
            reason: "EXPIRED",
            notes: `Expired batch ${inventory.batchNumber || ""} processed`,
            batchNumber: inventory.batchNumber || "",
            adjustedBy: req.adminId || null,
          },
        ],
        { session }
      );

      responseData = {
        inventoryId: inventory._id,
        batchNumber: inventory.batchNumber,
        removedQuantity: previousStock,
        remainingQuantity: 0,
      };
    });

    return res.status(200).json({
      status: true,
      message: "Expired batch processed successfully",
      data: responseData,
    });
  } catch (error) {
    console.error("Mark batch expired error:", error);

    return res.status(400).json({
      status: false,
      message: error.message || "Failed to process expired batch",
    });
  } finally {
    await session.endSession();
  }
};
