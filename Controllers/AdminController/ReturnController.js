const mongoose = require("mongoose");

const Return = require("../../models/ReturnModel");
const Order = require("../../models/Orders");
const User = require("../../models/User");

const { createGatewayRefund } = require("../../services/refundService");


const getAdminId = (req) =>
  req.admin?._id ||
  req.adminId ||
  req.user?._id ||
  null;

const addTimeline = (returnData, status, message, adminId) => {
  returnData.timeline.push({
    status,
    message,
    changedBy: adminId,
    changedAt: new Date(),
  });
};

const sendError = (res, error, statusCode = 500) => {
  console.error("Returns API Error:", error);

  return res.status(statusCode).json({
    status: false,
    message: error.message || "Something went wrong",
  });
};

const getReturnAmount = (returnData) => {
  return returnData.items.reduce(
    (total, item) => total + Number(item.returnAmount || 0),
    0
  );
};

const validObjectId = (id) => mongoose.Types.ObjectId.isValid(id);



exports.getReturns = async (req, res) => {
  try {
    let {
      page = 1,
      limit = 10,
      search = "",
      status = "",
      startDate = "",
      endDate = "",
    } = req.query;

    page = Math.max(parseInt(page) || 1, 1);
    limit = Math.min(Math.max(parseInt(limit) || 10, 1), 100);

    const filter = {};

    if (status && status !== "ALL") {
      filter.status = status;
    }

    if (startDate || endDate) {
      filter.createdAt = {};

      if (startDate) {
        filter.createdAt.$gte = new Date(startDate);
      }

      if (endDate) {
        const end = new Date(endDate);
        end.setHours(23, 59, 59, 999);
        filter.createdAt.$lte = end;
      }
    }

    if (search.trim()) {
      const searchRegex = new RegExp(
        search.trim().replace(/[.*+?^${}()|[\]\\]/g, "\\$&"),
        "i"
      );

      filter.$or = [
        { returnId: searchRegex },
        { orderNumber: searchRegex },
        { reason: searchRegex },
        { "items.productName": searchRegex },
      ];
    }

    const total = await Return.countDocuments(filter);

    const returns = await Return.find(filter)
      .populate("userid", "username lastname email mobile")
      .populate("orderId", "orderId invoiceId orderStatus paymentStatus")
      .populate("received.warehouseId", "warehouseName name")
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .lean();

    return res.status(200).json({
      status: true,
      message: "Returns fetched successfully",
      data: {
        returns,
        pagination: {
          total,
          page,
          limit,
          totalPages: Math.ceil(total / limit),
        },
      },
    });
  } catch (error) {
    return sendError(res, error);
  }
};



exports.getReturnById = async (req, res) => {
  try {
    const { id } = req.params;

    if (!validObjectId(id)) {
      return res.status(400).json({
        status: false,
        message: "Invalid return ID",
      });
    }

    const returnData = await Return.findById(id)
      .populate("userid", "username lastname email mobile")
      .populate("orderId")
      .populate("items.productId")
      .populate("received.warehouseId", "warehouseName name");

    if (!returnData) {
      return res.status(404).json({
        status: false,
        message: "Return not found",
      });
    }

    return res.status(200).json({
      status: true,
      message: "Return fetched successfully",
      data: { return: returnData },
    });
  } catch (error) {
    return sendError(res, error);
  }
};



exports.approveReturn = async (req, res) => {
  try {
    const returnData = await Return.findById(req.params.id);

    if (!returnData) {
      return res.status(404).json({
        status: false,
        message: "Return not found",
      });
    }

    if (returnData.status !== "REQUESTED") {
      return res.status(400).json({
        status: false,
        message: "Only requested returns can be approved",
      });
    }

    if (!returnData.eligibility.eligible) {
      return res.status(400).json({
        status: false,
        message: "This return is marked as ineligible",
      });
    }

    returnData.status = "APPROVED";

    addTimeline(
      returnData,
      "APPROVED",
      req.body.message || "Return request approved",
      getAdminId(req)
    );

    await returnData.save();

    return res.status(200).json({
      status: true,
      message: "Return approved successfully",
      data: { return: returnData },
    });
  } catch (error) {
    return sendError(res, error);
  }
};


exports.rejectReturn = async (req, res) => {
  try {
    const { reason } = req.body;

    if (!reason || !reason.trim()) {
      return res.status(400).json({
        status: false,
        message: "Rejection reason is required",
      });
    }

    const returnData = await Return.findById(req.params.id);

    if (!returnData) {
      return res.status(404).json({
        status: false,
        message: "Return not found",
      });
    }

    if (returnData.status !== "REQUESTED") {
      return res.status(400).json({
        status: false,
        message: "Only requested returns can be rejected",
      });
    }

    returnData.status = "REJECTED";
    returnData.rejectionReason = reason.trim();

    addTimeline(
      returnData,
      "REJECTED",
      `Return rejected: ${reason.trim()}`,
      getAdminId(req)
    );

    await returnData.save();

    // TODO: Send rejection notification/email to the customer.

    return res.status(200).json({
      status: true,
      message: "Return rejected successfully",
      data: { return: returnData },
    });
  } catch (error) {
    return sendError(res, error);
  }
};


exports.schedulePickup = async (req, res) => {
  try {
    const {
      pickupDate,
      courierName,
      trackingNumber,
      trackingUrl,
      notes,
    } = req.body;

    if (!pickupDate || !courierName) {
      return res.status(400).json({
        status: false,
        message: "Pickup date and courier name are required",
      });
    }

    const returnData = await Return.findById(req.params.id);

    if (!returnData) {
      return res.status(404).json({
        status: false,
        message: "Return not found",
      });
    }

    if (returnData.status !== "APPROVED") {
      return res.status(400).json({
        status: false,
        message: "Only approved returns can be scheduled for pickup",
      });
    }

    const parsedDate = new Date(pickupDate);

    if (Number.isNaN(parsedDate.getTime())) {
      return res.status(400).json({
        status: false,
        message: "Invalid pickup date",
      });
    }

    returnData.pickup = {
      pickupDate: parsedDate,
      courierName,
      trackingNumber: trackingNumber || "",
      trackingUrl: trackingUrl || "",
      notes: notes || "",
    };

    returnData.status = "PICKUP_SCHEDULED";

    addTimeline(
      returnData,
      "PICKUP_SCHEDULED",
      `Pickup scheduled with ${courierName}`,
      getAdminId(req)
    );

    await returnData.save();

    // TODO: Call your courier API here to create an actual reverse pickup.
    // Saving courier details alone does not book a real pickup.

    return res.status(200).json({
      status: true,
      message: "Return pickup scheduled successfully",
      data: { return: returnData },
    });
  } catch (error) {
    return sendError(res, error);
  }
};



exports.markReceived = async (req, res) => {
  try {
    const {
      condition,
      conditionNotes,
      restock = false,
      warehouseId,
      restockQuantity,
    } = req.body;

    const allowedConditions = [
      "SEALED",
      "UNOPENED",
      "OPENED",
      "DAMAGED",
      "DEFECTIVE",
    ];

    if (!allowedConditions.includes(condition)) {
      return res.status(400).json({
        status: false,
        message: "Select a valid returned product condition",
      });
    }

    const returnData = await Return.findById(req.params.id);

    if (!returnData) {
      return res.status(404).json({
        status: false,
        message: "Return not found",
      });
    }

    if (returnData.status !== "PICKUP_SCHEDULED") {
      return res.status(400).json({
        status: false,
        message: "Only pickup-scheduled returns can be marked received",
      });
    }

    if (restock && !warehouseId) {
      return res.status(400).json({
        status: false,
        message: "Select a warehouse for restocking",
      });
    }

    if (restock && !validObjectId(warehouseId)) {
      return res.status(400).json({
        status: false,
        message: "Invalid warehouse ID",
      });
    }

    // Restock must only be allowed for sellable, unopened/sealed products.
    if (restock && !["SEALED", "UNOPENED"].includes(condition)) {
      return res.status(400).json({
        status: false,
        message: "Only sealed or unopened products can be restocked",
      });
    }

    returnData.status = "RECEIVED";

    returnData.received = {
      receivedAt: new Date(),
      condition,
      conditionNotes: conditionNotes || "",
      restock: Boolean(restock),
      warehouseId: restock ? warehouseId : null,
    };

    // Mark each item with the received condition.
    for (const item of returnData.items) {
      item.condition = condition;
    }

    addTimeline(
      returnData,
      "RECEIVED",
      `Return received. Condition: ${condition}`,
      getAdminId(req)
    );

    await returnData.save();

    // IMPORTANT:
    // Connect your existing Inventory model/service here.
    // Do not directly update Product stock unless your inventory system
    // actually stores stock on the Product document.
    //
    // Example integration:
    // if (restock) {
    //   await InventoryService.addReturnedStock({
    //     items: returnData.items,
    //     warehouseId,
    //     restockQuantity
    //   });
    // }

    return res.status(200).json({
      status: true,
      message: restock
        ? "Return received. Inventory restock integration is required."
        : "Return marked as received successfully",
      data: { return: returnData },
    });
  } catch (error) {
    return sendError(res, error);
  }
};



exports.issueRefund = async (req, res) => {
  try {
    const {
      refundType = "FULL",
      amount,
      refundMethod = "GATEWAY",
      reason = "",
    } = req.body;

    const returnData = await Return.findById(req.params.id);

    if (!returnData) {
      return res.status(404).json({
        status: false,
        message: "Return not found",
      });
    }

    if (returnData.status !== "RECEIVED") {
      return res.status(400).json({
        status: false,
        message: "Refund can only be issued after the returned item is received",
      });
    }

    if (returnData.refund.status === "PROCESSING" ||
        returnData.refund.status === "SUCCESS") {
      return res.status(400).json({
        status: false,
        message: "Refund is already processing or completed",
      });
    }

    if (!["FULL", "PARTIAL"].includes(refundType)) {
      return res.status(400).json({
        status: false,
        message: "Invalid refund type",
      });
    }

    if (!["GATEWAY", "STORE_CREDIT"].includes(refundMethod)) {
      return res.status(400).json({
        status: false,
        message: "Invalid refund method",
      });
    }

    const maximumRefund = getReturnAmount(returnData);
    const refundAmount =
      refundType === "FULL" ? maximumRefund : Number(amount);

    if (
      !Number.isFinite(refundAmount) ||
      refundAmount <= 0 ||
      refundAmount > maximumRefund
    ) {
      return res.status(400).json({
        status: false,
        message: `Refund amount must be greater than 0 and not exceed ${maximumRefund}`,
      });
    }

    // Mark as processing before calling the gateway to reduce duplicate
    // refund attempts. For production, also use a database transaction
    // or an atomic conditional update to handle concurrent requests.
    returnData.refund = {
      refundType,
      amount: refundAmount,
      refundMethod,
      reason,
      gatewayRefundId: "",
      status: "PROCESSING",
      processedAt: null,
    };

    await returnData.save();

    try {
      let gatewayRefundId = "";

      if (refundMethod === "GATEWAY") {
        const order = await Order.findById(returnData.orderId);

        if (!order) {
          throw new Error("Original order not found");
        }

        // IMPORTANT:
        // Change this field to match the payment ID field in your
        // existing Order/payment schema.
        const paymentId =
          order.razorpayPaymentId ||
          order.paymentId ||
          order.paymentDetails?.razorpayPaymentId ||
          order.paymentDetails?.paymentId;

        if (!paymentId) {
          throw new Error(
            "Original gateway payment ID is missing from the order"
          );
        }

        const gatewayRefund = await createGatewayRefund({
          paymentId,
          amount: refundAmount,
          returnId: returnData.returnId,
        });

        gatewayRefundId = gatewayRefund.id;
      } else {
        // TODO: Implement store-credit balance/ledger update using
        // your actual User wallet or StoreCredit model.
        throw new Error(
          "Store credit service is not configured yet. Connect your wallet/credit model before enabling this option."
        );
      }

      returnData.refund.status = "SUCCESS";
      returnData.refund.gatewayRefundId = gatewayRefundId;
      returnData.refund.processedAt = new Date();
      returnData.status = "REFUNDED";

      addTimeline(
        returnData,
        "REFUNDED",
        `${refundType} refund of ${refundAmount} completed through ${refundMethod}`,
        getAdminId(req)
      );

      await returnData.save();

      // TODO: Notify customer about successful refund.

      return res.status(200).json({
        status: true,
        message: "Refund completed successfully",
        data: {
          return: returnData,
          refund: {
            amount: refundAmount,
            method: refundMethod,
            gatewayRefundId,
            status: "SUCCESS",
          },
        },
      });
    } catch (refundError) {
      returnData.refund.status = "FAILED";
      await returnData.save();

      throw refundError;
    }
  } catch (error) {
    return sendError(res, error, 400);
  }
};



exports.addReturnNote = async (req, res) => {
  try {
    const { note } = req.body;

    if (!note || !note.trim()) {
      return res.status(400).json({
        status: false,
        message: "Note is required",
      });
    }

    const returnData = await Return.findById(req.params.id);

    if (!returnData) {
      return res.status(404).json({
        status: false,
        message: "Return not found",
      });
    }

    returnData.internalNotes.push({
      note: note.trim(),
      addedBy: getAdminId(req),
      createdAt: new Date(),
    });

    await returnData.save();

    return res.status(200).json({
      status: true,
      message: "Internal note added successfully",
      data: { return: returnData },
    });
  } catch (error) {
    return sendError(res, error);
  }
};