const mongoose = require("mongoose");
const ProductModel = require("../../models/Product");
const ProductVariantModel = require("../../models/ProductVariant");

const isValidObjectId = (id) => mongoose.Types.ObjectId.isValid(id);

const getProductName = (product) => {
  if (!product) return "";

  return product.productname || product.name || "";
};

const formatVariant = (variant) => {
  const data = variant.toObject ? variant.toObject() : variant;

  const product = data.productId && typeof data.productId === "object"
    ? data.productId
    : null;

  const productDetails = product
    ? {
      _id: product._id,
      name: getProductName(product),
      sku: product.sku || "",
      type: product.productType || product.type || "",
      category: product.categoryId || product.category || null,
    }
    : null;

  return {
    ...data,
    productId: productDetails || data.productId,
    product: productDetails || data.productId,
  };
};

const populateVariant = (query) => {
  return query.populate({
    path: "productId",
    select: "name productname sku productType type categoryId category",
  });
};

exports.createProductVariant = async (req, res) => {
  try {
    const {
      productId,
      variantType,
      variantName,
      sku,
      price,
      stock,
      barcode,
    } = req.body;

    if (
      !productId ||
      !variantType ||
      !variantName ||
      !sku ||
      price === undefined ||
      price === ""
    ) {
      return res.status(400).json({
        status: false,
        message: "Please provide all required fields",
      });
    }

    if (!isValidObjectId(productId)) {
      return res.status(400).json({
        status: false,
        message: "Invalid product ID",
      });
    }

    const allowedTypes = ["SIZE", "VOLUME", "SHADE"];
    const normalizedType = String(variantType).trim().toUpperCase();

    if (!allowedTypes.includes(normalizedType)) {
      return res.status(400).json({
        status: false,
        message: "Invalid variant type",
      });
    }

    const normalizedName = String(variantName).trim();
    const normalizedSku = String(sku).trim().toUpperCase();
    const numericPrice = Number(price);
    const numericStock = stock === undefined || stock === "" ? 0 : Number(stock);

    if (!normalizedName || !normalizedSku) {
      return res.status(400).json({
        status: false,
        message: "Variant name and SKU are required",
      });
    }

    if (!Number.isFinite(numericPrice) || numericPrice < 0) {
      return res.status(400).json({
        status: false,
        message: "Please enter a valid price",
      });
    }

    if (!Number.isInteger(numericStock) || numericStock < 0) {
      return res.status(400).json({
        status: false,
        message: "Stock must be a non-negative whole number",
      });
    }

    const product = await ProductModel.findById(productId);

    if (!product) {
      return res.status(404).json({
        status: false,
        message: "Product not found",
      });
    }

    const existingSku = await ProductVariantModel.findOne({
      productId,
      sku: normalizedSku,
    });

    if (existingSku) {
      return res.status(409).json({
        status: false,
        message: "This SKU already exists for this product",
      });
    }

    const variant = await ProductVariantModel.create({
      productId,
      variantType: normalizedType,
      variantName: normalizedName,
      sku: normalizedSku,
      price: numericPrice,
      stock: numericStock,
      barcode: String(barcode || "").trim(),
    });

    const populatedVariant = await populateVariant(
      ProductVariantModel.findById(variant._id)
    );

    return res.status(201).json({
      status: true,
      message: "Product variant created successfully",
      data: formatVariant(populatedVariant),
    });
  } catch (error) {
    console.error("Create product variant error:", error);

    if (error.code === 11000) {
      return res.status(409).json({
        status: false,
        message: "This SKU already exists for this product",
      });
    }

    return res.status(500).json({
      status: false,
      message: "Failed to create product variant",
      error: error.message,
    });
  }
};

exports.getAllProductVariants = async (req, res) => {
  try {
    const variants = await populateVariant(
      ProductVariantModel.find({})
    ).sort({ createdAt: -1 });

    return res.status(200).json({
      status: true,
      message: "Product variants fetched successfully",
      data: variants.map(formatVariant),
    });
  } catch (error) {
    console.error("Get product variants error:", error);

    return res.status(500).json({
      status: false,
      message: "Failed to fetch product variants",
      error: error.message,
    });
  }
};

exports.updateProductVariant = async (req, res) => {
  try {
    const { id } = req.params;

    const {
      variantType,
      variantName,
      sku,
      price,
      stock,
      barcode,
    } = req.body;

    if (!isValidObjectId(id)) {
      return res.status(400).json({
        status: false,
        message: "Invalid variant ID",
      });
    }

    const variant = await ProductVariantModel.findById(id);

    if (!variant) {
      return res.status(404).json({
        status: false,
        message: "Product variant not found",
      });
    }

    if (
      !variantType ||
      !variantName ||
      !sku ||
      price === undefined ||
      price === ""
    ) {
      return res.status(400).json({
        status: false,
        message: "Please provide all required fields",
      });
    }

    const allowedTypes = ["SIZE", "VOLUME", "SHADE"];
    const normalizedType = String(variantType).trim().toUpperCase();

    if (!allowedTypes.includes(normalizedType)) {
      return res.status(400).json({
        status: false,
        message: "Invalid variant type",
      });
    }

    const normalizedName = String(variantName).trim();
    const normalizedSku = String(sku).trim().toUpperCase();
    const numericPrice = Number(price);
    const numericStock = stock === undefined || stock === "" ? 0 : Number(stock);

    if (!normalizedName || !normalizedSku) {
      return res.status(400).json({
        status: false,
        message: "Variant name and SKU are required",
      });
    }

    if (!Number.isFinite(numericPrice) || numericPrice < 0) {
      return res.status(400).json({
        status: false,
        message: "Please enter a valid price",
      });
    }

    if (!Number.isInteger(numericStock) || numericStock < 0) {
      return res.status(400).json({
        status: false,
        message: "Stock must be a non-negative whole number",
      });
    }

    const existingSku = await ProductVariantModel.findOne({
      _id: { $ne: id },
      productId: variant.productId,
      sku: normalizedSku,
    });

    if (existingSku) {
      return res.status(409).json({
        status: false,
        message: "This SKU already exists for this product",
      });
    }

    variant.variantType = normalizedType;
    variant.variantName = normalizedName;
    variant.sku = normalizedSku;
    variant.price = numericPrice;
    variant.stock = numericStock;
    variant.barcode = String(barcode || "").trim();

    await variant.save();

    const populatedVariant = await populateVariant(
      ProductVariantModel.findById(variant._id)
    );

    return res.status(200).json({
      status: true,
      message: "Product variant updated successfully",
      data: formatVariant(populatedVariant),
    });
  } catch (error) {
    console.error("Update product variant error:", error);

    if (error.code === 11000) {
      return res.status(409).json({
        status: false,
        message: "This SKU already exists for this product",
      });
    }

    return res.status(500).json({
      status: false,
      message: "Failed to update product variant",
      error: error.message,
    });
  }
};

exports.deleteProductVariant = async (req, res) => {
  try {
    const { id } = req.params;

    if (!isValidObjectId(id)) {
      return res.status(400).json({
        status: false,
        message: "Invalid variant ID",
      });
    }

    const variant = await ProductVariantModel.findByIdAndDelete(id);

    if (!variant) {
      return res.status(404).json({
        status: false,
        message: "Product variant not found",
      });
    }

    return res.status(200).json({
      status: true,
      message: "Product variant deleted successfully",
    });
  } catch (error) {
    console.error("Delete product variant error:", error);

    return res.status(500).json({
      status: false,
      message: "Failed to delete product variant",
      error: error.message,
    });
  }
};


exports.getProductVariantsByProductId = async (req, res) => {
  try {
    const { productId } = req.params;


    console.log('productId', productId)

    if (!mongoose.Types.ObjectId.isValid(productId)) {
      return res.status(400).json({
        status: false,
        message: "Invalid product ID",
      });
    }

    const variants = await ProductVariantModel.find({_id : productId}).sort({ createdAt: -1 });


    console.log('variants---------', variants)

    return res.status(200).json({
      status: true,
      message: "Product variants fetched successfully",
      data: variants,
    });
  } catch (error) {
    console.error("GET PRODUCT VARIANTS ERROR:", error);

    return res.status(500).json({
      status: false,
      message: error.message || "Failed to fetch product variants",
    });
  }
};