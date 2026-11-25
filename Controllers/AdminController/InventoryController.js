
const mongoose = require("mongoose");

const InventoryModel = require("../../models/Inventory");
const ProductModel = require("../../models/Product");
const WarehouseModel = require("../../models/Warehouse");
const StockAdjustmentModel = require("../../models/StockAdjustment");

const isValidId = (id) => mongoose.Types.ObjectId.isValid(id);

const getStockStatus = (available, threshold) => {
  if (available <= 0) return "OUT_OF_STOCK";
  if (available <= threshold) return "LOW_STOCK";
  return "IN_STOCK";
};

const formatInventory = (inventory) => {
  const item = inventory.toObject
    ? inventory.toObject()
    : inventory;

  const product = item.productId;
  const warehouse = item.warehouseId;

  let variant = null;

  if (product && Array.isArray(product.variants)) {
    variant =
      product.variants.find(
        (v) => String(v._id) === String(item.variantId)
      ) || null;
  }

  return {
    ...item,
    productId: product
      ? {
          _id: product._id,
          name: product.productname || "",
          image: product.productimages?.[0]?.media || "",
          type: product.productType || "",
          sku: product.sku || "",
        }
      : null,
    variantId: variant
      ? {
          _id: variant._id,
          variantName:
            variant.name ||
            variant.size ||
            variant.shade ||
            variant.variantType ||
            "",
          name: variant.name || "",
          sku: variant.sku || "",
          barcode: variant.barcode || "",
          price: variant.price || 0,
        }
      : null,
    warehouseId: warehouse
      ? {
          _id: warehouse._id,
          name: warehouse.warehouseName || "",
          code: warehouse.warehouseCode || "",
        }
      : null,
  };
};

// GET INVENTORY LIST
exports.getInventory = async (req, res) => {
  try {
    const page = Math.max(parseInt(req.query.page) || 1, 1);
    const limit = Math.max(parseInt(req.query.limit) || 10, 1);
    const skip = (page - 1) * limit;

    const { search, status, warehouseId } = req.query;

    const filter = {};

    if (status) {
      if (
        !["IN_STOCK", "LOW_STOCK", "OUT_OF_STOCK"].includes(status)
      ) {
        return res.status(400).json({
          status: false,
          message: "Invalid inventory status",
        });
      }

      filter.status = status;
    }

    if (warehouseId) {
      if (!isValidId(warehouseId)) {
        return res.status(400).json({
          status: false,
          message: "Invalid warehouse ID",
        });
      }

      filter.warehouseId = warehouseId;
    }

    let inventoryList = await InventoryModel.find(filter)
      .populate({
        path: "productId",
        select: "productname productType productimages sku variants",
      })
      .populate({
        path: "warehouseId",
        select: "warehouseName warehouseCode",
      })
      .sort({ createdAt: -1 })
      .lean();

    if (search && search.trim()) {
      const searchText = search.trim().toLowerCase();

      inventoryList = inventoryList.filter((item) => {
        const product = item.productId;
        const warehouse = item.warehouseId;

        const variant = product?.variants?.find(
          (v) => String(v._id) === String(item.variantId)
        );

        return (
          product?.productname?.toLowerCase().includes(searchText) ||
          item.sku?.toLowerCase().includes(searchText) ||
          variant?.sku?.toLowerCase().includes(searchText) ||
          variant?.name?.toLowerCase().includes(searchText) ||
          item.batchNumber?.toLowerCase().includes(searchText) ||
          warehouse?.warehouseName?.toLowerCase().includes(searchText)
        );
      });
    }

    const totalRecords = inventoryList.length;

    const data = inventoryList
      .slice(skip, skip + limit)
      .map(formatInventory);

    return res.status(200).json({
      status: true,
      message: "Inventory fetched successfully",
      data,
      pagination: {
        total: totalRecords,
        totalRecords,
        page,
        limit,
        totalPages: Math.ceil(totalRecords / limit),
      },
    });
  } catch (error) {
    console.error("Get inventory error:", error);

    return res.status(500).json({
      status: false,
      message: "Failed to fetch inventory",
      error: error.message,
    });
  }
};

// GET INVENTORY DETAILS
exports.getInventoryById = async (req, res) => {
  try {
    const { id } = req.params;

    if (!isValidId(id)) {
      return res.status(400).json({
        status: false,
        message: "Invalid inventory ID",
      });
    }

    const inventory = await InventoryModel.findById(id)
      .populate({
        path: "productId",
        select: "productname productType productimages sku variants",
      })
      .populate({
        path: "warehouseId",
        select: "warehouseName warehouseCode address city state",
      });

    if (!inventory) {
      return res.status(404).json({
        status: false,
        message: "Inventory not found",
      });
    }

    return res.status(200).json({
      status: true,
      message: "Inventory details fetched successfully",
      data: formatInventory(inventory),
    });
  } catch (error) {
    console.error("Get inventory details error:", error);

    return res.status(500).json({
      status: false,
      message: "Failed to fetch inventory details",
      error: error.message,
    });
  }
};

// RECEIVE STOCK
exports.receiveStock = async (req, res) => {
  try {
    const {
      productId,
      variantId,
      warehouseId,
      batchNumber,
      receivedQuantity,
      lowStockThreshold = 10,
      manufacturingDate,
      expiryDate,
      notes = "",
    } = req.body;

    if (
      !productId ||
      !variantId ||
      !warehouseId ||
      !batchNumber ||
      receivedQuantity === undefined ||
      !expiryDate
    ) {
      return res.status(400).json({
        status: false,
        message: "Please provide all required fields",
      });
    }

    if (
      !isValidId(productId) ||
      !isValidId(variantId) ||
      !isValidId(warehouseId)
    ) {
      return res.status(400).json({
        status: false,
        message: "Invalid product, variant or warehouse ID",
      });
    }

    const quantity = Number(receivedQuantity);
    const threshold = Number(lowStockThreshold);

    if (!Number.isInteger(quantity) || quantity <= 0) {
      return res.status(400).json({
        status: false,
        message: "Received quantity must be a positive whole number",
      });
    }

    if (!Number.isInteger(threshold) || threshold < 0) {
      return res.status(400).json({
        status: false,
        message: "Low stock threshold must be a non-negative whole number",
      });
    }

    const expiry = new Date(expiryDate);

    if (Number.isNaN(expiry.getTime())) {
      return res.status(400).json({
        status: false,
        message: "Invalid expiry date",
      });
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    if (expiry <= today) {
      return res.status(400).json({
        status: false,
        message: "Expiry date must be in the future",
      });
    }

    let manufacturing = null;

    if (manufacturingDate) {
      manufacturing = new Date(manufacturingDate);

      if (
        Number.isNaN(manufacturing.getTime()) ||
        manufacturing >= expiry
      ) {
        return res.status(400).json({
          status: false,
          message: "Manufacturing date must be before expiry date",
        });
      }
    }

    const [product, warehouse] = await Promise.all([
      ProductModel.findById(productId),
      WarehouseModel.findById(warehouseId),
    ]);

    if (!product) {
      return res.status(404).json({
        status: false,
        message: "Product not found",
      });
    }

    if (!warehouse || warehouse.status !== "ACTIVE") {
      return res.status(404).json({
        status: false,
        message: "Active warehouse not found",
      });
    }

    const variant = product.variants.id(variantId);

    if (!variant) {
      return res.status(404).json({
        status: false,
        message: "Product variant not found",
      });
    }

    const cleanBatchNumber = batchNumber.trim();

    let inventory = await InventoryModel.findOne({
      productId,
      variantId,
      warehouseId,
      batchNumber: cleanBatchNumber,
    });

    const previousStock = inventory ? inventory.onHand : 0;

    if (inventory) {
      inventory.onHand += quantity;
      inventory.available = inventory.onHand - inventory.reserved;
      inventory.lowStockThreshold = threshold;
      inventory.sku = variant.sku || product.sku || "";
      inventory.manufacturingDate =
        manufacturing || inventory.manufacturingDate;
      inventory.expiryDate = expiry;
      inventory.notes = notes;
      inventory.status = getStockStatus(
        inventory.available,
        inventory.lowStockThreshold
      );

      await inventory.save();
    } else {
      const available = quantity;

      inventory = await InventoryModel.create({
        productId,
        variantId,
        warehouseId,
        batchNumber: cleanBatchNumber,
        sku: variant.sku || product.sku || "",
        onHand: quantity,
        reserved: 0,
        available,
        lowStockThreshold: threshold,
        manufacturingDate: manufacturing,
        expiryDate: expiry,
        notes,
        status: getStockStatus(available, threshold),
      });
    }

    await StockAdjustmentModel.create({
      inventoryId: inventory._id,
      productId,
      variantId,
      warehouseId,
      adjustmentType: "ADD",
      quantity,
      previousStock,
      newStock: inventory.onHand,
      reason: "STOCK_RECEIVED",
      notes,
      adjustedBy: req.adminId || null,
    });

    const populated = await InventoryModel.findById(inventory._id)
      .populate({
        path: "productId",
        select: "productname productType productimages sku variants",
      })
      .populate({
        path: "warehouseId",
        select: "warehouseName warehouseCode",
      });

    return res.status(201).json({
      status: true,
      message: "Stock received successfully",
      data: formatInventory(populated),
    });
  } catch (error) {
    console.error("Receive stock error:", error);

    if (error.code === 11000) {
      return res.status(409).json({
        status: false,
        message: "This inventory batch already exists",
      });
    }

    return res.status(500).json({
      status: false,
      message: "Failed to receive stock",
      error: error.message,
    });
  }
};

// UPDATE INVENTORY THRESHOLD
exports.updateInventory = async (req, res) => {
  try {
    const { id } = req.params;
    const { lowStockThreshold } = req.body;

    if (!isValidId(id)) {
      return res.status(400).json({
        status: false,
        message: "Invalid inventory ID",
      });
    }

    const threshold = Number(lowStockThreshold);

    if (
      lowStockThreshold === undefined ||
      !Number.isInteger(threshold) ||
      threshold < 0
    ) {
      return res.status(400).json({
        status: false,
        message: "Enter a valid low stock threshold",
      });
    }

    const inventory = await InventoryModel.findById(id);

    if (!inventory) {
      return res.status(404).json({
        status: false,
        message: "Inventory not found",
      });
    }

    inventory.lowStockThreshold = threshold;
    inventory.available = inventory.onHand - inventory.reserved;
    inventory.status = getStockStatus(
      inventory.available,
      threshold
    );

    await inventory.save();

    return res.status(200).json({
      status: true,
      message: "Inventory updated successfully",
      data: inventory,
    });
  } catch (error) {
    console.error("Update inventory error:", error);

    return res.status(500).json({
      status: false,
      message: "Failed to update inventory",
      error: error.message,
    });
  }
};


exports.deleteInventory = async (req, res) => {
  try {
    const { id } = req.params;

    if (!isValidId(id)) {
      return res.status(400).json({
        status: false,
        message: "Invalid inventory ID",
      });
    }

    const inventory = await InventoryModel.findById(id);

    if (!inventory) {
      return res.status(404).json({
        status: false,
        message: "Inventory not found",
      });
    }

    if (inventory.reserved > 0) {
      return res.status(400).json({
        status: false,
        message: "Cannot delete inventory with reserved stock",
      });
    }

    await InventoryModel.findByIdAndDelete(id);

    return res.status(200).json({
      status: true,
      message: "Inventory deleted successfully",
    });
  } catch (error) {
    console.error("Delete inventory error:", error);

    return res.status(500).json({
      status: false,
      message: "Failed to delete inventory",
      error: error.message,
    });
  }
};

// ADJUST STOCK
exports.adjustStock = async (req, res) => {
  try {
    const {
      inventoryId,
      adjustmentType,
      type,
      quantity,
      reason = "",
      notes = "",
    } = req.body;

    const action = adjustmentType || type;

    if (!inventoryId || !action || quantity === undefined) {
      return res.status(400).json({
        status: false,
        message: "Inventory, adjustment type and quantity are required",
      });
    }

    if (!isValidId(inventoryId)) {
      return res.status(400).json({
        status: false,
        message: "Invalid inventory ID",
      });
    }

    if (!["ADD", "REMOVE", "SET"].includes(action)) {
      return res.status(400).json({
        status: false,
        message: "Adjustment type must be ADD, REMOVE or SET",
      });
    }

    const amount = Number(quantity);

    if (!Number.isInteger(amount) || amount < 0) {
      return res.status(400).json({
        status: false,
        message: "Quantity must be a non-negative whole number",
      });
    }

    const inventory = await InventoryModel.findById(inventoryId);

    if (!inventory) {
      return res.status(404).json({
        status: false,
        message: "Inventory not found",
      });
    }

    const previousStock = inventory.onHand;
    let newStock = previousStock;

    if (action === "ADD") {
      if (amount <= 0) {
        return res.status(400).json({
          status: false,
          message: "Quantity must be greater than zero",
        });
      }

      newStock += amount;
    }

    if (action === "REMOVE") {
      if (amount <= 0 || previousStock - amount < inventory.reserved) {
        return res.status(400).json({
          status: false,
          message: "Cannot remove more than the available stock",
        });
      }

      newStock -= amount;
    }

    if (action === "SET") {
      if (amount < inventory.reserved) {
        return res.status(400).json({
          status: false,
          message: "New stock cannot be less than reserved stock",
        });
      }

      newStock = amount;
    }

    inventory.onHand = newStock;
    inventory.available = newStock - inventory.reserved;
    inventory.status = getStockStatus(
      inventory.available,
      inventory.lowStockThreshold
    );

    await inventory.save();

    await StockAdjustmentModel.create({
      inventoryId: inventory._id,
      productId: inventory.productId,
      variantId: inventory.variantId,
      warehouseId: inventory.warehouseId,
      adjustmentType: action,
      quantity: amount,
      previousStock,
      newStock,
      reason,
      notes,
      adjustedBy: req.adminId || null,
    });

    return res.status(200).json({
      status: true,
      message: "Stock adjusted successfully",
      data: {
        inventoryId: inventory._id,
        previousStock,
        newStock,
        available: inventory.available,
        status: inventory.status,
      },
    });
  } catch (error) {
    console.error("Adjust stock error:", error);

    return res.status(500).json({
      status: false,
      message: "Failed to adjust stock",
      error: error.message,
    });
  }
};

// GET STOCK ADJUSTMENT LOGS
exports.getAdjustmentLogs = async (req, res) => {
  try {
    const page = Math.max(parseInt(req.query.page) || 1, 1);
    const limit = Math.max(parseInt(req.query.limit) || 10, 1);
    const skip = (page - 1) * limit;

    const filter = {};

    if (req.query.warehouseId) {
      if (!isValidId(req.query.warehouseId)) {
        return res.status(400).json({
          status: false,
          message: "Invalid warehouse ID",
        });
      }

      filter.warehouseId = req.query.warehouseId;
    }

    const [data, totalRecords] = await Promise.all([
      StockAdjustmentModel.find(filter)
        .populate("productId", "productname sku")
        .populate("warehouseId", "warehouseName warehouseCode")
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit),
      StockAdjustmentModel.countDocuments(filter),
    ]);

    return res.status(200).json({
      status: true,
      message: "Adjustment logs fetched successfully",
      data,
      pagination: {
        total: totalRecords,
        totalRecords,
        page,
        limit,
        totalPages: Math.ceil(totalRecords / limit),
      },
    });
  } catch (error) {
    console.error("Get adjustment logs error:", error);

    return res.status(500).json({
      status: false,
      message: "Failed to fetch adjustment logs",
      error: error.message,
    });
  }
};
