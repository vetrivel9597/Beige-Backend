require("../config/environment");

const Groq = require("groq-sdk");
const multer = require("multer");
const sharp = require("sharp");
const Product = require("../models/Product");
const AIAnalysis = require("../models/AIAnalysis");
const { getVisionImages, isImageFile, isVideoFile } = require("../utils/aiMedia");

const groq = new Groq({
  apiKey: process.env.GROQ_API_KEY,
});



const getProductText = (product) => {
  return [
    product.productname,
    product.description,
    product.category,
    product.subCategory,
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
};


const getRecommendedProducts = (
  aiProducts,
  products,
  skinAnalysis,
  hairAnalysis,
  answers
) => {
  const productMap = new Map(
    products.map((product) => [
      String(product._id),
      product,
    ])
  );

  const selected = new Map();

  if (Array.isArray(aiProducts)) {
    for (const item of aiProducts) {
      if (!item) continue;

      const id = String(item.productId || item._id || "");

      if (productMap.has(id)) {
        const product = productMap.get(id);

        selected.set(id, {
          product,
          reason: item.reason || "Selected based on your care profile.",
          usage: item.usage || "Follow the product label instructions.",
          priority: item.priority || "medium",
        });
      }
    }
  }


  if (selected.size < 3) {
    const skinText = [
      skinAnalysis?.skinType,
      skinAnalysis?.summary,
      ...(skinAnalysis?.visibleConcerns || []).map(
        (item) => `${item.concern || ""} ${item.observation || ""}`
      ),
      ...answers
        .filter((item) => item.category === "Skin")
        .map((item) => `${item.question} ${item.answer}`),
    ]
      .join(" ")
      .toLowerCase();

    const hairText = [
      hairAnalysis?.hairType,
      hairAnalysis?.scalpCondition,
      hairAnalysis?.hairCondition,
      hairAnalysis?.summary,
      ...answers
        .filter((item) => item.category === "Hair")
        .map((item) => `${item.question} ${item.answer}`),
    ]
      .join(" ")
      .toLowerCase();

    const skinKeywords = [
      "acne",
      "pimple",
      "blemish",
      "breakout",
      "pigmentation",
      "dark spot",
      "uneven tone",
      "oiliness",
      "oily",
      "dryness",
      "dry skin",
      "sensitive",
      "redness",
      "texture",
      "dark circle",
    ];

    const skinProductKeywords = [
      "face wash",
      "cleanser",
      "serum",
      "moisturizer",
      "moisturiser",
      "sunscreen",
      "face cream",
      "skin care",
      "skincare",
      "toner",
      "acne",
      "niacinamide",
      "salicylic",
      "pigmentation",
      "brightening",
    ];

    const hairProductKeywords = [
      "shampoo",
      "conditioner",
      "hair oil",
      "hair serum",
      "hair mask",
      "hair care",
      "haircare",
    ];

    const skinConcernMatches = skinKeywords.filter((keyword) =>
      skinText.includes(keyword)
    );

    const isHairRelevant = hairText.length > 0;

    const scoredProducts = products
      .filter((product) => !selected.has(String(product._id)))
      .map((product) => {
        const text = getProductText(product);

        const isSkinProduct = skinProductKeywords.some((keyword) =>
          text.includes(keyword)
        );

        const isHairProduct = hairProductKeywords.some((keyword) =>
          text.includes(keyword)
        );

        let score = 0;
        let reason = "";

        if (isSkinProduct) {
          score += 2;

          const matchedConcerns = skinConcernMatches.filter((keyword) =>
            text.includes(keyword)
          );

          score += matchedConcerns.length * 3;

          if (matchedConcerns.length > 0) {
            reason =
              `Selected because its product information matches your visible skin concerns: ${matchedConcerns.join(", ")}.`;
          } else {
            reason =
              "Selected as a general skincare option based on your skin profile.";
          }
        }

        if (isHairRelevant && isHairProduct) {
          score += 2;

          if (hairText.includes("chemically treated") ||
            hairText.includes("chemically")) {
            if (
              text.includes("repair") ||
              text.includes("damage") ||
              text.includes("treated") ||
              text.includes("conditioner") ||
              text.includes("hair mask")
            ) {
              score += 2;
              // ✅ FIX: don't overwrite a stronger skin-based reason
              if (!reason) {
                reason =
                  "Selected as a haircare option for your chemically treated hair.";
              }
            }
          } else if (!reason) {
            // ✅ FIX: don't overwrite a stronger skin-based reason
            reason =
              "Selected as a haircare option based on your hair questionnaire.";
          }
        }

        return {
          product,
          score,
          reason,
        };
      })
      .filter((item) => item.score >= 2)
      .sort((a, b) => b.score - a.score);

    for (const item of scoredProducts) {
      if (selected.size >= 3) break;

      const id = String(item.product._id);

      selected.set(id, {
        product: item.product,
        reason: item.reason,
        usage: "Use according to the product instructions. Check the ingredients before use.",
        priority: item.score >= 5 ? "high" : "medium",
      });
    }
  }


  return Array.from(selected.values()).map(
    ({ product, reason, usage, priority }) => ({
      _id: String(product._id),
      productname: product.productname,
      description: product.description || "",
      pagelink: product.pagelink || "",
      productimages: product.productimages || [],
      price: product.price ?? null,
      final_price: product.final_price ?? product.price ?? null,
      category: product.category || "",
      subCategory: product.subCategory || "",
      reason,
      usage,
      priority,
    })
  );
};



const SkinAnalyze = async (req, res) => {
  try {


    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: "Please upload a face image or video.",
      });
    }

    if (!isImageFile(req.file) && !isVideoFile(req.file)) {
      return res.status(400).json({
        success: false,
        message: "Please upload a supported image or video.",
      });
    }

    if (!isVideoFile(req.file) && req.file.size > 10 * 1024 * 1024) {
      return res.status(400).json({
        success: false,
        message: "Image size must be 10 MB or less.",
      });
    }

    let answers = req.body.answers;

    if (typeof answers === "string") {
      try {
        answers = JSON.parse(answers);
      } catch {
        return res.status(400).json({
          success: false,
          message: "Answers must be valid JSON.",
        });
      }
    }

    if (!Array.isArray(answers) || answers.length === 0) {
      return res.status(400).json({
        success: false,
        message: "Please provide questionnaire answers.",
      });
    }

    const validAnswers = answers.every((item) => {
      return (
        item &&
        typeof item.question === "string" &&
        typeof item.answer === "string" &&
        ["Skin", "Hair"].includes(item.category) &&
        item.question.trim() &&
        item.answer.trim()
      );
    });

    if (!validAnswers) {
      return res.status(400).json({
        success: false,
        message: "Invalid questionnaire answer format.",
      });
    }


    const products = await Product.find({
      productStatus: 1,
      quantity: { $gt: 0 },
    })
      .select(
        "productname description pagelink productimages price final_price category subCategory size shade productStatus quantity"
      )
      .limit(20)
      .lean();

    if (!products.length) {
      return res.status(404).json({
        success: false,
        message: "No available products found.",
      });
    }

    const productCatalog = products.map((product) => ({
      productId: String(product._id),
      name: product.productname || "",
      description: (product.description || "").slice(0, 100),
      category: String(product.category || ""),
      subCategory: String(product.subCategory || ""),
      price: product.final_price ?? product.price ?? null,
    }));

    const visionImages = await getVisionImages(req.file);

    const selectedImages = visionImages.slice(
      0,
      isVideoFile(req.file) ? 2 : 1
    );

    if (!selectedImages.length) {
      return res.status(400).json({
        success: false,
        message: "Unable to extract images from uploaded media.",
      });
    }

    const optimizedImages = await Promise.all(
      selectedImages.map(async ({ buffer }) => {
        const optimizedBuffer = await sharp(buffer)
          .rotate()
          .resize({
            width: 512,
            height: 512,
            fit: "inside",
            withoutEnlargement: true,
          })
          .jpeg({
            quality: 65,
          })
          .toBuffer();

        return {
          buffer: optimizedBuffer,
          mimeType: "image/jpeg",
        };
      })
    );

    const mediaDescription = isVideoFile(req.file)
      ? "The uploaded video is represented by up to two sampled frames. Analyze the visible appearance across those frames."
      : "Analyze the uploaded image.";

    const prompt = `
You are an expert cosmetic skincare and haircare recommendation assistant.

${mediaDescription}

USER QUESTIONNAIRE ANSWERS:
${JSON.stringify(answers)}

AVAILABLE DATABASE PRODUCTS:
${JSON.stringify(productCatalog)}

IMPORTANT IMAGE RULES:
- Analyze only clearly visible cosmetic characteristics.
- Never diagnose diseases or medical conditions.
- Do not claim image observations prove a skin type.
- Use questionnaire answers to assess skin type.
- Mention uncertainty when appropriate.
- Do not invent skin concerns.

SKIN ANALYSIS:
- Identify at most 2 visible concerns.
- Consider acne, blemishes, pigmentation, uneven tone,
  dryness, visible oiliness and dark circles.
- Mention only clearly visible concerns.

HAIR ANALYSIS:
- Use the hair questionnaire answers.
- Do not claim to diagnose scalp conditions from a face image.
- Do not invent unobservable hair characteristics.

PRODUCT SELECTION:
- Recommend products ONLY from the supplied database.
- Copy productId exactly.
- Never invent product IDs, names or prices.
- Recommend relevant products based on the answers and analysis.
- Recommend a maximum of 3 products.
- Return an empty array if no suitable products exist.

ROUTINE:
- Maximum 2 morning steps.
- Maximum 2 night steps.
- Maximum 2 haircare steps.
- Maximum 2 general advice points.
- Keep descriptions short.

Return valid JSON only in this structure:

{
  "skinAnalysis": {
    "skinType": "",
    "skinToneObservation": "",
    "visibleConcerns": [
      {
        "concern": "",
        "observation": "",
        "confidence": "low"
      }
    ],
    "imageQuality": "",
    "summary": ""
  },
  "hairAnalysis": {
    "hairType": "",
    "scalpCondition": "",
    "hairCondition": "",
    "summary": ""
  },
  "recommendations": {
    "morningRoutine": [],
    "nightRoutine": [],
    "hairCareRoutine": [],
    "generalAdvice": []
  },
  "recommendedProducts": [
    {
      "productId": "",
      "reason": "",
      "usage": "",
      "priority": "high"
    }
  ],
  "disclaimer": "This is an AI-generated cosmetic assessment, not a medical diagnosis."
}
`;

    const completion = await groq.chat.completions.create({
      model: "qwen/qwen3.8-27b",
      temperature: 0.1,

      max_completion_tokens: 900,

      response_format: {
        type: "json_object",
      },

      messages: [
        {
          role: "system",
          content:
            "You are a careful cosmetic skincare and haircare assistant. Return valid JSON only. Never invent products or IDs. Keep responses concise.",
        },
        {
          role: "user",
          content: [
            {
              type: "text",
              text: prompt,
            },
            ...optimizedImages.map(({ buffer, mimeType }) => ({
              type: "image_url",
              image_url: {
                url: `data:${mimeType};base64,${buffer.toString("base64")}`,
              },
            })),
          ],
        },
      ],
    });

    const choice = completion.choices?.[0];

    const aiContent = choice?.message?.content;

    if (!aiContent) {
      throw new Error("Groq returned an empty response.");
    }

    let aiResult;

    try {
      aiResult = JSON.parse(aiContent);
    } catch (error) {
      console.error("Invalid Groq JSON:", aiContent);
      throw new Error("Groq returned invalid JSON.");
    }

    const skinAnalysis = aiResult.skinAnalysis || {};
    const hairAnalysis = aiResult.hairAnalysis || {};
    const recommendations = aiResult.recommendations || {};

    const recommendedProducts = getRecommendedProducts(
      aiResult.recommendedProducts,
      products,
      skinAnalysis,
      hairAnalysis,
      answers
    );

    console.log(
      "FINAL RECOMMENDED PRODUCTS:",
      recommendedProducts.map((product) => ({
        id: product._id,
        name: product.productname,
      }))
    );

    return res.status(200).json({
      success: true,
      message: "Skin and hair analysis completed successfully.",
      data: {
        skinAnalysis,
        hairAnalysis,
        recommendations,
        recommendedProducts,
        disclaimer:
          aiResult.disclaimer ||
          "This is an AI-generated cosmetic assessment, not a medical diagnosis.",
      },
    });

  } catch (error) {
    console.error("Skin analysis error:", error);

    if (error instanceof multer.MulterError) {
      return res.status(400).json({
        success: false,
        message:
          error.code === "LIMIT_FILE_SIZE"
            ? "Image size must be 10 MB or video size must be 50 MB or less."
            : error.message,
      });
    }

    if (error.status === 429) {
      const groqErrorMessage =
        error.error?.error?.message || error.message || "";

      const retryAfter = Number(
        error.headers?.get?.("retry-after") || 0
      );

      const isDailyLimit =
        groqErrorMessage.toLowerCase().includes("tokens per day") ||
        groqErrorMessage.toLowerCase().includes("token limit");

      return res.status(429).json({
        success: false,
        message: isDailyLimit
          ? "Daily AI token limit reached. Please try again after the quota resets."
          : "AI rate limit reached. Please try again later.",
        retryAfterSeconds: retryAfter,
        retryAfterMinutes: Math.ceil(retryAfter / 60),
        limitType: isDailyLimit
          ? "daily_token_limit"
          : "rate_limit",
      });
    }

    if (error.status === 400) {
      return res.status(400).json({
        success: false,
        message: error.message || "Invalid AI request.",
      });
    }

    return res.status(500).json({
      success: false,
      message: "Unable to analyze your uploaded media right now.",
      error:
        process.env.NODE_ENV === "development"
          ? error.message
          : undefined,
    });
  }
};



const MakeupAnalyze = async (req, res) => {
  try {
    const { lipColor, foundationShade } = req.body;

    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: "Please upload a face image or video.",
      });
    }

    if (!isImageFile(req.file) && !isVideoFile(req.file)) {
      return res.status(400).json({ success: false, message: "Please upload a supported image or video." });
    }

    if (!isVideoFile(req.file) && req.file.size > 10 * 1024 * 1024) {
      return res.status(400).json({ success: false, message: "Image size must be 10 MB or less." });
    }

    if (!lipColor || !foundationShade) {
      return res.status(400).json({
        success: false,
        message: "Lip colour and foundation shade are required.",
      });
    }

    const visionImages = await getVisionImages(req.file);
    const optimizedImages = await Promise.all(visionImages.map(async ({ buffer }) =>
      sharp(buffer)
        .rotate()
        .resize(1024, 1024, { fit: "inside", withoutEnlargement: true })
        .jpeg({ quality: 85 })
        .toBuffer()
    ));
    const mediaDescription = isVideoFile(req.file)
      ? "Analyze the uploaded video using the provided sampled frames, taken from its first 12 seconds."
      : "Analyze the uploaded face image.";

    const prompt = `
You are a professional makeup artist and cosmetic shade consultant.

Your task is to analyze the uploaded face image or video and provide
personalized FACE BASE MAKEUP recommendations.

${mediaDescription}

USER SELECTED MAKEUP:

Lip Colour: ${lipColor}
Foundation Shade: ${foundationShade}

IMPORTANT INSTRUCTIONS:

1. Analyze only visible cosmetic characteristics in the image.
2. Estimate visible skin depth and undertone cautiously.
3. Consider lighting, camera filters and image quality.
4. Do not pretend to know an exact skin tone or undertone
   when the image does not provide enough evidence.
5. Evaluate whether the selected foundation shade
   appears suitable for the visible complexion.
6. Do not automatically approve the selected foundation.
7. Suggest a better shade direction if the selected shade
   appears too light, too dark, too warm or too cool.
8. Consider the selected lip colour when recommending
   blush, bronzer, highlighter and overall makeup balance.
9. Recommend practical makeup techniques.
10. Do not diagnose skin diseases or medical conditions.
11. Do not invent product brands or product names.
12. Give honest, specific and practical recommendations.

ANALYSIS REQUIRED:

A. Visible skin tone
B. Possible undertone
C. Selected foundation suitability
D. Foundation shade adjustment
E. Primer recommendation
F. Concealer recommendation
G. Colour corrector recommendation
H. Foundation coverage and finish
I. Setting powder recommendation
J. Blush recommendation
K. Bronzer recommendation
L. Highlighter recommendation
M. Lip colour compatibility
N. Complete face base makeup routine

Return ONLY valid JSON in this structure:

{
  "skinAnalysis": {
    "visibleSkinTone": "",
    "possibleUndertone": "",
    "confidence": "Low / Medium / High",
    "observation": ""
  },
  "foundationAnalysis": {
    "selectedShade": "${foundationShade}",
    "suitability": "Suitable / Slightly Light / Slightly Dark / Too Warm / Too Cool / Cannot Determine",
    "reason": "",
    "recommendedShadeDirection": "",
    "coverage": "",
    "finish": ""
  },
  "makeupRecommendations": {
    "primer": {
      "type": "",
      "reason": ""
    },
    "concealer": {
      "shadeDirection": "",
      "type": "",
      "application": ""
    },
    "colorCorrector": {
      "recommended": "",
      "reason": ""
    },
    "foundation": {
      "recommendation": "",
      "application": ""
    },
    "settingPowder": {
      "shade": "",
      "type": ""
    },
    "blush": {
      "recommendedColors": [],
      "reason": ""
    },
    "bronzer": {
      "shadeDirection": "",
      "application": ""
    },
    "highlighter": {
      "recommendedColors": "",
      "application": ""
    }
  },
  "lipColorAnalysis": {
    "selectedColor": "${lipColor}",
    "compatibility": "",
    "baseMakeupAdjustment": ""
  },
  "completeRoutine": [
    {
      "step": 1,
      "productType": "",
      "instruction": ""
    }
  ],
  "finalSuggestion": "",
  "imageLimitations": ""
}

Keep recommendations concise, specific and useful.
Never claim laboratory-level shade matching from a photograph.
`;

    const completion = await groq.chat.completions.create({
      model: "qwen/qwen3.8-27b",

      messages: [
        {
          role: "system",
          content:
            "You are an expert professional makeup artist and cosmetic shade consultant. Analyze images carefully and return accurate, honest JSON recommendations.",
        },
        {
          role: "user",
          content: [
            {
              type: "text",
              text: prompt,
            },
            ...optimizedImages.map((buffer) => ({
              type: "image_url",
              image_url: {
                url: `data:image/jpeg;base64,${buffer.toString("base64")}`,
              },
            })),
          ],
        },
      ],

      temperature: 0.2,
      max_completion_tokens: 800,
      response_format: {
        type: "json_object",
      },
    });

    const aiResponse =
      completion.choices[0]?.message?.content;

    if (!aiResponse) {
      throw new Error("Empty response received from Groq AI.");
    }

    const analysis = JSON.parse(aiResponse);

    return res.status(200).json({
      success: true,
      message: "Makeup base analysis completed successfully.",
      selectedOptions: {
        lipColor,
        foundationShade,
      },
      data: analysis,
    });

  } catch (error) {
    console.error("Makeup AI Analysis Error:", error);

    if (error.status === 400) {
      return res.status(400).json({ success: false, message: error.message });
    }

    return res.status(500).json({
      success: false,
      message: "Unable to analyze your makeup. Please try again.",
      error:
        process.env.NODE_ENV === "development"
          ? error.message
          : undefined,
    });
  }
};

module.exports = {
  SkinAnalyze,
  MakeupAnalyze
};
