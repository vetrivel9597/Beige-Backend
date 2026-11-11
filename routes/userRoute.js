var express = require("express");
var router = express.Router();
const Userroute = require("../Controllers/UserController");
const blogModule = require("../models/Blog");
const faqModule = require('../models/faq');
const categoryModule = require('../models/categories');
const userauth = require("../Middleware/auth")
const siteSetting = require("../models/siteSetting.js")
const { uploads } = require("../cloudinary/storage");
const paymentController = require('../Controllers/payment.js');
const optionalAuth = require('../Middleware/optionalAuth');
const Product = require("../models/Product.js")
const multer = require("multer");
const  AiController = require("../Controllers/AiController.js");
const aiAnalysisController =require("../Controllers/AIAnalysisController.js")
require('../config/environment');




const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 50 * 1024 * 1024,
  },
  fileFilter: (req, file, cb) => {
    const allowedTypes = [
      "image/jpeg",
      "image/png",
      "image/webp",
      "video/mp4",
      "video/quicktime",
      "video/webm",
      "video/x-m4v",
      "video/x-msvideo",
      "video/x-matroska",
      "video/3gpp",
    ];

    const allowedExtensions = /\.(jpe?g|png|webp|mp4|mov|webm|m4v|avi|mkv|3gp)$/i;

    if (!allowedTypes.includes(file.mimetype) && !allowedExtensions.test(file.originalname || "")) {
      return cb(new Error("Upload a supported image or video file."));
    }

    cb(null, true);
  },
});

const aiMediaUpload = (req, res, next) => {
  upload.single("image")(req, res, (error) => {
    if (!error) return next();

    const message = error instanceof multer.MulterError && error.code === "LIMIT_FILE_SIZE"
      ? "Upload file must be 50 MB or smaller."
      : error.message || "Unable to receive the uploaded media.";
    return res.status(400).json({ success: false, message });
  });
};


router.get('/api/blogs', async (req, res, next) => {
  try { res.json({ status: true, blogs: await blogModule.find().sort({ createdAt: -1 }) }); }
  catch (error) { next(error); }
});
router.get('/api/blogs/:link', async (req, res, next) => {
  try {
    const title = req.params.link.replace(/-/g, ' ').trim();
    const blog = await blogModule.findOne({ pagelink: new RegExp(title, 'i') });
    if (!blog) return res.status(404).json({ status: false, message: 'Article not found' });
    res.json({ status: true, blog });
  } catch (error) { next(error); }
});
router.get('/api/home', Userroute.homepage);
router.get('/api/catalog', async (req, res, next) => {
  try {
    const [categories, products] = await Promise.all([
      categoryModule.find({}),
      Product.find({ productStatus: 1 })
    ]);
    res.json({ status: true, categories, products });
  } catch (error) { next(error); }
});
router.get('/api/checkout-settings', async (req, res, next) => {
  try {
    const settings = await siteSetting.findOne({});
    res.json({ status: true, Gst: settings?.tax_Rate || 0, Shipping: settings?.ShippingCharge || 0, razorpayKeyId: process.env.RAZORPAY_KEY_ID || '' });
  } catch (error) { next(error); }
});
router.get('/api/faqs', async (req, res, next) => {
  try { res.json({ status: true, faqs: await faqModule.find().sort({ createdAt: -1 }) }); }
  catch (error) { next(error); }
});
router.get('/api/product/:category/:pagelink', async (req, res, next) => {
  try {
    const product = await Product.findOne({ pagelink: req.params.pagelink.trim().toLowerCase() });
    if (!product) return res.status(404).json({ status: false, message: 'Product not found' });
    res.json({ status: true, product });
  } catch (error) { next(error); }
});
router.get('/api/auth/me', userauth, Userroute.getCurrentUser);
router.post('/api/auth/logout', userauth, Userroute.logout);
router.get('/api/ai/analyses', userauth, aiAnalysisController.list);
router.delete('/api/ai/analyses', userauth, aiAnalysisController.removeAll);

router.get('/', Userroute.homepage);
router.get('/Userroute', Userroute.homepage);
router.get('/login', (req, res) => res.json({ status: true }));
router.get('/register', (req, res) => res.json({ status: true }));
router.get('/blog', async (req, res, next) => {
  try { res.json({ status: true, blogs: await blogModule.find().sort({ createdAt: -1 }) }); }
  catch (error) { next(error); }
});
router.get('/blog/:link', async (req, res, next) => {
  try {
    const title = req.params.link.replace(/-/g, ' ').trim();
    const blog = await blogModule.findOne({ pagelink: new RegExp(title, 'i') });
    if (!blog) return res.status(404).json({ status: false, message: 'Article not found' });
    res.json({ status: true, blog });
  } catch (error) { next(error); }
});
router.get('/faq', async (req, res, next) => {
  try { res.json({ status: true, faqs: await faqModule.find().sort({ createdAt: -1 }) }); }
  catch (error) { next(error); }
});
router.get('/offers', Userroute.offerPage);
router.get('/products', Userroute.prodcutcategory);
router.get('/profile', userauth, Userroute.getProfile);
router.get('/my-orders', userauth, Userroute.getuserorders);
router.get('/my-wishlist', userauth, Userroute.getWishlist);
router.get('/my-address', userauth, Userroute.getAddresses);
router.get('/cart', Userroute.viewcart);
router.get('/shipping', async (req, res, next) => {
  try { const settings = await siteSetting.findOne({}); res.json({ status: true, Gst: settings?.tax_Rate || 0, Shipping: settings?.ShippingCharge || 0, razorpayKeyId: process.env.RAZORPAY_KEY_ID || '' }); }
  catch (error) { next(error); }
});
router.get('/category/:categoryname', (req, res, next) => { req.query.categoryname = req.params.categoryname.replace(/-/g, ' '); return Userroute.Category(req, res, next); });
router.get('/haircare', (req, res) => Userroute.searchItem({ query: { q: 'hair' } }, res));



router.post('/registration', Userroute.userregister)
router.post('/Login', Userroute.userlogin)
router.post('/verifyloginotp', Userroute.verifyloginotp)
router.post('/resendloginotp', Userroute.resendloginotp)
router.post('/forgotpassword', Userroute.forgotpassword)
router.get('/passwordresetpage/:token', Userroute.passwordresetpage)
router.post('/resetpassword/:id', Userroute.resetpassword)
router.post('/addinfluencer', Userroute.influencer);
router.post('/addWhislist', userauth, Userroute.addWhislist);
router.post("/addcart", userauth, Userroute.addcart);
router.post('/removeFromWishlist', userauth, Userroute.removeFromWhislist);
router.get('/search', Userroute.searchItem);
router.get('/viewcart', Userroute.viewcart);

router.post('/deletecart', userauth, Userroute.deletecart);
router.get('/productcategory', Userroute.prodcutcategory);
router.get('/subcategorydetails', Userroute.subcategorydetails);
router.get('/categories', Userroute.getCategories);
router.get('/othercategories', Userroute.getotherCategories);
router.get('/subcategorydata/:id', Userroute.subcategorydata);


router.get('/products/:subCategoryId', Userroute.getProducts);
router.post('/updateProfile', userauth, Userroute.updateProfile);
router.get('/getProfile', userauth, Userroute.getProfile);
router.get('/getWishlist', userauth, Userroute.getWishlist);
router.post('/addAddress', userauth, Userroute.addAddress);
router.put('/updateAddress/:id', userauth, Userroute.updateAddress);
router.get('/skincaredetails', Userroute.skincaredetails);
router.get('/getAddresses', userauth, Userroute.getAddresses);
router.get('/getAddress/:id', userauth, Userroute.getAddress);
router.delete('/deleteAddress/:id', userauth, Userroute.deleteAddress);
router.get('/product/:category/:pagelink', Userroute.preview);
router.post('/addquantity', userauth, Userroute.addquantity);
router.get('/Category', Userroute.Category);

router.post('/placeorder', userauth, Userroute.placeorder);
router.get('/offerPage', Userroute.offerPage);
router.get('/newOffer', Userroute.newOffer);
router.get('/bestSeller', Userroute.bestSeller);


router.post('/order', userauth, paymentController.order);
router.post('/verify-payment', userauth, paymentController.verify);

router.get('/getuserorders', userauth, Userroute.getuserorders);

router.post('/setOrderSession', (req, res) => {
  req.session.isOrderProcess = req.body.processOrder || false;
  res.json({ success: true });
});

router.post('/checkProductAvailability', Userroute.checkProductAvailability);
router.post('/applyCoupon', Userroute.applycoupon);
router.get('/influncerCouponCode', userauth, Userroute.influncerCouponCode);
router.post('/applyForInfluencer', userauth, Userroute.applyForInfluencer);
router.get('/searchCategories', Userroute.getSearchCategories);
router.get('/getSocialMedialinks', Userroute.getSocialMedialinks);
router.get('/gettrendingCategory', Userroute.gettrendingCategory);
router.get('/siteAddress', Userroute.siteAddress);
router.post('/add-to-sitemap', require('../Middleware/adminAuth'), Userroute.addtositemap);
router.post('/edit-sitemap', require('../Middleware/adminAuth'), Userroute.edittimestamp)
router.post('/delete-sitemap', require('../Middleware/adminAuth'), Userroute.deletesitemap)





router.post("/skinAnalyze", aiMediaUpload, AiController.SkinAnalyze
);


router.post("/makeupBaseAnalyze", aiMediaUpload, AiController.MakeupAnalyze
);





module.exports = router;
