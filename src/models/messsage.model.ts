import mongoose from "mongoose";

const messageSchema= new mongoose.Schema({
    senderId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "users",
        required: true,
    },
    text: {
        type: String,
        required: true,
    },
    timeStamp: {
        type: Number,
        required: true,
    },
})

const MessageModel = mongoose.model("Message", messageSchema);

export default MessageModel;