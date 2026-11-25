const mongoose = require("mongoose");
const StockAdjustmentModel = require("../../models/StockAdjustment");

exports.getStockMovements = async (req, res) => {
  try {
    const { reason, warehouseId } = req.query;

    const filter = {};

    if (reason) {
      filter.reason = {
        $regex: `^${reason}$`,
        $options: "i",
      };
    }

    if (warehouseId) {
      if (!mongoose.Types.ObjectId.isValid(warehouseId)) {
        return res.status(400).json({
          status: false,
          message: "Invalid warehouse ID",
        });
      }

      filter.warehouseId = warehouseId;
    }

    const adjustments = await StockAdjustmentModel.find(filter)
      .populate({
        path: "inventoryId",
      })
      .populate({
        path: "productId",
        select: "productname name sku",
      })
      .populate({
        path: "variantId",
        select: "variantName sku variantType",
      })
      .populate({
        path: "warehouseId",
        select: "warehouseName warehouseCode name",
      })
      .populate({
        path: "adjustedBy",
        select: "name username email",
      })
      .sort({ createdAt: -1 })
      .lean();

    // Map schema fields to frontend field names
    const data = adjustments.map((item) => ({
      ...item,

      movementType:
        item.adjustmentType === "ADD"
          ? "IN"
          : item.adjustmentType === "REMOVE"
            ? "OUT"
            : "ADJUSTMENT",

      beforeQuantity: item.previousStock,
      afterQuantity: item.newStock,

      performedBy: item.adjustedBy,

      sku:
        item.variantId?.sku ||
        item.inventoryId?.sku ||
        "N/A",

      batchNumber: item.batchNumber || "N/A",
    }));

    return res.status(200).json({
      status: true,
      message: "Stock movements fetched successfully",
      data,
      total: data.length,
    });
  } catch (error) {
    console.error("Get stock movements error:", error);

    return res.status(500).json({
      status: false,
      message: "Failed to fetch stock movements",
      error: error.message,
    });
  }
};