const express = require('express')
const router = express.Router()
const adminControllers = require('../Controllers/adminController');
const adminAuth = require('../Middleware/adminAuth');
const requireAdminRole = require('../Middleware/adminRole');
const { uploads } = require("../cloudinary/storage");

router.get('/auth/me', adminAuth, (req, res) => {
    const admin = res.locals.admin;
    return res.json({ status: true, user: { id: String(admin._id), email: admin.email, role: admin.role || 'super_admin' } });
});

router.post("/admin-auth", adminAuth, (req, res) => {
    try {
        res.send({ status: true, message: "Admin verified" });
    } catch (error) {
        res.send({ status: false, message: "Something went wrong..!" });
    }
});
router.post('/admin-create', adminAuth, requireAdminRole(), adminControllers.create);
router.post('/admin-login', adminControllers.login)
router.post("/admin-forget-password", adminControllers.forgetpass)
router.post("/admin-reset-password", adminControllers.resetpass)

router.post('/blogUpdate', adminAuth, requireAdminRole('catalog_manager'), uploads.single('BlogImage'), adminControllers.blogUpdate);
router.post('/faqUpdate', adminAuth, requireAdminRole('catalog_manager'), adminControllers.faqUpdate);
router.post('/addCategories', adminAuth, requireAdminRole('catalog_manager'), uploads.single('Images'), adminControllers.addCategories);
router.get('/getblog', adminAuth, requireAdminRole('catalog_manager'), adminControllers.getbloglist)
router.get('/getcategories', adminAuth, requireAdminRole('catalog_manager'), adminControllers.getcategories)
router.get('/userlist', adminAuth, requireAdminRole('support'), adminControllers.getuserlist)
router.post("/add&update-productData", adminAuth, requireAdminRole('catalog_manager'), uploads.fields([{ name: "media", maxCount: 10 }]),
    adminControllers.productData
)
router.post("/influencerUpdate", adminAuth, requireAdminRole('catalog_manager'), adminControllers.updateInfluencer)
router.post("/delete-productData", adminAuth, requireAdminRole('catalog_manager'), adminControllers.productDelete)
router.get('/getstockproduct', adminAuth, requireAdminRole('catalog_manager', 'order_manager'), adminControllers.getStockProduct)
router.get('/getproduct', adminAuth, requireAdminRole('catalog_manager'), adminControllers.getProduct)
router.get('/getinfluencer', adminAuth, requireAdminRole('catalog_manager'), adminControllers.getInfluencer)
router.get('/getorders', adminAuth, requireAdminRole('order_manager'), adminControllers.getOrders)
router.get('/sellproduct', adminAuth, requireAdminRole('order_manager'), adminControllers.Sellproduct)
router.post('/blogdelete', adminAuth, requireAdminRole('catalog_manager'), adminControllers.BlogdataDelete)
router.post('/quantityUpdate', adminAuth, requireAdminRole('catalog_manager', 'order_manager'), adminControllers.QuantityUpdate)
router.post('/addSiteSetting',adminAuth,requireAdminRole(),adminControllers.addSiteSetting);
router.get('/getsiteSetting',adminAuth,requireAdminRole(),adminControllers.getSiteSetting);
router.get('/getfaq',adminAuth,requireAdminRole('catalog_manager'),adminControllers.getFaq);
router.post('/createCoupon',adminAuth,requireAdminRole('catalog_manager'),adminControllers.createCoupon);
router.post('/addDeliveryDetails',adminAuth,requireAdminRole('order_manager'),adminControllers.DeliveryDetails);
router.post('/addSocialMedialinks',adminAuth,requireAdminRole('catalog_manager'),adminControllers.addSocialMedialinks);
router.get('/getSocialMedialinks',adminAuth,requireAdminRole('catalog_manager'),adminControllers.getSocialMedialinks);
router.get('/siteAddress',adminControllers.siteAddress);

router.post('/addhomecontent',adminAuth, requireAdminRole('catalog_manager'), uploads.single('categoryImage'), adminControllers.createhomecontent);
router.get('/gethomecontent',adminAuth, requireAdminRole('catalog_manager'), adminControllers.gethomecontent);
router.get('/edithomedatacontent/:id',adminAuth, requireAdminRole('catalog_manager'), adminControllers.Categorycontentedit);
router.post('/homecontentupdate',uploads.single('categoryImage'),adminAuth, requireAdminRole('catalog_manager'), adminControllers.Categorycontentupdate);
router.post('/Categorycontentdelete', adminAuth, requireAdminRole('catalog_manager'), adminControllers.Categorycontentdelete)
router.post('/addTrendingcontent',adminAuth, requireAdminRole('catalog_manager'), uploads.single('subCategoryVideo'), adminControllers.addTrendingcontent);
router.get('/getTrendingcontent',adminAuth, requireAdminRole('catalog_manager'), adminControllers.getTrendingcontent);
router.post('/deletTrendingCat', adminAuth, requireAdminRole('catalog_manager'), adminControllers.deletTrendingCat);
router.get('/editTrendingcontent/:id',adminAuth, requireAdminRole('catalog_manager'), adminControllers.editTrendingcontent);
router.post('/updateTrendingcat',adminAuth, requireAdminRole('catalog_manager'), uploads.single('video'), adminControllers.updateTrendingcat);
router.post('/addAddressSetting',adminAuth, requireAdminRole('catalog_manager'), adminControllers.addAddressSetting);
router.get('/getAddressSetting',adminAuth, requireAdminRole('catalog_manager'), adminControllers.getAddressSetting);
router.post('/addbannercontent',adminAuth, requireAdminRole('catalog_manager'), uploads.single('categoryImage'), adminControllers.addbannercontent);
router.get('/getbannercontent',adminAuth, requireAdminRole('catalog_manager'), adminControllers.getbannercontent);
router.post('/deletebannercontent', adminAuth, requireAdminRole('catalog_manager'), adminControllers.deletebannercontent)
router.get('/editbannercontent/:id',adminAuth, requireAdminRole('catalog_manager'), adminControllers.editbannercontent);
router.post('/updatebannnercontent',adminAuth, requireAdminRole('catalog_manager'), uploads.single('categoryImage'), adminControllers.updatebannnercontent);
router.post('/addoffercontent',adminAuth, requireAdminRole('catalog_manager'), uploads.single('categoryImage'), adminControllers.addoffercontent);
router.post('/addcategorypagebanner',adminAuth, requireAdminRole('catalog_manager'), uploads.single('categorypagebannerimage'), adminControllers.addcategorypagebanner);
router.get('/getcategorypagebanner',adminAuth, requireAdminRole('catalog_manager'), adminControllers.getcategorypagebanner);
router.get('/editcategorypagebanner/:id',adminAuth, requireAdminRole('catalog_manager'), adminControllers.geteditcategorypagebanner);
router.post('/updatecategorypagebanner',adminAuth, requireAdminRole('catalog_manager'), uploads.single('categorypagebannerImage'), adminControllers.updatecategorypagebanner);
router.post('/deletecategorypagebanner', adminAuth, requireAdminRole('catalog_manager'), adminControllers.deletecategorypagebanner)

router.get('/getoffercontent',adminAuth, requireAdminRole('catalog_manager'), adminControllers.getoffercontent);
router.get('/editoffercontent/:id',adminAuth, requireAdminRole('catalog_manager'), adminControllers.editoffercontent);
router.post('/updateoffercontent',uploads.single('categoryImage'),adminAuth, requireAdminRole('catalog_manager'), adminControllers.updateoffercontent);

router.post('/deleteoffercontent', adminAuth, requireAdminRole('catalog_manager'), adminControllers.deleteoffercontent)
router.post("/pageCreate",adminAuth,requireAdminRole('catalog_manager'),uploads.single("pageimage"),adminControllers .pageCreate)
router.post("/pageUpdate",adminAuth,requireAdminRole('catalog_manager'),uploads.single("pageimage"),adminControllers.pageupdate)
router.post("/pageDelete", adminAuth, requireAdminRole('catalog_manager'), adminControllers.pagedelete)
router.get("/pagedetails",adminAuth,requireAdminRole('catalog_manager'),adminControllers.pagedetails)
router.get("/pagedetail/:pageid",adminAuth,requireAdminRole('catalog_manager'),adminControllers.seperatepagedetail)
module.exports = router;
