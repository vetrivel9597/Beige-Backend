
const mongoose = require("mongoose");
const ProductModel = require("../../models/Product");

const STATUS_VALUES = ["ACTIVE", "DRAFT", "ARCHIVED"];
const TYPE_VALUES = ["SKIN_CARE", "BEAUTY"];

const getProductStatus = (product) => {
  if (product.status && STATUS_VALUES.includes(product.status)) {
    return product.status;
  }

  if (product.productStatus === 1) return "ACTIVE";
  if (product.productStatus === 2) return "ARCHIVED";

  return "DRAFT";
};

const formatProduct = (product) => {
  const item = product.toObject ? product.toObject() : product;

  return {
    ...item,
    name: item.productname || item.name || "",
    sku: item.sku || "",
    slug: item.slug || item.pagelink || "",
    type: item.productType || item.type || "SKIN_CARE",
    status: getProductStatus(item),
    price: item.sellingPrice ?? item.price ?? "",
    stock: item.quantity ?? item.stock ?? 0,
    image:
      item.productimages?.[0]?.media ||
      item.image ||
      "",
    category: item.categoryId
      ? {
        _id: item.categoryId._id || item.categoryId,
        name: item.categoryId.name || item.category || "",
        slug: item.categoryId.slug || "",
        parentCategory: item.categoryId.parentCategory || null,
      }
      : item.category
        ? {
          _id: "",
          name: item.category,
          slug: "",
          parentCategory: null,
        }
        : null,
  };
};

const getCategoryList = async () => {
  const products = await ProductModel.find({
    $or: [
      { categoryId: { $exists: true, $ne: null } },
      { category: { $exists: true, $nin: ["", null] } },
    ],
  })
    .select("category categoryId")
    .lean();

  const categories = new Map();

  products.forEach((product) => {
    const id = product.categoryId
      ? String(product.categoryId)
      : String(product.category || "").trim();

    const name = String(product.category || "").trim();

    if (!id || !name) return;

    if (!categories.has(id)) {
      categories.set(id, {
        _id: id,
        name,
        slug: name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, ""),
        status: "ACTIVE",
      });
    }
  });

  return Array.from(categories.values());
};



exports.getProducts = async (req, res) => {
  try {

    console.log('Enter getProducts',)
    const {
      page = 1,
      limit = 10,
      search = "",
      status = "",
      type = "",
      category = "",
    } = req.query;

    const pageNumber = Math.max(Number(page) || 1, 1);
    const limitNumber = Math.min(Math.max(Number(limit) || 10, 1), 10000);

    const conditions = [];

    if (search.trim()) {
      const searchRegex = new RegExp(
        search.trim().replace(/[.*+?^${}()|[\]\\]/g, "\\$&"),
        "i"
      );

      conditions.push({
        $or: [
          { productname: searchRegex },
          { name: searchRegex },
          { sku: searchRegex },
          { category: searchRegex },
        ],
      });
    }

    if (status && STATUS_VALUES.includes(status)) {
      if (status === "ACTIVE") {
        conditions.push({
          $or: [
            { status: "ACTIVE" },
            { productStatus: 1 },
          ],
        });
      } else if (status === "ARCHIVED") {
        conditions.push({
          $or: [
            { status: "ARCHIVED" },
            { productStatus: 2 },
          ],
        });
      } else {
        conditions.push({
          $or: [
            { status: "DRAFT" },
            { productStatus: 0 },
            {
              status: { $exists: false },
              productStatus: { $exists: false },
            },
          ],
        });
      }
    }

    if (type && TYPE_VALUES.includes(type)) {
      conditions.push({
        $or: [
          { productType: type },
          { type },
        ],
      });
    }

    if (category) {
      if (mongoose.Types.ObjectId.isValid(category)) {
        conditions.push({
          categoryId: new mongoose.Types.ObjectId(category),
        });
      } else {
        conditions.push({
          category: category,
        });
      }
    }

    const filter = conditions.length ? { $and: conditions } : {};

    const [products, total] = await Promise.all([
      ProductModel.find(filter)
        .sort({ createdAt: -1 })
        .skip((pageNumber - 1) * limitNumber)
        .limit(limitNumber)
        .lean(),

      ProductModel.countDocuments(filter),
    ]);

    return res.status(200).json({
      status: true,
      message: "Products fetched successfully",
      data: products.map(formatProduct),
      pagination: {
        total,
        page: pageNumber,
        limit: limitNumber,
        totalPages: Math.ceil(total / limitNumber),
      },
    });
  } catch (error) {
    console.error("Get Products Error:", error);

    return res.status(500).json({
      status: false,
      message: "Unable to fetch products",
      error: error.message,
    });
  }
};


exports.deleteProduct = async (req, res) => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        status: false,
        message: "Invalid product ID",
      });
    }

    const product = await ProductModel.findByIdAndDelete(id);

    if (!product) {
      return res.status(404).json({
        status: false,
        message: "Product not found",
      });
    }

    return res.status(200).json({
      status: true,
      message: "Product deleted successfully",
    });
  } catch (error) {
    console.error("Delete Product Error:", error);

    return res.status(500).json({
      status: false,
      message: "Unable to delete product",
    });
  }
};

exports.bulkUpdateStatus = async (req, res) => {
  try {
    const { productIds, status } = req.body;

    if (
      !Array.isArray(productIds) ||
      productIds.length === 0 ||
      !STATUS_VALUES.includes(status)
    ) {
      return res.status(400).json({
        status: false,
        message: "Valid product IDs and status are required",
      });
    }

    const validIds = productIds.filter((id) =>
      mongoose.Types.ObjectId.isValid(id)
    );

    if (validIds.length !== productIds.length) {
      return res.status(400).json({
        status: false,
        message: "One or more product IDs are invalid",
      });
    }

    const result = await ProductModel.updateMany(
      { _id: { $in: validIds } },
      {
        $set: {
          status,
          updatedAt: new Date(),
        },
      }
    );

    return res.status(200).json({
      status: true,
      message: `${result.modifiedCount} product(s) updated successfully`,
      data: {
        matchedCount: result.matchedCount,
        modifiedCount: result.modifiedCount,
      },
    });
  } catch (error) {
    console.error("Bulk Status Update Error:", error);

    return res.status(500).json({
      status: false,
      message: "Unable to update product statuses",
    });
  }
};

exports.bulkUpdateCategory = async (req, res) => {
  try {
    const { productIds, category } = req.body;

    if (
      !Array.isArray(productIds) ||
      productIds.length === 0 ||
      !category
    ) {
      return res.status(400).json({
        status: false,
        message: "Product IDs and category are required",
      });
    }

    const validIds = productIds.filter((id) =>
      mongoose.Types.ObjectId.isValid(id)
    );

    if (validIds.length !== productIds.length) {
      return res.status(400).json({
        status: false,
        message: "One or more product IDs are invalid",
      });
    }

    const categoryProducts = await ProductModel.find({
      $or: [
        { categoryId: category },
        { category: category },
      ],
    })
      .select("category categoryId")
      .limit(1)
      .lean();

    if (!categoryProducts.length) {
      return res.status(404).json({
        status: false,
        message: "Category not found in existing products",
      });
    }

    const categoryName = categoryProducts[0].category || "";

    const updateData = {
      category: categoryName,
      updatedAt: new Date(),
    };

    if (mongoose.Types.ObjectId.isValid(category)) {
      updateData.categoryId = category;
    }

    const result = await ProductModel.updateMany(
      { _id: { $in: validIds } },
      { $set: updateData }
    );

    return res.status(200).json({
      status: true,
      message: `${result.modifiedCount} product(s) category updated successfully`,
      data: {
        matchedCount: result.matchedCount,
        modifiedCount: result.modifiedCount,
      },
    });
  } catch (error) {
    console.error("Bulk Category Update Error:", error);

    return res.status(500).json({
      status: false,
      message: "Unable to update product categories",
    });
  }
};

exports.bulkImport = async (req, res) => {
  try {
    const { products } = req.body;

    if (!Array.isArray(products) || products.length === 0) {
      return res.status(400).json({
        status: false,
        message: "Products are required for import",
      });
    }

    if (products.length > 5000) {
      return res.status(400).json({
        status: false,
        message: "Maximum 5000 products can be imported at once",
      });
    }

    const categories = await getCategoryList();
    const categoryMap = new Map();

    categories.forEach((item) => {
      categoryMap.set(String(item._id).toLowerCase(), item);
      categoryMap.set(item.name.toLowerCase(), item);
      categoryMap.set(item.slug.toLowerCase(), item);
    });

    const seenSkus = new Set();
    const errors = [];
    const documents = [];

    for (let index = 0; index < products.length; index++) {
      const row = products[index];

      const name = String(row.name || "").trim();
      const sku = String(row.sku || "").trim().toUpperCase();
      const categoryValue = String(row.category || "").trim();
      const type = String(row.type || "").trim().toUpperCase();
      const status = String(row.status || "DRAFT").trim().toUpperCase();
      const price = Number(row.price);
      const stock = Number(row.stock);
      const image = String(row.image || "").trim();

      const category = categoryMap.get(categoryValue.toLowerCase());

      const rowErrors = [];

      if (!name) rowErrors.push("Name is required");
      if (!sku) rowErrors.push("SKU is required");

      if (sku && seenSkus.has(sku)) {
        rowErrors.push("Duplicate SKU in import file");
      }

      if (sku) seenSkus.add(sku);

      if (!category) rowErrors.push("Invalid category");
      if (!TYPE_VALUES.includes(type)) rowErrors.push("Invalid type");
      if (!STATUS_VALUES.includes(status)) rowErrors.push("Invalid status");
      if (!Number.isFinite(price) || price < 0) {
        rowErrors.push("Invalid price");
      }
      if (!Number.isInteger(stock) || stock < 0) {
        rowErrors.push("Invalid stock");
      }

      if (rowErrors.length) {
        errors.push({
          row: index + 2,
          sku,
          message: rowErrors.join(", "),
        });
        continue;
      }

      documents.push({
        productname: name,
        sku,
        slug: name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, ""),
        category: category.name,
        categoryId: mongoose.Types.ObjectId.isValid(category._id)
          ? category._id
          : undefined,
        productType: type,
        status,
        price: String(price),
        sellingPrice: price,
        quantity: stock,
        productimages: image ? [{ media: image }] : [],
        createdAt: new Date(),
        updatedAt: new Date(),
      });
    }

    if (errors.length) {
      return res.status(400).json({
        status: false,
        message: "Please correct the import validation errors",
        data: {
          importedCount: 0,
          errors,
        },
      });
    }

    const existingSkus = await ProductModel.find({
      sku: { $in: documents.map((item) => item.sku) },
    })
      .select("sku")
      .lean();

    if (existingSkus.length) {
      return res.status(409).json({
        status: false,
        message: "Some SKUs already exist",
        data: {
          duplicateSkus: existingSkus.map((item) => item.sku),
        },
      });
    }

    const imported = await ProductModel.insertMany(documents, {
      ordered: true,
    });

    return res.status(201).json({
      status: true,
      message: "Products imported successfully",
      data: {
        importedCount: imported.length,
        errors: [],
      },
    });
  } catch (error) {
    console.error("Bulk Import Error:", error);

    return res.status(500).json({
      status: false,
      message: "Unable to import products",
    });
  }
};


exports.createProduct = async (req, res) => {
  try {
    const {
      name,
      sku,
      category,
      type,
      price,
      stock,
      status,
    } = req.body;


    console.log('req.body', req.body)

    if (!name || !sku || !category || !type || price === undefined || stock === undefined || !status) {
      return res.status(400).json({
        status: false,
        message: "All required product fields must be provided",
      });
    }

    const productName = name.trim();
    const productSku = sku.trim().toUpperCase();

    if (!productName || !productSku) {
      return res.status(400).json({
        status: false,
        message: "Product name and SKU are required",
      });
    }

    if (!mongoose.Types.ObjectId.isValid(category)) {
      return res.status(400).json({
        status: false,
        message: "Invalid category ID",
      });
    }

    if (!TYPE_VALUES.includes(type)) {
      return res.status(400).json({
        status: false,
        message: "Invalid product type",
      });
    }

    if (!STATUS_VALUES.includes(status)) {
      return res.status(400).json({
        status: false,
        message: "Invalid product status",
      });
    }

    const productPrice = Number(price);
    const productStock = Number(stock);

    if (!Number.isFinite(productPrice) || productPrice < 0) {
      return res.status(400).json({
        status: false,
        message: "Invalid product price",
      });
    }

    if (!Number.isInteger(productStock) || productStock < 0) {
      return res.status(400).json({
        status: false,
        message: "Invalid stock quantity",
      });
    }

    const existingProduct = await ProductModel.findOne({
      sku: productSku,
    });

    if (existingProduct) {
      return res.status(409).json({
        status: false,
        message: "Product SKU already exists",
      });
    }

    const categoryRef = ProductModel.schema.path("categoryId")?.options?.ref;
    const CategoryModel = categoryRef ? mongoose.model(categoryRef) : null;

    let categoryName = "";

    if (CategoryModel) {
      const categoryData = await CategoryModel.findById(category).lean();

      if (!categoryData) {
        return res.status(404).json({
          status: false,
          message: "Category not found",
        });
      }

      categoryName = categoryData.name || categoryData.categoryName || "";
    }

    if (!categoryName) {
      return res.status(400).json({
        status: false,
        message: "Unable to identify category name. Check your category model reference.",
      });
    }

    const slugBase = productName
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "");

    const slug = `${slugBase}-${productSku.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`;

    const productStatus =
      status === "ACTIVE" ? 1 :
        status === "ARCHIVED" ? 2 : 0;

    const imageUrl = req.file
      ? req.file.path || req.file.secure_url || req.file.url
      : "";

    const product = new ProductModel({
      productname: productName,
      name: productName,
      sku: productSku,
      slug,
      pagelink: slug,
      category: categoryName,
      categoryId: category,
      productType: type,
      type,
      price: String(productPrice),
      sellingPrice: productPrice,
      quantity: productStock,
      stock: productStock,
      status,
      productStatus,
      productimages: imageUrl
        ? [{ media: imageUrl }]
        : [],
      image: imageUrl,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    await product.save();

    return res.status(201).json({
      status: true,
      message: "Product created successfully",
      data: {
        _id: product._id,
        name: product.productname,
        sku: product.sku,
        category: {
          _id: product.categoryId,
          name: product.category,
        },
        type: product.productType,
        price: product.sellingPrice,
        stock: product.quantity,
        status: product.status,
        image: imageUrl,
      },
    });

  } catch (error) {
    console.error("Create Product Error:", error);

    if (error.code === 11000) {
      return res.status(409).json({
        status: false,
        message: "Product already exists",
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
      message: "Unable to create product",
      error: error.message,
    });
  }
};


exports.getSingleProduct = async (req, res) => {
    try {
        const { id } = req.params;

        if (!mongoose.Types.ObjectId.isValid(id)) {
            return res.status(400).json({
                status: false,
                message: "Invalid product ID"
            });
        }

        const product = await ProductModel.findById(id)
            .populate("categoryId")
            .lean();

        if (!product) {
            return res.status(404).json({
                status: false,
                message: "Product not found"
            });
        }

        return res.status(200).json({
            status: true,
            message: "Product fetched successfully",
            data: product
        });

    } catch (error) {
        return res.status(500).json({
            status: false,
            message: error.message
        });
    }
};

