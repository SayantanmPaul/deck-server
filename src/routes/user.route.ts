import express from "express";
import {
  getCurrentUser,
  handleRefreshToken,
  handleUserLogout,
  handleUserSignIn,
  handleUserSignUp,
} from "../controller/user.controller";
import { authenticateToken } from "../middlewares/authenticate.middleware";
import { handleAddNewFriend } from "../controller/friendreq.controller";

export const userRouter = express.Router();

userRouter.post("/user/signup", handleUserSignUp);

userRouter.post("/user/signin", handleUserSignIn);

userRouter.post("/user/refresh", handleRefreshToken);

userRouter.post("/user/logout", authenticateToken, handleUserLogout);

userRouter.get("/user", authenticateToken, getCurrentUser);

userRouter.post("/user/add-friend", authenticateToken, handleAddNewFriend);

// userRouter.get('/', )
