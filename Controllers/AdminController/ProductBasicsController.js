
const mongoose = require("mongoose");
const ProductModel = require("../../models/Product");
const ProductBasicsModel = require("../../models/ProductBasics");

const isValidObjectId = (id) =>
  mongoose.Types.ObjectId.isValid(id);

const validatePayload = (body) => {
  const {
    slug,
    brandLine,
    collections,
    shortDescription,
    longDescription,
    howToUse,
  } = body;

  if (typeof slug !== "string" || !slug.trim()) {
    return "Slug is required";
  }

  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug.trim().toLowerCase())) {
    return "Please enter a valid slug";
  }

  if (slug.trim().length > 150) {
    return "Slug must not exceed 150 characters";
  }

  if (typeof brandLine !== "string" || !brandLine.trim()) {
    return "Brand line is required";
  }

  if (brandLine.trim().length > 100) {
    return "Brand line must not exceed 100 characters";
  }

  if (!Array.isArray(collections) || collections.length === 0) {
    return "At least one collection is required";
  }

  if (collections.some((item) => typeof item !== "string" || !item.trim())) {
    return "Collections must contain valid text values";
  }

  if (collections.join(",").length > 500) {
    return "Collections must not exceed 500 characters";
  }

  if (typeof shortDescription !== "string" || !shortDescription.trim()) {
    return "Short description is required";
  }

  if (shortDescription.trim().length > 300) {
    return "Short description must not exceed 300 characters";
  }

  if (typeof longDescription !== "string" || !longDescription.trim()) {
    return "Long description is required";
  }

  if (longDescription.trim().length > 5000) {
    return "Long description must not exceed 5000 characters";
  }

  if (typeof howToUse !== "string" || !howToUse.trim()) {
    return "How to use is required";
  }

  if (howToUse.trim().length > 2000) {
    return "How to use must not exceed 2000 characters";
  }

  return null;
};

const preparePayload = (body) => ({
  slug: body.slug.trim().toLowerCase(),
  brandLine: body.brandLine.trim(),
  collections: body.collections.map((item) => item.trim()).filter(Boolean),
  shortDescription: body.shortDescription.trim(),
  longDescription: body.longDescription.trim(),
  howToUse: body.howToUse.trim(),
});

const populateProduct = (query) => {
  return query.populate({
    path: "productId",
    select:
      "name productname sku type productType category categoryId price sellingPrice stock quantity status",
  });
};

const sendServerError = (res, error, label) => {
  console.error(`${label}:`, error);

  if (error.code === 11000) {
    return res.status(409).json({
      status: false,
      message: "Product basics or slug already exists",
    });
  }

  if (error.name === "ValidationError") {
    return res.status(400).json({
      status: false,
      message: error.message,
    });
  }

  return res.status(500).json({
    status: false,
    message: "Internal server error",
    error: error.message,
  });
};

exports.createProductBasics = async (req, res) => {
  try {
    const { productId } = req.body;

    if (!productId || !isValidObjectId(productId)) {
      return res.status(400).json({
        status: false,
        message: "Valid product ID is required",
      });
    }

    const product = await ProductModel.findById(productId);

    if (!product) {
      return res.status(404).json({
        status: false,
        message: "Product not found",
      });
    }

    const validationError = validatePayload(req.body);

    if (validationError) {
      return res.status(400).json({
        status: false,
        message: validationError,
      });
    }

    const existingBasics = await ProductBasicsModel.findOne({ productId });

    if (existingBasics) {
      return res.status(409).json({
        status: false,
        message: "Product basics already exist for this product",
        data: existingBasics,
      });
    }

    const payload = preparePayload(req.body);

    const existingSlug = await ProductBasicsModel.findOne({
      slug: payload.slug,
    });

    if (existingSlug) {
      return res.status(409).json({
        status: false,
        message: "This slug is already in use",
      });
    }

    const productBasics = await ProductBasicsModel.create({
      productId,
      ...payload,
    });

    const savedData = await populateProduct(
      ProductBasicsModel.findById(productBasics._id)
    );

    return res.status(201).json({
      status: true,
      message: "Product basics created successfully",
      data: savedData,
    });
  } catch (error) {
    return sendServerError(res, error, "CREATE PRODUCT BASICS ERROR");
  }
};

exports.getAllProductBasics = async (req, res) => {
  try {
    const productBasics = await populateProduct(
      ProductBasicsModel.find().sort({ createdAt: -1 })
    );

    return res.status(200).json({
      status: true,
      message: "Product basics fetched successfully",
      data: productBasics,
    });
  } catch (error) {
    return sendServerError(res, error, "GET PRODUCT BASICS ERROR");
  }
};

exports.getSingleProductBasics = async (req, res) => {
  try {
    const { id } = req.params;

    if (!isValidObjectId(id)) {
      return res.status(400).json({
        status: false,
        message: "Invalid product ID",
      });
    }

    const product = await ProductModel.findById(id);

    if (!product) {
      return res.status(404).json({
        status: false,
        message: "Product not found",
      });
    }

    const productBasics = await populateProduct(
      ProductBasicsModel.findOne({ productId: id })
    );

    if (!productBasics) {
      return res.status(404).json({
        status: false,
        message: "Product basics not found for this product",
        data: null,
      });
    }

    return res.status(200).json({
      status: true,
      message: "Product basics fetched successfully",
      data: productBasics,
    });
  } catch (error) {
    return sendServerError(res, error, "GET SINGLE PRODUCT BASICS ERROR");
  }
};

exports.getProductBasicsByProductId = async (req, res) => {
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

    const productBasics = await populateProduct(
      ProductBasicsModel.findOne({ productId })
    );

    if (!productBasics) {
      return res.status(404).json({
        status: false,
        message: "Product basics not found for this product",
        data: null,
      });
    }

    return res.status(200).json({
      status: true,
      message: "Product basics fetched successfully",
      data: productBasics,
    });
  } catch (error) {
    return sendServerError(
      res,
      error,
      "GET PRODUCT BASICS BY PRODUCT ERROR"
    );
  }
};

exports.updateProductBasics = async (req, res) => {
  try {
    const { id } = req.params;

    if (!isValidObjectId(id)) {
      return res.status(400).json({
        status: false,
        message: "Invalid product ID",
      });
    }

    const product = await ProductModel.findById(id);

    if (!product) {
      return res.status(404).json({
        status: false,
        message: "Product not found",
      });
    }

    const productBasics = await ProductBasicsModel.findOne({
      productId: id,
    });

    if (!productBasics) {
      return res.status(404).json({
        status: false,
        message: "Product basics not found for this product",
      });
    }

    const validationError = validatePayload(req.body);

    if (validationError) {
      return res.status(400).json({
        status: false,
        message: validationError,
      });
    }

    const payload = preparePayload(req.body);

    const existingSlug = await ProductBasicsModel.findOne({
      slug: payload.slug,
      _id: { $ne: productBasics._id },
    });

    if (existingSlug) {
      return res.status(409).json({
        status: false,
        message: "This slug is already in use",
      });
    }

    Object.assign(productBasics, payload);

    await productBasics.save();

    const updatedData = await populateProduct(
      ProductBasicsModel.findOne({ productId: id })
    );

    return res.status(200).json({
      status: true,
      message: "Product basics updated successfully",
      data: updatedData,
    });
  } catch (error) {
    return sendServerError(res, error, "UPDATE PRODUCT BASICS ERROR");
  }
};

exports.deleteProductBasics = async (req, res) => {
  try {
    const { id } = req.params;

    if (!isValidObjectId(id)) {
      return res.status(400).json({
        status: false,
        message: "Invalid product ID",
      });
    }

    const deletedData = await ProductBasicsModel.findOneAndDelete({
      productId: id,
    });

    if (!deletedData) {
      return res.status(404).json({
        status: false,
        message: "Product basics not found for this product",
      });
    }

    return res.status(200).json({
      status: true,
      message: "Product basics deleted successfully",
    });
  } catch (error) {
    return sendServerError(res, error, "DELETE PRODUCT BASICS ERROR");
  }
};

