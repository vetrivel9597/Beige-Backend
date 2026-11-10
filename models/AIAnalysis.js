const mongoose = require('mongoose');

const AIAnalysisSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  mode: { type: String, enum: ['skin', 'makeup'], required: true },
  analysis: { type: mongoose.Schema.Types.Mixed, default: null },
  makeup: { type: mongoose.Schema.Types.Mixed, default: null },
  recommendedProducts: { type: [mongoose.Schema.Types.Mixed], default: [] },
  consentedAt: { type: Date, required: true },
  createdAt: { type: Date, default: Date.now, index: true },
});

module.exports = mongoose.model('AIAnalysis', AIAnalysisSchema);
