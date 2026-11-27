const mongoose = require("mongoose");
const Order = require("../../models/Orders");
const PaymentDetail = require("../../models/payment-details");

const fs = require("fs");
const path = require("path");
const PDFDocument = require("pdfkit");
const DOC_DIR = path.join(__dirname, "../../public/invoices");

const COMPANY = {
  name: process.env.COMPANY_NAME || "NEWME",
  address: process.env.COMPANY_ADDRESS || "",
  gstin: process.env.COMPANY_GSTIN || "",
  phone: process.env.COMPANY_PHONE || "",
  email: process.env.COMPANY_EMAIL || "",
};


const getBaseUrl = (req) =>
  process.env.BASE_URL || `${req.protocol}://${req.get("host")}`;

const money = (n) => `Rs. ${Number(n || 0).toFixed(2)}`;

const formatDate = (d) =>
  new Date(d || Date.now()).toLocaleDateString("en-IN");

const writePdf = (filePath, draw) =>
  new Promise((resolve, reject) => {
    const doc = new PDFDocument({ margin: 40, size: "A4" });
    const stream = fs.createWriteStream(filePath);

    stream.on("finish", resolve);
    stream.on("error", reject);
    doc.on("error", reject);

    doc.pipe(stream);
    draw(doc);
    doc.end();
  });

const drawCompanyHeader = (doc) => {
  doc.fontSize(16).font("Helvetica-Bold").text(COMPANY.name);
  doc.font("Helvetica").fontSize(9);
  if (COMPANY.address) doc.text(COMPANY.address);
  if (COMPANY.gstin) doc.text(`GSTIN: ${COMPANY.gstin}`);
  if (COMPANY.phone) doc.text(`Phone: ${COMPANY.phone}`);
  if (COMPANY.email) doc.text(`Email: ${COMPANY.email}`);
  doc.moveDown();
};

const drawAddress = (doc, title, a = {}) => {
  doc.font("Helvetica-Bold").fontSize(10).text(title);
  doc.font("Helvetica").fontSize(10);
  doc.text(a.name || "-");
  doc.text(a.address || "-");
  doc.text(`Mobile: ${a.mobile || "-"}`);
  if (a.email) doc.text(`Email: ${a.email}`);
  doc.moveDown();
};

const drawTable = (doc, cols, rows) => {
  const rowHeight = 20;
  let y = doc.y;

  const header = () => {
    doc.font("Helvetica-Bold").fontSize(9);
    cols.forEach((c) =>
      doc.text(c.label, c.x, y, { width: c.width, align: c.align || "left" })
    );
    y += rowHeight - 6;
    doc.moveTo(40, y).lineTo(555, y).stroke();
    y += 6;
    doc.font("Helvetica").fontSize(9);
  };

  header();

  rows.forEach((row) => {
    if (y > 740) {
      doc.addPage();
      y = 40;
      header();
    }
    cols.forEach((c, i) =>
      doc.text(String(row[i] ?? ""), c.x, y, {
        width: c.width,
        align: c.align || "left",
      })
    );
    y += rowHeight;
  });

  doc.x = 40;
  doc.y = y + 4;
};


const getAdminId = (req) => {
  return req.admin?._id || req.user?._id || null;
};

const isValidId = (id) => mongoose.isValidObjectId(id);

const sendError = (res, statusCode, message) => {
  return res.status(statusCode).json({
    status: false,
    message,
  });
};

const getOrderById = async (id) => {

  return Order.findById(id)
    .populate("userid", "username lastname email mobile")
    .populate(
      "product.productid",
      "productname sku productimages price sellingPrice gstRate"
    )
    .populate("product.variantId")
    .populate("paymentDetailId");
};

const updateOrderStatus = async ({
  req,
  res,
  id,
  status,
  comment,
  extraUpdates = {},
}) => {
  try {
    if (!isValidId(id)) {
      return sendError(res, 400, "Invalid order ID");
    }

    const order = await Order.findById(id);

    if (!order) {
      return sendError(res, 404, "Order not found");
    }

    if (order.orderStatus === "CANCELLED") {
      return sendError(res, 400, "Cancelled orders cannot be updated");
    }

    if (order.orderStatus === "DELIVERED") {
      return sendError(res, 400, "Order is already delivered");
    }

    order.orderStatus = status;

    // Keep legacy fields synchronized
    order.productStatus = status;
    order.deliveryStatus = status;

    Object.assign(order, extraUpdates);

    order.statusHistory.push({
      status,
      comment: comment || `Order status changed to ${status}`,
      changedBy: getAdminId(req),
      changedAt: new Date(),
    });

    await order.save();

    const updatedOrder = await getOrderById(order._id);

    return res.status(200).json({
      status: true,
      message: `Order ${status.toLowerCase()} successfully`,
      data: {
        order: updatedOrder,
      },
    });
  } catch (error) {
    console.error("Update order status error:", error);

    return sendError(res, 500, "Failed to update order status");
  }
};

exports.getOrders = async (req, res) => {
  try {
    const {
      page = 1,
      limit = 10,
      search = "",
      status = "",
      paymentStatus = "",
      paymentMethod = "",
      startDate = "",
      endDate = "",
    } = req.query;

    const currentPage = Math.max(parseInt(page, 10) || 1, 1);
    const pageLimit = Math.min(
      Math.max(parseInt(limit, 10) || 10, 1),
      100
    );

    const skip = (currentPage - 1) * pageLimit;



    const baseFilter = {};

    if (startDate || endDate) {
      baseFilter.orderdate = {};

      if (startDate) {
        const start = new Date(startDate);

        if (Number.isNaN(start.getTime())) {
          return sendError(res, 400, "Invalid start date");
        }

        start.setHours(0, 0, 0, 0);
        baseFilter.orderdate.$gte = start;
      }

      if (endDate) {
        const end = new Date(endDate);

        if (Number.isNaN(end.getTime())) {
          return sendError(res, 400, "Invalid end date");
        }

        end.setHours(23, 59, 59, 999);
        baseFilter.orderdate.$lte = end;
      }
    }



    if (search.trim()) {
      const searchText = search.trim();

      const escapedSearch = searchText.replace(
        /[.*+?^${}()|[\]\\]/g,
        "\\$&"
      );

      const searchRegex = new RegExp(escapedSearch, "i");

      const matchingUsers = await mongoose
        .model("User")
        .find({
          $or: [
            { username: searchRegex },
            { lastname: searchRegex },
            { email: searchRegex },
            { mobile: searchRegex },
          ],
        })
        .select("_id")
        .lean();

      const userIds = matchingUsers.map((user) => user._id);

      const searchConditions = [
        { orderId: searchRegex },
        { invoiceId: searchRegex },
        { barcode: searchRegex },
        { "delivery_Address.name": searchRegex },
        { "delivery_Address.email": searchRegex },
        { "delivery_Address.address": searchRegex },
        { "product.productname": searchRegex },
        { userid: { $in: userIds } },
      ];

      if (/^\d+$/.test(searchText)) {
        searchConditions.push({
          "delivery_Address.mobile": Number(searchText),
        });
      }

      baseFilter.$or = searchConditions;
    }



    const summaryFilter = { ...baseFilter };



    const pipeline = [
      {
        $match: baseFilter,
      },

      // Join User
      {
        $lookup: {
          from: "users",
          localField: "userid",
          foreignField: "_id",
          as: "userDetails",
        },
      },

      {
        $unwind: {
          path: "$userDetails",
          preserveNullAndEmptyArrays: true,
        },
      },

      // Join Product
      {
        $lookup: {
          from: "products",
          localField: "product.productid",
          foreignField: "_id",
          as: "productDetails",
        },
      },

      // Join Payment Details using orderId
      {
        $lookup: {
          from: "paymentdetails",
          let: {
            currentOrderId: "$orderId",
          },
          pipeline: [
            {
              $match: {
                $expr: {
                  $eq: ["$orderId", "$$currentOrderId"],
                },
              },
            },
            {
              $sort: {
                createdAt: -1,
              },
            },
            {
              $limit: 1,
            },
          ],
          as: "paymentDetails",
        },
      },

      // Convert payment array into object
      {
        $unwind: {
          path: "$paymentDetails",
          preserveNullAndEmptyArrays: true,
        },
      },

      // Join Variant if variantId exists
      {
        $lookup: {
          from: "productvariants",
          localField: "product.variantId",
          foreignField: "_id",
          as: "variantDetails",
        },
      },

      // Add payment status
      {
        $addFields: {
          paymentStatus: {
            $cond: [
              {
                $and: [
                  { $ne: ["$paymentDetails", null] },
                  { $ne: ["$paymentDetails.status", null] },
                  { $ne: ["$paymentDetails.status", ""] },
                ],
              },
              {
                $cond: [
                  {
                    $eq: [
                      { $toUpper: "$paymentDetails.status" },
                      "SUCCESS",
                    ],
                  },
                  "PAID",
                  { $toUpper: "$paymentDetails.status" },
                ],
              },
              {
                $ifNull: ["$paymentStatus", "PENDING"],
              },
            ],
          },
        },
      },

      // Payment filters
      ...(
        paymentStatus.trim()
          ? [
            {
              $match: {
                paymentStatus: paymentStatus.trim().toUpperCase(),
              },
            },
          ]
          : []
      ),

      ...(
        paymentMethod.trim()
          ? [
            {
              $match: {
                paymentMethod: {
                  $regex: `^${paymentMethod.trim().replace(
                    /[.*+?^${}()|[\]\\]/g,
                    "\\$&"
                  )}$`,
                  $options: "i",
                },
              },
            },
          ]
          : []
      ),

      ...(
        status.trim()
          ? [
            {
              $match: {
                orderStatus: status.trim().toUpperCase(),
              },
            },
          ]
          : []
      ),

      // Sort
      {
        $sort: {
          orderdate: -1,
          createdAt: -1,
        },
      },

      {
        $skip: skip,
      },

      {
        $limit: pageLimit,
      },

      // Format output
      {
        $project: {
          userDetails: {
            _id: 1,
            username: 1,
            lastname: 1,
            email: 1,
            mobile: 1,
          },

          productDetails: 1,
          variantDetails: 1,
          paymentDetails: 1,

          orderId: 1,
          invoiceId: 1,
          userid: 1,
          product: 1,
          delivery_Address: 1,
          productStatus: 1,
          shippingCharge: 1,
          gstPercentage: 1,
          totalDiscount: 1,
          amount: 1,
          barcode: 1,
          couponDiscount: 1,
          couponDiscountAmount: 1,
          promoCode: 1,
          orderdate: 1,
          deliveryDate: 1,
          deliveryStatus: 1,
          orderStatus: 1,
          paymentStatus: 1,
          paymentMethod: 1,
          subtotal: 1,
          taxAmount: 1,
          shipment: 1,
          courierName: 1,
          trackingNumber: 1,
          trackingUrl: 1,
          internalNotes: 1,
          statusHistory: 1,
          source: 1,
          cancelReason: 1,
          refundAmount: 1,
          invoice: 1,
          packingSlip: 1,
          createdAt: 1,
          updatedAt: 1,
        },
      },
    ];



    const summaryPipeline = [
      {
        $match: summaryFilter,
      },
      {
        $group: {
          _id: null,

          totalOrders: {
            $sum: 1,
          },

          pending: {
            $sum: {
              $cond: [
                { $eq: ["$orderStatus", "PENDING"] },
                1,
                0,
              ],
            },
          },

          processing: {
            $sum: {
              $cond: [
                {
                  $in: [
                    "$orderStatus",
                    ["CONFIRMED", "PROCESSING", "PACKED", "SHIPPED"],
                  ],
                },
                1,
                0,
              ],
            },
          },

          delivered: {
            $sum: {
              $cond: [
                { $eq: ["$orderStatus", "DELIVERED"] },
                1,
                0,
              ],
            },
          },

          cancelled: {
            $sum: {
              $cond: [
                { $eq: ["$orderStatus", "CANCELLED"] },
                1,
                0,
              ],
            },
          },
        },
      },
    ];



    const [orders, totalOrders, summaryResult] = await Promise.all([
      Order.aggregate(pipeline),

      Order.aggregate([
        {
          $match: baseFilter,
        },
        {
          $lookup: {
            from: "paymentdetails",
            let: {
              currentOrderId: "$orderId",
            },
            pipeline: [
              {
                $match: {
                  $expr: {
                    $eq: ["$orderId", "$$currentOrderId"],
                  },
                },
              },
              {
                $sort: {
                  createdAt: -1,
                },
              },
              {
                $limit: 1,
              },
            ],
            as: "paymentDetails",
          },
        },
        {
          $unwind: {
            path: "$paymentDetails",
            preserveNullAndEmptyArrays: true,
          },
        },
        {
          $addFields: {
            paymentStatus: {
              $cond: [
                {
                  $and: [
                    { $ne: ["$paymentDetails.status", null] },
                    { $ne: ["$paymentDetails.status", ""] },
                  ],
                },
                {
                  $cond: [
                    {
                      $eq: [
                        { $toUpper: "$paymentDetails.status" },
                        "SUCCESS",
                      ],
                    },
                    "PAID",
                    { $toUpper: "$paymentDetails.status" },
                  ],
                },
                {
                  $ifNull: ["$paymentStatus", "PENDING"],
                },
              ],
            },
          },
        },
        ...(
          paymentStatus.trim()
            ? [
              {
                $match: {
                  paymentStatus: paymentStatus.trim().toUpperCase(),
                },
              },
            ]
            : []
        ),
        ...(
          paymentMethod.trim()
            ? [
              {
                $match: {
                  paymentMethod: {
                    $regex: `^${paymentMethod.trim().replace(
                      /[.*+?^${}()|[\]\\]/g,
                      "\\$&"
                    )}$`,
                    $options: "i",
                  },
                },
              },
            ]
            : []
        ),
        ...(
          status.trim()
            ? [
              {
                $match: {
                  orderStatus: status.trim().toUpperCase(),
                },
              },
            ]
            : []
        ),
        {
          $count: "total",
        },
      ]),

      Order.aggregate(summaryPipeline),
    ]);

    const totalCount = totalOrders[0]?.total || 0;
    const summary = summaryResult[0] || {
      totalOrders: 0,
      pending: 0,
      processing: 0,
      delivered: 0,
      cancelled: 0,
    };



    return res.status(200).json({
      status: true,
      message: "Orders fetched successfully",

      data: {
        orders,

        totalOrders: totalCount,
        totalCount,
        currentPage,

        totalPages: Math.ceil(totalCount / pageLimit),

        summary: {
          totalOrders: summary.totalOrders,
          pending: summary.pending,
          processing: summary.processing,
          delivered: summary.delivered,
          cancelled: summary.cancelled,
        },
      },
    });

  } catch (error) {
    console.error("Get orders aggregation error:", error);

    return sendError(
      res,
      500,
      "Failed to fetch orders"
    );
  }
};

exports.getOrder = async (req, res) => {
  try {
    const { id } = req.params;

    if (!isValidId(id)) {
      return sendError(res, 400, "Invalid order ID");
    }

    const order = await getOrderById(id);

    if (!order) {
      return sendError(res, 404, "Order not found");
    }

    return res.status(200).json({
      status: true,
      message: "Order fetched successfully",
      data: {
        order,
      },
    });
  } catch (error) {
    console.error("Get order error:", error);

    return sendError(res, 500, "Failed to fetch order details");
  }
};


exports.confirmOrder = async (req, res) => {
  return updateOrderStatus({
    req,
    res,
    id: req.params.id,
    status: "CONFIRMED",
    comment: req.body?.comment || "Order confirmed by admin",
  });
};


exports.packOrder = async (req, res) => {
  return updateOrderStatus({
    req,
    res,
    id: req.params.id,
    status: "PACKED",
    comment: req.body?.comment || "Order packed by admin",
  });
};


exports.createShipment = async (req, res) => {
  try {
    const {
      courierName,
      trackingNumber,
      trackingUrl,
      shipmentId,
    } = req.body;

    if (!courierName || !trackingNumber) {
      return sendError(
        res,
        400,
        "Courier name and tracking number are required"
      );
    }

    if (!isValidId(req.params.id)) {
      return sendError(res, 400, "Invalid order ID");
    }

    const order = await Order.findById(req.params.id);

    if (!order) {
      return sendError(res, 404, "Order not found");
    }

    if (["CANCELLED", "DELIVERED"].includes(order.orderStatus)) {
      return sendError(
        res,
        400,
        "Shipment cannot be created for this order"
      );
    }

    if (order.orderStatus === "PENDING") {
      return sendError(
        res,
        400,
        "Please confirm the order before creating shipment"
      );
    }

    const shippedAt = new Date();

    const shipmentData = {
      courierName,
      trackingNumber,
      trackingUrl: trackingUrl || "",
      shipmentId: shipmentId || "",
      shippedAt,
    };

    order.shipment = shipmentData;

    // Keep top-level fields for frontend compatibility
    order.courierName = courierName;
    order.trackingNumber = trackingNumber;
    order.trackingUrl = trackingUrl || "";
    order.shippedAt = shippedAt;

    order.orderStatus = "SHIPPED";
    order.productStatus = "SHIPPED";
    order.deliveryStatus = "SHIPPED";

    order.statusHistory.push({
      status: "SHIPPED",
      comment: `Shipment created through ${courierName}`,
      changedBy: getAdminId(req),
      changedAt: shippedAt,
    });

    await order.save();

    const updatedOrder = await getOrderById(order._id);

    return res.status(200).json({
      status: true,
      message: "Shipment created successfully",
      data: {
        order: updatedOrder,
      },
    });
  } catch (error) {
    console.error("Create shipment error:", error);

    return sendError(res, 500, "Failed to create shipment");
  }
};


exports.deliverOrder = async (req, res) => {
  try {
    if (!isValidId(req.params.id)) {
      return sendError(res, 400, "Invalid order ID");
    }

    const order = await Order.findById(req.params.id);

    if (!order) {
      return sendError(res, 404, "Order not found");
    }

    if (order.orderStatus !== "SHIPPED") {
      return sendError(
        res,
        400,
        "Only shipped orders can be marked as delivered"
      );
    }

    const deliveredAt = new Date();

    order.orderStatus = "DELIVERED";
    order.productStatus = "DELIVERED";
    order.deliveryStatus = "DELIVERED";
    order.deliveryDate = deliveredAt;
    order.deliveredAt = deliveredAt;

    if (order.shipment) {
      order.shipment.deliveredAt = deliveredAt;
    }

    order.statusHistory.push({
      status: "DELIVERED",
      comment: req.body?.comment || "Order delivered successfully",
      changedBy: getAdminId(req),
      changedAt: deliveredAt,
    });

    await order.save();

    const updatedOrder = await getOrderById(order._id);

    return res.status(200).json({
      status: true,
      message: "Order delivered successfully",
      data: {
        order: updatedOrder,
      },
    });
  } catch (error) {
    console.error("Deliver order error:", error);

    return sendError(res, 500, "Failed to update delivery status");
  }
};



exports.cancelOrder = async (req, res) => {
  try {
    const { reason } = req.body;

    if (!isValidId(req.params.id)) {
      return sendError(res, 400, "Invalid order ID");
    }

    const order = await Order.findById(req.params.id);

    if (!order) {
      return sendError(res, 404, "Order not found");
    }

    if (["CANCELLED", "DELIVERED"].includes(order.orderStatus)) {
      return sendError(
        res,
        400,
        "This order cannot be cancelled"
      );
    }

    const cancelledAt = new Date();

    order.orderStatus = "CANCELLED";
    order.productStatus = "CANCELLED";
    order.deliveryStatus = "CANCELLED";
    order.cancelReason = reason || "Cancelled by admin";
    order.cancelledAt = cancelledAt;

    order.statusHistory.push({
      status: "CANCELLED",
      comment: order.cancelReason,
      changedBy: getAdminId(req),
      changedAt: cancelledAt,
    });

    await order.save();

    const updatedOrder = await getOrderById(order._id);

    return res.status(200).json({
      status: true,
      message: "Order cancelled successfully",
      data: {
        order: updatedOrder,
      },
    });
  } catch (error) {
    console.error("Cancel order error:", error);

    return sendError(res, 500, "Failed to cancel order");
  }
};


exports.addOrderNote = async (req, res) => {
  try {
    const { note } = req.body;

    if (!isValidId(req.params.id)) {
      return sendError(res, 400, "Invalid order ID");
    }

    if (!note || !note.trim()) {
      return sendError(res, 400, "Note is required");
    }

    const order = await Order.findById(req.params.id);

    if (!order) {
      return sendError(res, 404, "Order not found");
    }

    order.internalNotes.push({
      note: note.trim(),
      addedBy: getAdminId(req),
      createdAt: new Date(),
    });

    await order.save();

    const updatedOrder = await getOrderById(order._id);

    return res.status(200).json({
      status: true,
      message: "Internal note added successfully",
      data: {
        order: updatedOrder,
      },
    });
  } catch (error) {
    console.error("Add order note error:", error);

    return sendError(res, 500, "Failed to add internal note");
  }
};


exports.getOrderInvoice = async (req, res) => {
  try {
    if (!isValidId(req.params.id)) {
      return sendError(res, 400, "Invalid order ID");
    }

    const order = await Order.findById(req.params.id);

    if (!order) {
      return sendError(res, 404, "Order not found");
    }

    fs.mkdirSync(DOC_DIR, { recursive: true });

    const invoiceNo = order.invoiceId || `INV-${order._id}`;
    const fileName = `${invoiceNo}.pdf`;
    const filePath = path.join(DOC_DIR, fileName);
    const url = `${getBaseUrl(req)}/invoices/${fileName}`;

    if (fs.existsSync(filePath)) {
      return res.status(200).json({
        status: true,
        message: "Invoice fetched successfully",
        data: { url },
      });
    }

    await writePdf(filePath, (doc) => {
      doc.font("Helvetica-Bold").fontSize(20).text("TAX INVOICE", {
        align: "center",
      });
      doc.moveDown();

      drawCompanyHeader(doc);

      doc.font("Helvetica").fontSize(10);
      doc.text(`Invoice No: ${invoiceNo}`);
      doc.text(`Order ID: ${order.orderId || order._id}`);
      doc.text(`Date: ${formatDate(order.orderdate || order.createdAt)}`);
      doc.text(
        `Payment: ${order.paymentMethod || "-"} (${order.paymentStatus || "-"})`
      );
      doc.moveDown();

      drawAddress(doc, "Bill / Ship To", order.delivery_Address);

      const cols = [
        { label: "#", x: 40, width: 25 },
        { label: "Product", x: 70, width: 250 },
        { label: "Qty", x: 325, width: 40, align: "center" },
        { label: "Price", x: 370, width: 90, align: "right" },
        { label: "Total", x: 465, width: 90, align: "right" },
      ];

      let subtotal = 0;

      const rows = (order.product || []).map((p, i) => {
        const d = p.productdetails?.[0] || {};
        const qty = Number(d.quantity) || 1;
        const price = Number(d.price) || 0;
        const line = qty * price;
        subtotal += line;
        return [i + 1, p.productname || "-", qty, money(price), money(line)];
      });

      drawTable(doc, cols, rows);

      doc.moveDown();
      doc.font("Helvetica").fontSize(10);
      doc.text(`Subtotal: ${money(order.subtotal || subtotal)}`, {
        align: "right",
      });
      if (Number(order.taxAmount) > 0) {
        doc.text(`GST: ${money(order.taxAmount)}`, { align: "right" });
      }
      doc.text(`Shipping: ${money(order.shippingCharge)}`, { align: "right" });
      doc.text(`Discount: -${money(order.totalDiscount)}`, { align: "right" });
      doc.font("Helvetica-Bold").fontSize(12);
      doc.text(`Total Paid: ${money(order.amount || subtotal)}`, {
        align: "right",
      });

      doc.moveDown(2);
      doc.font("Helvetica").fontSize(8).text(
        "This is a computer generated invoice.",
        { align: "center" }
      );
    });

    order.invoice = url;
    await order.save();

    return res.status(200).json({
      status: true,
      message: "Invoice generated successfully",
      data: { url },
    });
  } catch (error) {
    console.error("Get invoice error:", error);
    return sendError(res, 500, "Failed to fetch invoice");
  }
};


exports.getPackingSlip = async (req, res) => {
  try {
    if (!isValidId(req.params.id)) {
      return sendError(res, 400, "Invalid order ID");
    }

    const order = await Order.findById(req.params.id);

    if (!order) {
      return sendError(res, 404, "Order not found");
    }

    fs.mkdirSync(DOC_DIR, { recursive: true });

    const slipNo = `PS-${order.orderId || order._id}`;
    const fileName = `${slipNo}.pdf`;
    const filePath = path.join(DOC_DIR, fileName);
    const url = `${getBaseUrl(req)}/invoices/${fileName}`;

    if (fs.existsSync(filePath)) {
      return res.status(200).json({
        status: true,
        message: "Packing slip fetched successfully",
        data: { url },
      });
    }

    await writePdf(filePath, (doc) => {
      doc.font("Helvetica-Bold").fontSize(18).text("PACKING SLIP", {
        align: "center",
      });
      doc.moveDown();

      drawCompanyHeader(doc);

      doc.font("Helvetica").fontSize(10);
      doc.text(`Order ID: ${order.orderId || order._id}`);
      doc.text(`Order Date: ${formatDate(order.orderdate || order.createdAt)}`);
      if (order.invoiceId) doc.text(`Invoice No: ${order.invoiceId}`);
      doc.moveDown();

      drawAddress(doc, "Ship To", order.delivery_Address);

      const cols = [
        { label: "#", x: 40, width: 25 },
        { label: "Product", x: 70, width: 340 },
        { label: "Size / Shade", x: 415, width: 90 },
        { label: "Qty", x: 510, width: 45, align: "center" },
      ];

      let totalQty = 0;

      const rows = (order.product || []).map((p, i) => {
        const d = p.productdetails?.[0] || {};
        const qty = Number(d.quantity) || 1;
        totalQty += qty;
        const variant = [d.size, d.shade].filter(Boolean).join(" / ") || "-";
        return [i + 1, p.productname || "-", variant, qty];
      });

      drawTable(doc, cols, rows);

      doc.moveDown();
      doc.font("Helvetica-Bold").fontSize(10);
      doc.text(`Total items: ${totalQty}`, { align: "right" });

      doc.moveDown(2);
      doc.font("Helvetica").fontSize(9).text("Packed by: ____________________");
      doc.text("Checked by: ___________________");
    });

    order.packingSlip = url;
    await order.save();

    return res.status(200).json({
      status: true,
      message: "Packing slip generated successfully",
      data: { url },
    });
  } catch (error) {
    console.error("Get packing slip error:", error);
    return sendError(res, 500, "Failed to fetch packing slip");
  }
};












// const axios = require("axios");

// const BASE_URL = process.env.SHIPROCKET_BASE_URL;

// let cachedToken = null;
// let tokenExpiresAt = 0;

// const shiprocketApi = axios.create({
//   baseURL: BASE_URL,
//   timeout: 30000,
//   headers: {
//     "Content-Type": "application/json",
//   },
// });

// const getShiprocketToken = async () => {
//   if (cachedToken && Date.now() < tokenExpiresAt) {
//     return cachedToken;
//   }

//   try {
//     const response = await shiprocketApi.post("/auth/login", {
//       email: process.env.SHIPROCKET_EMAIL,
//       password: process.env.SHIPROCKET_PASSWORD,
//     });

//     const token = response.data?.token;

//     if (!token) {
//       throw new Error("Shiprocket token not received");
//     }

//     cachedToken = token;

//     // Refresh locally before the documented 10-day token expiry.
//     tokenExpiresAt = Date.now() + 9 * 24 * 60 * 60 * 1000;

//     return token;
//   } catch (error) {
//     console.error(
//       "Shiprocket authentication:",
//       error.response?.data || error.message
//     );

//     throw new Error("Shiprocket authentication failed");
//   }
// };

// const createShiprocketOrder = async (payload) => {
//   const token = await getShiprocketToken();

//   const response = await shiprocketApi.post(
//     "/orders/create/adhoc",
//     payload,
//     {
//       headers: {
//         Authorization: `Bearer ${token}`,
//       },
//     }
//   );

//   return response.data;
// };

// const assignShiprocketAWB = async (shipmentId, courierId = null) => {
//   const token = await getShiprocketToken();

//   const payload = {
//     shipment_id: Number(shipmentId),
//   };

//   // Optional: specify a courier ID returned by serviceability API.
//   if (courierId) {
//     payload.courier_id = Number(courierId);
//   }

//   const response = await shiprocketApi.post(
//     "/courier/assign/awb",
//     payload,
//     {
//       headers: {
//         Authorization: `Bearer ${token}`,
//       },
//     }
//   );

//   return response.data;
// };

// const scheduleShiprocketPickup = async (shipmentId) => {
//   const token = await getShiprocketToken();

//   const response = await shiprocketApi.post(
//     "/courier/generate/pickup",
//     {
//       shipment_id: Number(shipmentId),
//     },
//     {
//       headers: {
//         Authorization: `Bearer ${token}`,
//       },
//     }
//   );

//   return response.data;
// };

// const generateShiprocketLabel = async (shipmentId) => {
//   const token = await getShiprocketToken();

//   const response = await shiprocketApi.post(
//     "/courier/generate/label",
//     {
//       shipment_id: [Number(shipmentId)],
//     },
//     {
//       headers: {
//         Authorization: `Bearer ${token}`,
//       },
//     }
//   );

//   return response.data;
// };

// module.exports = {
//   getShiprocketToken,
//   createShiprocketOrder,
//   assignShiprocketAWB,
//   scheduleShiprocketPickup,
//   generateShiprocketLabel,
// };
