const mongoose = require("mongoose");

const ProductIngredientsSchema = new mongoose.Schema(
  {
    productId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Product",
      required: true,
      unique: true,
    },

    ingredientList: {
      type: [String],
      required: true,
      validate: {
        validator: (value) =>
          Array.isArray(value) &&
          value.length > 0 &&
          value.every((item) => typeof item === "string" && item.trim()),
        message: "At least one ingredient is required",
      },
    },

    keyActives: [
      {
        name: {
          type: String,
          required: true,
          trim: true,
        },
        percentage: {
          type: Number,
          required: true,
          min: 0,
          max: 100,
        },
      },
    ],

    freeFrom: {
      fragranceFree: {
        type: Boolean,
        default: false,
      },
      parabenFree: {
        type: Boolean,
        default: false,
      },
      vegan: {
        type: Boolean,
        default: false,
      },
      crueltyFree: {
        type: Boolean,
        default: false,
      },
    },
  },
  {
    timestamps: true,
  }
);

module.exports = mongoose.model(
  "ProductIngredients",
  ProductIngredientsSchema
);