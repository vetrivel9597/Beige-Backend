const AIAnalysis = require('../models/AIAnalysis');

async function list(req, res, next) {
  try {
    const analyses = await AIAnalysis.find({ userId: res.locals.user_id })
      .select('mode analysis makeup recommendedProducts createdAt')
      .sort({ createdAt: -1 })
      .limit(50)
      .lean();
    return res.json({ status: true, analyses });
  } catch (error) { return next(error); }
}

async function removeAll(req, res, next) {
  try {
    const result = await AIAnalysis.deleteMany({ userId: res.locals.user_id });
    return res.json({ status: true, deletedCount: result.deletedCount });
  } catch (error) { return next(error); }
}

module.exports = { list, removeAll };
