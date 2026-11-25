const mongoose = require("mongoose");

const ProductAiTagsSchema = new mongoose.Schema(
  {
    productId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Product",
      required: true,
      unique: true,
    },

    productType: {
      type: String,
      enum: ["SKIN_CARE", "BEAUTY"],
      required: true,
    },

    skinTypes: {
      type: [String],
      default: [],
    },

    concerns: [
      {
        name: {
          type: String,
          required: true,
          trim: true,
        },
        strength: {
          type: Number,
          required: true,
          min: 1,
          max: 3,
        },
      },
    ],

    routineStep: {
      type: String,
      default: "",
    },

    timeOfUse: {
      type: String,
      default: "BOTH",
    },

    contraindications: {
      type: [String],
      default: [],
    },

    beauty: {
      productRole: {
        type: String,
        default: "",
      },
      finish: {
        type: String,
        default: "",
      },
      coverage: {
        type: String,
        default: "",
      },
      suitableLooks: {
        type: [String],
        default: [],
      },
    },

    priceBand: {
      type: String,
      default: "",
    },

    includeInAIRecommendations: {
      type: Boolean,
      default: true,
    },
  },
  {
    timestamps: true,
  }
);

module.exports = mongoose.model(
  "ProductAiTags",
  ProductAiTagsSchema
);