import { NextFunction, Request, Response } from "express";
import { redis } from "../lib/redis";
import UserModel from "../models/user.model";
import { fetchRedis } from "../lib/helper";
import { z } from "zod";

export const handleAddNewFriend = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { email: friendEmail } = req.body;
    const currentUserId = req.body.user._id;

    let newFriendUser;

    //1. check redis chache for user exists
    const newFriend = await redis.get(`userId:${friendEmail}`);

    if (newFriend) {
      newFriendUser = JSON.parse(newFriend);
    } else {
      //2. check user for existence in mongodb if not in redis
      newFriendUser = await UserModel.findOne({ email: friendEmail });

      if (!newFriendUser) {
        return res
          .status(404)
          .json({ error: "user doesn't exists in the database" });
      }

      await redis.set(`userId:${friendEmail}`, JSON.stringify(newFriendUser));
    }

    const idToAdd = newFriendUser._id.toString();

    //3. check if the user is same as the logged in user
    if (idToAdd === currentUserId) {
      return res.status(400).json({ error: "you can't add yourself" });
    }

    //4. check for already sent friend request in both redis and mongodb
    const isAlreadyAdded = await fetchRedis(
      "sismember",
      `userId:${idToAdd}:incoming_friend_requests`,
      currentUserId
    );

    const isRequestInMongoDB = await UserModel.findOne({
      _id: idToAdd,
      incomingFriendRequests: currentUserId,
    });

    if (isAlreadyAdded?.result || isRequestInMongoDB) {
      return res
        .status(400)
        .json({ error: "you have already sent a friend request previously" });
    }

    //5. check for already been friends in redis and mongodb
    const isAlreadyFriends = await fetchRedis(
      "sismember",
      `userId:${currentUserId}:friends`,
      idToAdd
    );

    const isFriendInMongoDB = await UserModel.findOne({
      _id: currentUserId,
      friends: idToAdd,
    });

    if (isAlreadyFriends?.result || isFriendInMongoDB) {
      return res.status(400).json({ error: "You are already friends" });
    }

    //6. If all checks pass, send friend request in redis and mongodb
    redis.sadd(`userId:${idToAdd}:incoming_friend_requests`, currentUserId);

    await UserModel.findByIdAndUpdate(idToAdd, {
      $addToSet: { incomingFriendRequests: currentUserId },
    });

    return res.status(200).json({
      message: "friend request sent",
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(422).json({ error: error.message });
    }
    next(error);
  }
};
