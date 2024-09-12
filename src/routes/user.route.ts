import express from "express";
import {
  handleRefreshToken,
  handleUserLogout,
  handleUserSignIn,
  handleUserSignUp,
} from "../controller/user.controller";
import { authenticateToken } from "../../middlewares/authenticate.middleware";

export const userRouter = express.Router();

userRouter.post("/user/signup", handleUserSignUp);

userRouter.post("/user/signin", handleUserSignIn);

userRouter.post("/user/refresh", handleRefreshToken);

userRouter.post("/user/logout", authenticateToken, handleUserLogout);

// userRouter.get('/', )
