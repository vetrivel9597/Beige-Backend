const mongoose = require("mongoose");
const CollectionModel = require("../../models/Collection");
const ProductModel = require("../../models/Product");

const isValidObjectId = (id) =>
  mongoose.Types.ObjectId.isValid(id);

const parseProducts = (products) => {
  if (Array.isArray(products)) return products;

  if (typeof products === "string") {
    try {
      const parsed = JSON.parse(products);
      return Array.isArray(parsed) ? parsed : null;
    } catch (error) {
      return null;
    }
  }

  return null;
};

const validateProducts = async (products) => {
  if (!products || products.length === 0) {
    return {
      valid: false,
      message: "Please select at least one product",
    };
  }

  if (products.some((id) => !isValidObjectId(id))) {
    return {
      valid: false,
      message: "Invalid product ID",
    };
  }

  const uniqueProducts = [...new Set(products.map(String))];

  const existingProducts = await ProductModel.find({
    _id: { $in: uniqueProducts },
    status: "ACTIVE",
  }).select("_id");

  if (existingProducts.length !== uniqueProducts.length) {
    return {
      valid: false,
      message: "One or more selected products are invalid or inactive",
    };
  }

  return {
    valid: true,
    products: uniqueProducts,
  };
};

exports.getAllCollections = async (req, res) => {
  try {
    const collections = await CollectionModel.find()
      .populate("products", "name sku image price status")
      .sort({ displayOrder: 1, createdAt: -1 })
      .lean();

    return res.status(200).json({
      status: true,
      message: "Collections fetched successfully",
      data: collections,
    });
  } catch (error) {
    console.error("GET COLLECTIONS ERROR:", error);

    return res.status(500).json({
      status: false,
      message: error.message || "Failed to fetch collections",
    });
  }
};

exports.getSingleCollection = async (req, res) => {
  try {
    const { id } = req.params;

    if (!isValidObjectId(id)) {
      return res.status(400).json({
        status: false,
        message: "Invalid collection ID",
      });
    }

    const collection = await CollectionModel.findById(id)
      .populate("products", "name sku image price status")
      .lean();

    if (!collection) {
      return res.status(404).json({
        status: false,
        message: "Collection not found",
      });
    }

    return res.status(200).json({
      status: true,
      message: "Collection fetched successfully",
      data: collection,
    });
  } catch (error) {
    console.error("GET SINGLE COLLECTION ERROR:", error);

    return res.status(500).json({
      status: false,
      message: error.message || "Failed to fetch collection",
    });
  }
};

exports.createCollection = async (req, res) => {
  try {
    const {
      name,
      slug,
      description,
      displayOrder,
      status,
    } = req.body;

    const products = parseProducts(req.body.products);

    if (!name?.trim() || !slug?.trim()) {
      return res.status(400).json({
        status: false,
        message: "Collection name and slug are required",
      });
    }

    if (!req.file?.path) {
      return res.status(400).json({
        status: false,
        message: "Collection image is required",
      });
    }

    if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug.trim().toLowerCase())) {
      return res.status(400).json({
        status: false,
        message: "Invalid collection slug",
      });
    }

    const productValidation = await validateProducts(products);

    if (!productValidation.valid) {
      return res.status(400).json({
        status: false,
        message: productValidation.message,
      });
    }

    const existingCollection = await CollectionModel.findOne({
      $or: [
        { name: name.trim() },
        { slug: slug.trim().toLowerCase() },
      ],
    });

    if (existingCollection) {
      return res.status(409).json({
        status: false,
        message: "Collection name or slug already exists",
      });
    }

    const collection = await CollectionModel.create({
      name: name.trim(),
      slug: slug.trim().toLowerCase(),
      image: req.file.path,
      description: description || "",
      products: productValidation.products,
      displayOrder: Number(displayOrder) || 0,
      status: status || "DRAFT",
    });

    const result = await CollectionModel.findById(collection._id)
      .populate("products", "name sku image price status")
      .lean();

    return res.status(201).json({
      status: true,
      message: "Collection created successfully",
      data: result,
    });
  } catch (error) {
    console.error("CREATE COLLECTION ERROR:", error);

    if (error.code === 11000) {
      return res.status(409).json({
        status: false,
        message: "Collection slug already exists",
      });
    }

    return res.status(500).json({
      status: false,
      message: error.message || "Failed to create collection",
    });
  }
};

exports.updateCollection = async (req, res) => {
  try {
    const { id } = req.params;

    const {
      name,
      slug,
      description,
      displayOrder,
      status,
    } = req.body;

    const products = parseProducts(req.body.products);

    if (!isValidObjectId(id)) {
      return res.status(400).json({
        status: false,
        message: "Invalid collection ID",
      });
    }

    if (!name?.trim() || !slug?.trim()) {
      return res.status(400).json({
        status: false,
        message: "Collection name and slug are required",
      });
    }

    if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug.trim().toLowerCase())) {
      return res.status(400).json({
        status: false,
        message: "Invalid collection slug",
      });
    }

    const collection = await CollectionModel.findById(id);

    if (!collection) {
      return res.status(404).json({
        status: false,
        message: "Collection not found",
      });
    }

    if (!products) {
      return res.status(400).json({
        status: false,
        message: "Invalid products data",
      });
    }

    const productValidation = await validateProducts(products);

    if (!productValidation.valid) {
      return res.status(400).json({
        status: false,
        message: productValidation.message,
      });
    }

    const duplicate = await CollectionModel.findOne({
      _id: { $ne: id },
      $or: [
        { name: name.trim() },
        { slug: slug.trim().toLowerCase() },
      ],
    });

    if (duplicate) {
      return res.status(409).json({
        status: false,
        message: "Collection name or slug already exists",
      });
    }

    collection.name = name.trim();
    collection.slug = slug.trim().toLowerCase();
    collection.description = description || "";
    collection.products = productValidation.products;
    collection.displayOrder = Number(displayOrder) || 0;
    collection.status = status || "DRAFT";

    if (req.file?.path) {
      collection.image = req.file.path;
    }

    await collection.save();

    const result = await CollectionModel.findById(id)
      .populate("products", "name sku image price status")
      .lean();

    return res.status(200).json({
      status: true,
      message: "Collection updated successfully",
      data: result,
    });
  } catch (error) {
    console.error("UPDATE COLLECTION ERROR:", error);

    if (error.code === 11000) {
      return res.status(409).json({
        status: false,
        message: "Collection slug already exists",
      });
    }

    return res.status(500).json({
      status: false,
      message: error.message || "Failed to update collection",
    });
  }
};

exports.deleteCollection = async (req, res) => {
  try {
    const { id } = req.params;

    if (!isValidObjectId(id)) {
      return res.status(400).json({
        status: false,
        message: "Invalid collection ID",
      });
    }

    const collection = await CollectionModel.findById(id);

    if (!collection) {
      return res.status(404).json({
        status: false,
        message: "Collection not found",
      });
    }

    await CollectionModel.findByIdAndDelete(id);

    return res.status(200).json({
      status: true,
      message: "Collection deleted successfully",
    });
  } catch (error) {
    console.error("DELETE COLLECTION ERROR:", error);

    return res.status(500).json({
      status: false,
      message: error.message || "Failed to delete collection",
    });
  }
};