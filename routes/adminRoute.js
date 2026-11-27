const express = require('express')
const router = express.Router()
const adminControllers = require('../Controllers/adminController');
const adminAuth = require('../Middleware/adminAuth');
const requireAdminRole = require('../Middleware/adminRole');
const { uploads } = require("../cloudinary/storage");






const Sidebarcontroller = require("../Controllers/AdminController/Sidebarcontroller");
const dashboardController = require("../Controllers/AdminController/dashboardController");
const Auth = require("../Controllers/AdminController/AdminController");
const AuthAdmin = require("../Middleware/AuthAdmin");
const ProductController = require("../Controllers/AdminController/ProductController");
const CategoryController = require("../Controllers/AdminController/CategoryController");
const ProductBasicsController = require("../Controllers/AdminController/ProductBasicsController");
const ProductPricing = require("../Controllers/AdminController/ProductPricingController");
const ProductMedia = require("../Controllers/AdminController/ProductMediaController");
const ProductVariant = require("../Controllers/AdminController/ProductVariantController");
const ProductIngredients = require("../Controllers/AdminController/ProductIngredientsController");
const ProductAiTags = require("../Controllers/AdminController/ProductAiTagsController");
const CollectionController = require("../Controllers/AdminController/CollectionController");
const InventoryController = require("../Controllers/AdminController/InventoryController");
const WarehouseController = require("../Controllers/AdminController/WarehouseController");
const SubAdminController = require("../Controllers/AdminController/SubAdminController");
const stockAdjustmentController = require("../Controllers/AdminController/stockAdjustmentController");
const expiryController = require("../Controllers/AdminController/expiryController");
const OrderController = require("../Controllers/AdminController/OrderController");
const ReturnController = require("../Controllers/AdminController/ReturnController");













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
//router.post('/admin-login', adminControllers.login)
//router.post("/admin-forget-password", adminControllers.forgetpass)
//router.post("/admin-reset-password", adminControllers.resetpass)
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
//router.get('/getproduct', adminAuth, requireAdminRole('catalog_manager'), adminControllers.getProduct)
router.get('/getinfluencer', adminAuth, requireAdminRole('catalog_manager'), adminControllers.getInfluencer)
router.get('/getorders', adminAuth, requireAdminRole('order_manager'), adminControllers.getOrders)
router.get('/sellproduct', adminAuth, requireAdminRole('order_manager'), adminControllers.Sellproduct)
router.post('/blogdelete', adminAuth, requireAdminRole('catalog_manager'), adminControllers.BlogdataDelete)
router.post('/quantityUpdate', adminAuth, requireAdminRole('catalog_manager', 'order_manager'), adminControllers.QuantityUpdate)
router.post('/addSiteSetting', adminAuth, requireAdminRole(), adminControllers.addSiteSetting);
router.get('/getsiteSetting', adminAuth, requireAdminRole(), adminControllers.getSiteSetting);
router.get('/getfaq', adminAuth, requireAdminRole('catalog_manager'), adminControllers.getFaq);
router.post('/createCoupon', adminAuth, requireAdminRole('catalog_manager'), adminControllers.createCoupon);
router.post('/addDeliveryDetails', adminAuth, requireAdminRole('order_manager'), adminControllers.DeliveryDetails);
router.post('/addSocialMedialinks', adminAuth, requireAdminRole('catalog_manager'), adminControllers.addSocialMedialinks);
router.get('/getSocialMedialinks', adminAuth, requireAdminRole('catalog_manager'), adminControllers.getSocialMedialinks);
router.get('/siteAddress', adminControllers.siteAddress);
router.post('/addhomecontent', adminAuth, requireAdminRole('catalog_manager'), uploads.single('categoryImage'), adminControllers.createhomecontent);
router.get('/gethomecontent', adminAuth, requireAdminRole('catalog_manager'), adminControllers.gethomecontent);
router.get('/edithomedatacontent/:id', adminAuth, requireAdminRole('catalog_manager'), adminControllers.Categorycontentedit);
router.post('/homecontentupdate', uploads.single('categoryImage'), adminAuth, requireAdminRole('catalog_manager'), adminControllers.Categorycontentupdate);
router.post('/Categorycontentdelete', adminAuth, requireAdminRole('catalog_manager'), adminControllers.Categorycontentdelete)
router.post('/addTrendingcontent', adminAuth, requireAdminRole('catalog_manager'), uploads.single('subCategoryVideo'), adminControllers.addTrendingcontent);
router.get('/getTrendingcontent', adminAuth, requireAdminRole('catalog_manager'), adminControllers.getTrendingcontent);
router.post('/deletTrendingCat', adminAuth, requireAdminRole('catalog_manager'), adminControllers.deletTrendingCat);
router.get('/editTrendingcontent/:id', adminAuth, requireAdminRole('catalog_manager'), adminControllers.editTrendingcontent);
router.post('/updateTrendingcat', adminAuth, requireAdminRole('catalog_manager'), uploads.single('video'), adminControllers.updateTrendingcat);
router.post('/addAddressSetting', adminAuth, requireAdminRole('catalog_manager'), adminControllers.addAddressSetting);
router.get('/getAddressSetting', adminAuth, requireAdminRole('catalog_manager'), adminControllers.getAddressSetting);
router.post('/addbannercontent', adminAuth, requireAdminRole('catalog_manager'), uploads.single('categoryImage'), adminControllers.addbannercontent);
router.get('/getbannercontent', adminAuth, requireAdminRole('catalog_manager'), adminControllers.getbannercontent);
router.post('/deletebannercontent', adminAuth, requireAdminRole('catalog_manager'), adminControllers.deletebannercontent)
router.get('/editbannercontent/:id', adminAuth, requireAdminRole('catalog_manager'), adminControllers.editbannercontent);
router.post('/updatebannnercontent', adminAuth, requireAdminRole('catalog_manager'), uploads.single('categoryImage'), adminControllers.updatebannnercontent);
router.post('/addoffercontent', adminAuth, requireAdminRole('catalog_manager'), uploads.single('categoryImage'), adminControllers.addoffercontent);
router.post('/addcategorypagebanner', adminAuth, requireAdminRole('catalog_manager'), uploads.single('categorypagebannerimage'), adminControllers.addcategorypagebanner);
router.get('/getcategorypagebanner', adminAuth, requireAdminRole('catalog_manager'), adminControllers.getcategorypagebanner);
router.get('/editcategorypagebanner/:id', adminAuth, requireAdminRole('catalog_manager'), adminControllers.geteditcategorypagebanner);
router.post('/updatecategorypagebanner', adminAuth, requireAdminRole('catalog_manager'), uploads.single('categorypagebannerImage'), adminControllers.updatecategorypagebanner);
router.post('/deletecategorypagebanner', adminAuth, requireAdminRole('catalog_manager'), adminControllers.deletecategorypagebanner)
router.get('/getoffercontent', adminAuth, requireAdminRole('catalog_manager'), adminControllers.getoffercontent);
router.get('/editoffercontent/:id', adminAuth, requireAdminRole('catalog_manager'), adminControllers.editoffercontent);
router.post('/updateoffercontent', uploads.single('categoryImage'), adminAuth, requireAdminRole('catalog_manager'), adminControllers.updateoffercontent);
router.post('/deleteoffercontent', adminAuth, requireAdminRole('catalog_manager'), adminControllers.deleteoffercontent)
router.post("/pageCreate", adminAuth, requireAdminRole('catalog_manager'), uploads.single("pageimage"), adminControllers.pageCreate)
router.post("/pageUpdate", adminAuth, requireAdminRole('catalog_manager'), uploads.single("pageimage"), adminControllers.pageupdate)
router.post("/pageDelete", adminAuth, requireAdminRole('catalog_manager'), adminControllers.pagedelete)
router.get("/pagedetails", adminAuth, requireAdminRole('catalog_manager'), adminControllers.pagedetails)
router.get("/pagedetail/:pageid", adminAuth, requireAdminRole('catalog_manager'), adminControllers.seperatepagedetail)














router.post("/admin-register", Auth.adminRegister);
router.post("/admin-login", Auth.adminLogin);
router.post("/admin-forget-password", Auth.adminForgetPassword);
router.post("/admin-verify-otp", Auth.adminVerifyOtp);
router.post("/admin-reset-password", Auth.adminResetPassword);


router.post("/admin-logout", AuthAdmin, Auth.adminLogout);
router.post("/admin-change-password", AuthAdmin, Auth.adminChangePassword);
router.get("/admin-profile", AuthAdmin, Auth.getAdminProfile);
router.get("/admin-check-auth", AuthAdmin, Auth.checkAdminAuth);


router.get("/dashboard", AuthAdmin, dashboardController.dashboard);
router.get("/sidebar-modules", AuthAdmin, Sidebarcontroller.sidebarModules);



router.get("/getproduct", AuthAdmin, ProductController.getProducts);
router.delete("/deleteproduct/:id", AuthAdmin, ProductController.deleteProduct);
router.patch("/bulk-update-status", AuthAdmin, ProductController.bulkUpdateStatus);
router.patch("/bulk-update-category", AuthAdmin, ProductController.bulkUpdateCategory);
router.post("/bulk-import", AuthAdmin, ProductController.bulkImport);
router.post("/createproduct", AuthAdmin, uploads.single("image"), ProductController.createProduct);
router.get("/getproduct/:id", AuthAdmin, ProductController.getSingleProduct);



router.post("/add-category", uploads.single("image"), CategoryController.addCategory);
router.get("/get-categories", AuthAdmin, CategoryController.getCategories);
router.post("/create-category", AuthAdmin, uploads.single("image"), CategoryController.createCategory);
router.put("/update-category/:id", AuthAdmin, uploads.single("image"), CategoryController.updateCategory);
router.delete("/delete-category/:id", AuthAdmin, CategoryController.deleteCategory);



router.get("/get-collections", AuthAdmin, CollectionController.getAllCollections);
router.get("/get-collection/:id", AuthAdmin, CollectionController.getSingleCollection);
router.post("/create-collection", AuthAdmin, uploads.single("image"), CollectionController.createCollection);
router.put("/update-collection/:id", AuthAdmin, uploads.single("image"), CollectionController.updateCollection);
router.delete("/delete-collection/:id", AuthAdmin, CollectionController.deleteCollection);



router.post("/createproduct-basics", AuthAdmin, ProductBasicsController.createProductBasics);
router.get("/getproduct-basics/:id", AuthAdmin, ProductBasicsController.getSingleProductBasics);
router.put("/updateproduct-basics/:id", AuthAdmin, ProductBasicsController.updateProductBasics);
router.get("/getproduct-basics", AuthAdmin, ProductBasicsController.getAllProductBasics);
router.get("/getproduct-basics-by-product/:productId", AuthAdmin, ProductBasicsController.getProductBasicsByProductId);
router.delete("/deleteproduct-basics/:id", AuthAdmin, ProductBasicsController.deleteProductBasics);



router.post("/createproduct-pricing", AuthAdmin, ProductPricing.createProductPricing);
router.get("/getproduct-pricing", AuthAdmin, ProductPricing.getAllProductPricing);
router.put("/updateproduct-pricing/:id", AuthAdmin, ProductPricing.updateProductPricing);
router.delete("/deleteproductpricing/:id", AuthAdmin, ProductPricing.deleteProductPricing);


router.post("/createproduct-media", AuthAdmin, ProductMedia.uploadProductImages, ProductMedia.createProductMedia);
router.get("/getproduct-media", AuthAdmin, ProductMedia.getProductMedia);
router.get("/getproduct-media/:productId", AuthAdmin, ProductMedia.getProductMedia);
router.put("/updateproduct-media/:productId", AuthAdmin, ProductMedia.uploadProductImages, ProductMedia.updateProductMedia);



router.post("/createproduct-variant", AuthAdmin, ProductVariant.createProductVariant);
router.get("/getproduct-variant", AuthAdmin, ProductVariant.getAllProductVariants);
router.get("/getproduct-variant/:productId", AuthAdmin, ProductVariant.getProductVariantsByProductId);
router.put("/updateproduct-variant/:id", AuthAdmin, ProductVariant.updateProductVariant);
router.delete("/deleteproduct-variant/:id", AuthAdmin, ProductVariant.deleteProductVariant);



router.post("/createproduct-ingredients", AuthAdmin, ProductIngredients.createProductIngredients);
router.get("/getproduct-ingredients/:productId", AuthAdmin, ProductIngredients.getProductIngredients);
router.put("/updateproduct-ingredients/:id", AuthAdmin, ProductIngredients.updateProductIngredients);
router.delete("/deleteproduct-ingredients/:id", AuthAdmin, ProductIngredients.deleteProductIngredients);



router.post("/createproduct-ai-tags", AuthAdmin, ProductAiTags.createProductAiTags);
router.get("/getproduct-ai-tags", AuthAdmin, ProductAiTags.getAllProductAiTags);
router.put("/updateproduct-ai-tags/:productId", AuthAdmin, ProductAiTags.updateProductAiTags);
router.delete("/deleteproduct-ai-tags/:productId", AuthAdmin, ProductAiTags.deleteProductAiTags);



router.get("/get-inventory", AuthAdmin, InventoryController.getInventory);
router.get("/get-inventory/:id", AuthAdmin, InventoryController.getInventoryById);
router.post("/receive-stock", AuthAdmin, InventoryController.receiveStock);
router.put("/update-inventory/:id", AuthAdmin, InventoryController.updateInventory);
router.delete("/delete-inventory/:id", AuthAdmin, InventoryController.deleteInventory);
router.post("/adjust-stock", AuthAdmin, InventoryController.adjustStock);
router.get("/get-adjustment-logs", AuthAdmin, InventoryController.getAdjustmentLogs);



router.get("/warehouse/get-warehouses", AuthAdmin, WarehouseController.getWarehouses);
router.get("/warehouse/get-warehouse/:id", AuthAdmin, WarehouseController.getWarehouseById);
router.post("/warehouse/create-warehouse", AuthAdmin, WarehouseController.createWarehouse);
router.put("/warehouse/update-warehouse/:id", AuthAdmin, WarehouseController.updateWarehouse);
router.put("/warehouse/set-default/:id", AuthAdmin, WarehouseController.setDefaultWarehouse);
router.delete("/warehouse/delete-warehouse/:id", AuthAdmin, WarehouseController.deleteWarehouse);



router.get("/get-modules", AuthAdmin, SubAdminController.getModules);
router.get("/view-admin", AuthAdmin, SubAdminController.viewAdmins);
router.get("/get-admin/:id", AuthAdmin, SubAdminController.getAdminById);
router.put("/update-admin/:id", AuthAdmin, SubAdminController.updateAdmin);
router.delete("/delete-admin/:id", AuthAdmin, SubAdminController.deleteAdmin);



router.get("/get-stock-movements", stockAdjustmentController.getStockMovements);



router.get("/get-expiry-batches", expiryController.getExpiryBatches);
router.get("/get-expiry-summary", expiryController.getExpirySummary);
router.put("/mark-batch-expired/:id", expiryController.markBatchExpired);




router.get("/orders/get-orders", AuthAdmin, OrderController.getOrders);
router.get("/orders/get-order/:id", AuthAdmin, OrderController.getOrder);
router.post("/orders/confirm/:id", AuthAdmin, OrderController.confirmOrder);
router.post("/orders/pack/:id", AuthAdmin, OrderController.packOrder);
router.post("/orders/create-shipment/:id", AuthAdmin, OrderController.createShipment);
router.post("/orders/deliver/:id", AuthAdmin, OrderController.deliverOrder);
router.post("/orders/cancel/:id", AuthAdmin, OrderController.cancelOrder);
router.post("/orders/add-note/:id", AuthAdmin, OrderController.addOrderNote);
router.get("/orders/invoice/:id", AuthAdmin, OrderController.getOrderInvoice);
router.get("/orders/packing-slip/:id", AuthAdmin, OrderController.getPackingSlip);





router.get("/get-returns",AuthAdmin,ReturnController.getReturns);
router.get("/get-return/:id",AuthAdmin,ReturnController.getReturnById);
router.post("/approve/:id", AuthAdmin, ReturnController.approveReturn);
router.post("/reject/:id",AuthAdmin,ReturnController.rejectReturn);
router.post( "/schedule-pickup/:id",AuthAdmin,ReturnController.schedulePickup);
router.post("/mark-received/:id",AuthAdmin,ReturnController.markReceived);
router.post("/issue-refund/:id",AuthAdmin,ReturnController.issueRefund);
router.post("/add-note/:id",AuthAdmin,ReturnController.addReturnNote);






module.exports = router;
