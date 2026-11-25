const mongoose = require("mongoose");
const WarehouseModel = require("../../models/Warehouse");

const isValidId = (id) => mongoose.Types.ObjectId.isValid(id);

const formatWarehouse = (warehouse) => ({
    _id: warehouse._id,
    name: warehouse.warehouseName,
    code: warehouse.warehouseCode,
    address: warehouse.address || "",
    contactPerson: warehouse.contactPerson || "",
    phone: warehouse.phone || "",
    email: warehouse.email || "",
    city: warehouse.city || "",
    state: warehouse.state || "",
    pincode: warehouse.pincode || "",
    status: warehouse.status,
    isDefault: Boolean(warehouse.isDefault),
    createdAt: warehouse.createdAt,
    updatedAt: warehouse.updatedAt,
});

exports.getWarehouses = async (req, res) => {
    try {
        const page = Math.max(parseInt(req.query.page) || 1, 1);
        const limit = Math.max(parseInt(req.query.limit) || 10, 1);
        const skip = (page - 1) * limit;

        const [warehouses, total] = await Promise.all([
            WarehouseModel.find()
                .sort({ isDefault: -1, createdAt: -1 })
                .skip(skip)
                .limit(limit)
                .lean(),
            WarehouseModel.countDocuments(),
        ]);

        return res.status(200).json({
            status: true,
            message: "Warehouses fetched successfully",
            data: warehouses.map(formatWarehouse),
            pagination: {
                total,
                totalPages: Math.ceil(total / limit),
                currentPage: page,
                limit,
            },
        });
    } catch (error) {
        console.error("Get Warehouses Error:", error);
        return res.status(500).json({
            status: false,
            message: "Failed to fetch warehouses",
            error: error.message,
        });
    }
};

exports.getWarehouseById = async (req, res) => {
    try {
        const { id } = req.params;

        if (!isValidId(id)) {
            return res.status(400).json({
                status: false,
                message: "Invalid warehouse ID",
            });
        }

        const warehouse = await WarehouseModel.findById(id).lean();

        if (!warehouse) {
            return res.status(404).json({
                status: false,
                message: "Warehouse not found",
            });
        }

        return res.status(200).json({
            status: true,
            message: "Warehouse fetched successfully",
            data: formatWarehouse(warehouse),
        });
    } catch (error) {
        console.error("Get Warehouse Error:", error);
        return res.status(500).json({
            status: false,
            message: "Failed to fetch warehouse",
            error: error.message,
        });
    }
};

exports.createWarehouse = async (req, res) => {
    try {
        const {
            name,
            code,
            address,
            contactPerson,
            phone,
            status,
            isDefault,
        } = req.body;

        if (!name?.trim() || !code?.trim()) {
            return res.status(400).json({
                status: false,
                message: "Warehouse name and code are required",
            });
        }

        const existingWarehouse = await WarehouseModel.findOne({
            warehouseCode: code.trim(),
        });

        if (existingWarehouse) {
            return res.status(409).json({
                status: false,
                message: "Warehouse code already exists",
            });
        }

        const warehouse = await WarehouseModel.create({
            warehouseName: name.trim(),
            warehouseCode: code.trim(),
            address: address?.trim() || "",
            contactPerson: contactPerson?.trim() || "",
            phone: phone?.trim() || "",
            status: status || "ACTIVE",
            isDefault: Boolean(isDefault),
        });

        if (warehouse.isDefault) {
            await WarehouseModel.updateMany(
                { _id: { $ne: warehouse._id } },
                { $set: { isDefault: false } }
            );
        }

        return res.status(201).json({
            status: true,
            message: "Warehouse created successfully",
            data: formatWarehouse(warehouse.toObject()),
        });
    } catch (error) {
        console.error("Create Warehouse Error:", error);

        if (error.code === 11000) {
            return res.status(409).json({
                status: false,
                message: "Warehouse code already exists",
            });
        }

        return res.status(500).json({
            status: false,
            message: "Failed to create warehouse",
            error: error.message,
        });
    }
};

exports.updateWarehouse = async (req, res) => {
    try {
        const { id } = req.params;

        if (!isValidId(id)) {
            return res.status(400).json({
                status: false,
                message: "Invalid warehouse ID",
            });
        }

        const {
            name,
            code,
            address,
            contactPerson,
            phone,
            status,
            isDefault,
        } = req.body;

        if (!name?.trim() || !code?.trim()) {
            return res.status(400).json({
                status: false,
                message: "Warehouse name and code are required",
            });
        }

        const existingWarehouse = await WarehouseModel.findOne({
            warehouseCode: code.trim(),
            _id: { $ne: id },
        });

        if (existingWarehouse) {
            return res.status(409).json({
                status: false,
                message: "Warehouse code already exists",
            });
        }

        const warehouse = await WarehouseModel.findById(id);

        if (!warehouse) {
            return res.status(404).json({
                status: false,
                message: "Warehouse not found",
            });
        }

        warehouse.warehouseName = name.trim();
        warehouse.warehouseCode = code.trim();
        warehouse.address = address?.trim() || "";
        warehouse.contactPerson = contactPerson?.trim() || "";
        warehouse.phone = phone?.trim() || "";

        if (status) {
            warehouse.status = status;
        }

        if (typeof isDefault === "boolean") {
            warehouse.isDefault = isDefault;
        }

        if (warehouse.isDefault) {
            await WarehouseModel.updateMany(
                { _id: { $ne: warehouse._id } },
                { $set: { isDefault: false } }
            );
        }

        await warehouse.save();

        return res.status(200).json({
            status: true,
            message: "Warehouse updated successfully",
            data: formatWarehouse(warehouse.toObject()),
        });
    } catch (error) {
        console.error("Update Warehouse Error:", error);

        if (error.code === 11000) {
            return res.status(409).json({
                status: false,
                message: "Warehouse code already exists",
            });
        }

        return res.status(500).json({
            status: false,
            message: "Failed to update warehouse",
            error: error.message,
        });
    }
};

exports.setDefaultWarehouse = async (req, res) => {
    try {
        const { id } = req.params;

        if (!isValidId(id)) {
            return res.status(400).json({
                status: false,
                message: "Invalid warehouse ID",
            });
        }

        const warehouse = await WarehouseModel.findById(id);

        if (!warehouse) {
            return res.status(404).json({
                status: false,
                message: "Warehouse not found",
            });
        }

        if (warehouse.status !== "ACTIVE") {
            return res.status(400).json({
                status: false,
                message: "Only active warehouses can be set as default",
            });
        }

        await WarehouseModel.updateMany(
            { _id: { $ne: id } },
            { $set: { isDefault: false } }
        );

        warehouse.isDefault = true;
        await warehouse.save();

        return res.status(200).json({
            status: true,
            message: "Default warehouse updated successfully",
            data: formatWarehouse(warehouse.toObject()),
        });
    } catch (error) {
        console.error("Set Default Warehouse Error:", error);
        return res.status(500).json({
            status: false,
            message: "Failed to set default warehouse",
            error: error.message,
        });
    }
};

exports.deleteWarehouse = async (req, res) => {
    try {
        const { id } = req.params;

        if (!isValidId(id)) {
            return res.status(400).json({
                status: false,
                message: "Invalid warehouse ID",
            });
        }

        const warehouse = await WarehouseModel.findById(id);

        if (!warehouse) {
            return res.status(404).json({
                status: false,
                message: "Warehouse not found",
            });
        }

        await WarehouseModel.findByIdAndDelete(id);

        return res.status(200).json({
            status: true,
            message: "Warehouse deleted successfully",
        });
    } catch (error) {
        console.error("Delete Warehouse Error:", error);
        return res.status(500).json({
            status: false,
            message: "Failed to delete warehouse",
            error: error.message,
        });
    }
};