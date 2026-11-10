const mongoose = require('mongoose');
const adminUser = require('../models/adminModule');
const blogModule = require('../models/Blog');
const faqModule = require('../models/faq');
const categoriesModule = require('../models/categories');
const axios = require('axios');
const jwt = require("jsonwebtoken");
const { hashPassword, verifyPassword } = require('../utils/password');
const path = require('path');
const fs = require('node:fs');
const nodemailer = require("nodemailer");
const hbs = require("nodemailer-express-handlebars");
const resetMailBody = path.resolve(__dirname, '../EmailTemplates/mailBody/resetPassword.txt');
const Bloglist = require('../models/Blog')
const Offerbanner = require('../models/Offercontent')
const Categories = require('../models/categories')
const Userlist = require('../models/User')
const productModule = require('../models/Product');
const adminModule = require('../models/adminModule');
const InfluencerModule = require('../models/Influencer');
const Orders = require('../models/Orders')
const Sellproductmodule = require('../models/sellProduct')
const siteSetting = require('../models/siteSetting');
const FAQ = require('../models/faq')
const myCollection = require('../models/myCollections');
const { uploads } = require('../cloudinary/storage');
const SocialMedia = require('../models/socilaMedia');
const { log } = require('handlebars/runtime');
const myCollections = require('../models/myCollections');
const sanitizeHtml = require('sanitize-html');
const ObjectId = mongoose.Types.ObjectId;
const TrendingCategory = require('../models/trendingCategory');
const Usercart = require("../models/usercart");
const SiteAddress = require('../models/address');
const Banner = require("../models/Banner")
const Offercontent = require("../models/Offercontent");
const pageModule = require("../models/page")
const categorypagebanner = require("../models/categorypagebanner");
const { image } = require('pdfkit');
const adminForwardConfig = (req) => ({ headers: { Authorization: req.headers.authorization || '' } });

//Register


const create = async (req, res) => {
  try {
    const email = String(req.body.email || '').trim().toLowerCase();
    const password = req.body.password;
    const role = String(req.body.role || 'support');
    if (!email || typeof password !== 'string' || password.length < 8) {
      return res.status(400).json({ status: false, message: 'A valid email and password of at least 8 characters are required.' });
    }
    if (!['super_admin', 'catalog_manager', 'order_manager', 'support'].includes(role)) {
      return res.status(400).json({ status: false, message: 'Choose a valid admin role.' });
    }
    if (await adminUser.findOne({ email }).select('_id')) {
      return res.status(409).json({ status: false, message: 'An admin account with this email already exists.' });
    }
    const passwordHash = await hashPassword(password);
    const data = new adminUser({
      email,
      password: passwordHash,
      role,
    });
    const value = await data.save();
    return res.status(201).json({ status: true, message: 'Admin account created.', data: { id: String(value._id), email: value.email, role: value.role } });
  } catch (error) {
    console.error('Admin registration failed:', error);
    return res.status(500).json({ status: false, message: 'Admin registration failed.' });
  }
}

//   login

const login = async (req, res) => {
  try {
    const email = String(req.body.email || '').trim().toLowerCase();
    const password = req.body.password;
    if (!email || typeof password !== 'string' || !password) {
      return res.status(400).json({ status: false, message: 'Email and password are required.' });
    }
    const user = await adminUser.findOne({ email });
    if (user) {
      const passwordCheck = await verifyPassword(password, user.password, process.env.LEGACY_ADMIN_PASSWORD_ENCRYPTION_KEY);
      if (!passwordCheck.valid) {
        return res.status(401).json({ status: false, message: 'Invalid email or password.' });
      }
      if (passwordCheck.needsUpgrade) {
        user.password = await hashPassword(password);
        await user.save();
      }
      if (!process.env.JWT_ADMIN_SECRET) {
        console.error('JWT_ADMIN_SECRET is not configured.');
        return res.status(503).json({ status: false, message: 'Admin login is unavailable.' });
      }
      const token = jwt.sign({ id: user._id }, process.env.JWT_ADMIN_SECRET, {
        expiresIn: '24h',
      });
      return res.status(200).json({
        status: true,
        message: 'Login successful.',
        token,
        data: { id: String(user._id), email: user.email, role: user.role || 'super_admin' },
      });
    } else {
      return res.status(401).json({ status: false, message: 'Invalid email or password.' });
    }
  } catch (error) {
    console.error('Admin login failed:', error);
    return res.status(500).json({ status: false, message: 'Unable to log in right now.' });
  }
}

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

const forgetPassMailSend = (to, sub, emailBody) => {
  try {
    let mailOptions = {
      from: `${process.env.SMTP_FROM}`,
      to: `${to}`,
      subject: `${sub}`,
      html: `${emailBody}`,
    };
    transporter.sendMail(mailOptions, (err, info) => {
      if (err) {
        console.error("Error sending email:", err);
      } else {
        console.log('Mail sent successfully', info.response);
      }
    });
  } catch (error) {
    console.error("Error sending email:", error);
  }
}

const forgetpass = async (req, res) => {

  try {
    const email = req.body.email;
    console.log(req, "email");

    let user = await adminModule.findOne({ email: email })
    console.log(user, "user");

    if (user) {
      const site = await SiteAddress.find({})
      console.log(site, "site");

      const sitename = site[0].siteName
      const data = fs.readFileSync(resetMailBody, 'utf8');
      let bodyData = data.toString();
      const token = jwt.sign({ id: user._id }, process.env.MAIL_CONFIRM_SECRET, {
        expiresIn: '5m'
      });
      const chars = {
        "{{link}}": `${String(process.env.ADMIN_URL).replace(/\/+$/, '')}/resetpassword/${token}`,
        "{{compName}}": sitename,
        "{{compImage}}": `${process.env.CLOUDINARY_IMAGE_URL}`
      };
      bodyData = bodyData.replace(/{{link}}/i, (m) => chars[m]);
      bodyData = bodyData.replace(/{{compName}}/i, (m) => chars[m]);
      bodyData = bodyData.replace(/{{compImage}}/i, (m) => chars[m]);
      let subject = "Forgot Password";
      forgetPassMailSend(email, subject, bodyData);
      res.send({ status: true, message: "Please check your email Inbox and Link will expired in 5 mins ", usertoken: token })
    } else {
      res.send({ status: false, message: "Enter valid email address..!" })
    }
  } catch (error) {
    console.log("error:", error);
    res.send({ status: false, message: "Something went wrong..!" });
  }
}

const resetpass = async (req, res) => {
  try {
    const { token } = req.body;
    const verify = jwt.verify(token, process.env.MAIL_CONFIRM_SECRET);

    const userId = verify.id;

    const password = req.body.password;
    if (typeof password !== 'string' || password.length < 8) {
      return res.status(400).json({ status: false, message: 'Password must be at least 8 characters.' });
    }
    const passwordHash = await hashPassword(password);
    await adminModule.findByIdAndUpdate(
      {
        _id: userId,
      },
      {
        $set: {
          password: passwordHash,
        },
      }
    );
    return res.send({ status: true, message: "Password updated successfully." });
  } catch (error) {
    console.log(error.message, "error");
    res.json({ message: "Something went to be wrong" });
  }
}

// Dashboard

const blogUpdate = async (req, res) => {
  const id = res.locals.admin_id
  const datas = req.body;
  console.log('datas---', datas);

  const Image = req.file ? req.file.path : null
  console.log("image", Image);

  try {
    console.log("jeeeeeeeeeee");

    if (!id) {
      return res.send({ status: false, message: "Invalid Admin Login..." })
    }
    if (datas.id) {
      const currentBlog = await blogModule.findById(datas.id);
      console.log("currentBlog", currentBlog);

      const updateBlog = await blogModule.findByIdAndUpdate({ _id: datas.id }, {
        $set: {
          blogTitle: datas.BlogTitle,
          blogDescription: datas.BlogDescription,
          pagelink: datas.pagelink,
          pagemetatitle: datas.pagemetatitle,
          pagemetadescription: datas.pagemetadescription,
          pagemetakeywords: datas.pagemetakeywords,
          pageschema: datas.pageschema || '',
          blogImage: Image || currentBlog.blogImage,
          blogType: datas.BlogType,
          categoryId: datas.CategoryId,
          createdAt: new Date()
        }
      });
      if (updateBlog) {
        const origin = `${String(process.env.BACKEND_URL).replace(/\/+$/, '')}/`;

        axios.post(`${origin}edit-sitemap`, {
          new_url: `blog/${encodeURIComponent(datas.pagelink.toLowerCase())
            .replace(/%20/g, '-')
            }`,
          old_url: `blog/${encodeURIComponent(currentBlog.pagelink.toLowerCase())
            .replace(/%20/g, '-')
            }`
        }, adminForwardConfig(req))
        res.status(200).send({ status: true, message: "Blog Updated", data: updateBlog });
      } else {
        res.status(400).send({ status: false, message: "Blog Not Updated" });
      }
    } else {
      console.log("blog");

      const data = new blogModule({
        blogTitle: datas.BlogTitle,
        blogDescription: datas.BlogDescription,
        blogImage: Image,
        pagelink: datas.pagelink,
        pagemetatitle: datas.pagemetatitle,
        pagemetadescription: datas.pagemetadescription,
        pagemetakeywords: datas.pagemetakeywords,
        pageschema: datas.pageschema || '',
        blogType: datas.BlogType,
        categoryId: datas.CategoryId,
        createdAt: new Date()
      });
      console.log(data, "data");

      const value = await data.save();

      if (value) {
        const origin = `${String(process.env.BACKEND_URL).replace(/\/+$/, '')}/`;
        await axios.post(`${origin}add-to-sitemap`, {
          url: `blog/${encodeURIComponent(datas.pagelink.toLowerCase())
            .replace(/%20/g, '-')
            }`
        }, adminForwardConfig(req))
        res.status(200).send({ status: true, message: "Blog Added" });
      } else {
        res.status(400).send({ status: false, message: "Blog Not Added" });
      }
    }
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
}

const faqUpdate = async (req, res) => {
  const datas = req.body;
  try {
    if (datas.type == "update") {
      const updateFaq = await faqModule.findByIdAndUpdate({ _id: datas.id }, {
        $set: {
          faqTitle: datas.faqTitle,
          faqDescription: datas.faqDescription,
          status: datas.status
        }
      });
      if (updateFaq) {
        res.status(200).send({ status: true, message: "FAQ Updated" });
      } else {
        res.status(400).send({ status: false, message: "FAQ Not Updated" });
      }
    } else if (datas.type == "delete") {
      const deleteFaq = await faqModule.findByIdAndDelete({ _id: datas.id });
      if (deleteFaq) {
        res.status(200).send({ status: true, message: "Faq Deleted" });
      } else {
        res.status(400).send({ status: false, message: "Faq Not Deleted" });
      }
    } else {
      const data = new faqModule({
        faqTitle: datas.faqTitle,
        faqDescription: datas.faqDescription,
        status: 1
      });
      const value = await data.save();
      if (value) {
        res.status(200).send({ status: true, message: "FAQ Added" });
      } else {
        res.status(400).send({ status: false, message: "FAQ Not Added" });
      }
    }
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
}

const productData = async (req, res) => {
  console.log("productdata");

  const id = res.locals.admin_id;
  const datas = req.body;
  console.log(datas, "datas");

  const mediaFiles = req.files['media'];


  try {
    if (!id) {
      return res.send({ status: false, message: "Invalid Admin Login..." });
    }

    if (datas.id) {
      // Update Product
      const existingProduct = await productModule.findById(datas.id);

      if (!existingProduct) {
        return res.send({ status: false, message: "Product not found..." });
      }

      let updatedMedia = existingProduct.productimages;  // Existing media

      if (datas.imageID && mediaFiles) {
        // Parse imageID and delete the corresponding images
        const imageIdsToReplace = JSON.parse(datas.imageID);

        updatedMedia = updatedMedia.filter(image => !imageIdsToReplace.includes(image._id.toString()));

        // Now replace the deleted ones with the new media files
        const newMediaFiles = mediaFiles.slice(0, imageIdsToReplace.length).map(file => ({ media: file.path }));

        updatedMedia = updatedMedia.concat(newMediaFiles);

        // If there are remaining new media files (beyond the ones replacing the existing ones), add them
        const remainingMediaFiles = mediaFiles.slice(imageIdsToReplace.length);
        if (remainingMediaFiles.length > 0) {
          const extraMediaFiles = remainingMediaFiles.map(file => ({ media: file.path }));
          updatedMedia = updatedMedia.concat(extraMediaFiles);
        }

      } else if (mediaFiles) {
        // If no specific images to replace, add the new media files
        const newMediaFiles = mediaFiles.map(file => ({ media: file.path }));
        updatedMedia = updatedMedia.concat(newMediaFiles);
      } else if (datas.imageID) {
        // If there are imageIDs but no media files, delete the corresponding images
        const imageIdsToDelete = JSON.parse(datas.imageID);
        updatedMedia = updatedMedia.filter(image => !imageIdsToDelete.includes(image._id.toString()));
      }

      // Update the product with the new or updated media files
      const updateData = await productModule.findByIdAndUpdate(
        { _id: datas.id },
        {
          $set: {
            productname: datas.productname,
            description: datas.description,
            pagelink: datas.pagelink,
            pagemetatitle: datas.pagemetatitle,
            pagemetadescription: datas.pagemetadescription,
            pagemetakeywords: datas.pagemetakeywords,
            pageschema: datas.pageschema || '',
            productimages: updatedMedia,  // Set the updated media
            price: datas.price,
            gst_price: datas.gst_price,
            category: datas.category,
            categoryId: datas.categoryId,
            subCategory: datas.subCategory,
            subCategoryId: datas.subCategoryId,
            shade: datas.shade,
            quantity: datas.quantity,
            discount: datas.discount,
            discount_price: datas.discount_price,
            final_price: datas.finalprice,
            size: datas.size,
          }
        },
        { new: true }
      );
      console.log("existingProduct", existingProduct, "updateData", updateData);


      if (updateData) {

        const origin = `${String(process.env.BACKEND_URL).replace(/\/+$/, '')}/`;

        axios.post(`${origin}edit-sitemap`, {
          new_url: `product/${encodeURIComponent(datas.category.toLowerCase())
            .replace(/%20/g, '-')
            }/${encodeURIComponent(datas.pagelink.toLowerCase())
              .replace(/%20/g, '-')
            }`,
          old_url: `product/${encodeURIComponent(existingProduct.category.toLowerCase())
            .replace(/%20/g, '-')
            }/${encodeURIComponent(existingProduct.pagelink.toLowerCase())
              .replace(/%20/g, '-')
            }`
        }, adminForwardConfig(req))
        // await axios.post(`${origin}add-to-sitemap`, {
        //   url: `product/${encodeURIComponent(datas.category.toLowerCase())
        //     .replace(/%20/g, '-')
        //     }/${encodeURIComponent(datas.pagelink.toLowerCase())
        //       .replace(/%20/g, '-')
        //     }`
        // })
        res.send({ status: true, message: "Product Updated..." });
      } else {
        res.send({ status: false, message: "Failed to update the Product Data..." });
      }
    }

    else {
      // Add Product
      if (!mediaFiles || mediaFiles.length === 0) {
        return res.status(400).json({ error: 'No files uploaded.' });
      }
      const mediaData = mediaFiles.map(file => ({ media: file.path }));

      const { productname, price, description, pagelink, pagemetatitle, pagemetadescription, pagemetakeywords, pageschema, category, categoryId, subCategory,
        subCategoryId, shade, quantity, discount, discount_price, finalprice, size
      } = req.body;

      const addData = await productModule.create({
        productname,
        description,
        pagelink,
        pagemetatitle,
        pagemetadescription,
        pagemetakeywords,
        pageschema,
        productimages: mediaData,
        price,
        gst_price: datas.Gstprice,
        category,
        categoryId,
        subCategory,
        subCategoryId,
        shade,
        quantity,
        discount,
        discount_price,
        final_price: finalprice && finalprice.trim() !== '' ? finalprice : datas.Gstprice,
        size,
        productStatus: 1,
        createdAt: new Date(),
      });

      if (addData) {
        const origin = `${String(process.env.BACKEND_URL).replace(/\/+$/, '')}/`;
        await axios.post(`${origin}add-to-sitemap`, {
          url: `product/${encodeURIComponent(category.toLowerCase())
            .replace(/%20/g, '-')
            }/${encodeURIComponent(pagelink.toLowerCase())
              .replace(/%20/g, '-')
            }`
        }, adminForwardConfig(req))
        res.status(200).json({ status: true, message: "Product Added..." });
      } else {
        res.status(200).json({ status: false, message: "Failed to Add the Product Data..." });
      }
    }
  } catch (error) {
    console.log("error---", error);
    res.send({ status: false, message: "Something Went Wrong..." });
  }
}

const productDelete = async (req, res) => {
  const id = res.locals.admin_id
  const datas = req.body
  try {
    if (!id) {
      return res.send({ status: false, message: "Invalid Admin Login..." })
    }
    const product = await productModule.findById({ _id: datas.id })

    const origin = `${String(process.env.BACKEND_URL).replace(/\/+$/, '')}/`;

    axios.post(`${origin}delete-sitemap`, {
      url: `product/${encodeURIComponent(product.category.toLowerCase())
        .replace(/%20/g, '-')
        }/${encodeURIComponent(product.pagelink.toLowerCase())
          .replace(/%20/g, '-')
        }`
    }, adminForwardConfig(req))
    await productModule.findByIdAndDelete({ _id: datas.id })
      .then(() => {


        res.send({ status: true, message: "Product Deleted..." })
      }).catch(() => {
        res.send({ status: false, message: "Unable to Delete the Product..." })
      })
  } catch (error) {
    res.send({ status: false, message: "Something Went Wrong..." })
  }
}

const addCategories = async (req, res) => {
  const id = res.locals.admin_id;
  try {
    if (!id) {
      return res.send({ status: false, message: "Invalid Admin Login..." });
    }

    const { type, name, subCategories, categoryId, subCategoryId, status } = req.body;
    const Images = req.file ? req.file.path : null;

    if (type === "add") {
      const newData = new categoriesModule({
        name: name,
        subCategories: [{ name: subCategories }],
        status: 1
      });
      const value = await newData.save();
      if (value) {
        res.status(200).send({ status: true, message: "Categories Added" });
      } else {
        res.status(400).send({ status: false, message: "Categories Not Added" });
      }
    } else if (type === "addSub") {
      const updatedCategory = await categoriesModule.findByIdAndUpdate(
        { _id: categoryId },
        { $push: { subCategories: [{ name: subCategories }] } },
        { new: true }
      );
      if (updatedCategory) {
        res.status(200).send({ status: true, message: "Subcategory Added", data: updatedCategory });
      } else {
        res.status(400).send({ status: false, message: "Category Not Found or Subcategory Not Added" });
      }
    } else if (type === "updateStatus") {
      const updatedCategory = await categoriesModule.findOneAndUpdate(
        { _id: categoryId, "subCategories._id": subCategoryId },
        { $set: { "subCategories.$.status": status } },
        { new: true }
      );
      const productData = await productModule.updateMany(
        { categoryId: categoryId, subCategoryId: subCategoryId },
        { $set: { productStatus: status } }
      );
      if (updatedCategory || productData) {
        res.status(200).send({ status: true, message: `Subcategory Status ${status == 1 ? "Enabled" : "Disabled"}` });
      } else {
        res.status(400).send({ status: false, message: "Category Not Found or Subcategory Not Updated" });
      }
    } else if (type === "addImage") {
      const categoryImage = await categoriesModule.findOneAndUpdate(
        { _id: categoryId, "subCategories._id": subCategoryId },
        { $set: { "subCategories.$.image": Images } },
        { new: true }
      );
      if (categoryImage) {
        res.status(200).send({ status: true, message: "Image Updated Successfully..." });
      } else {
        res.status(400).send({ status: false, message: "Failed to Update Image..." });
      }
    } else if (type === "deleteCategory") {
      console.log("categoryId----", categoryId);
      const categoryDelete = await categoriesModule.findByIdAndDelete({ _id: new ObjectId(categoryId) });
      const BannercategoryDelete = categoryDelete ? await Banner.findOneAndDelete({ categoryId: new ObjectId(categoryId) }) : null;
      const deleteProduct = categoryDelete ? await productModule.deleteMany({ categoryId: categoryId }) : null;
      const deleteMycollection = categoryDelete ? await myCollection.findOneAndDelete({ categoryId: categoryId }) : null;
      const deleteBlog = categoryDelete ? await Bloglist.deleteMany({ categoryId: categoryId }) : null;
      const deleteTrending = categoryDelete ? await TrendingCategory.findOneAndDelete({ categoryId: categoryId }) : null;
      const deleteofferbanner = categoryDelete ? await Offerbanner.findOneAndDelete({ categoryId: categoryId }) : null;
      if (categoryDelete) {
        res.status(200).send({ status: true, message: "Category Deleted Successfully" });
      } else {
        res.status(400).send({ status: false, message: "Category Not Found" });
      }
    } else {
      const updatedCategory = await categoriesModule.findByIdAndUpdate(
        { _id: categoryId },
        { $pull: { subCategories: { _id: subCategoryId } } },
        { new: true }
      );
      const productData = await productModule.deleteMany({
        categoryId: categoryId,
        subCategoryId: subCategoryId
      });

      const deleteTrending = await TrendingCategory.findOneAndDelete({ subCategoryId: subCategoryId });

      if (updatedCategory) {
        res.status(200).send({ status: true, message: "Subcategory Removed" });
      } else {
        res.status(400).send({ status: false, message: "Category Not Found or Subcategory Not Removed", data: updatedCategory });
      }
    }
  } catch (error) {
    console.log("error--", error);
    res.status(500).json({ error: error.message });
  }
};

const getbloglist = async (req, res) => {
  const id = res.locals.admin_id
  try {
    if (!id) {
      return res.send({ status: false, message: "Invalid Admin Login..." })
    }
    const getblog = await Bloglist.find().sort({ _id: -1 })
    if (getblog) {
      res.send({ status: true, message: "Blogdata find", data: getblog })
    }
    else {
      res.send({ status: false, message: "BlogData not found" })
    }
  } catch (error) {
    res.status(500).json({ status: false, message: "Error retrieving Blogdata" });
  }
}

const getcategories = async (req, res) => {
  const id = res.locals.admin_id
  try {
    const gst = await siteSetting.find({})
    const Gst = gst[0].tax_Rate || 0

    if (!id) {
      return res.send({ status: false, message: "Invalid Admin Login..." })
    }
    const getCategory = await Categories.find()
    if (getCategory.length > 0) {
      res.send({ status: true, message: "CategoryList find", data: getCategory, Gst: Gst })
    }
    else {
      res.send({ status: false, message: "CategoryList not found" })
    }
  } catch (error) {
    res.status(500).json({ status: false, message: "Error retrieving CategoryList" });
  }
}

//userlist
const getuserlist = async (req, res) => {
  console.log("working");

  const id = res.locals.admin_id
  try {
    if (!id) {
      return res.send({ status: false, message: "Invalid Admin Login..." })
    }
    const User = await Userlist.find().select('-password -__v').sort({ _id: -1 }).lean()
    if (User) {
      res.send({ status: true, message: "Userlist find", data: User })
    }
    else {
      res.send({ status: false, message: "Userlist not found" })
    }
  } catch (error) {
    res.status(500).json({ status: false, message: "Error retrieving Userlist" });
  }
}

//getProduct

const getProduct = async (req, res) => {
  const id = res.locals.admin_id
  try {
    if (!id) {
      return res.send({ status: false, message: "Invalid Admin Login..." })
    }
    const Product = await productModule.find().sort({ _id: -1 })
    // console.log(Product,"Product");

    if (Product) {
      res.send({ status: true, message: "ProductList find", data: Product })
    }
    else {
      res.send({ status: false, message: "ProductList not found" })
    }
  } catch (error) {
    res.status(500).json({ status: false, message: "Error retrieving ProductList" });
  }
}

const getStockProduct = async (req, res) => {
  const id = res.locals.admin_id
  try {
    if (!id) {
      return res.send({ status: false, message: "Invalid Admin Login..." })
    }
    const Product = await productModule.find().sort({ quantity: 1 })
    if (Product) {
      res.send({ status: true, message: "StockList find", data: Product })
    }
    else {
      res.send({ status: false, message: "StockList not found" })
    }
  } catch (error) {
    res.status(500).json({ status: false, message: "Error retrieving StockList" });
  }
}

const generateRandomNumber = () => {
  return Math.floor(1000 + Math.random() * 9000);
};

const updateInfluencer = async (req, res) => {
  const id = res.locals.admin_id
  const data = req.body
  const referralCode = generateRandomNumber()
  try {
    if (!id) {
      return res.send({ status: false, message: "Invalid Admin Login..." })
    }
    const influencers = await InfluencerModule.find({ _id: data.id })
    const email = influencers[0].email.split("@")[0]
    const refCode = `${email}@${referralCode}`;
    let updateData
    if (data.type == "offer") {
      if (data.value == "Approve") {
        updateData = await InfluencerModule.findByIdAndUpdate({ _id: data.id }, {
          $set: {
            influencerStatus: "Approved",
            CouponDiscount: data.discount,
            couponStatus: true,
            promoCode: refCode
          }
        })
      } else if (data.value == "Reject") {
        updateData = await InfluencerModule.findByIdAndDelete({ _id: data.id });
      }

    } else if (data.type == "status") {
      updateData = await InfluencerModule.findByIdAndUpdate({ _id: data.id }, {
        $set: {
          couponStatus: data.status
        }
      })

      if (data.status == false) {
        const updatedUserCart = await Usercart.updateMany(
          { promoCode: data.promoCode },
          { $set: { promoCode: "", CouponDiscount: 0 } }
        );
      }

    }
    if (updateData) {
      res.send({
        status: true,
        message: data.type == "status" ?
          `Coupon code ${influencers[0].couponStatus == true ? "De-Activated" : "Activated"}` :
          "Influencers Data Updated"
      })
    } else {
      res.send({ status: true, message: "Failed to Update Influencers Data...." })
    }
  } catch (error) {
    res.status(500).json({ status: false, message: "Error updating Influencer" });
  }
}

const getInfluencer = async (req, res) => {
  const id = res.locals.admin_id
  try {
    if (!id) {
      return res.send({ status: false, message: "Invalid Admin Login..." })
    }
    const influencers = await InfluencerModule.find().sort({ _id: -1 })
    if (influencers.length > 0) {
      // Clean up each influencer object
      const cleanedInfluencers = influencers.map(influencer => {
        const cleanedContact = {};
        for (const key in influencer.contact) {
          if (influencer.contact[key] && key !== '$isMongooseDocumentPrototype' && key !== '$isNew') {
            cleanedContact[key] = influencer.contact[key];
          }
        }
        return {
          ...influencer._doc,
          contact: cleanedContact
        };
      });
      res.send({ status: true, message: "Influencer find", data: cleanedInfluencers })
    }
    else {
      res.send({ status: false, message: "Influencer not found" })
    }
  } catch (error) {
    res.status(500).json({ status: false, message: "Error retrieving Influencer" });
  }
}

const getOrders = async (req, res) => {
  const id = res.locals.admin_id
  try {
    if (!id) {
      return res.send({ status: false, message: "Invalid Admin Login..." })
    }
    const Orderlist = await Orders.find({ productStatus: "Order Confirmed" }).sort({ _id: -1 })
    if (Orderlist) {
      res.send({ status: true, message: "OrderList find", data: Orderlist })
    }
    else {
      res.send({ status: false, message: "OrderList not found" })
    }
  } catch (error) {
    res.status(500).json({ status: false, message: "Error retrieving OrderList" });
  }
}


//blogdelete
const BlogdataDelete = (async (req, res) => {
  const id = res.locals.admin_id
  const blogId = req.body.blogId
  try {
    if (!id) {
      return res.send({ status: false, message: "Invalid Admin Login..." })
    }
    const value = await Bloglist.findByIdAndDelete({ _id: blogId })
    if (value) {
      const origin = `${String(process.env.BACKEND_URL).replace(/\/+$/, '')}/`;
      axios.post(`${origin}delete-sitemap`, {
        url: `blog/${encodeURIComponent(value.pagelink.toLowerCase())
          .replace(/%20/g, '-')
          }`
      }, adminForwardConfig(req))
      res.send({ status: true, message: "BlogData Deleted", value })
    }
    else {
      res.send({ status: true, message: "BlogData is Not Deleted" })
    }
  } catch (error) {
    res.status(500).json({ status: false, message: "something went wrong" });
  }
})

const Sellproduct = async (req, res) => {
  const id = res.locals.admin_id
  try {
    if (!id) {
      return res.send({ status: false, message: "Invalid Admin Login..." })
    }
    const SellproductList = await Sellproductmodule.aggregate([
      // { $match: { userid: userID } },
      {
        $lookup: {
          from: "products",
          localField: "productId",
          foreignField: "_id",
          as: "sellProductList"
        }
      },
      { $unwind: "$sellProductList" },
      {
        $project: {
          _id: 1,
          productId: 1,
          productname: 1,
          quantity: 1,
          createdAt: 1,
          "sellProductList.category": 1,
          "sellProductList.subCategory": 1,

        }
      },
      {
        $sort: {
          quantity: -1
        }
      },
    ])

    if (SellproductList) {
      res.send({ status: true, message: "SellproductList find", data: SellproductList });
    } else {
      res.send({ status: false, message: "SellproductList not found" });
    }
  } catch (error) {
    // console.error("Error handling request:", error);
    res.status(500).json({ status: false, error: "Internal server error" });
  }
}

// Quantity update
const QuantityUpdate = async (req, res) => {
  const id = res.locals.admin_id;
  const datas = req.body;
  // console.log('datas---',datas);

  try {
    if (!id) {
      return res.send({ status: false, message: "Invalid Admin Login..." })
    }
    const updateData = await productModule.findByIdAndUpdate(
      { _id: datas.id },
      {
        $inc: {
          quantity: datas.quantity,
        }
      },
      { new: true }
    );
    // console.log('updateData---',updateData);

    if (updateData) {
      res.send({ status: true, message: "Quantity Updated..." });
    } else {
      res.send({ status: false, message: "Failed to update the Quantity Data..." });
    }
  } catch (error) {
    res.status(500).json({ status: false, message: "something went wrong" });
  }

}


const addSiteSetting = async (req, res) => {
  const id = res.locals.admin_id;

  try {
    if (id) {
      const { tax_Rate, ShippingCharge, tax_Type } = req.body;

      const updatedGST = await siteSetting.findOneAndUpdate(
        { userId: id },
        {
          userId: id,
          tax_Rate: tax_Rate,
          tax_Type: tax_Type,
          ShippingCharge: ShippingCharge
        },
        { upsert: true, new: true }
      );

      let newgst = updatedGST ? Number(updatedGST.tax_Rate) / 100 : 0;
      console.log(newgst, "newgst");

      // Fetch existing data (products) from the database
      const existdata = await productModule.find({});
      console.log(existdata, "existdata");

      // Loop through each product and update its prices
      existdata.forEach(async product => {
        const price = Number(product.price)
        const discount = Number(product.discount)
        const updatedGstPrice = Math.round(price + (price * newgst));
        const updatedDiscountPrice = (updatedGstPrice * discount) / 100;
        const updatedFinalPrice = updatedGstPrice - updatedDiscountPrice;

        // Update the product in the database with new prices
        await productModule.updateOne(
          { _id: product._id },
          {
            $set: {
              gst_price: Math.round(updatedGstPrice),
              discount_price: updatedDiscountPrice,
              final_price: updatedFinalPrice,
            }
          }
        );
      });

      console.log("Products updated successfully");

      res.status(200).json({ success: true, data: updatedGST });
    } else {
      return res.send({ status: false, message: "Invalid Admin Login..." })
    }

  } catch (error) {
    console.log('error----', error);

    res.status(500).json({ success: false, message: 'Error updating siteSetting', error });
  }
};

const getSiteSetting = async (req, res) => {
  const id = res.locals.admin_id
  try {
    if (!id) {
      return res.send({ status: false, message: "Invalid Admin Login..." })
    }
    const SiteSetting = await siteSetting.find()

    if (SiteSetting.length > 0) {
      res.send({ status: true, message: "SiteSetting find", data: SiteSetting })
    }
    else {
      res.send({ status: false, message: "SiteSetting not found" })
    }
  } catch (error) {
    console.log('error--', error);

    res.status(500).json({ status: false, message: "Error retrieving SiteSetting" });
  }
}
const createCoupon = async (req, res) => {
  const { code, discount } = req.body;
  // console.log(req.body, "req.body");

  try {
    let existingCouponDoc = await coupon.findOne({});

    if (!existingCouponDoc) {
      existingCouponDoc = new coupon({
        coupons: [{ code, discount }]
      });
    } else {
      let existingCouponCode = await coupon.findOne({ "coupons.code": code });
      // console.log(existingCouponCode, "existingCouponCode");

      if (!existingCouponCode) {
        existingCouponDoc.coupons.push({ code, discount });
      } else {
        existingCouponDoc = await coupon.findOneAndUpdate(
          { "coupons.code": code },
          { $set: { "coupons.$.discount": discount } },
          { new: true }
        );
      }
    }
    await existingCouponDoc.save();
    // console.log(existingCouponDoc, "savedCouponDoc");

    res.json({ success: true, message: 'Coupon added or updated successfully', coupon: existingCouponDoc });
  } catch (error) {
    console.error("Error adding or updating coupon:", error); // Log the error
    res.status(500).json({ success: false, message: 'Server error', error });
  }
};

const createhomecontent = async (req, res) => {
  // Check if the image was uploaded
  const Images = req.file ? req.file.path : null;

  // Destructure request body
  const { categoryid, categoryname, categorydescription } = req.body;
  const sanitizedDescription = sanitizeHtml(categorydescription, {
    allowedTags: [], // No tags allowed
    allowedAttributes: {}
  });
  // console.log(sanitizedDescription, "sanitizedDescriptionsanitizedDescription");


  // Validate required fields
  if (!categoryid || !categoryname || !categorydescription) {
    return res.status(400).json({ message: 'All fields are required' });
  }

  try {
    // Check if the category already exists
    const existcategory = await myCollection.findOne({ categoryName: categoryname, categoryId: categoryid });

    if (existcategory) {
      // If the category exists, update it
      const updatedCategory = await myCollection.findOneAndUpdate(
        { categoryName: categoryname, categoryId: categoryid },
        {
          $set: {
            categoryId: categoryid,
            categoryName: categoryname,
            categoryImage: Images || existcategory.categoryImage, // Update image only if new one is uploaded
            categoryDescription: sanitizedDescription,
          }
        },
        { new: true } // Return the updated document
      );

      return res.json({ status: true, message: 'Category updated successfully', data: updatedCategory });
    }

    // If the category does not exist, create a new one
    const homecollection = await myCollection.create({
      categoryId: categoryid,
      categoryName: categoryname,
      categoryImage: Images,
      categoryDescription: sanitizedDescription
    });

    // Send a success response with the created data
    res.json({ status: true, message: 'Collection created successfully', data: homecollection });
  } catch (error) {
    // Handle errors and send a response
    console.error(error);
    res.status(500).json({ status: false, message: 'Server error', error: error.message });
  }
};


const getFaq = async (req, res) => {
  const id = res.locals.admin_id
  try {
    if (!id) {
      return res.send({ status: false, message: "Invalid Admin Login..." })
    }
    const faqContenet = await FAQ.find().sort({ _id: -1 })
    if (faqContenet) {
      res.send({ status: true, message: "FaqList find", data: faqContenet })
    }
    else {
      res.send({ status: false, message: "FaqList not found" })
    }
  } catch (error) {
    console.log('error', error);

    res.status(500).json({ status: false, message: "Error retrieving Faq" });
  }
}

const addSocialMedialinks = async (req, res) => {
  const id = res.locals.admin_id;
  const { facebook, twitter, whatsapp, instagram, } = req.body;
  //  console.log("data",facebook,twitter,whatsapp,instagram,sitename);

  try {
    if (!id) {
      return res.send({ status: false, message: "Invalid Admin Login..." })
    }

    const updateSocialMedia = await SocialMedia.findOneAndUpdate(
      { userId: id },
      {
        userId: id,
        facebook_link: facebook,
        twitter_link: twitter,
        whatsapp_link: whatsapp,
        instragram_link: instagram,
      },
      { upsert: true, new: true }
    );

    if (updateSocialMedia) {
      res.send({ status: true, message: "Data Updated" });
    } else {
      res.send({ status: false, message: "Data not Updated" });
    }

  } catch (error) {
    console.error("Unexpected error:", error);
    res.status(500).json({ success: false, message: "Internal server error", error: error.message });
  }
}
const getSocialMedialinks = async (req, res) => {
  console.log("work");

  const id = res.locals.admin_id;  // Admin ID fetched from authenticated session
  console.log(id, "id");


  try {
    if (!id) {
      return res.send({ status: false, message: "Invalid Admin Login..." });
    }

    const socialMediaData = await SocialMedia.findOne({ userId: id });


    console.log(socialMediaData, "socialMediaData");

    if (socialMediaData) {
      res.send({ status: true, data: socialMediaData });
    } else {
      res.send({ status: false, message: "No social media data found" });
    }

  } catch (error) {
    console.error("Unexpected error:", error);
    res.status(500).json({ success: false, message: "Internal server error", error: error.message });
  }
};
const siteAddress = async (req, res) => {


  try {

    const siteAddress = await SiteAddress.find({});

    console.log(siteAddress);

    if (siteAddress.length > 0) {
      res.send({ status: true, data: siteAddress });
    } else {
      res.send({ status: false, data: [] });
    }

  } catch (error) {
    console.error("Unexpected error:", error);
    res.status(500).json({ success: false, message: "Internal server error", error: error.message });
  }
};




// delivary status
const DeliveryDetails = async (req, res) => {
  const id = res.locals.admin_id;

  try {
    if (id) {
      const { _id, deliveryStatus, deliveryDate } = req.body;
      // console.log("_id--",_id);

      const updatedDelivery = await Orders.findOneAndUpdate(
        { _id: _id },
        {
          deliveryStatus: deliveryStatus,
          deliveryDate: deliveryDate

        },
        { upsert: true, new: true }
      );
      // console.log('updatedDelivery--', updatedDelivery);

      res.status(200).json({ success: true, data: updatedDelivery });
    } else {
      return res.send({ status: false, message: "Invalid Admin Login..." })
    }

  } catch (error) {
    console.log('error----', error);

    res.status(500).json({ success: false, message: 'Error updating DeliveryDetails', error });
  }
};

const gethomecontent = async (req, res) => {
  try {
    const homecontent = await myCollection.find({});  // Fetching home content from the database


    // If home content is found, send a success response
    res.send({
      status: true,
      message: "Home content successfully fetched",
      data: homecontent
    });
  } catch (error) {
    console.log('error----', error);

    // Sending a proper error response if there's a failure
    res.status(500).send({
      status: false,
      message: "Failed to fetch home content",
      error: error.message || 'Internal Server Error'
    });
  }
};
const Categorycontentedit = async (req, res) => {

  const { id } = req.params
  // console.log("id", id);

  try {
    const homecontent = await myCollection.find({});  // Fetching home content from the database    

    // If home content is found, send a success response
    res.send({
      status: true,
      message: "Home content successfully fetched",
      data: homecontent
    });
  } catch (error) {
    console.log('error----', error);

    // Sending a proper error response if there's a failure
    res.status(500).send({
      status: false,
      message: "Failed to fetch home content",
      error: error.message || 'Internal Server Error'
    });
  }
};
const Categorycontentupdate = async (req, res) => {
  try {
    const { id, categoryId, categoryName, categoryDescription, categoryImage } = req.body;
    const Images = req.file ? req.file.path : null;

    const sanitizedDescription = sanitizeHtml(categoryDescription, {
      allowedTags: [], // No tags allowed
      allowedAttributes: {}
    });

    // Find the existing record by ID
    const updateData = {
      categoryId: categoryId,
      categoryName: categoryName,
      categoryDescription: sanitizedDescription,
      categoryImage: categoryImage || Images,

    };

    // console.log(updateData, "updateData");

    // Update the record in the database
    const updatedContent = await myCollection.findByIdAndUpdate(id, updateData, { new: true });

    res.send({
      status: true,
      message: 'Content updated successfully',
      updatedContent,
    });
  } catch (error) {
    res.status(500).json({
      message: 'Error updating content',
      error: error.message,
    });
  }
};
const Categorycontentdelete = (async (req, res) => {
  const { categorycontentid } = req.body
  const id = res.locals.admin_id
  try {
    if (!id) {
      return res.send({ status: false, message: "Invalid Admin Login..." })
    }
    const value = await myCollections.findByIdAndDelete({ _id: categorycontentid })
    if (value) {
      res.send({ status: true, message: "Categorycontent Deleted", value })
    }
    else {
      res.send({ status: false, message: "Categorycontent is Not Deleted" })
    }
  } catch (error) {
    res.status(500).json({ status: false, message: "something went wrong" });
  }
})

const addTrendingcontent = async (req, res) => {
  const id = res.locals.admin_id
  const data = req.body;
  const video = req.file.path;
  let updatedTrendingCatg;

  try {
    if (!id) {
      return res.send({ status: false, message: "Invalid Admin Login..." })
    }

    if (data.id) {
      // If an ID is provided, attempt to update
      updatedTrendingCatg = await TrendingCategory.findOneAndUpdate(
        { _id: data.id },
        {
          category: data.categoryName,
          categoryId: data.categoryId,
          subCategory: data.subCategoryname,
          subCategoryId: data.subCategoryid,
          media: video
        },
        { new: true }
      );
    } else {
      updatedTrendingCatg = await TrendingCategory.create({
        category: data.categoryName,
        categoryId: data.categoryId,
        subCategory: data.subCategoryname,
        subCategoryId: data.subCategoryid,
        media: video
      });
    }

    if (updatedTrendingCatg) {
      res.send({ status: true, message: "Data Updated" });
    } else {
      res.send({ status: false, message: "Data not Updated" });
    }

  } catch (error) {
    console.log('error----', error);
    res.status(500).json({ success: false, message: 'Error updating Data' });
  }
}


const getTrendingcontent = async (req, res) => {
  const id = res.locals.admin_id
  try {
    if (!id) {
      return res.send({ status: false, message: "Invalid Admin Login..." })
    }

    const Trendingcontent = await TrendingCategory.find({});
    // console.log("Trendingcontent--", Trendingcontent.length);

    if (Trendingcontent.length > 0) {
      res.send({ status: true, message: "Data Fetched", data: Trendingcontent });
    } else {
      res.send({ status: false, message: "Data not Fetched", data: [] });
    }
  } catch (error) {
    console.log('error----', error);
    res.status(500).json({ success: false, message: 'Something Went Wrong' });
  }
};

const deletTrendingCat = async (req, res) => {
  const id = res.locals.admin_id
  const data = req.body;
  try {
    if (!id) {
      return res.send({ status: false, message: "Invalid Admin Login..." })
    }
    const deleteSubCategory = await TrendingCategory.findByIdAndDelete({ _id: data.subcategorycontentid });
    if (deleteSubCategory) {
      res.send({ status: true, message: "Data Deleted" });
    } else {
      res.send({ status: false, message: "Data Not Deleted" });
    }
  } catch (error) {
    console.log('error----', error);
    res.status(500).json({ success: false, message: 'Something Went Wrong' });
  }
}

const editTrendingcontent = async (req, res) => {

  const { id } = req.params
  // console.log("id", id);

  try {
    const Trendingcontent = await TrendingCategory.find({});
    // console.log("Trendingcontent--", Trendingcontent.length);

    if (Trendingcontent.length > 0) {
      res.send({ status: true, message: "Data Fetched", data: Trendingcontent });
    } else {
      res.send({ status: false, message: "Data not Fetched", data: [] });
    }
  } catch (error) {
    console.log('error----', error);
    res.status(500).json({ success: false, message: 'Something Went Wrong' });
  }
};




const updateTrendingcat = async (req, res) => {
  const id = res.locals.admin_id
  const data = req.body;
  const video = req.file.path;

  try {
    if (!id) {
      return res.send({ status: false, message: "Invalid Admin Login..." })
    }

    const updatedTrendCategory = await TrendingCategory.findOneAndUpdate(
      { _id: data.id },
      { $set: { media: video } }
    );

    if (updatedTrendCategory) {
      res.send({ status: true, message: "Data Updated" });
    } else {
      res.send({ status: false, message: "Data Not Updated" });
    }

  } catch (error) {
    console.log('error----', error);
    res.status(500).json({ success: false, message: 'Something Went Wrong' });
  }
}

const addAddressSetting = async (req, res) => {
  const id = res.locals.admin_id
  const data = req.body;
  console.log("data===", data);
  try {
    if (!id) {
      return res.send({ status: false, message: "Invalid Admin Login..." })
    }

    const updatedAddress = await SiteAddress.findOneAndUpdate(
      { userId: id },
      {
        userId: id,
        siteName: data.siteName,
        siteYear: data.siteYear,
        email: data.email,
        mobile: data.mobile,
        address: data.address
      },
      { upsert: true, new: true }
    );

    if (updatedAddress) {
      res.send({ status: true, message: "Data Updated" });
    } else {
      res.send({ status: false, message: "Data not Updated" });
    }

  } catch (error) {
    console.log('error----', error);
    res.status(500).json({ success: false, message: 'Something Went Wrong' });
  }
}

const getAddressSetting = async (req, res) => {
  const id = res.locals.admin_id
  try {
    if (!id) {
      return res.send({ status: false, message: "Invalid Admin Login..." })
    }

    const AddressSetting = await SiteAddress.find({});
    // console.log("Trendingcontent--", AddressSetting.length);

    if (AddressSetting.length > 0) {
      res.send({ status: true, message: "Data Fetched", data: AddressSetting });
    } else {
      res.send({ status: false, message: "Data not Fetched", data: [] });
    }
  } catch (error) {
    console.log('error----', error);
    res.status(500).json({ success: false, message: 'Something Went Wrong' });
  }
};
const addbannercontent = async (req, res) => {
  // Check if the image was uploaded
  const Images = req.file ? req.file.path : null;

  // Destructure request body
  const { categoryid, categoryname } = req.body;

  // Validate required fields
  if (!categoryid || !categoryname) {
    return res.status(400).json({ message: 'All fields are required' });
  }

  try {
    // Check if the category already exists
    const existcategory = await Banner.findOne({ categoryName: categoryname, categoryId: categoryid });

    if (existcategory) {
      // If the category exists, update it
      const updatedCategory = await Banner.findOneAndUpdate(
        { categoryName: categoryname, categoryId: categoryid },
        {
          $set: {
            categoryId: categoryid,
            categoryName: categoryname,
            categoryImage: Images || existcategory.categoryImage, // Update image only if new one is uploaded
          }
        },
        { new: true } // Return the updated document
      );

      return res.json({ status: true, message: 'Banner updated successfully', data: updatedCategory });
    }

    // If the category does not exist, create a new one
    const bannercollection = await Banner.create({
      categoryId: categoryid,
      categoryName: categoryname,
      categoryImage: Images,
    });

    // Send a success response with the created data
    res.json({ status: true, message: 'Banner created successfully', data: bannercollection });
  } catch (error) {
    // Handle errors and send a response
    console.error(error);
    res.status(500).json({ status: false, message: 'Server error', error: error.message });
  }
};
const getbannercontent = async (req, res) => {
  try {
    const Bannercontent = await Banner.find({});  // Fetching home content from the database


    // If home content is found, send a success response
    res.send({
      status: true,
      message: "Banners successfully fetched",
      data: Bannercontent
    });
  } catch (error) {
    console.log('error----', error);

    // Sending a proper error response if there's a failure
    res.status(500).send({
      status: false,
      message: "Failed to fetch Banner content",
      error: error.message || 'Internal Server Error'
    });
  }
};
const deletebannercontent = (async (req, res) => {
  const { categorycontentid } = req.body
  const id = res.locals.admin_id
  try {
    if (!id) {
      return res.send({ status: false, message: "Invalid Admin Login..." })
    }
    const value = await Banner.findByIdAndDelete({ _id: categorycontentid })
    if (value) {
      res.send({ status: true, message: "Banner Deleted", value })
    }
    else {
      res.send({ status: false, message: "Banner is Not Deleted" })
    }
  } catch (error) {
    res.status(500).json({ status: false, message: "something went wrong" });
  }
})

const editbannercontent = async (req, res) => {

  const { id } = req.params
  // console.log("id", id);

  try {
    const bannercontent = await Banner.find({});  // Fetching home content from the database    

    // If home content is found, send a success response
    res.send({
      status: true,
      message: "Banner successfully fetched",
      data: bannercontent
    });
  } catch (error) {
    console.log('error----', error);

    // Sending a proper error response if there's a failure
    res.status(500).send({
      status: false,
      message: "Failed to fetch banner content ",
      error: error.message || 'Internal Server Error'
    });
  }
};
const updatebannnercontent = async (req, res) => {

  try {
    const { id, categoryId, categoryName, categoryImage } = req.body;
    const Images = req.file ? req.file.path : null;



    // Find the existing record by ID
    const updateData = {
      categoryId: categoryId,
      categoryName: categoryName,
      categoryImage: categoryImage || Images,

    };

    // console.log(updateData, "updateData");

    // Update the record in the database
    const updatedContent = await Banner.findByIdAndUpdate(id, updateData, { new: true });

    res.send({
      status: true,
      message: 'Content updated successfully',
      updatedContent,
    });
  } catch (error) {
    res.status(500).json({
      message: 'Error updating content',
      error: error.message,
    });
  }
};

const addoffercontent = async (req, res) => {
  // Check if the image was uploaded
  const Images = req.file ? req.file.path : null;

  // Destructure request body
  const { categoryid, categoryname, categorydescription } = req.body;
  const sanitizedDescription = sanitizeHtml(categorydescription, {
    allowedTags: [], // No tags allowed
    allowedAttributes: {}
  });
  // console.log(sanitizedDescription, "sanitizedDescriptionsanitizedDescription");


  // Validate required fields
  if (!categoryid || !categoryname || !categorydescription) {
    return res.status(400).json({ message: 'All fields are required' });
  }

  try {
    // Check if the category already exists
    const existcategory = await Offercontent.findOne({ categoryName: categoryname, categoryId: categoryid });

    if (existcategory) {
      // If the category exists, update it
      const updatedCategory = await Offercontent.findOneAndUpdate(
        { categoryName: categoryname, categoryId: categoryid },
        {
          $set: {
            categoryId: categoryid,
            categoryName: categoryname,
            categoryImage: Images || existcategory.categoryImage, // Update image only if new one is uploaded
            categoryDescription: sanitizedDescription,
          }
        },
        { new: true } // Return the updated document
      );

      return res.json({ status: true, message: 'Offercontent updated successfully', data: updatedCategory });
    }

    // If the category does not exist, create a new one
    const homecollection = await Offercontent.create({
      categoryId: categoryid,
      categoryName: categoryname,
      categoryImage: Images,
      categoryDescription: sanitizedDescription
    });

    // Send a success response with the created data
    res.json({ status: true, message: 'Offercontent created successfully', data: homecollection });
  } catch (error) {
    // Handle errors and send a response
    console.error(error);
    res.status(500).json({ status: false, message: 'Server error', error: error.message });
  }
};

const addcategorypagebanner = async (req, res) => {

  // Check if the image was uploaded
  const Images = req.file ? req.file.path : null;
  // console.log("images",Images);


  // Destructure request body
  const { categorypagebannerid, categorypagebannername, categorypagebannertitle, categorypagebannerdescription, } = req.body;
  console.log(req.body, "req.body");

  const sanitizedDescription = sanitizeHtml(categorypagebannerdescription, {
    allowedTags: [], // No tags allowed
    allowedAttributes: {}
  });
  //  console.log(sanitizedDescription, "sanitizedDescriptionsanitizedDescription");


  // Validate required fields
  if (!categorypagebannerid || !categorypagebannername || !categorypagebannerdescription || !categorypagebannertitle) {
    return res.status(400).json({ message: 'All fields are required' });
  }

  try {
    console.log("works");

    // Check if the categorypagebanner already exists
    const existcategorypagebanner = await categorypagebanner.findOne({ categorypagebannerName: categorypagebannername, categorypagebannerId: categorypagebannerid });
    console.log(existcategorypagebanner, "existcategorypagebanner");


    if (existcategorypagebanner) {
      // If the categorypagebanner exists, update it
      const updatedcategorypagebanner = await categorypagebanner.findOneAndUpdate(
        { categorypagebannerName: categorypagebannername, categorypagebannerId: categorypagebannerid },
        {
          $set: {
            categorypagebannerId: categorypagebannerid,
            categorypagebannerTitle: categorypagebannertitle,
            categorypagebannerName: categorypagebannername,
            categorypagebannerImage: Images || existcategorypagebanner.categorypagebannerImage, // Update image only if new one is uploaded
            categorypagebannerDescription: sanitizedDescription,
          }
        },
        { new: true } // Return the updated document
      );
      console.log('updatedcategorypagebanner', updatedcategorypagebanner)
      return res.json({ status: true, message: 'categorypagebanner updated successfully', data: updatedcategorypagebanner });
    }

    // If the categorypagebanner does not exist, create a new one
    const homecollection = await categorypagebanner.create({
      categorypagebannerId: categorypagebannerid,
      categorypagebannerName: categorypagebannername,
      categorypagebannerTitle: categorypagebannertitle,
      categorypagebannerImage: Images,
      categorypagebannerDescription: sanitizedDescription
    });
    console.log('homecollection', homecollection)
    // Send a success response with the created data
    res.json({ status: true, message: 'categorypagebanner created successfully', data: homecollection });
  } catch (error) {
    // Handle errors and send a response
    console.error(error);
    res.status(500).json({ status: false, message: 'Server error', error: error.message });
  }
};
const getoffercontent = async (req, res) => {
  try {
    const offercontent = await Offercontent.find({});  // Fetching home content from the database


    // If home content is found, send a success response
    res.send({
      status: true,
      message: "offercontent successfully fetched",
      data: offercontent
    });
  } catch (error) {
    console.log('error----', error);

    // Sending a proper error response if there's a failure
    res.status(500).send({
      status: false,
      message: "Failed to fetch offer content",
      error: error.message || 'Internal Server Error'
    });
  }
};
const getcategorypagebanner = async (req, res) => {
  try {
    const categorypageBanner = await categorypagebanner.find({});  // Fetching home content from the database

    console.log("categorypageBanner", categorypageBanner);

    // If home content is found, send a success response
    res.send({
      status: true,
      message: "categorypagebanner successfully fetched",
      data: categorypageBanner
    });
  } catch (error) {
    console.log('error----', error);

    // Sending a proper error response if there's a failure
    res.status(500).send({
      status: false,
      message: "Failed to fetch offer content",
      error: error.message || 'Internal Server Error'
    });
  }
};
const editoffercontent = async (req, res) => {

  const { id } = req.params
  // console.log("id", id);

  try {
    const offercontent = await Offercontent.find({});  // Fetching home content from the database    

    // If home content is found, send a success response
    res.send({
      status: true,
      message: "Offercontent successfully fetched",
      data: offercontent
    });
  } catch (error) {
    console.log('error----', error);

    // Sending a proper error response if there's a failure
    res.status(500).send({
      status: false,
      message: "Failed to fetch banner content ",
      error: error.message || 'Internal Server Error'
    });
  }
};
const geteditcategorypagebanner = async (req, res) => {

  const { id } = req.params
  console.log("iddddd", id);

  try {
    const offercontent = await categorypagebanner.find({});  // Fetching home content from the database    

    // If home content is found, send a success response
    res.send({
      status: true,
      message: "Offercontent successfully fetched",
      data: offercontent
    });
  } catch (error) {
    console.log('error----', error);

    // Sending a proper error response if there's a failure
    res.status(500).send({
      status: false,
      message: "Failed to fetch banner content ",
      error: error.message || 'Internal Server Error'
    });
  }
};
const updateoffercontent = async (req, res) => {
  try {
    const { id, categoryId, categoryName, categoryDescription, categoryImage } = req.body;
    const Images = req.file ? req.file.path : null;

    const sanitizedDescription = sanitizeHtml(categoryDescription, {
      allowedTags: [], // No tags allowed
      allowedAttributes: {}
    });

    // Find the existing record by ID
    const updateData = {
      categoryId: categoryId,
      categoryName: categoryName,
      categoryDescription: sanitizedDescription,
      categoryImage: categoryImage || Images,

    };


    // console.log(updateData, "updateData");

    // Update the record in the database
    const updatedContent = await Offercontent.findByIdAndUpdate(id, updateData, { new: true });

    res.send({
      status: true,
      message: 'Offercontent updated successfully',
      updatedContent,
    });
  } catch (error) {
    res.status(500).json({
      message: 'Error Offer  content',
      error: error.message,
    });
  }
};
const updatecategorypagebanner = async (req, res) => {
  try {
    const { id, categorypagebannerId, categorypagebannerName, categorypagebannerTitle, categorypagebannerDescription, categorypagebannerImage } = req.body;
    const Images = req.file ? req.file.path : null;
    console.log(req.body, "req.bodyy");


    const sanitizedDescription = sanitizeHtml(categorypagebannerDescription, {
      allowedTags: [], // No tags allowed
      allowedAttributes: {}
    });

    // Find the existing record by ID
    const updateData = {
      categorypagebannerId: categorypagebannerId,
      categorypagebannerName: categorypagebannerName,
      categorypagebannerTitle: categorypagebannerTitle,
      categorypagebannerDescription: sanitizedDescription,
      categorypagebannerImage: categorypagebannerImage || Images,

    };
    // Update the record in the database
    const updatedContent = await categorypagebanner.findByIdAndUpdate(id, updateData, { new: true });

    res.send({
      status: true,
      message: 'categorypagebanner updated successfully',
      updatedContent,
    });
  } catch (error) {
    res.status(500).json({
      message: 'Error Offer  content',
      error: error.message,
    });
  }
};


const deleteoffercontent = (async (req, res) => {
  const { categorycontentid } = req.body
  const id = res.locals.admin_id
  console.log("id", req.body);

  try {
    if (!id) {
      return res.send({ status: false, message: "Invalid Admin Login..." })
    }
    console.log("value");

    const value = await Offercontent.findByIdAndDelete({ _id: categorycontentid })

    if (value) {
      res.send({ status: true, message: "Offercontent Deleted", value })
    }
    else {
      res.send({ status: false, message: "Offercontent is Not Deleted" })
    }
  } catch (error) {
    res.status(500).json({ status: false, message: "something went wrong" });
  }
})
const deletecategorypagebanner = (async (req, res) => {
  const { categorycontentid } = req.body
  const id = res.locals.admin_id
  console.log("id", req.body);

  try {
    if (!id) {
      return res.send({ status: false, message: "Invalid Admin Login..." })
    }
    console.log("value");

    const value = await categorypagebanner.findByIdAndDelete({ _id: categorycontentid })

    if (value) {
      res.send({ status: true, message: "Categorypagebanner Deleted", value })
    }
    else {
      res.send({ status: false, message: "Categorypagebanner is Not Deleted" })
    }
  } catch (error) {
    res.status(500).json({ status: false, message: "something went wrong" });
  }
})

const pageCreate = async (req, res) => {

  try {
    const AddPage = req.body
    console.log('AddPage', AddPage)
    const Image = req.file ? req.file.path : null
    console.log(Image, "Image");


    const existingPage = await pageModule.findOne({ pagelink: AddPage.pagelink });
    // const existingBlog = await Bloglist.findOne({ bloglink: AddPage.pagelink });
    console.log("existingPage", existingPage)

    if (existingPage) {
      return res.send({
        status: false,
        message: 'The provided URL is already registered for this Link.',
      });
    }

    else {
      const origin = `${String(process.env.BACKEND_URL).replace(/\/+$/, '')}/`;
      await axios.post(`${origin}add-to-sitemap`, {
        url: AddPage.pagelink
      }, adminForwardConfig(req))
      const newPageCreate = new pageModule({ ...AddPage, pageimage: Image })
      console.log(newPageCreate, "newPageCreate");

      const savedPage = await newPageCreate.save();
      console.log(savedPage, "savedPage");


      res.send({ status: true, message: "Page details added successfully", page: savedPage });
    }
  } catch (error) {
    console.error("Error adding blog details:", error);
    res.status(500).json({ message: "Internal server error" });
  }
};
const pageupdate = async (req, res) => {
  console.log(req.body, "req.body");

  try {
    const { id } = req.body;
    console.log("id", id);

    const PageUpdate = req.body;
    const imagePath = req.file ? req.file.path : null;

    const existingPage = await pageModule.findById(id);
    if (!existingPage) {
      return res.send({ status: false, message: "Page not found." });
    }

    const allPages = await pageModule.find();
    // const allBlogs = await Bloglist.find();

    const isPageLinkUsed = allPages.some(
      (page) => page.pagelink === PageUpdate.pagelink && page._id.toString() !== id
    );
    // const isBlogLinkUsed = allBlogs.some(
    //   (blog) => blog.bloglink === PageUpdate.pagelink
    // );

    if (isPageLinkUsed) {
      return res.send({
        status: false,
        message: "The provided URL is already registered for this Link.",
      });
    }

    if (existingPage.pagelink === PageUpdate.pagelink) {
      const updateData = {
        ...PageUpdate,
        pageimage: imagePath || existingPage.pageimage,
      };

      const updatePage = await pageModule.findByIdAndUpdate(id, updateData, {
        new: true,
      });

      // console.log('updatedPage---', updatePage)

      return res.send({
        status: true,
        message: "Page updated successfully.",
        updatePage,
      });
    }
    const origin = `${String(process.env.BACKEND_URL).replace(/\/+$/, '')}/`;
    axios.post(`${origin}edit-sitemap`, {
      new_url: PageUpdate.pagelink,
      old_url: existingPage.pagelink
    }, adminForwardConfig(req))
    const updateData = {
      ...PageUpdate,
      pageimage: imagePath || existingPage.pageimage,
    };

    const updatePage = await pageModule.findByIdAndUpdate(id, updateData, {
      new: true,
    });

    res.send({
      status: true,
      message: "Page updated successfully.",
      updatePage,
    });
  } catch (error) {
    console.error("Error updating page details:", error);
    res.status(500).json({ message: "Internal server error" });
  }
};

const pagedelete = async (req, res) => {
  const { blogId } = req.body;
  console.log('pageId-----------', blogId)
  try {
    const Pagefind = await pageModule.findById({ _id: blogId });
    const origin = `${String(process.env.BACKEND_URL).replace(/\/+$/, '')}/`;
    axios.post(`${origin}delete-sitemap`, {
      url: Pagefind.pagelink
    }, adminForwardConfig(req))
    const value = await pageModule.findByIdAndDelete({ _id: blogId })
    if (value) {
      res.send({ status: true, message: "PageData Deleted", value })
    }
    else {
      res.send({ status: true, message: "PageData is Not Deleted" })
    }
  } catch (error) {
    console.log("error", error.message);

    res.status(500).json({ status: false, message: "something went wrong" });
  }
}
const pagedetails = async (req, res) => {

  try {
    const response = await pageModule.find({}).sort({ _id: -1 });
    // console.log("pagedetails collected", response);
    res.json({ status: true, result: response });
  } catch (error) {
    console.log('error', error)
    console.error("Error while Get tabledata:", error);
    res.status(500).json({ error: "Error while Get tabledata" });
  }
};
const seperatepagedetail = async (req, res) => {
  const { pageid } = req.params;
  console.log(pageid, "pageId")

  try {
    const response = await pageModule.findById({ _id: pageid });
    res.json({ status: true, result: response });
    console.log("response", response)
  } catch (error) {
    console.error("Error while Get collectdata:", error);
    res.status(500).json({ error: "Error while Get collectdata" });
  }
}
module.exports = {
  create,
  login,
  forgetpass,
  resetpass,
  blogUpdate,
  faqUpdate,
  productData,
  productDelete,
  addCategories,
  getbloglist,
  getcategories,
  getuserlist,
  getbloglist,
  getProduct,
  updateInfluencer,
  getInfluencer,
  getOrders,
  BlogdataDelete,
  Sellproduct,
  QuantityUpdate,
  getStockProduct,
  addSiteSetting,
  getSiteSetting,
  getFaq,
  createCoupon,
  createhomecontent,
  DeliveryDetails,
  addSocialMedialinks,
  getSocialMedialinks,
  gethomecontent,
  Categorycontentedit,
  Categorycontentupdate,
  Categorycontentdelete,
  addTrendingcontent,
  getTrendingcontent,
  deletTrendingCat,
  editTrendingcontent,
  updateTrendingcat,
  addAddressSetting,
  getAddressSetting,
  addbannercontent,
  getbannercontent,
  getbannercontent,
  deletebannercontent,
  editbannercontent,
  updatebannnercontent,
  addoffercontent,
  getoffercontent,
  editoffercontent,
  updateoffercontent,
  deleteoffercontent,
  siteAddress,
  pageCreate,
  pageupdate,
  pagedelete,
  pagedetails,
  seperatepagedetail,
  addcategorypagebanner,
  getcategorypagebanner,
  updatecategorypagebanner,
  geteditcategorypagebanner,
  deletecategorypagebanner

}
