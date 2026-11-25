
const AdminModel = require("../../models/adminModule");
const CryptoJS = require("crypto-js");
const jwt = require("jsonwebtoken");
const crypto = require("crypto");
const nodemailer = require("nodemailer");

const JWT_SECRET = process.env.JWT_SECRET;
const CRYPTO_SECRET = process.env.CRYPTO_SECRET;
const JWT_EXPIRE = "1d";

if (!JWT_SECRET || !CRYPTO_SECRET) {
  throw new Error("JWT_SECRET and CRYPTO_SECRET must be configured");
}

const encryptData = (value) => {
  return CryptoJS.AES.encrypt(
    String(value),
    CRYPTO_SECRET
  ).toString();
};

const decryptData = (encryptedValue) => {
  try {
    if (!encryptedValue) return "";

    const bytes = CryptoJS.AES.decrypt(
      encryptedValue,
      CRYPTO_SECRET
    );

    return bytes.toString(CryptoJS.enc.Utf8);
  } catch (error) {
    return "";
  }
};

const generateToken = (admin) => {
  return jwt.sign(
    {
      adminId: admin._id,
      email: admin.email,
      sessionVersion: admin.sessionVersion || 0,
    },
    JWT_SECRET,
    { expiresIn: JWT_EXPIRE }
  );
};

const cookieOptions = {
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: process.env.NODE_ENV === "production" ? "none" : "lax",
  maxAge: 24 * 60 * 60 * 1000,
  path: "/",
};

const clearCookieOptions = {
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: process.env.NODE_ENV === "production" ? "none" : "lax",
  path: "/",
};

const smtpPort = Number(process.env.SMTP_PORT || 587);

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: smtpPort,
  secure: smtpPort === 465,
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASSWORD,
  },
});

const validatePassword = (password) => {
  return (
    typeof password === "string" &&
    password.length >= 8 &&
    password.length <= 50 &&
    /[A-Z]/.test(password) &&
    /[a-z]/.test(password) &&
    /[0-9]/.test(password) &&
    /[^A-Za-z0-9]/.test(password)
  );
};

const normalizeEmail = (email) => {
  return typeof email === "string" ? email.toLowerCase().trim() : "";
};

exports.adminRegister = async (req, res) => {
  try {
    const { name, email, password, confirmPassword, role } = req.body;

    if (
      !name ||
      !email ||
      !password ||
      !confirmPassword
    ) {
      return res.status(400).json({
        status: false,
        message: "All fields are required",
      });
    }

    if (typeof name !== "string" || !name.trim()) {
      return res.status(400).json({
        status: false,
        message: "Valid name is required",
      });
    }

    const normalizedEmail = normalizeEmail(email);

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)) {
      return res.status(400).json({
        status: false,
        message: "Please enter a valid email address",
      });
    }

    if (password !== confirmPassword) {
      return res.status(400).json({
        status: false,
        message: "Passwords do not match",
      });
    }

    if (!validatePassword(password)) {
      return res.status(400).json({
        status: false,
        message:
          "Password must contain uppercase, lowercase, number, special character and be between 8 and 50 characters",
      });
    }

    const existingAdmin = await AdminModel.findOne({
      email: normalizedEmail,
    });

    if (existingAdmin) {
      return res.status(409).json({
        status: false,
        message: "Admin email already exists",
      });
    }

    const allowedRoles = [
      "SUPER_ADMIN",
      "ADMIN",
      "SUB_ADMIN",
    ];

    const adminRole = role || "ADMIN";

    if (!allowedRoles.includes(adminRole)) {
      return res.status(400).json({
        status: false,
        message: "Invalid admin role",
      });
    }

    const admin = await AdminModel.create({
      name: name.trim(),
      email: normalizedEmail,
      password: encryptData(password),
      role: adminRole,
      status: "ACTIVE",
      sessionVersion: 0,
    });

    return res.status(201).json({
      status: true,
      message: "Admin registered successfully",
      data: {
        id: admin._id,
        name: admin.name,
        email: admin.email,
        role: admin.role,
        status: admin.status,
      },
    });
  } catch (error) {
    console.error("Admin Register Error:", error);

    if (error.code === 11000) {
      return res.status(409).json({
        status: false,
        message: "Admin email already exists",
      });
    }

    return res.status(500).json({
      status: false,
      message: "Admin registration failed",
    });
  }
};

exports.adminLogin = async (req, res) => {
  try {
    const { email, password } = req.body;

    const normalizedEmail = normalizeEmail(email);

    if (!normalizedEmail || !password) {
      return res.status(400).json({
        status: false,
        message: "Email and password are required",
      });
    }

    const admin = await AdminModel.findOne({
      email: normalizedEmail,
    }).select("+password");

    if (!admin) {
      return res.status(401).json({
        status: false,
        message: "Invalid email or password",
      });
    }

    if (admin.status !== "ACTIVE") {
      return res.status(403).json({
        status: false,
        message: "Your admin account is inactive",
      });
    }

    const decryptedPassword = decryptData(admin.password);

    if (!decryptedPassword || decryptedPassword !== password) {
      return res.status(401).json({
        status: false,
        message: "Invalid email or password",
      });
    }

    admin.sessionVersion = (admin.sessionVersion || 0) + 1;

    await admin.save();

    const token = generateToken(admin);

    res.cookie("admin_auth_token", token, cookieOptions);

    return res.status(200).json({
      status: true,
      message: "Admin login successful",
      data: {
        id: admin._id,
        name: admin.name,
        email: admin.email,
        role: admin.role,
      },
    });
  } catch (error) {
    console.error("Admin Login Error:", error);

    return res.status(500).json({
      status: false,
      message: "Internal server error",
    });
  }
};

exports.adminLogout = async (req, res) => {
  try {
    if (req.admin?._id) {
      await AdminModel.findByIdAndUpdate(req.admin._id, {
        $inc: { sessionVersion: 1 },
      });
    }

    res.clearCookie("admin_auth_token", clearCookieOptions);

    return res.status(200).json({
      status: true,
      message: "Admin logout successful",
    });
  } catch (error) {
    console.error("Admin Logout Error:", error);

    return res.status(500).json({
      status: false,
      message: "Logout failed",
    });
  }
};


exports.adminForgetPassword = async (req, res) => {
  try {
    const email = normalizeEmail(req.body.email);

    if (!email) {
      return res.status(400).json({
        status: false,
        message: "Email is required",
      });
    }

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return res.status(400).json({
        status: false,
        message: "Please enter a valid email address",
      });
    }

    const genericResponse = {
      status: true,
      message: "If the account exists, a reset email will be sent.",
    };

    const admin = await AdminModel.findOne({
      email,
      status: "ACTIVE",
    }).select("+resetToken +resetTokenExpires");

    if (!admin) {
      return res.status(200).json(genericResponse);
    }

    const rawToken = crypto.randomBytes(32).toString("hex");

    const tokenHash = crypto
      .createHash("sha256")
      .update(rawToken)
      .digest("hex");

    admin.resetToken = tokenHash;
    admin.resetTokenExpires = new Date(Date.now() + 10 * 60 * 1000);

    await admin.save();

    const resetLink = `${process.env.ADMIN_URL}/resetpassword/${rawToken}`;

    try {
      await transporter.sendMail({
        from: process.env.SMTP_FROM,
        to: admin.email,
        subject: "Admin Password Reset",
        html: `
          <div style="font-family:Arial,sans-serif;padding:25px;color:#333;max-width:600px;margin:auto">
            <h2>Password Reset Request</h2>
            <p>Hello ${admin.name || "Admin"},</p>
            <p>We received a request to reset your admin account password.</p>
            <div style="text-align:center;margin:30px 0">
              <a href="${resetLink}" style="background:#2563eb;color:#fff;text-decoration:none;padding:14px 28px;border-radius:6px;display:inline-block">
                Reset Password
              </a>
            </div>
            <p>This reset link expires in 10 minutes.</p>
            <p>If you did not request this password reset, please ignore this email.</p>
          </div>
        `,
      });
    } catch (mailError) {
      admin.resetToken = undefined;
      admin.resetTokenExpires = undefined;
      await admin.save();

      console.error("Admin Reset Email Error:", mailError);

      return res.status(500).json({
        status: false,
        message: "Unable to send reset email",
      });
    }

    return res.status(200).json(genericResponse);
  } catch (error) {
    console.error("Admin Forgot Password Error:", error);

    return res.status(500).json({
      status: false,
      message: "Unable to process password reset",
    });
  }
};

exports.adminResetPassword = async (req, res) => {
  try {

    console.log('enter the adminResetPassword')
    const { token, newPassword, confirmPassword } = req.body;

    console.log('req.body', req.body)

    console.log('token-------', token)
    console.log('newPassword', newPassword)
    console.log('confirmPassword', confirmPassword)

    if (!token || !newPassword || !confirmPassword) {
      return res.status(400).json({
        status: false,
        message: "All fields are required",
      });
    }

    if (newPassword !== confirmPassword) {
      return res.status(400).json({
        status: false,
        message: "Passwords do not match",
      });
    }

    if (!validatePassword(newPassword)) {
      return res.status(400).json({
        status: false,
        message:
          "Password must contain uppercase, lowercase, number, special character and be between 8 and 50 characters",
      });
    }

    const tokenHash = crypto
      .createHash("sha256")
      .update(token)
      .digest("hex");

    const admin = await AdminModel.findOne({
      resetToken: tokenHash,
      resetTokenExpires: { $gt: new Date() },
      status: "ACTIVE",
    }).select("+resetToken +resetTokenExpires +password");

    if (!admin) {
      return res.status(400).json({
        status: false,
        message: "Invalid or expired reset link",
      });
    }

    admin.password = encryptData(newPassword);
    admin.resetToken = undefined;
    admin.resetTokenExpires = undefined;
    admin.sessionVersion = (admin.sessionVersion || 0) + 1;

    await admin.save();

    return res.status(200).json({
      status: true,
      message: "Password reset successfully. Please login again.",
    });
  } catch (error) {
    console.error("Admin Reset Password Error:", error);

    return res.status(500).json({
      status: false,
      message: "Password reset failed",
    });
  }
};

exports.adminVerifyOtp = async (req, res) => {
  try {
    const { otp } = req.body;
    const normalizedEmail = normalizeEmail(req.body.email);

    if (!normalizedEmail || !otp) {
      return res.status(400).json({
        status: false,
        message: "Email and OTP are required",
      });
    }

    const admin = await AdminModel.findOne({
      email: normalizedEmail,
      status: "ACTIVE",
    }).select("+resetOtp +resetOtpExpires");

    if (
      !admin ||
      !admin.resetOtp ||
      !admin.resetOtpExpires ||
      admin.resetOtpExpires < new Date()
    ) {
      return res.status(400).json({
        status: false,
        message: "OTP expired or invalid",
      });
    }

    const decryptedOtp = decryptData(admin.resetOtp);

    if (!decryptedOtp || decryptedOtp !== String(otp).trim()) {
      return res.status(400).json({
        status: false,
        message: "Invalid OTP",
      });
    }

    const resetToken = crypto.randomBytes(32).toString("hex");

    admin.resetToken = crypto
      .createHash("sha256")
      .update(resetToken)
      .digest("hex");

    admin.resetTokenExpires = new Date(Date.now() + 10 * 60 * 1000);

    admin.resetOtp = undefined;
    admin.resetOtpExpires = undefined;

    await admin.save();

    return res.status(200).json({
      status: true,
      message: "OTP verified successfully",
      resetToken,
    });
  } catch (error) {
    console.error("Admin Verify OTP Error:", error);

    return res.status(500).json({
      status: false,
      message: "OTP verification failed",
    });
  }
};


exports.adminChangePassword = async (req, res) => {
  try {
    const {
      currentPassword,
      newPassword,
      confirmPassword,
    } = req.body;

    if (!currentPassword || !newPassword || !confirmPassword) {
      return res.status(400).json({
        status: false,
        message: "All fields are required",
      });
    }

    if (newPassword !== confirmPassword) {
      return res.status(400).json({
        status: false,
        message: "Passwords do not match",
      });
    }

    if (!validatePassword(newPassword)) {
      return res.status(400).json({
        status: false,
        message:
          "Password must contain uppercase, lowercase, number, special character and be between 8 and 50 characters",
      });
    }

    const admin = await AdminModel.findById(req.admin._id)
      .select("+password");

    if (!admin) {
      return res.status(404).json({
        status: false,
        message: "Admin not found",
      });
    }

    const decryptedPassword = decryptData(admin.password);

    if (!decryptedPassword || decryptedPassword !== currentPassword) {
      return res.status(400).json({
        status: false,
        message: "Current password is incorrect",
      });
    }

    admin.password = encryptData(newPassword);
    admin.sessionVersion = (admin.sessionVersion || 0) + 1;

    await admin.save();

    res.clearCookie("admin_auth_token", clearCookieOptions);

    return res.status(200).json({
      status: true,
      message: "Password changed successfully. Please login again.",
    });
  } catch (error) {
    console.error("Admin Change Password Error:", error);

    return res.status(500).json({
      status: false,
      message: "Password change failed",
    });
  }
};

exports.getAdminProfile = async (req, res) => {
  try {
    const admin = await AdminModel.findById(req.admin._id)
      .select("-password -resetOtp -resetToken");

    if (!admin) {
      return res.status(404).json({
        status: false,
        message: "Admin not found",
      });
    }

    return res.status(200).json({
      status: true,
      message: "Admin profile fetched successfully",
      data: admin,
    });
  } catch (error) {
    console.error("Admin Profile Error:", error);

    return res.status(500).json({
      status: false,
      message: "Unable to fetch admin profile",
    });
  }
};

exports.checkAdminAuth = async (req, res) => {
  try {
    if (!req.admin?._id) {
      return res.status(401).json({
        status: false,
        authenticated: false,
        message: "Unauthorized",
      });
    }

    return res.status(200).json({
      status: true,
      authenticated: true,
      data: {
        id: req.admin._id,
        email: req.admin.email,
        name: req.admin.name,
        role: req.admin.role,
      },
    });
  } catch (error) {
    console.error("Admin Auth Check Error:", error);

    return res.status(401).json({
      status: false,
      authenticated: false,
      message: "Unauthorized",
    });
  }
};
