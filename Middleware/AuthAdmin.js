
const jwt = require("jsonwebtoken");
const AdminModel = require("../models/adminModule");

const adminAuth = async (req, res, next) => {
  try {
    const token = req.cookies.admin_auth_token;

    if (!token) {
      return res.status(401).json({
        status: false,
        message: "Authentication required",
      });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    const admin = await AdminModel.findById(decoded.adminId);

    if (!admin) {
      return res.status(401).json({
        status: false,
        message: "Admin not found",
      });
    }

    if (
      admin.sessionVersion !== decoded.sessionVersion ||
      admin.status !== "ACTIVE"
    ) {
      return res.status(401).json({
        status: false,
        message: "Session expired. Please login again.",
      });
    }

    req.admin = admin;
    next();

  } catch (error) {
    return res.status(401).json({
      status: false,
      message: "Invalid or expired token",
    });
  }
};

module.exports = adminAuth;
