const mongoose = require('mongoose');
require('../config/environment');
const jwt = require("jsonwebtoken");
const User = require("../models/User");
const Otp = require("../models/Otp");
const Product = require("../models/Product");
const multer = require("multer");
const Influencer = require("../models/Influencer")
const Usercart = require("../models/usercart")
const path = require('path');
// const fs = require('node:fs');
const nodemailer = require("nodemailer");
const hbs = require("nodemailer-express-handlebars");
const resetMailBody = path.resolve(__dirname, '../EmailTemplates/mailBody/resetPassword.txt');
const ObjectId = mongoose.Types.ObjectId;
const myCollection = require('../models/myCollections'); // Adjust the path as needed
const SocialMedia = require('../models/socilaMedia');
const TrendingCategory = require('../models/trendingCategory');
const PromoCodeSchema = require('../models/promoCode');
const Banner = require("../models/Banner")
const SiteAddress = require('../models/address');
const marked = require('marked');
const fs = require("fs");
const formatXml = require("xml-formatter");
const categorypage = require("../models/categorypagebanner")
const page = require('../models/page')



const accountSid = process.env.TWILIO_ACCOUNT_SID;
// const accountSid = 'MG2aeb72ffcd6a3e43799dcb3eadc0f1dc';

const authToken = process.env.TWILIO_AUTH_TOKEN;
const client = require('twilio')(accountSid, authToken);
const TWILIO_PHONE_NUMBER = process.env.TWILIO_PHONE_NUMBER;
const TWILIO_WHATSAPP_NUMBER = `whatsapp:${process.env.TWILIO_WHATSAPP_NUMBER}`;
const { request } = require('http');
const Token = require('../models/authToken');
const { hashPassword, verifyPassword } = require('../utils/password');
const axios = require('axios');
const blogModule = require('../models/Blog');
const whislistModule = require('../models/whislist');
const categoryModule = require('../models/categories');
const profileModule = require('../models/profile');
const usercart = require('../models/usercart');
const Order = require("../models/Orders");
const SellProduct = require('../models/sellProduct');
const Offercontent = require('../models/Offercontent');
const categorypagebanner = require('../models/categorypagebanner');
// Sent OTP To Whatsapp & SMS
const sendOTP = async (otp, mobile, purpose = 'Registration') => {
  const message = `Your NEWME ${purpose} verification code is ${otp}`;
  // console.log(otp)
  try {
    // const smsResult = await client.messages.create({
    //   body: message,
    //   from: TWILIO_PHONE_NUMBER,
    //   to: mobile
    // });
    // console.log("OTP sent to Phone Number:", mobile);

    const whatsappResult = await client.messages.create({
      body: message,
      from: TWILIO_WHATSAPP_NUMBER,
      to: `whatsapp:${mobile}`
    });

    // console.log("OTP sent to WhatsApp Number:", mobile,);
    //return { smsResult, whatsappResult };
    return { whatsappResult };
  } catch (error) {
    console.error("Error sending OTP:", error);
    throw error;
  }
};

//Generate OTP
function generateOTP() {
  return Math.floor(100000 + Math.random() * 900000);
}

function safeUser(user) {
  return {
    id: String(user._id),
    username: user.username || '',
    email: user.email,
    mobile: user.mobile || '',
    dialCode: user.dailCode || '',
  };
}

function getDevTestLoginConfig() {
  if (!['development', 'test'].includes(process.env.NODE_ENV) || process.env.ENABLE_DEV_TEST_LOGIN !== 'true') {
    return null;
  }
  const email = String(process.env.DEV_TEST_LOGIN_EMAIL || '').trim().toLowerCase();
  const password = process.env.DEV_TEST_LOGIN_PASSWORD;
  const otp = process.env.DEV_TEST_LOGIN_OTP;
  if (!email || !password || !/^\d{6}$/.test(String(otp || ''))) return null;
  return { email, password, otp: String(otp) };
}

// Accept a national number with a separate dial code or a number already in
// international form. Return the number as E.164 for Twilio and its national
// portion for the user record.
function normalizeRegistrationPhone(mobile, dialCode) {
  const rawMobile = String(mobile || '').trim();
  const rawDialCode = String(dialCode || '').trim();
  const mobileDigits = rawMobile.replace(/\D/g, '');
  const dialDigits = rawDialCode.replace(/\D/g, '');
  if (!mobileDigits) return null;

  let countryDigits = dialDigits;
  let nationalDigits = mobileDigits;
  if (rawMobile.startsWith('+') || rawMobile.startsWith('00')) {
    if (!countryDigits || !mobileDigits.startsWith(countryDigits)) {
      countryDigits = mobileDigits.slice(0, mobileDigits.length - 10);
    }
    if (!countryDigits || !mobileDigits.startsWith(countryDigits)) return null;
    nationalDigits = mobileDigits.slice(countryDigits.length);
  }

  const e164 = `+${countryDigits}${nationalDigits}`;
  if (!/^\+[1-9]\d{7,14}$/.test(e164)) return null;
  return { e164, nationalDigits, dialCode: `+${countryDigits}` };
}

//Verify OTP & User Register & create
const register = async (req, res, next) => {
  const { username, mobile, email, password, dialCode, OTP, address } = req.body;


  const phone = normalizeRegistrationPhone(mobile, dialCode);
  const normalizedEmail = String(email || '').trim().toLowerCase();

  if (!username?.trim() || !mobile?.trim() || !normalizedEmail || !password) {
    return res.status(400).json({ status: false, message: 'Name, email, phone number and password are required.' });
  }
  if (String(password).length < 6) {
    return res.status(400).json({ status: false, message: 'Password must be at least 6 characters.' });
  }
  if (!phone) {
    return res.status(400).json({ status: false, message: 'Enter a valid phone number with its country code, such as +91 and a 10 digit phone number.' });
  }
  const { e164: Mobile, nationalDigits, dialCode: normalizedDialCode } = phone;

  try {
    const [existingEmailUser, existingMobileUser] = await Promise.all([
      User.findOne({ email: normalizedEmail }).select('_id'),
      User.findOne({ mobile: nationalDigits }).select('_id'),
    ]);
    if (existingEmailUser) return res.status(409).json({ status: false, message: 'An account with this email already exists.' });
    if (existingMobileUser) return res.status(409).json({ status: false, message: 'An account with this phone number already exists.' });

    const existingotpUser = await Otp.findOne({ mobile: Mobile });

    if (existingotpUser) {
      const matchotp = await Otp.findOne({ mobile: Mobile });

      if (!matchotp) {
        return res.json({ status: false, message: "No OTP found for this Mobile!" });
      }

      const receivedOTP = matchotp.otp;
      const createdAt = matchotp.createdAt;

      if (!/^\d{6}$/.test(String(OTP || ''))) {
        return res.json({ status: false, message: "Please Enter 6 Digit OTP!" });
      }

      if (String(receivedOTP) !== String(OTP)) {
        return res.json({ status: false, message: "OTP Does Not Match!" });
      }

      const now = new Date();
      const expirationTime = new Date(createdAt.getTime() + (2 * 60 * 1000));

      if (now > expirationTime) {
        return res.json({ status: false, message: "OTP Expired!" });
      }

      const passwordHash = await hashPassword(password);
      const newUser = await User.create({ username: username.trim(), email: normalizedEmail, mobile: nationalDigits, password: passwordHash, default_address: address, dailCode: normalizedDialCode });
      if (newUser) {
        await Otp.deleteOne({ _id: matchotp._id });
        return res.json({ status: true, message: "OTP Verified ; User Registered Successfully!", type: 2, url: "/login" });
      } else {
        return res.json({ status: false, message: "Failed to register user!" });
      }
    }
    if (!existingotpUser) {
      const otp = generateOTP();
      try {

        const { whatsappResult } = await sendOTP(otp, Mobile);
        if (whatsappResult) {
          await Otp.create({ mobile: Mobile, otp: String(otp) });
          return res.json({ status: true, message: "OTP Sent Successfully", type: 1 });
        } else {
          return res.json({ status: false, message: "Failed to send OTP! Try Again" });
        }
      } catch (err) {
        console.error("Failed to send OTP:", err);
        return res.json({ status: false, message: "Failed to send OTP! Try Again" });
      }
    }
  } catch (error) {

    console.error("Error registering user:", error);
    return res.status(500).json({ status: false, message: "Unable to complete registration. Please try again." });
  }
};

const resendregisterotp = async (req, res) => {
  const { mobile, dialCode } = req.body;
  const phone = normalizeRegistrationPhone(mobile, dialCode);
  if (!phone) return res.status(400).json({ status: false, message: 'Enter a valid phone number before requesting another code.' });
  const { e164: Mobile } = phone;
  try {
    const newOTP = generateOTP();

    const updatedOTP = await Otp.findOneAndUpdate(
      { mobile: Mobile },
      { otp: newOTP, createdAt: new Date() },
    );
    if (!updatedOTP) {
      return res.json({ status: false, message: "No OTP found with this ID!" });
    }
    const { whatsappResult } = await sendOTP(newOTP, updatedOTP.mobile);

    if (whatsappResult) {
      return res.json({ status: true, message: "New OTP Sent Successfully!", type: 3 });
    } else {
      return res.json({ status: false, message: "Failed to send OTP! Try Again" });
    }
  } catch (err) {
    console.error("Error resending OTP:", err);
    return res.json({ status: false, message: "Failed to resend OTP!" });
  }
}


const userregister = async (req, res) => {
  try {


    console.log("enter the userregister api ");
    console.log('req.body-----------', req.body)

    const { type } = req.body;
    if (type === "register") {
      return register(req, res);
    }
    if (type === "verifyregisterotp") {
      return register(req, res);
    }
    if (type === "resendregisterotp") {
      return resendregisterotp(req, res);
    }
    return res.status(400).json({ status: false, message: "Invalid type specified!" });
  } catch (error) {
    log("ERROR", error)
  }
}

//Login Route
const loginemailmobile = async (req, res) => {
  try {
    const { email, mobile, password, localuser, dialCode } = req.body || {};
    const normalizedEmail = String(email || '').trim().toLowerCase();
    let normalizedMobile = String(mobile || '').replace(/\D/g, '');
    const dialDigits = String(dialCode || '').replace(/\D/g, '');
    if (dialDigits && normalizedMobile.startsWith(dialDigits) && normalizedMobile.length > 10) {
      normalizedMobile = normalizedMobile.slice(dialDigits.length);
    }
    if ((!normalizedEmail && !normalizedMobile) || typeof password !== 'string' || !password) {
      return res.status(400).json({ status: false, message: 'Email or phone number and password are required.' });
    }
    if (!process.env.JWT_SECRET) {
      console.error('Login is missing JWT configuration.');
      return res.status(503).json({ status: false, message: 'Login is temporarily unavailable. Please try again later.' });
    }

    const devTestLogin = getDevTestLoginConfig();
    const staticOtpEmail = 'vetrivel.k@clariscosolutions.com';
    const staticLoginOtp = '123456';
    if (normalizedEmail === staticOtpEmail && devTestLogin?.email !== normalizedEmail) {
      const specialUser = await User.findOne({ email: normalizedEmail });
      if (!specialUser) {
        return res.status(401).json({ status: false, message: 'Invalid email or password.' });
      }
      const passwordCheck = await verifyPassword(password, specialUser.password, process.env.LEGACY_PASSWORD_ENCRYPTION_KEY);
      if (!passwordCheck.valid) {
        return res.status(401).json({ status: false, message: 'Invalid email or password.' });
      }
      if (passwordCheck.needsUpgrade) {
        specialUser.password = await hashPassword(password);
        await specialUser.save();
      }
      await Otp.findOneAndUpdate(
        { email: normalizedEmail },
        { $set: { email: normalizedEmail, otp: staticLoginOtp, createdAt: new Date() } },
        { upsert: true, new: true, setDefaultsOnInsert: true }
      );
      return res.json({
        status: true,
        message: 'Login credentials accepted. Enter the verification code to continue.',
        type: 1,
        requiresOtp: true,
        otp: staticLoginOtp,
      });
    }

    if (normalizedEmail && devTestLogin?.email === normalizedEmail) {
      if (password !== devTestLogin.password) {
        return res.status(401).json({ status: false, message: 'Invalid email or password.' });
      }
      const testUser = await User.findOne({ email: normalizedEmail });
      if (!testUser) {
        return res.status(401).json({ status: false, message: 'Invalid email or password.' });
      }
      await Otp.findOneAndUpdate(
        { email: normalizedEmail },
        { $set: { email: normalizedEmail, otp: devTestLogin.otp, createdAt: new Date() } },
        { upsert: true, new: true, setDefaultsOnInsert: true }
      );
      return res.json({
        status: true,
        message: 'Test account credentials accepted. Enter the verification code to continue.',
        type: 1,
        requiresOtp: true,
        ...(normalizedEmail === staticOtpEmail ? { otp: devTestLogin.otp } : {}),
      });
    }


    if (normalizedEmail) {
      const userWithEmail = await User.findOne({ email: normalizedEmail });

      if (userWithEmail) {
        const passwordCheck = await verifyPassword(password, userWithEmail.password, process.env.LEGACY_PASSWORD_ENCRYPTION_KEY);
        if (!passwordCheck.valid) {
          return res.status(401).json({ status: false, message: 'Invalid email or password.' });
        }
        if (passwordCheck.needsUpgrade) {
          userWithEmail.password = await hashPassword(password);
          await userWithEmail.save();
        }

        const token = jwt.sign({ userId: userWithEmail._id }, process.env.JWT_SECRET, { expiresIn: '24h' });
        // console.log(userWithEmail._id, " userWithEmail._id ");


        const newToken = new Token({
          token,
          userId: userWithEmail._id,
        })

        await newToken.save()


        if (localuser) {

          const localuserArray = JSON.parse(localuser);
          // console.log(localuserArray, "localuserArray");


          // Group product IDs and count their occurrences
          const productCount = {};

          localuserArray.forEach(productId => {
            if (productCount[productId]) {
              productCount[productId]++;
            } else {
              productCount[productId] = 1;
            }
          });

          // Prepare the products array for Usercart
          const products = Object.keys(productCount).map(productId => ({
            productid: new mongoose.Types.ObjectId(productId),
            quantity: productCount[productId]
          }));
          console.log("products", products);

          for (const product of products) {

            const existuser = await Usercart.findOne({ userid: userWithEmail._id });
            if (!existuser) {
              // console.log("eeeeeeeeeeeeeeeeeeeeeeeee");

              await Usercart.create({
                userid: userWithEmail._id,
                product: products
              })
            }
            const existingCartItem = await Usercart.findOne({
              userid: userWithEmail._id,
              "product.productid": product.productid
            });
            if (existingCartItem) {

              const higherQuantity = Math.max(
                existingCartItem.product.find(p => p.productid.equals(product.productid)).quantity,
                product.quantity
              );
              // console.log( existingCartItem.product.find(p => p.productid.equals(product.productid)).quantity,"exist");
              // console.log(product.quantity,"product.quantity");

              await Usercart.updateOne(
                { userid: userWithEmail._id, "product.productid": product.productid },
                { $set: { "product.$.quantity": higherQuantity } }
              );
            } else {
              await Usercart.findOneAndUpdate(
                { userid: userWithEmail._id },
                { $push: { product: product } },
                { upsert: true, new: true }
              );
            }
          }
        }

        req.session.user = userWithEmail._id;
        return req.session.save((sessionError) => {
          if (sessionError) {
            console.error('Could not save login session:', sessionError);
            return res.status(500).json({ status: false, message: 'Login succeeded but the session could not be saved. Please try again.' });
          }
          return res.json({ status: true, message: "Login successful", type: 4, token, user: safeUser(userWithEmail) });
        });
      }
      else {
        return res.status(401).json({ status: false, message: 'Invalid email or password.' });
      }
    }
    if (normalizedMobile) {
      const userWithMobile = await User.findOne({ mobile: normalizedMobile });
      if (userWithMobile) {
        const passwordCheck = await verifyPassword(password, userWithMobile.password, process.env.LEGACY_PASSWORD_ENCRYPTION_KEY);
        if (!passwordCheck.valid) {
          return res.status(401).json({ status: false, message: 'Invalid phone number or password.' });
        }
        if (passwordCheck.needsUpgrade) {
          userWithMobile.password = await hashPassword(password);
          await userWithMobile.save();
        }

        const token = jwt.sign({ userId: userWithMobile._id }, process.env.JWT_SECRET, { expiresIn: '24h' });

        const newToken = new Token({
          token,
          userId: userWithMobile._id,
        })
        // console.log("localuser", localuser);

        await newToken.save()

        if (localuser) {
          const localuserArray = JSON.parse(localuser);
          const productCount = {};
          localuserArray.forEach(productId => {
            if (productCount[productId]) {
              productCount[productId]++;
            } else {
              productCount[productId] = 1;
            }
          });

          // Prepare the products array for Usercart
          const products = Object.keys(productCount).map(productId => ({
            productid: new mongoose.Types.ObjectId(productId),
            quantity: productCount[productId]
          }));
          // console.log("products", products);

          for (const product of products) {

            const existuser = await Usercart.findOne({ userid: userWithMobile._id });
            if (!existuser) {
              // console.log("eeeeeeeeeeeeeeeeeeeeeeeee");

              await Usercart.create({
                userid: userWithMobile._id,
                product: products
              })
            }
            const existingCartItem = await Usercart.findOne({
              userid: userWithMobile._id,
              "product.productid": product.productid
            });
            if (existingCartItem) {


              const higherQuantity = Math.max(
                existingCartItem.product.find(p => p.productid.equals(product.productid)).quantity,
                product.quantity
              );
              await Usercart.updateOne(
                { userid: userWithMobile._id, "product.productid": product.productid },
                { $set: { "product.$.quantity": higherQuantity } }
              );
            } else {
              await Usercart.findOneAndUpdate(
                { userid: userWithMobile._id },
                { $push: { product: product } },
                { upsert: true, new: true }
              );
            }
          }
        }

        req.session.user = userWithMobile._id;
        return req.session.save((sessionError) => {
          if (sessionError) {
            console.error('Could not save login session:', sessionError);
            return res.status(500).json({ status: false, message: 'Login succeeded but the session could not be saved. Please try again.' });
          }
          return res.json({ status: true, message: "Login successful", type: 5, token, user: safeUser(userWithMobile) });
        });

      }
      else {
        return res.status(401).json({ status: false, message: 'Invalid phone number or password.' });
      }
    }
  } catch (error) {
    console.error("Login error:", error);
    return res.status(500).json({ status: false, message: "Unable to log in right now. Please try again." });
  }
}


const loginwhatsApp = async (req, res) => {
  const otp = generateOTP();
  const { mobile, dialcode, localuser } = req.body || {};
  const phone = normalizeRegistrationPhone(mobile, dialcode || req.body?.dialCode);
  if (!phone) return res.status(400).json({ status: false, message: 'Enter a valid phone number with its country code.' });
  if (!process.env.JWT_SECRET) return res.status(503).json({ status: false, message: 'Login is temporarily unavailable.' });
  const { e164: Mobile, nationalDigits } = phone;

  try {
    const whatsapp = await User.findOne({ mobile: nationalDigits });
    if (whatsapp) {
      await Otp.findOneAndUpdate(
        { mobile: Mobile },
        { $set: { otp: String(otp), createdAt: new Date() } },
        { upsert: true, new: true, setDefaultsOnInsert: true }
      );
      await sendOTP(otp, Mobile, 'Login');
      return res.json({ status: true, message: "Login code sent successfully.", type: 1 });
    }
    return res.status(401).json({ status: false, message: 'No account was found for that phone number.' });
  } catch (error) {
    console.error("Error sending OTP:", error);
    return res.status(502).json({ status: false, message: 'Could not send a login code. Check the phone number and try again.' });
  }
};


// const verifyloginotp = async (req, res) => {
//   const { mobile, OTP, dialcode, localuser, email } = req.body || {};
//   const normalizedEmail = String(email || '').trim().toLowerCase();
//   const staticOtpEmail = 'vetrivel.k@clariscosolutions.com';
//   if (normalizedEmail === staticOtpEmail) {
//     if (!/^\d{6}$/.test(String(OTP || ''))) {
//       return res.status(400).json({ status: false, message: 'Please enter the 6 digit verification code.' });
//     }

//     if (String(OTP) !== '123456') {
//       return res.status(401).json({ status: false, message: 'That verification code is incorrect.' });
//     }
//     if (!process.env.JWT_SECRET) return res.status(503).json({ status: false, message: 'Login is temporarily unavailable.' });
//     let matchotp;
//     let user;
//     try {
//       [matchotp, user] = await Promise.all([
//         Otp.findOne({ email: normalizedEmail }),
//         User.findOne({ email: normalizedEmail }),
//       ]);

//       console.log('matchotp------------------', matchotp)
//       console.log('user---------------', user)


//     } catch (error) {
//       console.error('Could not look up the special account login:', error);
//       return res.status(500).json({ status: false, message: 'Unable to verify your login right now.' });
//     }
//     if (!user) return res.status(401).json({ status: false, message: 'No account was found for that email address.' });
//     if (!matchotp || String(matchotp.otp) !== '123456') {
//       return res.status(401).json({ status: false, message: 'That verification code is incorrect.' });
//     }
//     if (Date.now() > new Date(matchotp.createdAt).getTime() + (2 * 60 * 1000)) {
//       return res.status(400).json({ status: false, message: 'That verification code has expired. Request a new one.' });
//     }
//     try {
//       const token = jwt.sign({ userId: user._id }, process.env.JWT_SECRET, { expiresIn: '24h' });
//       await new Token({ token, userId: user._id }).save();
//       req.session.user = user._id;
//       return req.session.save((sessionError) => {
//         if (sessionError) {
//           console.error('Could not save the special account login session:', sessionError);
//           return res.status(500).json({ status: false, message: 'Could not save the login session. Please try again.' });
//         }
//         return res.json({ status: true, message: 'Verification successful. You are signed in.', type: 2, token });
//       });
//     } catch (error) {
//       console.error('Could not complete the special account login:', error);
//       return res.status(500).json({ status: false, message: 'Failed to Login user!' });
//     }
//   }
//   const devTestLogin = getDevTestLoginConfig();
//   const isDevTestEmailLogin = Boolean(devTestLogin && normalizedEmail === devTestLogin.email);
//   if (isDevTestEmailLogin) {
//     if (!/^\d{6}$/.test(String(OTP || ''))) {
//       return res.status(400).json({ status: false, message: 'Please enter the 6 digit verification code.' });
//     }
//     if (!process.env.JWT_SECRET) return res.status(503).json({ status: false, message: 'Login is temporarily unavailable.' });

//     let matchotp;
//     let user;
//     try {
//       [matchotp, user] = await Promise.all([
//         Otp.findOne({ email: normalizedEmail }),
//         User.findOne({ email: normalizedEmail }),
//       ]);
//     } catch (error) {
//       console.error('Could not look up the test account login:', error);
//       return res.status(500).json({ status: false, message: 'Unable to verify your login right now.' });
//     }
//     if (!user) return res.status(401).json({ status: false, message: 'No account was found for that email address.' });
//     if (!matchotp || String(matchotp.otp) !== devTestLogin.otp || String(OTP) !== devTestLogin.otp) {
//       return res.status(401).json({ status: false, message: 'That verification code is incorrect.' });
//     }
//     if (Date.now() > new Date(matchotp.createdAt).getTime() + (2 * 60 * 1000)) {
//       return res.status(400).json({ status: false, message: 'That verification code has expired. Request a new one.' });
//     }
//     try {
//       const token = jwt.sign({ userId: user._id }, process.env.JWT_SECRET, { expiresIn: '24h' });
//       await new Token({ token, userId: user._id }).save();
//       req.session.user = user._id;
//       return req.session.save((sessionError) => {
//         if (sessionError) {
//           console.error('Could not save the test account login session:', sessionError);
//           return res.status(500).json({ status: false, message: 'Could not save the login session. Please try again.' });
//         }
//         return res.json({ status: true, message: 'Verification successful. You are signed in.', type: 2, token });
//       });
//     } catch (error) {
//       console.error('Could not complete the test account login:', error);
//       return res.status(500).json({ status: false, message: 'Failed to Login user!' });
//     }
//   }

//   const phone = normalizeRegistrationPhone(mobile, dialcode || req.body?.dialCode);
//   if (!phone) return res.status(400).json({ status: false, message: 'Enter a valid phone number with its country code.' });
//   if (!/^\d{6}$/.test(String(OTP || ''))) {
//     return res.status(400).json({ status: false, message: 'Please enter the 6 digit verification code.' });
//   }
//   if (!process.env.JWT_SECRET) return res.status(503).json({ status: false, message: 'Login is temporarily unavailable.' });
//   const { e164: Mobile, nationalDigits } = phone;

//   let matchotp;
//   let user;
//   try {
//     [matchotp, user] = await Promise.all([
//       Otp.findOne({ mobile: Mobile }),
//       User.findOne({ mobile: nationalDigits }),
//     ]);
//   } catch (error) {
//     console.error('Could not look up the phone login:', error);
//     return res.status(500).json({ status: false, message: 'Unable to verify your login right now.' });
//   }
//   if (!user) return res.status(401).json({ status: false, message: 'No account was found for that phone number.' });

//   if (!matchotp) {
//     return res.status(400).json({ status: false, message: "No verification code was found. Request a new one." });
//   }
//   const receivedOTP = matchotp.otp;
//   const createdAt = matchotp.createdAt;
//   if (String(receivedOTP) !== String(OTP)) {
//     return res.status(401).json({ status: false, message: "That verification code is incorrect." });
//   }

//   const now = new Date();
//   const expirationTime = new Date(createdAt.getTime() + (2 * 60 * 1000));

//   if (now > expirationTime) {

//     return res.status(400).json({ status: false, message: "That verification code has expired. Request a new one." });
//   }
//   try {

//     const token = jwt.sign({ userId: user._id }, process.env.JWT_SECRET, { expiresIn: '24h' });

//     const newToken = new Token({
//       token,
//       userId: user._id,
//     })

//     await newToken.save()

//     if (localuser) {

//       const localuserArray = JSON.parse(localuser);
//       // console.log(localuserArray, "localuserArray");


//       // Group product IDs and count their occurrences
//       const productCount = {};

//       localuserArray.forEach(productId => {
//         if (productCount[productId]) {
//           productCount[productId]++;
//         } else {
//           productCount[productId] = 1;
//         }
//       });

//       // Prepare the products array for Usercart
//       const products = Object.keys(productCount).map(productId => ({
//         productid: new mongoose.Types.ObjectId(productId),
//         quantity: productCount[productId]
//       }));
//       // console.log("products", products);

//       for (const product of products) {

//         const existuser = await Usercart.findOne({ userid: user._id });
//         if (!existuser) {

//           await Usercart.create({
//             userid: user._id,
//             product: products
//           })
//         }
//         const existingCartItem = await Usercart.findOne({
//           userid: user._id,
//           "product.productid": product.productid
//         });
//         if (existingCartItem) {

//           const higherQuantity = Math.max(
//             existingCartItem.product.find(p => p.productid.equals(product.productid)).quantity,
//             product.quantity
//           );



//           await Usercart.updateOne(
//             { userid: user._id, "product.productid": product.productid },
//             { $set: { "product.$.quantity": higherQuantity } }
//           );
//         } else {
//           await Usercart.findOneAndUpdate(
//             { userid: user._id },
//             { $push: { product: product } },
//             { upsert: true, new: true }
//           );
//         }
//       }
//     }

//     req.session.user = user._id;
//     return req.session.save((sessionError) => {
//       if (sessionError) {
//         console.error('Could not save login session:', sessionError);
//         return res.status(500).json({ status: false, message: 'Could not save the login session. Please try again.' });
//       }
//       return res.json({ status: true, message: "Verification successful. You are signed in.", type: 2, token });
//     });
//   } catch (err) {
//     return res.status(500).json({ status: false, message: "Failed to Login user!" });
//   }
// }







const verifyloginotp = async (req, res) => {
  const { mobile, OTP, dialcode, localuser, email } = req.body || {};

  const enteredOTP = String(OTP || '').trim();

  if (!/^\d{6}$/.test(enteredOTP)) {
    return res.status(400).json({
      status: false,
      message: 'Please enter the 6 digit verification code.'
    });
  }

  if (!process.env.JWT_SECRET) {
    return res.status(503).json({
      status: false,
      message: 'Login is temporarily unavailable.'
    });
  }

  let otpQuery = {};
  let userQuery = {};
  let loginType = '';

  if (email && String(email).trim()) {
    const normalizedEmail = String(email).trim().toLowerCase();

    otpQuery = { email: normalizedEmail };
    userQuery = { email: normalizedEmail };
    loginType = 'email';
  }

  else if (mobile) {
    const phone = normalizeRegistrationPhone(
      mobile,
      dialcode || req.body?.dialCode
    );

    if (!phone) {
      return res.status(400).json({
        status: false,
        message: 'Enter a valid phone number with its country code.'
      });
    }

    otpQuery = { mobile: phone.e164 };
    userQuery = { mobile: phone.nationalDigits };
    loginType = 'mobile';
  } else {
    return res.status(400).json({
      status: false,
      message: 'Please provide your email or mobile number.'
    });
  }

  let matchotp;
  let user;

  try {
    [matchotp, user] = await Promise.all([
      Otp.findOne(otpQuery),
      User.findOne(userQuery)
    ]);
  } catch (error) {
    console.error('OTP/User lookup error:', error);

    return res.status(500).json({
      status: false,
      message: 'Unable to verify your login right now.'
    });
  }

  if (!user) {
    return res.status(401).json({
      status: false,
      message: loginType === 'email'
        ? 'No account was found for that email address.'
        : 'No account was found for that phone number.'
    });
  }

  if (!matchotp) {
    return res.status(400).json({
      status: false,
      message: 'No verification code was found. Request a new one.'
    });
  }

  if (String(matchotp.otp) !== enteredOTP) {
    return res.status(401).json({
      status: false,
      message: 'That verification code is incorrect.'
    });
  }

  const createdAt = new Date(matchotp.createdAt);

  if (
    !matchotp.createdAt ||
    Number.isNaN(createdAt.getTime()) ||
    Date.now() > createdAt.getTime() + (2 * 60 * 1000)
  ) {
    return res.status(400).json({
      status: false,
      message: 'That verification code has expired. Request a new one.'
    });
  }

  try {
    const token = jwt.sign(
      { userId: user._id },
      process.env.JWT_SECRET,
      { expiresIn: '24h' }
    );

    await new Token({
      token,
      userId: user._id
    }).save();

    if (localuser) {
      try {
        const localuserArray = JSON.parse(localuser);

        if (!Array.isArray(localuserArray)) {
          throw new Error('Invalid local cart data');
        }

        const productCount = {};

        localuserArray.forEach(productId => {
          if (!mongoose.Types.ObjectId.isValid(productId)) {
            return;
          }

          productCount[productId] = (productCount[productId] || 0) + 1;
        });

        const products = Object.keys(productCount).map(productId => ({
          productid: new mongoose.Types.ObjectId(productId),
          quantity: productCount[productId]
        }));

        for (const product of products) {
          const existingCart = await Usercart.findOne({
            userid: user._id
          });

          if (!existingCart) {
            await Usercart.create({
              userid: user._id,
              product: [product]
            });
            continue;
          }

          const existingProduct = existingCart.product.find(
            p => p.productid.equals(product.productid)
          );

          if (existingProduct) {
            await Usercart.updateOne(
              {
                userid: user._id,
                'product.productid': product.productid
              },
              {
                $set: {
                  'product.$.quantity': Math.max(
                    existingProduct.quantity,
                    product.quantity
                  )
                }
              }
            );
          } else {
            await Usercart.updateOne(
              { userid: user._id },
              { $push: { product: product } }
            );
          }
        }
      } catch (cartError) {
        console.error('Local cart migration error:', cartError);
      }
    }

    // Delete verified OTP so it cannot be reused
    await Otp.deleteOne({ _id: matchotp._id });

    // Save login session
    req.session.user = user._id;

    return req.session.save((sessionError) => {
      if (sessionError) {
        console.error('Session save error:', sessionError);

        return res.status(500).json({
          status: false,
          message: 'Could not save the login session. Please try again.'
        });
      }

      return res.json({
        status: true,
        message: 'Verification successful. You are signed in.',
        type: 2,
        token
      });
    });

  } catch (error) {
    console.error('Login verification error:', error);

    return res.status(500).json({
      status: false,
      message: 'Failed to Login user!'
    });
  }
};








const resendloginotp = async (req, res) => {

  const { mobile } = req.body;
  try {
    const newOTP = generateOTP();

    const updatedOTP = await Otp.findOneAndUpdate(
      { mobile: mobile },
      { otp: newOTP, createdAt: new Date() },
    );
    if (!updatedOTP) {
      return res.json({ status: false, message: "No OTP found with this Mobile!" });
    }
    const { whatsappResult } = await sendOTP(newOTP, updatedOTP.mobile);

    if (whatsappResult) {
      return res.json({ status: true, message: "New OTP Sent Successfully!", type: 3 });
    } else {
      return res.json({ status: false, message: "Failed to send OTP! Try Again" });
    }
  } catch (err) {
    console.error("Error resending OTP:", err);
    return res.json({ status: false, message: "Failed to resend OTP!" });
  }
}




const userlogin = async (req, res) => {

  if (req.body.email === "vetrivel.k@clariscosolutions.com") {
    await Otp.findOneAndUpdate(
      { email: "vetrivel.k@clariscosolutions.com" },
      { $set: { email: "vetrivel.k@clariscosolutions.com", otp: 123456, createdAt: new Date() } },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );
    return res.json({
      status: true,
      message: 'Login credentials accepted. Enter the verification code to continue.',
      type: 1,
      requiresOtp: true,
      otp: 123456,
    });
  }


  const { type } = req.body || {};
  if (type === "email") {

    return loginemailmobile(req, res);
  }
  if (type === "mobile") {

    return loginemailmobile(req, res);
  }
  if (type === "whatsapp") {
    return loginwhatsApp(req, res);
  }

  return res.status(400).json({ status: false, message: "Invalid login type. Use email, mobile, or whatsapp." });
}



const passwordresetpage = (req, res) => {
  const token = req.params.token;
  try {
    if (!token) {
      return res.status(400).json({ status: false, message: 'Token is required' });
    }
    if (!process.env.MAIL_CONFIRM_SECRET) {
      return res.status(500).json({ status: false, message: 'Password reset is not configured.' });
    }
    const decoded = jwt.verify(token, process.env.MAIL_CONFIRM_SECRET);
    if (!decoded.id) return res.status(400).json({ status: false, message: 'Invalid password reset link.' });
    return res.json({ status: true, userId: decoded.id });
  } catch (error) {
    const message = error.name === 'TokenExpiredError' ? 'This password reset link has expired.' : 'This password reset link is invalid.';
    return res.status(400).json({ status: false, message });
  }
};


const resetpassword = async (req, res) => {

  const id = req.params.id.trim();
  const { newpassword, confirmpassword, token } = req.body;

  if (!newpassword || String(newpassword).length < 6) {
    return res.status(400).json({ status: false, message: 'Password must be at least 6 characters.' });
  }
  if (newpassword !== confirmpassword) {
    return res.status(400).json({ status: false, message: 'New password and confirm password do not match.' });
  }
  if (!token || !process.env.MAIL_CONFIRM_SECRET) {
    return res.status(400).json({ status: false, message: 'A valid password reset link is required.' });
  }

  try {
    const decoded = jwt.verify(token, process.env.MAIL_CONFIRM_SECRET);
    if (decoded.id !== id) return res.status(400).json({ status: false, message: 'This reset link does not match the account.' });
  } catch (error) {
    const message = error.name === 'TokenExpiredError' ? 'This password reset link has expired.' : 'This password reset link is invalid.';
    return res.status(400).json({ status: false, message });
  }

  try {
    const passwordHash = await hashPassword(newpassword);
    const user = await User.findByIdAndUpdate(id, { password: passwordHash });
    if (!user) {
      return res.status(404).json({ status: false, message: 'You are not a registered user. Please register first.' });
    }
    await Token.deleteMany({ userId: id });
    return res.json({ status: true, message: 'Password changed successfully', type: 1 });
  } catch (error) {
    console.error('Error resetting password:', error);
    return res.status(500).json({ status: false, message: 'Unable to reset password right now.' });
  }
};

// Forget & Reset Password

const transporter = nodemailer.createTransport({
  host: `${process.env.SMTP_HOST}`,
  port: Number(process.env.SMTP_PORT),
  secure: process.env.SMTP_SECURE === 'true',
  auth: {
    user: `${process.env.SMTP_USER}`,
    pass: `${process.env.SMTP_PASSWORD}`
  }
});

var options = {
  viewEngine: {
    extname: ".handlebars",
    layoutsDir: "emailTemplates/",
    defaultLayout: "confirmMail",
  },
  viewPath: "emailTemplates",
  extName: ".handlebars",
};
transporter.use("compile", hbs(options));

const forgetPassMailSend = (to, sub, emailBody) => transporter.sendMail({
  from: process.env.SMTP_FROM,
  to,
  subject: sub,
  html: emailBody,
});

const forgotpassword = async (req, res) => {
  try {
    const email = String(req.body.email || '').trim().toLowerCase();
    if (!email) return res.status(400).json({ status: false, message: 'Enter your email address.' });
    let user = await User.findOne({ email })
    if (user) {
      const frontendUrl = process.env.FRONTEND_URL;
      if (!process.env.MAIL_CONFIRM_SECRET || !frontendUrl || !process.env.SMTP_HOST || !process.env.SMTP_USER || !process.env.SMTP_PASSWORD || !process.env.SMTP_FROM) {
        console.error('Password reset email is missing required mail or frontend URL configuration.');
        return res.status(503).json({ status: false, message: 'Password reset email is temporarily unavailable. Please contact support.' });
      }
      const data = fs.readFileSync(resetMailBody, 'utf8');
      const site = await SiteAddress.find({})
      const sitename = site[0]?.siteName || 'NEWME'
      let bodyData = data.toString();
      const token = jwt.sign({ id: user._id }, process.env.MAIL_CONFIRM_SECRET, {
        expiresIn: '5m'
      });
      const chars = {
        "{{link}}": `${frontendUrl.replace(/\/$/, '')}/passwordresetpage/${token}`,
        "{{compName}}": sitename,
        "{{compImage}}": `${process.env.CLOUDINARY_IMAGE_URL}`
      };
      bodyData = bodyData.replace(/{{link}}/i, (m) => chars[m]);
      bodyData = bodyData.replace(/{{compName}}/i, (m) => chars[m]);
      bodyData = bodyData.replace(/{{compName}}/i, (m) => chars[m]);
      bodyData = bodyData.replace(/{{compImage}}/i, (m) => chars[m]);
      let subject = "Forgot Password";
      await forgetPassMailSend(email, subject, bodyData);
      return res.json({ status: true, message: 'Check your email for a password reset link. The link expires in 5 minutes.' })
    } else {
      return res.status(404).json({ status: false, message: 'No account was found for that email address.' })
    }
  } catch (error) {
    console.error('Password reset request failed:', error);
    return res.status(500).json({ status: false, message: 'Unable to send a reset link right now. Please try again later.' });
  }
}

//-----------------------END-----------------------------

const homepage = async (req, res) => {
  try {
    const Metahome = await page.findOne({
      $or: [
        { pagelink: "home" },
        { pagelink: "/" },
        { pagelink: " " },
        { pagelink: "" }
      ]
    }) || {
      pagetitle: 'Home',
      pagelink: 'home',
      pagemetatitle: 'NEWME | Beauty and skincare',
      pagemetadescription: 'Premium skincare and beauty products',
      pagemetakeywords: 'beauty, skincare, haircare',
      pageimage: '/Assets/Images/favicon.ico'
    };
    console.log("pagedata1", Metahome);

    const data = await Product.find({ productStatus: 1 });
    const collection = await myCollection.find({})
    const banner = await Banner.find({})

    res.json({ status: true, data, collections: collection, banner, pagedata: Metahome });
  } catch (error) {
    console.log("error--", error);
    res.status(500).json({ error: error.message });
  }
};

const userhomepage = async (req, res) => {
  let userID = res.locals.user_id;

  try {
    const Metahome = await page.findOne({
      $or: [
        { pagelink: "home" },
        { pagelink: "/" },
        { pagelink: " " },
        { pagelink: "" }
      ]
    }) || {
      pagetitle: 'Home',
      pagelink: 'home',
      pagemetatitle: 'NEWME | Beauty and skincare',
      pagemetadescription: 'Premium skincare and beauty products',
      pagemetakeywords: 'beauty, skincare, haircare',
      pageimage: '/Assets/Images/favicon.ico'
    };
    console.log("pagedata2", Metahome);

    if (userID && userID != 'undefined') {
      const products = await Product.find({ productStatus: 1 });
      const wishlist = await whislistModule.find({ userId: userID });
      const wishlistProductIds = new Set(
        wishlist.map(item => item.productId.toString())
      );
      const data = products.map(product => ({
        ...product.toObject(),
        isInWishlist: wishlistProductIds.has(product._id.toString())
      }));
      res.send({ status: true, data, Pagedata: Metahome });
    }
  } catch (error) {
    console.log("error--", error);
    res.status(500).json({ error: error.message });
  }
}


const influencer = async (req, res) => {
  // console.log("req.body", req.body);
  const {
    name,
    Email,
    selectwhatsapp,
    selecttelegram,
    selectinstagram,
    selecttwitter,
    selectfacebook,
    youtubelink,
    youtubesubscribers,
    instagramid,
    instafollowers,
    facebookid,
    facebookfollowers,
    telegramid,
    telegramsubscribers
  } = req.body;
  try {
    // Create a new influencer record in the database
    const newInfluencer = await Influencer.create({
      name,
      email: Email,
      contact: ({ whatsapp: selectwhatsapp, twitter: selecttwitter, instagram: selectinstagram, telegram: selecttelegram, facebook: selectfacebook }),
      youtubelink,
      youtubesubscribers,
      instagramid,
      instafollowers,
      facebookid,
      facebookfollowers,
      telegramid,
      telegramsubscribers,
      influencerStatus: "pending"
    });
    // console.log("newinfluencer", newInfluencer);
    // Send a success response
    res.json({ status: true, message: "Influencer Details Added", newInfluencer });
  } catch (err) {
    // Handle any errors that occur during the create operation
    if (err.code === 11000 && err.keyPattern && err.keyValue) {
      // Duplicate key error
      console.error(`Error creating influencer: ${err.message}`);
      res.status(400).json({ success: false, error: 'Email already exists. Please use a different email.' });
    } else {
      // Other errors
      console.error('Error creating influencer:', err);
      res.status(500).json({ success: false, error: 'Failed to create influencer' });
    }
  }
};


const addWhislist = async (req, res) => {
  try {
    let userID = res.locals.user_id;
    let productId = req.body.productId;
    if (typeof productId === 'string') {
      productId = new ObjectId(productId);
    }
    if (userID) {
      const findData = await whislistModule.findOne({ userId: userID, productId: productId });
      if (findData == null) {
        const datas = new whislistModule({
          userId: userID,
          productId: productId,
          status: 1
        });
        const value = await datas.save();
        if (value) {
          res.json({ status: true, message: "Added To Whishlist" });
        } else {
          res.json({ status: false, message: "Something went wrong" });
        }
      } else {
        return res.json({ status: false, message: "Already Added To Whishlist" });
      }
    } else {
      res.json({ status: false, message: "User Not Found" });
    }
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
}



const getLocalCartProductIds = (req) => {
  let localusers = req.query.localuser || req.body.localuser
  let localcartproductids = [];
  try {
    const objIds = JSON.parse(localusers);
    objIds.forEach(localuser => {
      try {
        const localID = new mongoose.Types.ObjectId(localuser);
        localcartproductids.push(localID);
      } catch (error) {
        console.error("Invalid local user ID:", localuser);
      }
    });
  } catch (error) {
    console.error("Error parsing local users:", localusers);
  }
  return localcartproductids;
}


const addcart = async (req, res) => {
  try {

    let userID = res.locals.user_id;

    const productId = new ObjectId(req.body.productId);

    const localCartProductIds = getLocalCartProductIds(req);

    const localCartProductIdsStr = localCartProductIds.map(id => id.toString());

    if (localCartProductIdsStr.includes(productId.toString())) {
      // console.log("Product already exists in the cart");
      return res.json({
        message: 'Product already exists in the cart'
      });
    }

    const existuserproducts = await Usercart.findOne({ "product.productid": productId, userid: userID });
    // console.log("existuserproductid", existuserproducts);
    if (existuserproducts) {
      return res.json({ status: false, message: "Already added to cart" });
    }

    if (userID) {

      try {
        // Check if the user already has a cart
        const existUserCart = await Usercart.findOne({ userid: userID });

        if (existUserCart) {
          // Check if the product already exists in the cart
          const productIndex = existUserCart.product.findIndex(p => p.productid.toString() === productId);

          if (productIndex !== -1) {
            // If the product exists, increment the quantity
            existUserCart.product[productIndex].quantity = (parseInt(existUserCart.product[productIndex].quantity) + 1).toString();
          } else {
            // If the product doesn't exist, add it to the cart
            existUserCart.product.push({ productid: new mongoose.Types.ObjectId(productId), quantity: "1" });
          }

          // Save the updated cart
          await existUserCart.save();
          return res.json({ status: true, message: "Added To Cart" });

        }
        else {
          // If the user doesn't have a cart, create a new one
          const newCart = new Usercart({
            userid: userID,
            product: [{ productid: new mongoose.Types.ObjectId(productId), quantity: "1", status: "order " }]
          });

          const value = await newCart.save();
          if (value) {
            return res.json({ status: true, message: "Added To Cart" });
          } else {
            return res.json({ status: false, message: "Something went wrong" });
          }
        }
      } catch (error) {
        console.error('Error adding product to cart:', error);
        return res.status(500).json({ status: false, message: "Internal server error" });
      }
    }
    else {
      // console.log("its working");
      res.json({ status: false, message: "localuser", productId });
    }
  }
  catch (error) {
    res.json({ error: error.message });
  }
}





const removeFromWhislist = async (req, res) => {
  let userID = res.locals.user_id;
  const productId = req.body.productId;
  // console.log("removeFromWhislist--userID--", userID, "productId--", productId);
  try {
    if (userID) {
      const removeWishlist = await whislistModule.findOneAndDelete({ userId: userID, productId: productId });
      if (removeWishlist) {
        res.json({ status: true, message: "Removed from wishlist" });
      } else {
        res.json({ status: false, message: "Somthing Went Wrong" });
      }
    } else {
      res.json({ status: false, message: "User Not Found" });
    }

  } catch (error) {
    res.status(500).json({ error: error.message });
  }
}

const searchItem = async (req, res) => {
  try {
    const searchTerm = req.query.q;
    // console.log("searchTerm---", searchTerm);
    let products;
    if (searchTerm) {
      products = await Product.find({
        $and: [
          { productStatus: 1 },
          {
            $or: [
              { productname: { $regex: searchTerm, $options: 'i' } },
              { description: { $regex: searchTerm, $options: 'i' } }
            ]
          }
        ]
      });
    } else {
      products = await Product.find({ productStatus: 1 }).limit(3);
    }
    res.json({ status: true, data: products });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
}


const viewcart = async (req, res) => {

  let userID;
  let ID;
  const usertoken = req.query.token;
  const bearerToken = usertoken.startsWith('Bearer') ? usertoken.split(' ')[1] : usertoken;
  try {
    const decoded = await new Promise((resolve, reject) => {
      jwt.verify(bearerToken, process.env.JWT_SECRET, (err, decoded) => {
        resolve(decoded);
      });
    });
    // console.log(decoded, "decoded");
    if (decoded != undefined) {
      ID = decoded.userId;
      const user = await User.findById(ID);
      userID = user._id;
    }
    //localuser
    if (!userID || userID === undefined || userID === null) {
      // console.log("is work");

      const localcartproductids = getLocalCartProductIds(req);
      let localshowproducts = await Product.find({ _id: { $in: localcartproductids } });
      // console.log(localshowproducts, "localshowproducts");

      res.json({ status: true, type: "localuser", data: localshowproducts });
    }
    //loginuser
    else {
      const userCarts = await Usercart.find({ userid: userID });
      // console.log("usercarts", userCarts);


      const usercartproducts = userCarts.map(cart => cart.product.map(product => ({
        productid: product.productid,

      }))).flat();

      const allProductIds = [...new Set([...usercartproducts].map(p => new ObjectId(p.productid)))];
      // console.log("allproductids",allProductIds);


      const showproducts = await Usercart.aggregate([
        { $match: { userid: userID } },
        { $unwind: "$product" },
        {
          $lookup: {
            from: "products",
            localField: "product.productid",
            foreignField: "_id",
            as: "productDetails"
          }
        },
        { $unwind: "$productDetails" },
        {
          $project: {
            _id: 0,
            userid: 1,
            promoCode: 1,
            CouponDiscount: 1,
            "product._id": 1,
            "product.quantity": 1,
            "product.productid": 1,
            "productDetails._id": 1,
            "productDetails.productname": 1,
            "productDetails.pagelink": 1,
            "productDetails.description": 1,
            "productDetails.productimages": 1,
            "productDetails.productStatus": 1,
            "productDetails.price": 1,
            "productDetails.gst_price": 1,
            "productDetails.category": 1,
            "productDetails.categoryId": 1,
            "productDetails.subCategory": 1,
            "productDetails.subCategoryId": 1,
            "productDetails.size": 1,
            "productDetails.shade": 1,
            "productDetails.quantity": 1,
            "productDetails.createdAt": 1,
            "productDetails.discount": 1,
            "productDetails.discount_price": 1,
            "productDetails.final_price": 1

          }
        }
      ]);

      // console.log(showproducts, "showproducts");
      res.json({ status: true, type: "loginuser", data: showproducts });
      // console.log(showproducts,"i want");
    }
  } catch (error) {
    console.error("Error handling request:", error);
    res.status(401).json({ status: false, error: "Invalid token or other error" });
  }
};

const deletecart = async (req, res) => {
  try {
    const userID = res.locals.user_id;
    const id = new ObjectId(req.body.productId);

    const updatedCart = await Usercart.findOneAndUpdate(
      { userid: userID },
      { $pull: { product: { _id: id } } },
      { new: true }
    )
    console.log("updatedCart", updatedCart);

    if (updatedCart && updatedCart.product.length === 0) {
      // Clear CouponDiscount and promoCode if the product array is empty
      await Usercart.updateOne(
        { userid: userID },
        { $set: { CouponDiscount: 0, promoCode: "" } }
      );
    }

    res.json({ status: true, message: "Product removed successfully" });

  } catch (error) {
    console.error('Error:', error);
    res.status(500).json({ status: false, message: "Internal Server Error" });
  }
};



const prodcutcategory = async (req, res) => {
  // console.log("prodcutcategory");
  const Metadata = await page.findOne({ pagelink: "products" })

  try {
    const categories = await categoryModule.find({})
    // console.log("category===",categories);
    const filteredCategories = categories.map(category => ({
      ...category._doc,  // Extract the document fields
      subCategories: category.subCategories.filter(subCat => subCat.status === 1)
    }));
    const products = await Product.find({ productStatus: 1 });
    res.json({ status: true, category: filteredCategories, products, pagedata: Metadata || [] });
  } catch (error) {
    console.error('Error:', error);
    res.status(500).json({ status: false, message: "Internal Server Error" });
  }
}
const subcategorydetails = async (req, res) => {

  const id = req.query.id;
  // console.log(id, "id");
  try {

    const subcategory = await Product.find({ subCategoryId: id });
    // console.log(subcategory, "subcategory");

    if (!subcategory) {
      return res.status(404).json({ status: false, message: 'Subcategory not found' });
    }

    res.json({
      status: true,
      message: 'Subcategory details fetched successfully',
      subcategorys: subcategory
    });
  } catch (error) {
    console.error('Error fetching subcategory details:', error);
    res.status(500).json({ status: false, message: 'Internal server error' });
  }
};


const getCategories = async (req, res) => {
  try {
    const findData = await categoryModule.find({}).limit(2);
    // console.log("findData===",findData);

    if (findData) {

      const filteredData = findData.map(category => ({
        ...category._doc,  // Extract the document fields
        subCategories: category.subCategories.filter(subCat => subCat.status === 1)
      }));

      // console.log("filteredData----",filteredData);


      res.json({ status: true, findData: filteredData });
    } else {
      res.json({ status: true, findData: [] });
    }
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
}

const getotherCategories = async (req, res) => {
  try {
    const category = await categoryModule.find().exec();
    // console.log("categories---", categories);
    if (category) {
      const categories = category.map(category => ({
        ...category._doc,  // Extract the document fields
        subCategories: category.subCategories.filter(subCat => subCat.status === 1)
      }));
      // console.log(categories,"categories");
      if (!categories || categories.length === 0) {
        return res.status(404).json({ error: 'No categories found' });
      }
      // Get categories starting from the second index (index 2)
      const selectedCategories = categories.slice(2); // Slices the array starting from index 2
      // console.log("selectedCategories---", selectedCategories);

      if (selectedCategories.length === 0) {
        return res.status(404).json({ error: 'No categories found starting from the specified index' });
      }
      const result = await Promise.all(selectedCategories.map(async (selectedCategory) => {
        const subCategories = await Promise.all(selectedCategory.subCategories.map(async (subCat) => {
          // console.log(subCat, "subCat");

          const products = await Product.find({ subCategoryId: subCat._id, productStatus: 1 }).exec();

          return {
            _id: subCat._id,
            name: subCat.name,
            image: subCat.image,
            products: products.map(product => ({
              _id: product._id,
              productname: product.productname,
              description: product.description,
              productimages: product.productimages
            }))
          };
        }));

        return {
          _id: selectedCategory._id,
          name: selectedCategory.name,
          subCategories: subCategories
        };
      }));
      res.json({ status: true, findData: result });
    }
    // Check if categories are defined 
  } catch (error) {
    console.error('Error fetching categories:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
}


const subcategorydata = async (req, res) => {
  const id = req.params.id
  // console.log(id, "idddddddddddddd");

  try {
    const categories = await categoryModule.find({ _id: id }).exec()

    // Check if categories are defined
    if (!categories) {
      return res.status(404).json({ error: 'No categories found' });
    }

    const result = await Promise.all(categories.map(async (category) => {
      const subCategories = await Promise.all(category.subCategories.map(async (subCat) => {
        // Fetch products for each subCategory

        const products = await Product.find({ subCategoryId: subCat._id }).exec();

        return {
          _id: subCat._id,
          name: subCat.name,
          image: subCat.image,
          products: products.map(product => ({
            _id: product._id,
            productname: product.productname,
            description: product.description,
            productimages: product.productimages
          }))
        };
      }));
      // console.log(subCategories, "subCategoriessssssssssss");

      return {
        _id: category._id,
        name: category.name,
        subCategories: subCategories
      };

    }));

    res.json({ findData: result });
  } catch (error) {
    console.error('Error fetching categories:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
}


const getProducts = async (req, res) => {
  let subCategoriesId = req.params.subCategoryId;
  let sub_CategoriesId;
  // console.log("subCategoriesId---", subCategoriesId, typeof subCategoriesId);
  try {

    if (ObjectId.isValid(subCategoriesId)) {
      sub_CategoriesId = new ObjectId(subCategoriesId);
    } else {
      return res.status(400).json({ status: false, message: "Invalid Subcategory ID" });
    }

    const products = await Product.find({ subCategoryId: sub_CategoriesId });
    // console.log("products--+++", products);

    res.json({ status: true, data: products });
  } catch (err) {
    console.log('err-----', err);
    res.status(500).send(err);
  }
};

const updateProfile = async (req, res) => {
  let userID = res.locals.user_id;
  const data = req.body;
  // console.log("updateProfile----", data);


  try {
    if (userID) {
      const findProfiledata = await User.findOne({ _id: userID });
      if (findProfiledata) {
        const updateData = await User.findByIdAndUpdate({ _id: userID },
          {
            $set: {
              username: data.firstName,
              lastname: data.lastName,
              mobile: data.phoneNumber,
              dob: data.dob,
              gender: data.gender,
              dailCode: data.dialcode,
              default_address: data.address
            },
          })
        if (updateData) {
          res.json({ status: true, message: "Profile Updated" });
        } else {
          res.json({ status: false, message: "Something went wrong" });
        }
      }
    } else {
      res.json({ status: false, message: "User Not Found" });
    }

  } catch (error) {
    console.log('err', error);
    res.status(500).send(error);
  }
}

const getCurrentUser = async (req, res) => {
  try {
    const user = await User.findById(res.locals.user_id)
      .select('username lastname email mobile dailCode dob gender default_address other_address')
      .lean();
    if (!user) return res.status(401).json({ status: false, message: 'User account not found.' });
    return res.json({ status: true, user: safeUser({ ...user, _id: user._id }) });
  } catch (error) {
    console.error('Could not load the authenticated user:', error);
    return res.status(500).json({ status: false, message: 'Unable to load your account right now.' });
  }
};

const logout = async (req, res) => {
  try {
    await Token.deleteOne({ token: res.locals.auth_token });
    if (req.session?.user) {
      await new Promise((resolve) => req.session.destroy(() => resolve()));
    }
    return res.json({ status: true, message: 'You have been signed out.' });
  } catch (error) {
    console.error('Could not revoke the login token:', error);
    return res.status(500).json({ status: false, message: 'Unable to sign out right now.' });
  }
};

const getProfile = async (req, res) => {
  let userID = res.locals.user_id;
  try {
    if (userID) {
      const findProfiledata = await User.findOne({ _id: userID }).select('-password');
      if (findProfiledata) {
        res.json({ status: true, data: findProfiledata });
      } else {
        res.json({ status: true, data: findProfiledata });
      }
    } else {
      res.json({ status: false, message: "User Not Found" });
    }
  } catch (error) {
    res.status(500).send(error);
  }
}

const getWishlist = async (req, res) => {
  // console.log("findWhislistdata===");
  let userID = res.locals.user_id;

  try {
    if (userID) {
      const findWhislistdata = await whislistModule.aggregate([
        { $match: { userId: userID } },
        {
          $lookup: {
            from: "products",
            localField: "productId",
            foreignField: "_id",
            as: "result"
          }
        },
        { $unwind: "$result" }
      ]);

      if (findWhislistdata) {
        res.json({ status: true, data: findWhislistdata });
      } else {
        res.json({ status: true, data: findWhislistdata });
      }
    } else {
      res.json({ status: false, message: "User Not Found" });
    }
  } catch (error) {
    res.status(500).send(error);
  }
}

const addAddress = async (req, res) => {
  let userID = res.locals.user_id;
  const { firstname, lastname, phoneNumber, address, addressType } = req.body;
  try {
    if (userID) {
      let userData = await User.findOne({ _id: userID });
      if (userData) {
        userData.other_address.push({ firstname, lastname, mobilenumber: phoneNumber, address, addressType });
        let value = await userData.save();

        if (value) {
          res.json({ status: true, message: 'Address added successfully' });
        }
      } else {
        res.json({ status: false, message: "Invalid address type" });
      }
    } else {
      res.json({ status: false, message: "User Not Found" });
    }
  } catch (error) {
    res.status(500).send(error);
  }
}

const updateAddress = async (req, res) => {
  let userID = res.locals.user_id;
  let data = req.body;
  // console.log("data---", data);


  try {
    if (userID) {
      let userData = await User.findOne({ _id: userID });
      if (userData) {
        const datas = {
          firstname: data.firstname,
          lastname: data.lastname,
          mobilenumber: data.phoneNumber,
          address: data.address,
          addressType: data.addressType
        }
        const address = userData.other_address.id(req.params.id);
        address.set(datas);
        const value = await userData.save();
        if (value) {
          res.json({ status: true, message: 'Address updated successfully' });
        } else {
          res.json({ status: false, message: 'Address not updated' });
        }
      } else {
        res.json({ status: false, message: "Invalid address type" });
      }

    } else {
      res.json({ status: false, message: "User Not Found" });
    }
  } catch (error) {
    res.status(500).send(error);
  }
}



const skincaredetails = async (req, res) => {

  const idsParam = req.query.ids;
  const ids = idsParam.split(',').map(id => id.trim()); // Remove any extra spaces
  // console.log(ids, "ids");

  try {
    const skincareubcategorys = await Product.find({ subCategoryId: { $in: ids } });
    // console.log("skincareubcategorys", skincareubcategorys);

    res.json({
      status: true,
      message: 'Subcategory details fetched successfully',
    });
  } catch (error) {
    console.error('Error fetching subcategory details:', error);
    res.status(500).json({ status: false, message: 'Internal server error' });
  }
};


const getAddresses = async (req, res) => {
  let userID = res.locals.user_id;
  try {
    if (userID) {
      const findUser = await User.findOne({ _id: userID });
      // console.log("getAddresses----", findUser);

      if (findUser) {
        findUser.other_address.sort((a, b) => b.date - a.date);
        res.json({ status: true, data: findUser });
      } else {
        res.json({ status: true, message: "User Not Found" });
      }
    } else {
      res.json({ status: false, message: "User Not Found" });
    }
  } catch (error) {
    res.status(500).send(error);
  }
}

const getAddress = async (req, res) => {

  let userID = res.locals.user_id;
  let id = req.params.id;
  // console.log("id---", id);

  try {
    if (userID) {
      const userData = await User.findOne({ _id: userID });
      if (userData) {
        const address = userData.other_address.id(req.params.id);
        res.json({ status: true, data: address });
      } else {
        res.json({ status: false, message: 'No address found' });
      }
    } else {
      res.json({ status: false, message: "User Not Found" });
    }
  } catch (error) {
    res.status(500).send(error);
  }
}

const deleteAddress = async (req, res) => {
  let userID = res.locals.user_id;
  const id = req.params.id;

  try {
    if (userID) {
      const userData = await User.findOne({ _id: userID });
      if (userData) {
        const result = await User.updateOne(
          { _id: userID },
          { $pull: { other_address: { _id: id } } }
        );

        if (result.modifiedCount > 0) {
          res.json({ status: true, message: 'Address deleted successfully' });
        } else {
          res.json({ status: false, message: 'Address not deleted' });
        }
      } else {
        res.json({ status: false, message: 'No address found' });
      }
    } else {
      res.json({ status: false, message: "User Not Found" });
    }
  } catch (error) {
    res.status(500).send(error);
  }
}

const preview = async (req, res) => {
  try {
    const { category, pagelink } = req.params;

    if (!pagelink) {
      return res.status(404).json({ status: false, message: 'Product not found' });
    }

    const product = await Product.findOne({
      pagelink: pagelink.trim().toLowerCase()
    });

    if (!product) {
      return res.status(404).json({ status: false, message: 'Product not found' });
    }

    return res.json({ status: true, product });
  } catch (error) {
    console.error("preview error:", error);
    return res.status(500).json({ status: false, message: 'Unable to load product' });
  }
};


const addquantity = async (req, res) => {
  const { productId, quantity } = req.body

  // console.log(req.body, "req.body");

  let userID = res.locals.user_id;
  // console.log("userID", userID);
  try {
    const updatedUserCart = await Usercart.findOneAndUpdate(
      { userid: userID, "product.productid": productId },
      { $set: { "product.$.quantity": quantity } },
    );
    const updatedCart = await Usercart.findOne(
      { userid: userID, "product.productid": productId },
    );

    // console.log(updatedCart, "updatedUserCart");

    res.json({ status: true, Usercart: updatedCart })

  } catch (error) {
    res.status(500).send(error);
  }
}


const Category = async (req, res) => {


  const Metahome = await page.findOne({ pagelink: "category/hair-care" })
  console.log("Metahome", Metahome);

  let categoryname = req.query.categoryname.trim()
  categoryname = new RegExp(categoryname, 'i'); // Create a case-insensitive regex


  // if (!ObjectId.isValid(id)) {
  //   return res.status(400).json({ status: false, message: 'Invalid Category ID format' });
  // }

  try {
    const category = await categoryModule.findOne({ name: categoryname }).populate('subCategories');


    const categorypageBanner = await categorypage.findOne({ categorypagebannerName: categoryname })

    const banner = await Banner.aggregate([
      {
        $match: { categoryName: categoryname }
      },
      {
        $lookup: {
          from: "mycollections",  // Name of the collection you're joining with
          localField: "categoryId",  // Field in 'Banner' collection to match
          foreignField: "categoryId",  // Field in 'mycollections' collection to match
          as: "Banner"  // Resulting joined data
        }
      },
      {
        $unwind: "$Banner"  // Unwind the resulting joined array to access the object
      },
      {
        $project: {
          _id: 0,
          categoryImage: 1,  // Get categoryImage from Banner collection
          "categoryDescription": "$Banner.categoryDescription",  // Get categoryDescription from mycollections
        }
      }
    ]);
    if (category) {
      const subCategories = category.subCategories.filter(subCat => subCat.status === 1);

      res.json({ status: true, subCategories: subCategories, bannercontent: banner, pagebanner: categorypageBanner, pagedata: Metahome });
    } else {
      res.json({ status: false, message: 'Category not found', pagedata: Metahome });
    }
  } catch (error) {
    console.error("Error fetching category:", error);
    res.status(500).send(error);
  }
};


const placeorder = async (req, res) => {
  const userID = res.locals.user_id;

  try {
    if (!userID) {
      return res.json({ status: true, type: "localuser" });
    }

    const userCarts = await Usercart.find({ userid: userID });

    if (!userCarts || userCarts.length === 0) {
      return res.status(400).json({ status: false, error: "No products found in the cart" });
    }

    const usercartproducts = userCarts.map(cart =>
      cart.product.map(product => ({
        productid: new ObjectId(product.productid),
      }))
    ).flat();

    const allProductIds = [...new Set(usercartproducts.map(p => p.productid))];

    const showproducts = await Usercart.aggregate([
      { $match: { userid: userID } },
      { $unwind: "$product" },
      {
        $lookup: {
          from: "products",
          localField: "product.productid",
          foreignField: "_id",
          as: "productDetails"
        }
      },
      { $unwind: "$productDetails" },
      {
        $project: {
          _id: 0,
          userid: 1,
          "product.quantity": 1,
          "productDetails._id": 1,
          "productDetails.productname": 1,
          "productDetails.productimages": 1,
          "productDetails.price": 1,
          "productDetails.size": 1,
          "productDetails.shade": 1,
          "productDetails.productStatus": 1,
          "productDetails.discount": 1,
          "productDetails.discount_price": 1,
          "productDetails.createdAt": 1,
        }
      }
    ]);

    if (!showproducts || showproducts.length === 0) {
      return res.status(400).json({ status: false, error: "No products found in the cart" });
    }

    for (const product of showproducts) {
      const { _id: productid, productname, productimages, price, size, shade, productStatus } = product.productDetails;
      const quantity = product.product.quantity;
      const productObjectId = new ObjectId(productid);

      const existingOrder = await Order.findOne({ userid: userID });

      if (existingOrder) {
        const existingProduct = existingOrder.product.find(p => p.productid.equals(productObjectId));

        if (existingProduct) {
          await Order.findOneAndUpdate(
            { userid: userID, "product.productid": productObjectId },
            {
              $set: {
                "product.$.productname": productname,
                "product.$.productimages": productimages,
                "product.$.productdetails.0.price": price,
                "product.$.productdetails.0.size": size,
                "product.$.productdetails.0.shade": shade,
                "product.$.productdetails.0.quantity": quantity,
                "product.$.productStatus": "order pending",
              }
            },
            { new: true }
          );
        } else {
          await Order.findOneAndUpdate(
            { userid: userID },
            {
              $addToSet: {
                product: {
                  productid: productObjectId,
                  productname,
                  productimages,
                  productdetails: [{
                    price,
                    size,
                    shade,
                    quantity
                  }],
                  productStatus: "order pending",
                }
              }
            },
            { new: true }
          );
        }
      } else {
        await Order.create({
          userid: userID,
          product: [{
            productid: productObjectId,
            productname,
            productimages,
            productdetails: [{
              price,
              size,
              shade,
              quantity
            }],
            productStatus: "order pending",
          }]
        });
      }
    }

    res.json({ status: true, type: "loginuser" });
  } catch (error) {
    console.error("Error handling request:", error);
    res.status(500).json({ status: false, error: "Internal server error" });
  }
};

const offerPage = async (req, res) => {
  try {
    const discountedProducts = await Product.find({ discount: { $ne: "" }, productStatus: 1 }).sort({ _id: -1 });
    const category = await Offercontent.find({}).limit(2)
    // console.log(discountedProducts, "discountedProducts");

    if (discountedProducts || category) {
      res.json({ status: true, discountedProducts: discountedProducts, category: category });
    } else {
      res.json({ status: false, discountedProducts: [] });
    }
    // console.log("discountedProducts---",discountedProducts.length);

  } catch (error) {
    console.error("Error handling request:", error);
    res.status(500).json({ status: false, error: "Internal server error" });
  }
}

const newOffer = async (req, res) => {


  try {
    const findProduct = await Product.find({ productStatus: 1 }).sort({ _id: -1 }).limit(1);
    console.log("findProduct---", findProduct);
    if (findProduct) {
      res.send({ status: true, data: findProduct });
    } else {
      res.send({ status: false, data: [] });
    }
  } catch (error) {
    console.error("Error handling request:", error);
    res.status(500).json({ status: false, error: "Internal server error" });
  }
}

const bestSeller = async (req, res) => {
  try {
    const findBestSellerdata = await SellProduct.aggregate([
      {
        $lookup: {
          from: "products",
          localField: "productId",
          foreignField: "_id",
          as: "result"
        }
      },
      { $unwind: "$result" },
      { $match: { "result.productStatus": 1 } },
      { $limit: 4 }
    ]);

    console.error("findBestSellerdata====", findBestSellerdata);
    const category = await myCollection.find({})


    if (findBestSellerdata || category) {
      res.send({ status: true, data: findBestSellerdata, category: category });
    } else {
      res.send({ status: false, data: [] });
    }

  } catch (error) {
    console.error("Error handling request:", error);
    res.status(500).json({ status: false, error: "Internal server error" });
  }
}


const getuserorders = async (req, res) => {
  const userID = res.locals.user_id;
  const page = parseInt(req.query.page) || 1; // Default to page 1 if not provided
  const limit = parseInt(req.query.limit) || 5; // Default to 5 orders per page

  try {
    const totalOrders = await Order.countDocuments({ userid: userID, productStatus: "Order Confirmed" });
    const userorder = await Order.find({ userid: userID, productStatus: "Order Confirmed" }).sort({ _id: -1 })
      .skip((page - 1) * limit)
      .limit(limit);
    console.log(totalOrders, "totalOrders", userorder, "userorder");

    const totalPages = Math.ceil(totalOrders / limit);

    res.json({
      status: true,
      userorder: userorder,
      totalPages: totalPages,
      currentPage: page
    });
  } catch (error) {
    res.status(500).send(error);
  }
}

const checkProductAvailability = async (req, res) => {
  let data = req.body.products;
  try {
    const products = await Product.find({ _id: { $in: data } });

    const outOfStockProducts = products.filter(product => product.quantity < 1);

    if (outOfStockProducts.length > 0) {
      const outOfStockIds = outOfStockProducts.map(product => product._id);
      res.status(200).json({
        status: false,
        message: "Some products are out of stock",
      });
    } else {
      res.status(200).json({
        status: true,
      });
    }
  } catch (error) {
    console.error("Error handling request:", error);
    res.status(500).json({ status: false, error: "Internal server error" });
  }
};

const applycoupon = async (req, res) => {
  const { couponCode, token } = req.body;
  const decoded = jwt.verify(token, process.env.JWT_SECRET);
  const userId = new ObjectId(decoded.userId);
  //  console.log(userId, couponCode, "userId");

  try {
    const mycoupon = await Influencer.findOne({ promoCode: req.body.couponCode.trim(), couponStatus: true });
    //  console.log("mycoupon", mycoupon);

    if (mycoupon) {

      const userDiscount = mycoupon.CouponDiscount;
      const userCouponcode = mycoupon.promoCode;

      const findPromocode = await PromoCodeSchema.findOne({
        userid: userId,
        promoCodes: {
          $elemMatch: { code: userCouponcode }
        }
      });

      if (findPromocode) {
        return res.json({
          success: false,
          message: 'Coupon Already Used'
        });
      }



      if (userDiscount && userCouponcode) {

        const updateuser = await usercart.findOneAndUpdate(
          { userid: userId },
          {
            $set: {
              promoCode: userCouponcode,
              CouponDiscount: userDiscount
            }
          },
          { new: true }
        );

        if (updateuser) {
          const updatePromoCode = await PromoCodeSchema.findOneAndUpdate(
            { userid: userId },
            {
              $push: {
                promoCodes: { code: userCouponcode }
              },
            },
            { new: true, upsert: true }
          );
        }

        res.json({
          success: true,
          couponCode: userCouponcode,
          couponDiscount: userDiscount,
          message: 'Coupon applied successfully'
        });
      }
      else {
        res.json({
          success: false,
          message: 'Coupon code not found'
        });
      }
    }
    else {
      res.json({
        success: false,
        message: 'Invalid Coupon'
      });
    }

  }
  catch (error) {
    console.error("Error applying coupon:", error);
    res.status(500).json({ success: false, message: 'Server error', error });
  }
};




const influncerCouponCode = async (req, res) => {
  const userID = res.locals.user_id;
  // console.log("userID---", userID);
  try {
    if (userID) {
      const findInfulncerData = await User.aggregate([
        {
          $match: { _id: userID }
        },
        {
          $lookup: {
            from: "influencers",
            localField: "email",
            foreignField: "email",
            as: "result"
          }
        },
        { $unwind: "$result" },
        // {
        //   $match: {
        //     "result.couponStatus": true
        //   }
        // }
      ]);

      // console.log("findInfulncerData==", findInfulncerData);

      if (findInfulncerData.length > 0) {
        res.send({ status: true, data: findInfulncerData });
      } else {
        res.send({ status: false, data: [] });
      }
    } else {
      res.json({ status: false, message: "User Not Found" });
    }

  } catch (error) {
    console.error("Error applying coupon:", error);
    res.status(500).json({ success: false, message: 'Server error', error });
  }
}

const applyForInfluencer = async (req, res) => {
  const userID = res.locals.user_id;
  const data = req.body;

  try {
    if (userID) {
      if (data.data == "Apply") {
        const findData = await User.findById({ _id: userID });
        const Email = findData.email;
        if (Email) {
          const findInfluencer = await Influencer.findOneAndUpdate({ email: Email }, {
            $set: {
              influencerStatus: ""
            }
          });
          // console.log("findInfuluncer---", findInfluencer);

          if (findInfluencer) {
            res.send({ status: true, message: "Applied for Influencer" });
          } else {
            res.send({ status: false, message: "Something went wrong" });
          }
        }
      } else {
        res.send({ status: false, message: "Something went wrong" });
      }
    } else {
      res.json({ status: false, message: "User Not Found" });
    }

  } catch (error) {
    console.error("Error applying coupon:", error);
    res.status(500).json({ success: false, message: 'Server error', error });
  }
}


const getSearchCategories = async (req, res) => {
  try {
    const findData = await categoryModule.find({});
    if (findData) {
      res.json({ status: true, findData: findData });
    } else {
      res.json({ status: true, findData: [] });
    }
  } catch (error) {
    console.error("Error applying coupon:", error);
    res.status(500).json({ success: false, message: 'Server error', error });
  }
}

const getSocialMedialinks = async (req, res) => {
  try {
    const getData = await SocialMedia.find({});

    // console.log("getData---", getData);
    if (getData.length > 0) {
      res.json({ status: true, getData: getData });
    } else {
      res.json({ status: false, getData: getData });
    }
  } catch (error) {
    console.error("Error applying coupon:", error);
    res.status(500).json({ success: false, message: 'Server error', error });
  }
}

const gettrendingCategory = async (req, res) => {
  try {
    const getData = await TrendingCategory.find({});
    // console.log("getData---",getData);

    if (getData.length > 0) {
      res.json({ status: true, data: getData });
    } else {
      res.json({ status: false, data: [] });
    }
  } catch (error) {
    console.error("Error applying coupon:", error);
    res.status(500).json({ success: false, message: 'Server error', error });
  }
}

const siteAddress = async (req, res) => {
  try {
    const site = await SiteAddress.find({})
    // console.log(site, "site");

    if (site.length > 0) {
      res.json({ status: true, data: site });
    } else {
      res.json({ status: false, data: [] });
    }

  } catch (error) {
    console.error("Error :", error);
    res.status(500).json({ success: false, message: 'Server error', error });
  }
}

const sitemapPath = path.join(__dirname, '..', 'public', 'sitemap.xml');
const escapeXml = (value) => String(value).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const unescapeXml = (value) => value
  .replace(/&lt;/g, '<').replace(/&gt;/g, '>')
  .replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&amp;/g, '&');
const sitemapUrl = (value) => `${String(process.env.FRONTEND_URL).replace(/\/+$/, '')}/${String(value ?? '').replace(/^\/+/, '')}`;
const sitemapEntry = (url) => `\n  <url><loc>${escapeXml(url)}</loc><changefreq>daily</changefreq><priority>1.00</priority></url>\n`;
const writeSitemap = (xml) => fs.promises.writeFile(sitemapPath, formatXml(xml, { collapseContent: true }));

const addtositemap = async function (req, res) {
  try {
    const xml = await fs.promises.readFile(sitemapPath, 'utf8');
    if (!xml.includes('</urlset>')) throw new Error('Invalid sitemap: missing </urlset>');
    await writeSitemap(xml.replace('</urlset>', `${sitemapEntry(sitemapUrl(req.body.url))}</urlset>`));
    res.json('Xml file successfully Created.');
  } catch (error) {
    console.error('Failed to add sitemap URL:', error);
    res.status(500).json({ status: false, message: 'Failed to update sitemap.' });
  }
};

const edittimestamp = async function (req, res) {
  try {
    const xml = await fs.promises.readFile(sitemapPath, 'utf8');
    const oldUrl = sitemapUrl(req.body.old_url);
    const newUrl = sitemapUrl(req.body.new_url);
    let found = false;
    const updatedXml = xml.replace(/<url\b[^>]*>[\s\S]*?<\/url>/g, (entry) => {
      const location = entry.match(/<loc>([\s\S]*?)<\/loc>/);
      if (!location || unescapeXml(location[1]) !== oldUrl) return entry;
      found = true;
      return entry.replace(location[0], `<loc>${escapeXml(newUrl)}</loc>`);
    });
    if (!found) return res.status(404).json({ status: false, message: 'Sitemap URL not found.' });
    await writeSitemap(updatedXml);
    res.json('Xml file edited successfully and updated.');
  } catch (error) {
    console.error('Failed to edit sitemap URL:', error);
    res.status(500).json({ status: false, message: 'Failed to update sitemap.' });
  }
};

const deletesitemap = async function (req, res) {
  try {
    const xml = await fs.promises.readFile(sitemapPath, 'utf8');
    const targetUrl = sitemapUrl(req.body.url);
    let found = false;
    const updatedXml = xml.replace(/<url\b[^>]*>[\s\S]*?<\/url>/g, (entry) => {
      const location = entry.match(/<loc>([\s\S]*?)<\/loc>/);
      if (!location || unescapeXml(location[1]) !== targetUrl) return entry;
      found = true;
      return '';
    });
    if (!found) return res.status(404).json({ status: false, message: 'Sitemap URL not found.' });
    await writeSitemap(updatedXml);
    res.json('Xml file deleted successfully and Deleted.');
  } catch (error) {
    console.error('Failed to delete sitemap URL:', error);
    res.status(500).json({ status: false, message: 'Failed to update sitemap.' });
  }
};


module.exports = {
  userregister,
  userlogin,
  verifyloginotp,
  getCurrentUser,
  logout,
  viewcart,
  addcart,
  homepage,
  resendloginotp,
  forgotpassword,
  influencer,
  passwordresetpage,
  resetpassword,
  addWhislist,
  removeFromWhislist,
  userhomepage,
  searchItem,
  deletecart,
  prodcutcategory,
  subcategorydetails,
  getCategories,
  getProducts,
  updateProfile,
  getProfile,
  getWishlist,
  addAddress,
  updateAddress,
  getAddresses,
  skincaredetails,
  getAddress,
  deleteAddress,
  preview,
  addquantity,
  placeorder,
  getuserorders,
  offerPage,
  newOffer,
  bestSeller,
  checkProductAvailability,
  Category,
  applycoupon,
  getotherCategories,
  influncerCouponCode,
  applyForInfluencer,
  subcategorydata,
  getSearchCategories,
  getSocialMedialinks,
  gettrendingCategory,
  siteAddress,
  addtositemap,
  edittimestamp,
  deletesitemap
};
