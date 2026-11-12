
const User = require("../models/User");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const crypto = require("crypto");
const { OAuth2Client } = require("google-auth-library");
const nodemailer = require("nodemailer");
const CryptoJS = require("crypto-js");
const googleClient = new OAuth2Client(
    process.env.GOOGLE_CLIENT_ID
);
const transporter = require("../config/transporter");
const OTP = require("../models/Otp");

const generateToken = (user) => {
    return jwt.sign(
        {
            id: user._id,
            email: user.email
        },
        process.env.JWT_SECRET,
        {
            expiresIn: "7d"
        }
    );
};


exports.register = async (req, res) => {
    try {
        console.log("enter register");

        const { name, email, password, otp } =
            req.body?.data || req.body || {};

        if (!email) {
            return res.status(400).json({
                success: false,
                message: "Email is required"
            });
        }

        const normalizedEmail = email.trim().toLowerCase();

        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)) {
            return res.status(400).json({
                success: false,
                message: "Invalid email address"
            });
        }

        const existingUser = await User.findOne({
            email: normalizedEmail
        });

        if (existingUser) {
            return res.status(409).json({
                success: false,
                message: "Email already registered. Please login."
            });
        }


        if (!name || !password) {
            return res.status(400).json({
                success: false,
                message: "Name and password are required"
            });
        }

        if (password.length < 8) {
            return res.status(400).json({
                success: false,
                message: "Password must contain at least 8 characters"
            });
        }

        const otpCode = crypto
            .randomInt(100000, 1000000)
            .toString();

        await OTP.findOneAndUpdate(
            { email: normalizedEmail },
            {
                $set: {
                    email: normalizedEmail,
                    otp: otpCode,
                    createdAt: new Date()
                }
            },
            {
                upsert: true,
                new: true
            }
        );

        await transporter.sendMail({
            from: process.env.SMTP_FROM,
            to: normalizedEmail,
            subject: "Beige Email Verification",
            html: `
                    <div style="font-family: Arial, sans-serif;">
                        <h2>Welcome to Beige!</h2>
                        <p>Your email verification OTP is:</p>
                        <h1 style="letter-spacing: 5px;">${otpCode}</h1>
                        <p>This OTP is valid for 5 minutes.</p>
                    </div>
                `
        });

        return res.status(200).json({
            success: true,
            message: "OTP sent successfully to your email",

            registrationData: {
                name,
                email,
                password
            }
        });

    } catch (error) {
        console.error("Register Error:", error);

        if (error.code === 11000) {
            return res.status(409).json({
                success: false,
                message: "Email already registered"
            });
        }

        return res.status(500).json({
            success: false,
            message: "Registration failed"
        });
    }
};




exports.verifyOTP = async (req, res) => {
    try {
        const { name, password, email, otp, type } =
            req.body?.data || req.body || {};

        console.log('req.body', req.body)
        const normalizedEmail = email.trim().toLowerCase();


        if (type === "register") {


            if (!email || !otp || !type) {
                return res.status(400).json({
                    success: false,
                    message: "Email, OTP and type are required"
                });
            }



            if (!name || !password) {
                return res.status(400).json({
                    success: false,
                    message: "Name and password are required"
                });
            }

            const otpRecord = await OTP.findOne({
                email: normalizedEmail
            });

            if (!otpRecord) {
                return res.status(400).json({
                    success: false,
                    message: "OTP not found. Please register again."
                });
            }

            const otpAge =
                Date.now() - new Date(otpRecord.createdAt).getTime();

            if (otpAge > 5 * 60 * 1000) {
                await OTP.deleteOne({ _id: otpRecord._id });

                return res.status(400).json({
                    success: false,
                    message: "OTP expired. Please register again."
                });
            }

            if (String(otpRecord.otp).trim() !== String(otp).trim()) {
                return res.status(400).json({
                    success: false,
                    message: "Invalid OTP"
                });
            }

            // Check duplicate email again
            const existingUser = await User.findOne({
                email: normalizedEmail
            });

            if (existingUser) {
                await OTP.deleteOne({ _id: otpRecord._id });

                return res.status(409).json({
                    success: false,
                    message: "Email already registered. Please login."
                });
            }

            const salt = crypto.randomBytes(16).toString("hex");

            const hashedPassword = CryptoJS.SHA256(
                password + salt
            ).toString();

            const user = await User.create({
                username: name.trim(),
                email: normalizedEmail,
                password: `${salt}:${hashedPassword}`
            });

            await OTP.deleteOne({
                _id: otpRecord._id
            });

            const token = generateToken(user);

            return res.status(201).json({
                success: true,
                message: "Email verified and registration successful",
                token,
                user: {
                    id: user._id,
                    name: user.username,
                    email: user.email
                }
            });
        }


        if (type === "login") {

            console.log('enter login rtype login')

            const otpRecord = await OTP.findOne({
                email: normalizedEmail
            });

            if (!otpRecord) {
                return res.status(400).json({
                    success: false,
                    message: "OTP not found. Please login again."
                });
            }

            const otpAge =
                Date.now() - new Date(otpRecord.createdAt).getTime();

            if (otpAge > 5 * 60 * 1000) {
                await OTP.deleteOne({ _id: otpRecord._id });

                return res.status(400).json({
                    success: false,
                    message: "OTP expired. Please request a new OTP."
                });
            }

            if (String(otpRecord.otp).trim() !== String(otp).trim()) {
                return res.status(400).json({
                    success: false,
                    message: "Invalid OTP"
                });
            }

            const user = await User.findOne({
                email: normalizedEmail
            });

            if (!user) {
                return res.status(404).json({
                    success: false,
                    message: "User not found"
                });
            }

            await OTP.deleteOne({
                _id: otpRecord._id
            });

            const token = generateToken(user);

            return res.status(200).json({
                success: true,
                message: "Login successful",
                token,
                user: {
                    id: user._id,
                    name: user.username,
                    email: user.email
                }
            });
        }

        return res.status(400).json({
            success: false,
            message: "Invalid verification type"
        });

    } catch (error) {
        console.error("Verify OTP Error:", error);

        return res.status(500).json({
            success: false,
            message: "OTP verification failed"
        });
    }
};




exports.resendOTP = async (req, res) => {

    console.log('enter resendOTP api route')
    try {
        const { email } = req.body?.data || req.body || {};

        if (!email) {
            return res.status(400).json({
                success: false,
                message: "Email is required"
            });
        }

        const normalizedEmail = email.trim().toLowerCase();


        const otpCode = crypto.randomInt(100000, 1000000).toString();

        await OTP.findOneAndUpdate(
            { email: normalizedEmail },
            {
                $set: {
                    email: normalizedEmail,
                    otp: otpCode,
                    createdAt: new Date()
                }
            },
            {
                upsert: true,
                new: true
            }
        );

        await transporter.sendMail({
            from: process.env.SMTP_FROM,
            to: normalizedEmail,
            subject: "Beige Email Verification - New OTP",
            html: `
                <div style="font-family: Arial, sans-serif;">
                    <h2>Beige Email Verification</h2>
                    <p>Your new verification OTP is:</p>
                    <h1 style="letter-spacing: 5px;">${otpCode}</h1>
                    <p>This OTP is valid for 5 minutes.</p>
                </div>
            `
        });

        return res.status(200).json({
            success: true,
            message: "New OTP sent successfully to your email"
        });

    } catch (error) {
        console.error("Resend OTP Error:", error);

        return res.status(500).json({
            success: false,
            message: "Failed to resend OTP"
        });
    }
};





exports.login = async (req, res) => {
    try {

        const { email, password } = req.body?.data || req.body || {};

        console.log("req.body", req.body);

        if (!email || !password) {
            return res.status(400).json({
                success: false,
                message: "Email and password are required"
            });
        }

        const normalizedEmail = email.trim().toLowerCase();

        const user = await User.findOne({
            email: normalizedEmail
        });

        if (!user || !user.password) {
            return res.status(401).json({
                success: false,
                message: "Invalid email or password"
            });
        }

        // CryptoJS password verification
        const [salt, storedHash] = user.password.split(":");

        if (!salt || !storedHash) {
            return res.status(401).json({
                success: false,
                message: "Invalid email or password"
            });
        }

        const hashedPassword = CryptoJS.SHA256(
            password + salt
        ).toString();

        const isMatch = hashedPassword === storedHash;

        console.log("isMatch", isMatch);

        if (!isMatch) {
            return res.status(401).json({
                success: false,
                message: "Invalid email or password"
            });
        }

        // Generate OTP
        const otpCode = crypto
            .randomInt(100000, 1000000)
            .toString();

        // Save OTP
        await OTP.findOneAndUpdate(
            { email: normalizedEmail },
            {
                $set: {
                    email: normalizedEmail,
                    otp: otpCode,
                    type: "login",
                    createdAt: new Date()
                }
            },
            {
                upsert: true,
                new: true
            }
        );

        // Send OTP email
        await transporter.sendMail({
            from: process.env.SMTP_FROM,
            to: normalizedEmail,
            subject: "Beige Login Verification",
            html: `
                <div style="font-family: Arial, sans-serif;">
                    <h2>Welcome back to Beige!</h2>
                    <p>Your login verification OTP is:</p>
                    <h1 style="letter-spacing: 5px;">${otpCode}</h1>
                    <p>This OTP is valid for 5 minutes.</p>
                </div>
            `
        });

        return res.status(200).json({
            success: true,
            message: "Login OTP sent successfully to your email",
            email: normalizedEmail,
            type: "login"
        });

    } catch (error) {
        console.error("Login Error:", error);

        return res.status(500).json({
            success: false,
            message: "Login failed"
        });
    }
};





exports.googleLogin = async (req, res) => {
    try {
        const { credential } = req.body;

        if (!credential) {
            return res.status(400).json({
                success: false,
                message: "Google credential is required"
            });
        }

        const ticket = await googleClient.verifyIdToken({
            idToken: credential,
            audience: process.env.GOOGLE_CLIENT_ID
        });

        const payload = ticket.getPayload();

        if (
            !payload ||
            !payload.sub ||
            !payload.email ||
            payload.email_verified !== true
        ) {
            return res.status(401).json({
                success: false,
                message: "Invalid or unverified Google account"
            });
        }

        const normalizedEmail = payload.email.toLowerCase();

        let user = await User.findOne({
            email: normalizedEmail
        });

        if (!user) {
            user = await User.create({
                name: payload.name || normalizedEmail.split("@")[0],
                email: normalizedEmail,
                googleId: payload.sub
            });

        } else if (
            user.googleId &&
            user.googleId !== payload.sub
        ) {
            return res.status(401).json({
                success: false,
                message: "Google account does not match"
            });

        } else if (!user.googleId) {
            user.googleId = payload.sub;
            await user.save();
        }

        const token = generateToken(user);

        return res.status(200).json({
            success: true,
            message: "Google login successful",
            token,
            user: {
                id: user._id,
                name: user.name,
                email: user.email
            }
        });

    } catch (error) {
        console.error("Google Login Error:", error);

        return res.status(401).json({
            success: false,
            message: "Google authentication failed"
        });
    }
};





exports.forgotPassword = async (req, res) => {
    try {
        const { email } = req.body?.data || req.body || {};

        if (!email || typeof email !== "string") {
            return res.status(400).json({
                success: false,
                message: "Email is required"
            });
        }

        if (!process.env.JWT_SECRET) {
            throw new Error("JWT_SECRET is not configured");
        }

        const normalizedEmail = email.trim().toLowerCase();

        const user = await User.findOne({
            email: normalizedEmail
        });

        if (!user) {
            return res.status(200).json({
                success: true,
                message: "If an account exists for this email, a reset link has been sent."
            });
        }

        // Generate JWT reset token (5 minutes)
        const resetToken = jwt.sign(
            {
                email: normalizedEmail,
                type: "reset-password"
            },
            process.env.JWT_SECRET,
            {
                expiresIn: "5m",
                algorithm: "HS256"
            }
        );

        const frontendUrl = process.env.FRONTEND_URL;

        const resetLink =
            `${frontendUrl}/reset-password?token=${encodeURIComponent(resetToken)}`;

        await transporter.sendMail({
            from: process.env.SMTP_FROM,
            to: normalizedEmail,
            subject: "Beige Password Reset",
            html: `
                <h2>Password Reset Request</h2>
                <p>Hello ${user.username},</p>
                <p>Click the link below to reset your password.</p>
                <a href="${resetLink}">Reset Password</a>
                <p>This link is valid for 5 minutes.</p>
                <p>If you did not request this, please ignore this email.</p>
            `
        });

        return res.status(200).json({
            success: true,
            message: "If an account exists for this email, a reset link has been sent."
        });

    } catch (error) {
        console.error("Forgot Password Error:", error);

        return res.status(500).json({
            success: false,
            message: "Could not send the reset link. Please try again."
        });
    }
};




exports.resetPassword = async (req, res) => {
    try {
        const { token, password } = req.body?.data || req.body || {};

        if (!token || !password) {
            return res.status(400).json({
                success: false,
                message: "Token and password are required"
            });
        }

        if (typeof password !== "string") {
            return res.status(400).json({
                success: false,
                message: "Invalid password"
            });
        }

        if (password.length < 8) {
            return res.status(400).json({
                success: false,
                message: "Password must contain at least 8 characters"
            });
        }

        if (!/[A-Z]/.test(password)) {
            return res.status(400).json({
                success: false,
                message: "Password must contain at least one uppercase letter"
            });
        }

        if (!/[a-z]/.test(password)) {
            return res.status(400).json({
                success: false,
                message: "Password must contain at least one lowercase letter"
            });
        }

        if (!/[0-9]/.test(password)) {
            return res.status(400).json({
                success: false,
                message: "Password must contain at least one number"
            });
        }

        if (!/[!@#$%^&*(),.?":{}|<>]/.test(password)) {
            return res.status(400).json({
                success: false,
                message: "Password must contain a special character"
            });
        }

        if (!process.env.JWT_SECRET) {
            throw new Error("JWT_SECRET is not configured");
        }

        // Verify JWT reset token
        let decoded;

        try {
            decoded = jwt.verify(
                token,
                process.env.JWT_SECRET,
                {
                    algorithms: ["HS256"]
                }
            );
        } catch (error) {
            if (error.name === "TokenExpiredError") {
                return res.status(400).json({
                    success: false,
                    message: "Reset link expired. Please request a new link."
                });
            }

            return res.status(400).json({
                success: false,
                message: "Invalid or expired reset link"
            });
        }

        if (
            decoded.type !== "reset-password" ||
            !decoded.email
        ) {
            return res.status(400).json({
                success: false,
                message: "Invalid reset token"
            });
        }

        const user = await User.findOne({
            email: decoded.email
        });

        if (!user) {
            return res.status(404).json({
                success: false,
                message: "User not found"
            });
        }

        // Existing CryptoJS password hashing logic
        const salt = crypto.randomBytes(16).toString("hex");

        const hashedPassword = CryptoJS.SHA256(
            password + salt
        ).toString();

        user.password = `${salt}:${hashedPassword}`;

        await user.save();

        return res.status(200).json({
            success: true,
            message: "Password updated successfully. Please sign in."
        });

    } catch (error) {
        console.error("Reset Password Error:", error);

        return res.status(500).json({
            success: false,
            message: "Could not reset the password. Please try again."
        });
    }
};

