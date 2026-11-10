const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const PromoCodeSchema = new Schema({
  userid: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  promoCodes: [{
    code: { type: String },
  }],
  createdAt: {
    type: Date,
    default: Date.now
}
 
});

module.exports = mongoose.model('promocode', PromoCodeSchema);
