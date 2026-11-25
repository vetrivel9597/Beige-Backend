const mongoose = require("mongoose");
const ProductModel = require("../../models/Product");
const ProductIngredientsModel = require("../../models/ProductIngredients");

const isValidObjectId = (id) => mongoose.Types.ObjectId.isValid(id);

const validateIngredients = (body) => {
  const { ingredientList, keyActives, freeFrom } = body;

  if (!Array.isArray(ingredientList) || ingredientList.length === 0) {
    return "At least one ingredient is required";
  }

  if (
    ingredientList.some(
      (item) => typeof item !== "string" || !item.trim()
    )
  ) {
    return "Ingredient names cannot be empty";
  }

  if (!Array.isArray(keyActives)) {
    return "Key actives must be an array";
  }

  for (const active of keyActives) {
    if (
      !active ||
      typeof active.name !== "string" ||
      !active.name.trim() ||
      active.percentage === "" ||
      active.percentage === undefined ||
      !Number.isFinite(Number(active.percentage)) ||
      Number(active.percentage) < 0 ||
      Number(active.percentage) > 100
    ) {
      return "Please provide valid key active names and percentages between 0 and 100";
    }
  }

  const freeFromFields = [
    "fragranceFree",
    "parabenFree",
    "vegan",
    "crueltyFree",
  ];

  if (freeFrom !== undefined) {
    if (!freeFrom || typeof freeFrom !== "object" || Array.isArray(freeFrom)) {
      return "Invalid freeFrom information";
    }

    for (const field of freeFromFields) {
      if (
        freeFrom[field] !== undefined &&
        typeof freeFrom[field] !== "boolean"
      ) {
        return `Invalid ${field} value`;
      }
    }
  }

  return null;
};

const prepareIngredients = (body) => ({
  ingredientList: body.ingredientList.map((item) => item.trim()),
  keyActives: body.keyActives.map((item) => ({
    name: item.name.trim(),
    percentage: Number(item.percentage),
  })),
  freeFrom: {
    fragranceFree: Boolean(body.freeFrom?.fragranceFree),
    parabenFree: Boolean(body.freeFrom?.parabenFree),
    vegan: Boolean(body.freeFrom?.vegan),
    crueltyFree: Boolean(body.freeFrom?.crueltyFree),
  },
});

exports.createProductIngredients = async (req, res) => {
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

    const validationError = validateIngredients(req.body);

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

    const existingIngredients =
      await ProductIngredientsModel.findOne({ productId });

    if (existingIngredients) {
      return res.status(409).json({
        status: false,
        message: "Ingredients already exist for this product",
      });
    }

    const ingredients = await ProductIngredientsModel.create({
      productId,
      ...prepareIngredients(req.body),
    });

    return res.status(201).json({
      status: true,
      message: "Product ingredients created successfully",
      data: ingredients,
    });
  } catch (error) {
    console.error("Create product ingredients error:", error);

    if (error.code === 11000) {
      return res.status(409).json({
        status: false,
        message: "Ingredients already exist for this product",
      });
    }

    return res.status(500).json({
      status: false,
      message: "Failed to create product ingredients",
      error: error.message,
    });
  }
};

exports.getProductIngredients = async (req, res) => {
  try {
    const { productId } = req.params;

    if (!isValidObjectId(productId)) {
      return res.status(400).json({
        status: false,
        message: "Invalid product ID",
      });
    }

    const ingredients = await ProductIngredientsModel.findOne({
      productId,
    }).populate({
      path: "productId",
      select: "name productname sku productType type",
    });

    if (!ingredients) {
      return res.status(404).json({
        status: false,
        message: "Product ingredients not found",
      });
    }

    return res.status(200).json({
      status: true,
      message: "Product ingredients fetched successfully",
      data: ingredients,
    });
  } catch (error) {
    console.error("Get product ingredients error:", error);

    return res.status(500).json({
      status: false,
      message: "Failed to fetch product ingredients",
      error: error.message,
    });
  }
};



exports.updateProductIngredients = async (req, res) => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        status: false,
        message: "Invalid product ID"
      });
    }

    const ingredients = await ProductIngredientsModel.findOne({
      productId: id
    });

    if (!ingredients) {
      return res.status(404).json({
        status: false,
        message: "Product ingredients not found for this product"
      });
    }

    Object.assign(ingredients, req.body);

    await ingredients.save();

    return res.status(200).json({
      status: true,
      message: "Product ingredients updated successfully",
      data: ingredients
    });

  } catch (error) {
    return res.status(500).json({
      status: false,
      message: error.message
    });
  }
};

exports.deleteProductIngredients = async (req, res) => {
  try {
    const { id } = req.params;


    if (!isValidObjectId(id)) {
      return res.status(400).json({
        status: false,
        message: "Invalid ingredients ID",
      });
    }

    const ingredients =
      await ProductIngredientsModel.deleteOne({ productId : id } );

    if (!ingredients) {
      return res.status(404).json({
        status: false,
        message: "Product ingredients not found",
      });
    }

    return res.status(200).json({
      status: true,
      message: "Product ingredients deleted successfully",
    });
  } catch (error) {
    console.error("Delete product ingredients error:", error);

    return res.status(500).json({
      status: false,
      message: "Failed to delete product ingredients",
      error: error.message,
    });
  }
};