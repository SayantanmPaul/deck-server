import mongoose from "mongoose";

const handleConnectionToMongoDB = async (url: string) => {
  try {
    await mongoose.connect(url, {
      connectTimeoutMS: 30000,
    });
    console.log("succeesfully connected databse");
  } catch (error) {
    console.error("error in mongo connection:", error);
  }
};

export default handleConnectionToMongoDB;
