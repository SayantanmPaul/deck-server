import mongoose from "mongoose";

const RANDOM_NAME_LIST = [
  "Princess",
  "Charlie",
  "Ginger",
  "Boots",
  "Luna",
  "Kitty",
  "Cuddles",
  "Cookie",
  "Bandit",
  "Mittens",
  "Sophie",
  "Angel",
  "Shadow",
  "Trouble",
  "Chester",
  "Snuggles",
  "Casper",
  "Baby",
  "Pepper",
  "Loki",
];
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
    avatar: {
      type: String,
      default: () => {
        return `https://api.dicebear.com/9.x/shapes/svg?seed=${
          RANDOM_NAME_LIST[Math.floor(Math.random() * RANDOM_NAME_LIST.length)]
        }`;
      },
    },
  },
  {
    timestamps: true,
  }
);

const UserModel = mongoose.model("users", userSchema);

export default UserModel;
