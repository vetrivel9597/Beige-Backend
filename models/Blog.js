const mongoose = require('mongoose');

const BlogSchema = new mongoose.Schema({
    blogTitle: {
        type: String,
    },
    blogDescription: {
        type: String,
    },
    pagelink:{
        type:String,
    },
    pagemetatitle:{
        type:String
    },
    pagemetadescription:{
        type:String
    },
    pagemetakeywords:{
        type:String
    },
    pageschema:{
        type:String
    },
    blogImage: {
        type: String,
    },
    blogType : {
        type: String,
    },
    categoryId:{
        type: mongoose.Schema.Types.ObjectId,
        ref: 'categories',
    },
    createdAt: {
        type: Date,
    }
});

module.exports = mongoose.model("Blog", BlogSchema);
