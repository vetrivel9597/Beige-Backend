
const mongoose = require("mongoose");

const ProductVariantSchema = new mongoose.Schema(
  {
    variantType: {
      type: String,
      default: ""
    },
    name: {
      type: String,
      default: ""
    },
    sku: {
      type: String,
      default: ""
    },
    barcode: {
      type: String,
      default: ""
    },
    price: {
      type: Number,
      default: 0
    },
    stock: {
      type: Number,
      default: 0,
      min: 0
    },
    size: {
      type: String,
      default: ""
    },
    shade: {
      type: String,
      default: ""
    },
    status: {
      type: String,
      enum: ["ACTIVE", "DRAFT", "ARCHIVED"],
      default: "ACTIVE"
    }
  },
  { _id: true }
);

const ProductSchema = new mongoose.Schema({
  productname: {
    type: String,
    default: "",
    trim: true
  },

  description: {
    type: String,
    default: ""
  },

  pagelink: {
    type: String,
    trim: true,
    default: undefined
  },

  pagemetatitle: {
    type: String,
    default: ""
  },

  pagemetadescription: {
    type: String,
    default: ""
  },

  pagemetakeywords: {
    type: String,
    default: ""
  },

  pageschema: {
    type: String,
    default: ""
  },

  productimages: [
    {
      media: {
        type: String,
        default: ""
      }
    }
  ],

  productStatus: {
    type: Number,
    default: 0
  },

  status: {
    type: String,
    enum: ["ACTIVE", "DRAFT", "ARCHIVED"],
    default: "DRAFT"
  },

  price: {
    type: String,
    default: ""
  },

  gst_price: {
    type: String,
    default: ""
  },

  category: {
    type: String,
    default: ""
  },

  categoryId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "categories"
  },

  subCategory: {
    type: String,
    default: ""
  },

  subCategoryId: {
    type: mongoose.Schema.Types.ObjectId
  },

  size: {
    type: String,
    default: ""
  },

  shade: {
    type: String,
    default: ""
  },

  quantity: {
    type: Number,
    default: 0,
    min: 0
  },

  discount: {
    type: String,
    default: "0"
  },

  discount_price: {
    type: String,
    default: ""
  },

  final_price: {
    type: String,
    default: ""
  },

  productType: {
    type: String,
    enum: ["SKIN_CARE", "BEAUTY"],
    default: "SKIN_CARE"
  },

  brandLine: {
    type: String,
    default: ""
  },

  sku: {
    type: String,
    default: "",
    trim: true
  },

  barcode: {
    type: String,
    default: ""
  },

  mrp: {
    type: Number,
    default: 0,
    min: 0
  },

  sellingPrice: {
    type: Number,
    default: 0,
    min: 0
  },

  gstRate: {
    type: Number,
    default: 0,
    min: 0
  },

  hsnCode: {
    type: String,
    default: ""
  },

  costPrice: {
    type: Number,
    default: 0,
    min: 0
  },

  collections: [
    {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Collection"
    }
  ],

  lowStockThreshold: {
    type: Number,
    default: 5,
    min: 0
  },

  variants: {
    type: [ProductVariantSchema],
    default: []
  },

  ingredients: [
    {
      name: {
        type: String,
        default: ""
      },
      percentage: {
        type: Number,
        default: 0,
        min: 0,
        max: 100
      }
    }
  ],

  keyActives: [
    {
      name: {
        type: String,
        default: ""
      },
      percentage: {
        type: Number,
        default: 0,
        min: 0,
        max: 100
      }
    }
  ],

  freeFrom: [
    {
      type: String
    }
  ],

  skinTypes: [
    {
      type: String,
      enum: ["oily", "dry", "combination", "normal", "sensitive"]
    }
  ],

  concerns: [
    {
      name: {
        type: String
      },
      strength: {
        type: Number,
        min: 1,
        max: 3
      }
    }
  ],

  routineStep: {
    type: String,
    enum: [
      "cleanser",
      "toner",
      "serum",
      "moisturiser",
      "sunscreen",
      "mask",
      "treatment",
      ""
    ],
    default: ""
  },

  timeOfUse: [
    {
      type: String,
      enum: ["AM", "PM", "BOTH"]
    }
  ],

  contraindications: [
    {
      type: String
    }
  ],

  includeInAI: {
    type: Boolean,
    default: false
  },

  productRole: {
    type: String,
    default: ""
  },

  finish: {
    type: String,
    default: ""
  },

  coverage: {
    type: String,
    default: ""
  },

  suitableLooks: [
    {
      type: String
    }
  ],

  priceBand: {
    type: String,
    enum: ["budget", "mid", "premium", ""],
    default: ""
  },

  metaTitle: {
    type: String,
    default: ""
  },

  metaDescription: {
    type: String,
    default: ""
  },

  slug: {
    type: String,
    default: "",
    trim: true
  },

  video: {
    type: String,
    default: ""
  },

  altText: {
    type: String,
    default: ""
  },

  updatedAt: {
    type: Date,
    default: Date.now
  },

  createdAt: {
    type: Date,
    default: Date.now
  }
});






ProductSchema.pre("validate", function (next) {
  const statusMap = {
    ACTIVE: 1,
    DRAFT: 0,
    ARCHIVED: 2
  };

  const reverseStatusMap = {
    1: "ACTIVE",
    0: "DRAFT",
    2: "ARCHIVED"
  };

  if (
    this.isModified("status") &&
    !this.isModified("productStatus")
  ) {
    this.productStatus = statusMap[this.status] ?? 0;
  } else if (
    this.isModified("productStatus") &&
    !this.isModified("status")
  ) {
    this.status = reverseStatusMap[this.productStatus] || "DRAFT";
  } else if (!this.status) {
    this.status = reverseStatusMap[this.productStatus] || "DRAFT";
  }

  next();
});

ProductSchema.pre("save", function (next) {
  this.updatedAt = new Date();
  next();
});

ProductSchema.index(
  { pagelink: 1 },
  {
    unique: true,
    partialFilterExpression: {
      pagelink: { $type: "string" }
    }
  }
);

ProductSchema.index(
  { sku: 1 },
  {
    unique: true,
    partialFilterExpression: {
      sku: { $type: "string", $gt: "" }
    }
  }
);

ProductSchema.index({ categoryId: 1 });
ProductSchema.index({ productStatus: 1 });
ProductSchema.index({ quantity: 1 });
ProductSchema.index({ productType: 1 });
ProductSchema.index({ status: 1 });
ProductSchema.index({ createdAt: -1 });

module.exports = mongoose.model("Product", ProductSchema);
