const mongoose = require("mongoose");
const CategoryModel = require("../../models/Category");

const isValidObjectId = (id) => mongoose.Types.ObjectId.isValid(id);

exports.addCategory = async (req, res) => {
  try {
    const {
      name,
      description,
      parentCategory,
      displayOrder,
      status,
    } = req.body;

    if (!name || typeof name !== "string" || !name.trim()) {
      return res.status(400).json({
        status: false,
        message: "Category name is required",
      });
    }

    const categoryName = name.trim();

    const existingCategory = await CategoryModel.findOne({
      name: { $regex: `^${categoryName}$`, $options: "i" },
    });

    if (existingCategory) {
      return res.status(409).json({
        status: false,
        message: "Category already exists",
      });
    }

    if (
      parentCategory &&
      !mongoose.Types.ObjectId.isValid(parentCategory)
    ) {
      return res.status(400).json({
        status: false,
        message: "Invalid parent category ID",
      });
    }

    if (parentCategory) {
      const parentExists = await CategoryModel.findById(parentCategory);

      if (!parentExists) {
        return res.status(404).json({
          status: false,
          message: "Parent category not found",
        });
      }
    }

    const categoryStatus = status || "ACTIVE";

    if (!["ACTIVE", "INACTIVE"].includes(categoryStatus)) {
      return res.status(400).json({
        status: false,
        message: "Invalid category status",
      });
    }

    const order = displayOrder === undefined ? 0 : Number(displayOrder);

    if (!Number.isInteger(order) || order < 0) {
      return res.status(400).json({
        status: false,
        message: "Display order must be a non-negative integer",
      });
    }

    const slug = categoryName
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "");

    const existingSlug = await CategoryModel.findOne({ slug });

    if (existingSlug) {
      return res.status(409).json({
        status: false,
        message: "Category slug already exists",
      });
    }

    const image = req.file
      ? req.file.path || req.file.secure_url || req.file.url || ""
      : "";

    const category = await CategoryModel.create({
      name: categoryName,
      slug,
      image,
      description: description || "",
      parentCategory: parentCategory || null,
      displayOrder: order,
      status: categoryStatus,
    });

    return res.status(201).json({
      status: true,
      message: "Category added successfully",
      data: category,
    });
  } catch (error) {
    console.error("Add Category Error:", error);

    if (error.code === 11000) {
      return res.status(409).json({
        status: false,
        message: "Category slug already exists",
      });
    }

    return res.status(500).json({
      status: false,
      message: "Internal server error",
      error: error.message,
    });
  }
};

exports.getCategories = async (req, res) => {
  try {
    const categories = await CategoryModel.find()
      .populate("parentCategory", "name slug")
      .sort({ displayOrder: 1, createdAt: -1 })
      .lean();

    return res.status(200).json({
      status: true,
      message: "Categories fetched successfully",
      data: categories,
    });
  } catch (error) {
    console.error("GET CATEGORIES ERROR:", error);

    return res.status(500).json({
      status: false,
      message: error.message || "Failed to fetch categories",
    });
  }
};

exports.createCategory = async (req, res) => {
  try {
    const {
      name,
      slug,
      parentCategory,
      description,
      displayOrder,
      status,
    } = req.body;

    if (!name || !slug) {
      return res.status(400).json({
        status: false,
        message: "Category name and slug are required",
      });
    }

    if (parentCategory) {
      if (!isValidObjectId(parentCategory)) {
        return res.status(400).json({
          status: false,
          message: "Invalid parent category ID",
        });
      }

      const parent = await CategoryModel.findById(parentCategory);

      if (!parent) {
        return res.status(404).json({
          status: false,
          message: "Parent category not found",
        });
      }
    }

    const existingCategory = await CategoryModel.findOne({
      $or: [{ name: name.trim() }, { slug: slug.trim().toLowerCase() }],
    });

    if (existingCategory) {
      return res.status(409).json({
        status: false,
        message: "Category name or slug already exists",
      });
    }

    const category = await CategoryModel.create({
      name: name.trim(),
      slug: slug.trim().toLowerCase(),
      parentCategory: parentCategory || null,
      description: description || "",
      displayOrder: Number(displayOrder) || 0,
      status: status || "ACTIVE",
      image: req.file?.path || "",
    });

    return res.status(201).json({
      status: true,
      message: "Category created successfully",
      data: category,
    });
  } catch (error) {
    console.error("CREATE CATEGORY ERROR:", error);

    return res.status(500).json({
      status: false,
      message: error.message || "Failed to create category",
    });
  }
};

exports.updateCategory = async (req, res) => {
  try {
    const { id } = req.params;

    const {
      name,
      slug,
      parentCategory,
      description,
      displayOrder,
      status,
    } = req.body;

    if (!isValidObjectId(id)) {
      return res.status(400).json({
        status: false,
        message: "Invalid category ID",
      });
    }

    const category = await CategoryModel.findById(id);

    if (!category) {
      return res.status(404).json({
        status: false,
        message: "Category not found",
      });
    }

    if (!name || !slug) {
      return res.status(400).json({
        status: false,
        message: "Category name and slug are required",
      });
    }

    if (parentCategory) {
      if (!isValidObjectId(parentCategory)) {
        return res.status(400).json({
          status: false,
          message: "Invalid parent category ID",
        });
      }

      if (String(parentCategory) === String(id)) {
        return res.status(400).json({
          status: false,
          message: "Category cannot be its own parent",
        });
      }

      const parent = await CategoryModel.findById(parentCategory);

      if (!parent) {
        return res.status(404).json({
          status: false,
          message: "Parent category not found",
        });
      }

      let currentParent = parent;

      while (currentParent) {
        if (String(currentParent._id) === String(id)) {
          return res.status(400).json({
            status: false,
            message: "Cannot assign a descendant as parent category",
          });
        }

        if (!currentParent.parentCategory) break;

        currentParent = await CategoryModel.findById(
          currentParent.parentCategory
        );
      }
    }

    const duplicate = await CategoryModel.findOne({
      _id: { $ne: id },
      $or: [{ name: name.trim() }, { slug: slug.trim().toLowerCase() }],
    });

    if (duplicate) {
      return res.status(409).json({
        status: false,
        message: "Category name or slug already exists",
      });
    }

    category.name = name.trim();
    category.slug = slug.trim().toLowerCase();
    category.parentCategory = parentCategory || null;
    category.description = description || "";
    category.displayOrder = Number(displayOrder) || 0;
    category.status = status || "ACTIVE";

    if (req.file?.path) {
      category.image = req.file.path;
    }

    await category.save();

    return res.status(200).json({
      status: true,
      message: "Category updated successfully",
      data: category,
    });
  } catch (error) {
    console.error("UPDATE CATEGORY ERROR:", error);

    return res.status(500).json({
      status: false,
      message: error.message || "Failed to update category",
    });
  }
};

exports.deleteCategory = async (req, res) => {
  try {
    const { id } = req.params;

    if (!isValidObjectId(id)) {
      return res.status(400).json({
        status: false,
        message: "Invalid category ID",
      });
    }

    const category = await CategoryModel.findById(id);

    if (!category) {
      return res.status(404).json({
        status: false,
        message: "Category not found",
      });
    }

    const childCategory = await CategoryModel.findOne({
      parentCategory: id,
    });

    if (childCategory) {
      return res.status(400).json({
        status: false,
        message: "Please delete or move child categories before deleting this category",
      });
    }

    await CategoryModel.findByIdAndDelete(id);

    return res.status(200).json({
      status: true,
      message: "Category deleted successfully",
    });
  } catch (error) {
    console.error("DELETE CATEGORY ERROR:", error);

    return res.status(500).json({
      status: false,
      message: error.message || "Failed to delete category",
    });
  }
};