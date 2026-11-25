
const mongoose = require("mongoose");
const ProductModel = require("../../models/Product");
const ProductPricingModel = require("../../models/ProductPricing");

const isValidObjectId = (id) => {
  return mongoose.Types.ObjectId.isValid(id);
};

const validatePricing = (body) => {
  const {
    mrp,
    sellingPrice,
    gstRate,
    hsnCode,
    costPrice,
  } = body;

  if (
    mrp === undefined ||
    sellingPrice === undefined ||
    gstRate === undefined ||
    costPrice === undefined ||
    hsnCode === undefined
  ) {
    return "All pricing fields are required";
  }

  const values = {
    mrp,
    sellingPrice,
    gstRate,
    costPrice,
  };

  for (const [key, value] of Object.entries(values)) {
    if (
      value === null ||
      value === "" ||
      !Number.isFinite(Number(value))
    ) {
      return `${key} must be a valid number`;
    }

    if (Number(value) < 0) {
      return `${key} cannot be negative`;
    }
  }

  if (Number(gstRate) > 100) {
    return "GST rate must be between 0 and 100";
  }

  if (
    typeof hsnCode !== "string" ||
    !hsnCode.trim()
  ) {
    return "HSN code is required";
  }

  if (hsnCode.trim().length > 20) {
    return "HSN code cannot exceed 20 characters";
  }

  return null;
};

const getProductDetails = (product) => {
  if (!product) return null;

  const categoryValue = product.categoryId || product.category;

  const category =
    typeof categoryValue === "object"
      ? categoryValue?.name ||
        categoryValue?.categoryName ||
        ""
      : categoryValue || "";

  return {
    _id: product._id,
    name: product.productname || product.name || "",
    sku: product.sku || "",
    type: product.productType || product.type || "",
    category,
    price: product.sellingPrice ?? product.price ?? 0,
    stock: product.quantity ?? product.stock ?? 0,
    status:
      product.status ||
      (product.productStatus === 1 ? "ACTIVE" : "DRAFT"),
  };
};

const populatePricing = async (pricingId) => {
  const pricing = await ProductPricingModel.findById(
    pricingId
  ).populate({
    path: "productId",
    populate: {
      path: "categoryId",
      select: "name categoryName",
    },
  });

  if (!pricing) return null;

  const data = pricing.toObject();

  const productDetails = getProductDetails(data.productId);

  return {
    ...data,
    product: productDetails,
    productDetails,
  };
};

// CREATE PRODUCT PRICING

exports.createProductPricing = async (req, res) => {
  try {
    const {
      productId,
      mrp,
      sellingPrice,
      gstRate,
      hsnCode,
      costPrice,
    } = req.body;

    if (!productId || !isValidObjectId(productId)) {
      return res.status(400).json({
        status: false,
        message: "Valid product ID is required",
      });
    }

    const validationError = validatePricing(req.body);

    if (validationError) {
      return res.status(400).json({
        status: false,
        message: validationError,
      });
    }

    const product = await ProductModel.findById(productId);

    if (!product) {
      return res.status(404).json({
        status: false,
        message: "Product not found",
      });
    }

    const existingPricing =
      await ProductPricingModel.findOne({ productId });

    if (existingPricing) {
      return res.status(409).json({
        status: false,
        message: "Pricing already exists for this product",
      });
    }

    const pricing = await ProductPricingModel.create({
      productId,
      mrp: Number(mrp),
      sellingPrice: Number(sellingPrice),
      gstRate: Number(gstRate),
      hsnCode: hsnCode.trim(),
      costPrice: Number(costPrice),
    });

    const populatedData = await populatePricing(pricing._id);

    return res.status(201).json({
      status: true,
      message: "Product pricing created successfully",
      data: populatedData,
    });
  } catch (error) {
    console.error("CREATE PRODUCT PRICING ERROR:", error);

    if (error.code === 11000) {
      return res.status(409).json({
        status: false,
        message: "Pricing already exists for this product",
      });
    }

    return res.status(500).json({
      status: false,
      message: error.message || "Failed to create product pricing",
    });
  }
};

// GET ALL PRODUCT PRICING

exports.getAllProductPricing = async (req, res) => {
  try {
    const pricingList = await ProductPricingModel.find()
      .sort({ createdAt: -1 })
      .populate({
        path: "productId",
        populate: {
          path: "categoryId",
          select: "name categoryName",
        },
      });

    const formattedData = pricingList.map((pricing) => {
      const data = pricing.toObject();

      const productDetails = getProductDetails(data.productId);

      return {
        ...data,
        product: productDetails,
        productDetails,
      };
    });

    return res.status(200).json({
      status: true,
      message: "Product pricing fetched successfully",
      data: formattedData,
    });
  } catch (error) {
    console.error("GET PRODUCT PRICING ERROR:", error);

    return res.status(500).json({
      status: false,
      message: error.message || "Failed to fetch product pricing",
    });
  }
};

// UPDATE PRODUCT PRICING

exports.updateProductPricing = async (req, res) => {
  try {
    const { id } = req.params;

    const {
      mrp,
      sellingPrice,
      gstRate,
      hsnCode,
      costPrice,
    } = req.body;

    if (!isValidObjectId(id)) {
      return res.status(400).json({
        status: false,
        message: "Invalid pricing ID",
      });
    }

    const validationError = validatePricing(req.body);

    if (validationError) {
      return res.status(400).json({
        status: false,
        message: validationError,
      });
    }

    const existingPricing =
      await ProductPricingModel.findById(id);

    if (!existingPricing) {
      return res.status(404).json({
        status: false,
        message: "Product pricing not found",
      });
    }

    existingPricing.mrp = Number(mrp);
    existingPricing.sellingPrice = Number(sellingPrice);
    existingPricing.gstRate = Number(gstRate);
    existingPricing.hsnCode = hsnCode.trim();
    existingPricing.costPrice = Number(costPrice);

    await existingPricing.save();

    const populatedData = await populatePricing(id);

    return res.status(200).json({
      status: true,
      message: "Product pricing updated successfully",
      data: populatedData,
    });
  } catch (error) {
    console.error("UPDATE PRODUCT PRICING ERROR:", error);

    return res.status(500).json({
      status: false,
      message: error.message || "Failed to update product pricing",
    });
  }
};

// DELETE PRODUCT PRICING

exports.deleteProductPricing = async (req, res) => {
  try {
    console.log('enter the deleteProductPricing')
    const { id } = req.params;

    console.log('req.params', req.params)

    if (!isValidObjectId(id)) {
      return res.status(400).json({
        status: false,
        message: "Invalid pricing ID",
      });
    }

    const pricing = await ProductPricingModel.findById(id);


    console.log('pricing-----------', pricing)

    if (!pricing) {
      return res.status(404).json({
        status: false,
        message: "Product pricing not found",
      });
    }

    await ProductPricingModel.findByIdAndDelete(id);

    return res.status(200).json({
      status: true,
      message: "Product pricing deleted successfully",
    });
  } catch (error) {
    console.error("DELETE PRODUCT PRICING ERROR:", error);

    return res.status(500).json({
      status: false,
      message: error.message || "Failed to delete product pricing",
    });
  }
};
