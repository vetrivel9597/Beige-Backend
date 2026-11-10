const mongoose = require("mongoose");
const schema =mongoose.Schema;

const PageSchema = new schema({
    pagetitle:{
        type:String
    },
    pagelink:{
        type:String
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
    pageimage:{
        type:String
    },
});

module.exports = mongoose.model("pagedetail" ,PageSchema)