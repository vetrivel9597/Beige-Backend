const mongoose = require("mongoose");
const ProductModel = require("../../models/Product");
const ProductAiTagsModel = require("../../models/ProductAiTags");

const isValidObjectId = (id) => mongoose.Types.ObjectId.isValid(id);

const normalizeString = (value) =>
  typeof value === "string" ? value.trim().toUpperCase() : "";

const normalizeArray = (value) => {
  if (!Array.isArray(value)) return [];

  return value.map((item) => normalizeString(item)).filter(Boolean);
};

const getProductType = (product) =>
  normalizeString(product?.type || product?.productType);

const validatePayload = (body, productType) => {
  if (!["SKIN_CARE", "BEAUTY"].includes(productType)) {
    return "Invalid product type. Only SKIN_CARE and BEAUTY are supported";
  }

  if (
    body.skinTypes !== undefined &&
    !Array.isArray(body.skinTypes)
  ) {
    return "Skin types must be an array";
  }

  if (
    body.concerns !== undefined &&
    !Array.isArray(body.concerns)
  ) {
    return "Concerns must be an array";
  }

  if (
    body.contraindications !== undefined &&
    !Array.isArray(body.contraindications)
  ) {
    return "Contraindications must be an array";
  }

  if (
    body.beauty !== undefined &&
    (!body.beauty || typeof body.beauty !== "object" || Array.isArray(body.beauty))
  ) {
    return "Invalid beauty information";
  }

  if (
    body.beauty?.suitableLooks !== undefined &&
    !Array.isArray(body.beauty.suitableLooks)
  ) {
    return "Suitable looks must be an array";
  }

  if (
    body.includeInAIRecommendations !== undefined &&
    typeof body.includeInAIRecommendations !== "boolean"
  ) {
    return "includeInAIRecommendations must be true or false";
  }

  for (const concern of body.concerns || []) {
    if (
      !concern ||
      typeof concern.name !== "string" ||
      !concern.name.trim() ||
      ![1, 2, 3].includes(Number(concern.strength))
    ) {
      return "Each concern must have a name and a strength between 1 and 3";
    }
  }

  if (
    productType === "SKIN_CARE" &&
    (!Array.isArray(body.skinTypes) || body.skinTypes.length === 0)
  ) {
    return "Please select at least one skin type";
  }

  if (
    productType === "BEAUTY" &&
    !body.beauty?.productRole?.trim()
  ) {
    return "Please select a product role";
  }

  return null;
};

const preparePayload = (body, productType) => ({
  productType,

  skinTypes: normalizeArray(body.skinTypes),

  concerns: (body.concerns || []).map((item) => ({
    name: normalizeString(item.name),
    strength: Number(item.strength),
  })),

  routineStep: normalizeString(body.routineStep),

  timeOfUse: normalizeString(body.timeOfUse || "BOTH"),

  contraindications: normalizeArray(body.contraindications),

  beauty: {
    productRole: normalizeString(body.beauty?.productRole),
    finish: normalizeString(body.beauty?.finish),
    coverage: normalizeString(body.beauty?.coverage),
    suitableLooks: normalizeArray(body.beauty?.suitableLooks),
  },

  priceBand: normalizeString(body.priceBand),

  includeInAIRecommendations:
    body.includeInAIRecommendations !== undefined
      ? body.includeInAIRecommendations
      : true,
});

const populateProduct = (query) =>
  query.populate({
    path: "productId",
    select: "name productname sku type productType",
  });

const formatAiTag = (tag) => {
  const data = tag.toObject ? tag.toObject() : tag;
  const product = data.productId;

  const formattedProduct =
    product && typeof product === "object"
      ? {
          _id: product._id,
          name: product.name || product.productname || "",
          sku: product.sku || "",
          type: product.type || product.productType || "",
        }
      : null;

  return {
    ...data,
    product: formattedProduct,
    productId: formattedProduct || data.productId,
  };
};

exports.createProductAiTags = async (req, res) => {
  try {
    const { productId } = req.body;

    if (!productId) {
      return res.status(400).json({
        status: false,
        message: "Product ID is required",
      });
    }

    if (!isValidObjectId(productId)) {
      return res.status(400).json({
        status: false,
        message: "Invalid product ID",
      });
    }

    const product = await ProductModel.findById(productId);

    if (!product) {
      return res.status(404).json({
        status: false,
        message: "Product not found",
      });
    }

    const actualProductType = getProductType(product);
    const submittedProductType = normalizeString(req.body.productType);

    if (actualProductType !== submittedProductType) {
      return res.status(400).json({
        status: false,
        message: "Product type does not match the selected product",
      });
    }

    const validationError = validatePayload(
      req.body,
      actualProductType
    );

    if (validationError) {
      return res.status(400).json({
        status: false,
        message: validationError,
      });
    }

    const existingTag = await ProductAiTagsModel.findOne({
      productId,
    });

    if (existingTag) {
      return res.status(409).json({
        status: false,
        message: "AI tags already exist for this product",
      });
    }

    const aiTag = await ProductAiTagsModel.create({
      productId,
      ...preparePayload(req.body, actualProductType),
    });

    const populatedTag = await populateProduct(
      ProductAiTagsModel.findById(aiTag._id)
    );

    return res.status(201).json({
      status: true,
      message: "Product AI tags created successfully",
      data: formatAiTag(populatedTag),
    });
  } catch (error) {
    console.error("Create product AI tags error:", error);

    if (error.code === 11000) {
      return res.status(409).json({
        status: false,
        message: "AI tags already exist for this product",
      });
    }

    return res.status(500).json({
      status: false,
      message: "Failed to create product AI tags",
      error: error.message,
    });
  }
};

exports.getAllProductAiTags = async (req, res) => {
  try {
    const tags = await populateProduct(
      ProductAiTagsModel.find({})
    ).sort({ createdAt: -1 });

    return res.status(200).json({
      status: true,
      message: "Product AI tags fetched successfully",
      data: tags.map(formatAiTag),
    });
  } catch (error) {
    console.error("Get product AI tags error:", error);

    return res.status(500).json({
      status: false,
      message: "Failed to fetch product AI tags",
      error: error.message,
    });
  }
};

exports.updateProductAiTags = async (req, res) => {
  try {
    const { productId } = req.params;

    if (!isValidObjectId(productId)) {
      return res.status(400).json({
        status: false,
        message: "Invalid product ID",
      });
    }

    const product = await ProductModel.findById(productId);

    if (!product) {
      return res.status(404).json({
        status: false,
        message: "Product not found",
      });
    }

    const actualProductType = getProductType(product);
    const submittedProductType = normalizeString(req.body.productType);

    if (actualProductType !== submittedProductType) {
      return res.status(400).json({
        status: false,
        message: "Product type does not match the selected product",
      });
    }

    const validationError = validatePayload(
      req.body,
      actualProductType
    );

    if (validationError) {
      return res.status(400).json({
        status: false,
        message: validationError,
      });
    }

    const aiTag = await ProductAiTagsModel.findOne({
      productId,
    });

    if (!aiTag) {
      return res.status(404).json({
        status: false,
        message: "Product AI tags not found",
      });
    }

    const updatedData = preparePayload(
      req.body,
      actualProductType
    );

    Object.assign(aiTag, updatedData);

    await aiTag.save();

    const populatedTag = await populateProduct(
      ProductAiTagsModel.findById(aiTag._id)
    );

    return res.status(200).json({
      status: true,
      message: "Product AI tags updated successfully",
      data: formatAiTag(populatedTag),
    });
  } catch (error) {
    console.error("Update product AI tags error:", error);

    return res.status(500).json({
      status: false,
      message: "Failed to update product AI tags",
      error: error.message,
    });
  }
};

exports.deleteProductAiTags = async (req, res) => {
  try {
    const { productId } = req.params;

    if (!isValidObjectId(productId)) {
      return res.status(400).json({
        status: false,
        message: "Invalid product ID",
      });
    }

    const aiTag = await ProductAiTagsModel.findOneAndDelete({
      productId,
    });

    if (!aiTag) {
      return res.status(404).json({
        status: false,
        message: "Product AI tags not found",
      });
    }

    return res.status(200).json({
      status: true,
      message: "Product AI tags deleted successfully",
    });
  } catch (error) {
    console.error("Delete product AI tags error:", error);

    return res.status(500).json({
      status: false,
      message: "Failed to delete product AI tags",
      error: error.message,
    });
  }
};