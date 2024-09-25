import express from "express";
import {
  getCurrentUser,
  handleRefreshToken,
  handleUserLogout,
  handleUserSignIn,
  handleUserSignUp,
} from "../controller/user.controller";
import { authenticateToken } from "../middlewares/authenticate.middleware";
import {
  acceptIncomingFriendRequest,
  declineIncomingFriendRequest,
  getFriendsByUserId,
  getIncomingFriendRequestUsers,
  handleSendFriendRequest,
} from "../controller/friendreq.controller";
import {
  getConversationFriendInfo,
  getConversationsMessages,
  sendMessageToPartner,
} from "../controller/conversations.controller";

export const userRouter = express.Router();

userRouter.post("/user/signup", handleUserSignUp);

userRouter.post("/user/signin", handleUserSignIn);

userRouter.post("/user/refresh", handleRefreshToken);

userRouter.post("/user/logout", authenticateToken, handleUserLogout);

userRouter.get("/user", authenticateToken, getCurrentUser);

userRouter.post("/user/add-friend", authenticateToken, handleSendFriendRequest);

userRouter.get(
  "/user/friend-requests",
  authenticateToken,
  getIncomingFriendRequestUsers
);

userRouter.post(
  "/user/friend-requests/accept",
  authenticateToken,
  acceptIncomingFriendRequest
);

userRouter.post(
  "/user/friend-requests/decline",
  authenticateToken,
  declineIncomingFriendRequest
);

userRouter.get("/user/friends", authenticateToken, getFriendsByUserId);

userRouter.get(
  "/user/conversation/partnerDetails",
  authenticateToken,
  getConversationFriendInfo
);

userRouter.post(
  "/user/conversation/send",
  authenticateToken,
  sendMessageToPartner
);

userRouter.get(
  "/user/conversation/messages",
  authenticateToken,
  getConversationsMessages
);
// userRouter.get('/', )
