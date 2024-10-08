import mongoose from "mongoose";

export const RANDOM_NAME_LIST = [
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
    userName: {
      type: String,
      unique: true,
      trim: true,
    },
    friends: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "users",
      },
    ],
    incomingFriendRequests: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "users",
      },
    ],
    sentFriendRequests: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "users",
      },
    ],
  },
  {
    timestamps: true,
  }
);

const UserModel = mongoose.model("users", userSchema);

export default UserModel;
