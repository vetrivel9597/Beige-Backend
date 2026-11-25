const AdminModel = require("../../models/adminModule");

exports.sidebarModules = async (req, res) => {
  try {
    const admin = await AdminModel.findById(req.admin._id).lean();

    if (!admin || admin.status !== "ACTIVE" || admin.isDeleted) {
      return res.status(401).json({
        success: false,
        message: "Admin account is not active"
      });
    }

    let modules = [];

    if (admin.role === "SUPER_ADMIN") {
      modules = [
        "DASHBOARD",
        ...(admin.availableModules || [])
      ];
    } else {
      const permissions = Array.isArray(admin.permissions)
        ? admin.permissions
        : [];

      modules = permissions
        .filter((permission) => {
          if (typeof permission === "string") {
            return true;
          }

          return permission?.view === true;
        })
        .map((permission) =>
          typeof permission === "string"
            ? permission
            : permission.module
        )
        .filter(Boolean);
    }

    modules = [...new Set(modules)];

    return res.status(200).json({
      success: true,
      message: "Sidebar modules fetched successfully",
      data: {
        role: admin.role,
        modules
      }
    });

  } catch (error) {
    console.error("Sidebar Modules Error:", error);

    return res.status(500).json({
      success: false,
      message: "Unable to fetch sidebar modules"
    });
  }
};

