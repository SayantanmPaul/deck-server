import { NextFunction, Request, Response } from "express";
import { redis } from "../lib/redis";
import UserModel from "../models/user.model";
import { fetchRedis } from "../lib/helper";
import { string, z } from "zod";

export const handleSendFriendRequest = async (
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

      await redis.set(
        `userId:${newFriendUser._id}`,
        JSON.stringify(newFriendUser)
      );
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

    //6. If all checks pass, send friend request in redis
    redis.sadd(`userId:${idToAdd}:incoming_friend_requests`, currentUserId);

    //7. update incoming and sent friend requests in mongodb

    await UserModel.findByIdAndUpdate(idToAdd, {
      $addToSet: { incomingFriendRequests: currentUserId },
    });

    await UserModel.findByIdAndUpdate(currentUserId, {
      $addToSet: { sentFriendRequests: idToAdd },
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

export const getIncomingFriendRequestUsers = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    let incomingFriendReqIds;

    // const cachedIncomingFriendReqIds = await fetchRedis(
    //   "smembers",
    //   `userId:${req.body.user._id}:incoming_friend_requests`
    // )

    // if (cachedIncomingFriendReqIds) {
    //   incomingFriendReqIds = cachedIncomingFriendReqIds;
    // } else {
    const incomingFriendReqFromMongo = await UserModel.findById(
      req.body.user._id
    )
      .select("incomingFriendRequests")
      .lean();

    incomingFriendReqIds =
      incomingFriendReqFromMongo?.incomingFriendRequests || [];

    if (incomingFriendReqIds.length === 0) {
      return res.status(200).json({ message: "no incoming friend requests" });
    }

    const allFrindReqUsers =
      (await Promise.all(
        incomingFriendReqIds?.map(async (id) => {
          const user = await UserModel.findById(id)
            .select("firstName lastName email avatar _id")
            .lean();
          return user;
        })
      )) || [];

    return res.status(200).json({
      message: "incoming friend requests fetched successfully",
      incomingFriendReqestUsers: allFrindReqUsers,
    });
  } catch (error) {
    next(error);
  }
};

export const acceptIncomingFriendRequest = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const body = req.body;
    const currentUserId = req.body.user._id;

    const { senderId } = z.object({ senderId: z.string() }).parse(body);

    const isAlreadyFriends = await redis.sismember(
      `userId:${currentUserId}:friends`,
      senderId
    );

    const isAlreadyFriendsInMongo = await UserModel.findOne({
      _id: currentUserId,
      friends: senderId,
    });

    if (isAlreadyFriends || isAlreadyFriendsInMongo) {
      return res.status(400).json({ error: "already friends" });
    }

    const hasFriendRequest = await redis.sismember(
      `userId:${currentUserId}:incoming_friend_requests`,
      `${senderId}`
    );

    const hasFriendRequestInMongo = await UserModel.findOne({
      _id: currentUserId,
      incomingFriendRequests: senderId,
    });

    if (!hasFriendRequest || !hasFriendRequestInMongo) {
      return res.sendStatus(400);
    }

    await redis.sadd(`userId:${currentUserId}:friends`, senderId);

    await redis.sadd(`userId:${senderId}:friends`, currentUserId);

    await redis.srem(
      `userId:${currentUserId}:incoming_friend_requests`,
      senderId
    );

    await UserModel.findByIdAndUpdate(currentUserId, {
      $push: { friends: senderId },
      $pull: { incomingFriendRequests: senderId },
    });

    await UserModel.findByIdAndUpdate(senderId, {
      $push: { friends: currentUserId },
    });

    return res.status(200).json({message: `friend request accepted`});
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(422).json({ error: error.message });
    }
    next(error);
  }
};

export const declineIncomingFriendRequest = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const body = req.body;
    const currentUserId = req.body.user._id;

    const { senderId: IdToDeny } = z
      .object({ senderId: z.string() })
      .parse(body);

    await redis.srem(
      `userId:${currentUserId}:incoming_friend_requests`,
      IdToDeny
    );

    await UserModel.findByIdAndUpdate(currentUserId, {
      $pull: { incomingFriendRequests: IdToDeny },
    });

    return res.status(200).send("friend request removed");
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(422).json({ error: error.message });
    }
    next(error);
  }
};
