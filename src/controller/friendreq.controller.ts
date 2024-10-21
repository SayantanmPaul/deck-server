import { NextFunction, Request, Response } from "express";
import { z } from "zod";
import { pusherServer, toPusherKey } from "../lib/pusher";
import { redis } from "../lib/redis";
import UserModel from "../models/user.model";

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
    if (idToAdd === currentUserId.toString()) {
      return res.status(400).json({ error: "you can't add yourself" });
    }

    //4. check for already sent friend request in both redis and mongodb
    const isAlreadyAdded = (await redis.sismember(
      `userId:${idToAdd}:incoming_friend_requests`,
      currentUserId
    )) as 0 | 1;

    const isRequestInMongoDB = await UserModel.findOne({
      _id: idToAdd,
      incomingFriendRequests: currentUserId,
    });

    if (isAlreadyAdded || isRequestInMongoDB) {
      return res
        .status(400)
        .json({ error: "you have already sent a friend request previously" });
    }

    //5. check for already been friends in redis and mongodb
    const isAlreadyFriends = (await redis.sismember(
      `userId:${currentUserId}:friends`,
      idToAdd
    )) as 0 | 1;

    const isFriendInMongoDB: number =
      (await UserModel.countDocuments({
        _id: currentUserId,
        friends: idToAdd,
      })) > 0
        ? 1
        : 0;

    if (isAlreadyFriends || isFriendInMongoDB) {
      return res.status(400).json({ error: "You are already friends" });
    }

    pusherServer.trigger(
      toPusherKey(`user:${idToAdd}:incoming_friend_requests`),
      "incoming_friend_requests",
      {
        _id: currentUserId,
        firstName: req.body.user.firstName,
        lastName: req.body.user.lastName,
        email: req.body.user.email,
        avatar: req.body.user.avatar,
      }
    );
    console.log(`Pusher event triggered for ${idToAdd}`);

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

    const [userRaw, friendsRaw] = (await Promise.all([
      redis.get(`userId:${currentUserId}`),
      redis.get(`userId:${senderId}`),
    ])) as [string, string];

    const user = JSON.parse(userRaw);
    const friend = JSON.parse(friendsRaw);

    await Promise.all([
      pusherServer.trigger(
        toPusherKey(`user:${senderId}:friends`),
        "new_friend",
        user
      ),
      pusherServer.trigger(
        toPusherKey(`user:${currentUserId}:friends`),
        "new_friend",
        friend
      ),
      redis.sadd(`userId:${currentUserId}:friends`, senderId),

      redis.sadd(`userId:${senderId}:friends`, currentUserId),

      redis.srem(`userId:${currentUserId}:incoming_friend_requests`, senderId),

      UserModel.findByIdAndUpdate(currentUserId, {
        $push: { friends: senderId },
        $pull: { incomingFriendRequests: senderId },
      }),

      UserModel.findByIdAndUpdate(senderId, {
        $push: { friends: currentUserId },
      }),
    ]);

    return res.status(200).json({ message: `friend request accepted` });
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

    await Promise.all([
      pusherServer.trigger(
        toPusherKey(`user:${currentUserId}:friends`),
        "friend_decline",
        { senderId: IdToDeny }
      ),
      redis.srem(`userId:${currentUserId}:incoming_friend_requests`, IdToDeny),

      UserModel.findByIdAndUpdate(currentUserId, {
        $pull: { incomingFriendRequests: IdToDeny },
      }),
    ]);

    return res.status(200).send("friend request removed");
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(422).json({ error: error.message });
    }
    next(error);
  }
};

//retriving friends for current user
export const getFriendsByUserId = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const userFriendsFromMongo = await UserModel.findById(req.body.user._id)
      .select("friends")
      .lean();

    const friendsIds = userFriendsFromMongo?.friends || [];

    if (friendsIds.length === 0) {
      return res.status(200).json({ message: "no incoming friend requests" });
    }

    const allFriends =
      (await Promise.all(
        friendsIds?.map(async (friendId) => {
          const user = await UserModel.findById(friendId)
            .select("firstName lastName email avatar _id")
            .lean();
          return user;
        })
      )) || [];

    return res.status(200).json({
      message: "available friends of the user fetched successfully",
      friends: allFriends,
    });
  } catch (error) {
    next(error);
  }
};
