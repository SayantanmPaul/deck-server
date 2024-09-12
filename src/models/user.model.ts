import mongoose from "mongoose";

const userSchema = new mongoose.Schema(
  {
    firstName: {
      type: String,
      required: true,
    },
    lastName: {
      type: String,
      required: true,
    },
    email: {
      type: String,
      required: true,
      unique: true,
      trim: true,
    },
    password: {
      type: String,
      required: true,
    },
    bio: {
      type: String,
    },
    refreshToken: {
      type: String,
    },
  },
  {
    timestamps: true,
  }
);

const UserModel = mongoose.model("users", userSchema);

export default UserModel;
