const mongoose = require("mongoose");
const AdminModel = require("../../models/adminModule");

const MODULES = [
  "DASHBOARD",
  "PRODUCT",
  "CATEGORY",
  "COLLECTION",
  "SHADES",
  "INVENTORY",
  "WAREHOUSE",
  "ORDERS",
  "RETURNS",
  "PAYMENTS",
  "CUSTOMERS",
  "REVIEWS",
  "SKIN_AI",
  "LOOK_AI",
  "AI_SAFETY",
  "AI_SCAN_LOGS",
  "MARKETING",
  "CMS",
  "NOTIFICATIONS",
  "REPORTS",
  "SETTINGS",
  "SUB_ADMIN",
  "AUDIT_LOG",
];

const isValidId = (id) => mongoose.Types.ObjectId.isValid(id);

const adminFilter = {
  role: "SUB_ADMIN",
  isDeleted: { $ne: true },
};

exports.getModules = async (req, res) => {
  try {
    return res.status(200).json({
      status: true,
      message: "Modules fetched successfully",
      data: MODULES,
    });
  } catch (error) {
    console.error("Get Modules Error:", error);
    return res.status(500).json({
      status: false,
      message: "Failed to fetch modules",
    });
  }
};

exports.viewAdmins = async (req, res) => {
  try {
    const admins = await AdminModel.find(adminFilter)
      .select("-password -otp -resetToken -resetOtp")
      .sort({ createdAt: -1 })
      .lean();

    return res.status(200).json({
      status: true,
      message: "Sub-admins fetched successfully",
      data: admins,
    });
  } catch (error) {
    console.error("View Sub Admins Error:", error);
    return res.status(500).json({
      status: false,
      message: "Failed to fetch sub-admins",
    });
  }
};

exports.getAdminById = async (req, res) => {
  try {
    const { id } = req.params;

    if (!isValidId(id)) {
      return res.status(400).json({
        status: false,
        message: "Invalid sub-admin ID",
      });
    }

    const admin = await AdminModel.findOne({
      _id: id,
      ...adminFilter,
    })
      .select("-password -otp -resetToken -resetOtp")
      .lean();

    if (!admin) {
      return res.status(404).json({
        status: false,
        message: "Sub-admin not found",
      });
    }

    return res.status(200).json({
      status: true,
      message: "Sub-admin fetched successfully",
      data: admin,
    });
  } catch (error) {
    console.error("Get Sub Admin Error:", error);
    return res.status(500).json({
      status: false,
      message: "Failed to fetch sub-admin",
    });
  }
};

exports.updateAdmin = async (req, res) => {
  try {
    const { id } = req.params;
    const { name, email, status, permissions } = req.body;

    if (!isValidId(id)) {
      return res.status(400).json({
        status: false,
        message: "Invalid sub-admin ID",
      });
    }

    if (!name || !name.trim()) {
      return res.status(400).json({
        status: false,
        message: "Name is required",
      });
    }

    if (!email || !email.trim()) {
      return res.status(400).json({
        status: false,
        message: "Email is required",
      });
    }

    const normalizedEmail = email.trim().toLowerCase();

    const validEmail =
      /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail);

    if (!validEmail) {
      return res.status(400).json({
        status: false,
        message: "Enter a valid email address",
      });
    }

    if (!["ACTIVE", "INACTIVE"].includes(status)) {
      return res.status(400).json({
        status: false,
        message: "Invalid account status",
      });
    }

    if (!Array.isArray(permissions)) {
      return res.status(400).json({
        status: false,
        message: "Permissions must be an array",
      });
    }

    const selectedPermissions = [];
    const seenModules = new Set();

    for (const permission of permissions) {
      const module = permission?.module;

      if (!MODULES.includes(module)) {
        return res.status(400).json({
          status: false,
          message: `Invalid module: ${module || "Unknown"}`,
        });
      }

      if (seenModules.has(module)) {
        return res.status(400).json({
          status: false,
          message: `Duplicate module permission: ${module}`,
        });
      }

      seenModules.add(module);

      const edit = Boolean(permission.edit);
      const view = Boolean(permission.view) || edit;

      if (!view && !edit) {
        continue;
      }

      selectedPermissions.push({
        module,
        view,
        edit,
      });
    }

    if (selectedPermissions.length === 0) {
      return res.status(400).json({
        status: false,
        message: "Please select at least one module permission",
      });
    }

    const admin = await AdminModel.findOne({
      _id: id,
      ...adminFilter,
    });

    if (!admin) {
      return res.status(404).json({
        status: false,
        message: "Sub-admin not found",
      });
    }

    const duplicateEmail = await AdminModel.findOne({
      email: normalizedEmail,
      _id: { $ne: id },
      isDeleted: { $ne: true },
    });

    if (duplicateEmail) {
      return res.status(409).json({
        status: false,
        message: "Email address already exists",
      });
    }

    // Preserve existing permission fields not editable in this form.
    const existingPermissions = Array.isArray(admin.permissions)
      ? admin.permissions
      : [];

    const existingPermissionMap = new Map(
      existingPermissions.map((permission) => [
        permission.module,
        permission.toObject
          ? permission.toObject()
          : { ...permission },
      ])
    );

    admin.permissions = selectedPermissions.map((permission) => {
      const existing = existingPermissionMap.get(permission.module) || {};

      return {
        ...existing,
        module: permission.module,
        view: permission.view,
        edit: permission.edit,
      };
    });

    admin.name = name.trim();
    admin.email = normalizedEmail;
    admin.status = status;

    // Invalidate existing sessions when the account is deactivated.
    if (status === "INACTIVE") {
      admin.sessionVersion = (admin.sessionVersion || 0) + 1;
    }

    await admin.save();

    const updatedAdmin = await AdminModel.findById(id)
      .select("-password -otp -resetToken -resetOtp")
      .lean();

    return res.status(200).json({
      status: true,
      message: "Sub-admin updated successfully",
      data: updatedAdmin,
    });
  } catch (error) {
    console.error("Update Sub Admin Error:", error);

    if (error.code === 11000) {
      return res.status(409).json({
        status: false,
        message: "Email address already exists",
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
      message: "Failed to update sub-admin",
    });
  }
};

exports.deleteAdmin = async (req, res) => {
  try {
    const { id } = req.params;

    if (!isValidId(id)) {
      return res.status(400).json({
        status: false,
        message: "Invalid sub-admin ID",
      });
    }

    const admin = await AdminModel.findOne({
      _id: id,
      ...adminFilter,
    });

    if (!admin) {
      return res.status(404).json({
        status: false,
        message: "Sub-admin not found",
      });
    }

    admin.isDeleted = true;
    admin.status = "INACTIVE";
    admin.sessionVersion = (admin.sessionVersion || 0) + 1;

    await admin.save();

    return res.status(200).json({
      status: true,
      message: "Sub-admin deleted successfully",
    });
  } catch (error) {
    console.error("Delete Sub Admin Error:", error);
    return res.status(500).json({
      status: false,
      message: "Failed to delete sub-admin",
    });
  }
};