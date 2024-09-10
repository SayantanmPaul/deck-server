import mongoose from "mongoose";

const handleConnectionToMongoDB = async(url: string) => {
    try {
        await mongoose.connect(url);
    } catch (error) {
        console.error(error);
    }
};

export default handleConnectionToMongoDB;
