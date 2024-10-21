import { UploadApiResponse } from "cloudinary";
import { NextFunction, Request, Response } from "express";
import { nanoid } from "nanoid";
import { z } from "zod";
import { uploadContentToCloudinary } from "../lib/cloudinary";
import { pusherServer, toPusherKey } from "../lib/pusher";
import { redis } from "../lib/redis";
import {
  Message,
  MessageArraySchema,
  MessageSchema,
} from "../schema/validations";

export const getConversationsMessages = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { conversationId } = z
      .object({ conversationId: z.string() })
      .parse(req.query);

    //retrive messages from the redis store
    const results: string[] = await redis.zrange(
      `conversation:${conversationId}:messages`,
      0,
      -1
    );

    const dbMessages = results.map((message) => JSON.parse(message) as Message);

    const reserverdedDBMessages = dbMessages.reverse();

    const messages = MessageArraySchema.parse(reserverdedDBMessages);
    return res.status(200).json({ messages });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(422).json({ error: error.message });
    }
    next(error);
  }
};

export const getConversationFriendInfo = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { conversationPartnerId } = z
      .object({ conversationPartnerId: z.string() })
      .parse(req.query);

    const conversationPartner = await redis.get(
      `userId:${conversationPartnerId}`
    );
    if (!conversationPartner) {
      return res.status(404).json({ error: "conversation partner not found" });
    }

    const partnerDetails = JSON.parse(conversationPartner);

    return res.status(200).json({
      conversationPartner: {
        _id: partnerDetails._id,
        firstName: partnerDetails.firstName,
        lastName: partnerDetails.lastName,
        userName: partnerDetails.userName,
        email: partnerDetails.email,
        avatar: partnerDetails.avatar,
      },
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(422).json({ error: error.message });
    }
    next(error);
  }
};

export const sendMessageToPartner = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const body = req.body;
    const file = req.file;
    const user = req.body.user;

    const { conversationId, textMessage } = z
      .object({
        conversationId: z.string(),
        textMessage: z.string(),
      })
      .parse(body);

    //1. split conversation to get the userIds
    const [userId1, userId2] = conversationId.split("--");

    if (String(user._id) !== userId1 && String(user._id) !== userId2) {
      return res.status(401).json({ error: "unauthorized" });
    }

    //2. partner of the conversation
    const frindId = String(user._id) === userId1 ? userId2 : userId1;

    const friendList = await redis.smembers(`userId:${user._id}:friends`);

    const isFriend = friendList.includes(frindId) as true | false;

    if (!isFriend) {
      return res.status(401).json({ error: "unauthorized #" });
    }

    //3. get the sender
    const sender = (await redis.get(`userId:${user._id}`)) as string;

    const parsedSender = JSON.parse(sender);

    //4. all check clear and send the message
    const timeStamp = Date.now();
    let contentUrl: string | null = null;
    let contentType: string | null = null;
    let contentFileName: string | null = null;

    if (file) {
      const uploadUrl: UploadApiResponse = await uploadContentToCloudinary(
        file.buffer
      );
      contentUrl = uploadUrl.secure_url as string;
      contentType = `${uploadUrl.resource_type}/${uploadUrl.format}`;
      contentFileName= file.originalname;
    }

    const messageData: Message = {
      _id: nanoid(),
      senderId: String(user._id),
      text: textMessage,
      timeStamp: timeStamp,
      contentUrl: contentUrl,
      contentType: contentType,
      contentFileName: contentFileName,
    };

    const message = MessageSchema.parse(messageData);

    //notift all connected chat room clients
    const channel = toPusherKey(`conversation:${conversationId}`);
    await pusherServer.trigger(channel, "incoming_message", message);

    await pusherServer.trigger(
      toPusherKey(`user:${frindId}:conversations`),
      "new_message",
      {
        ...message,
        senderAvatar: parsedSender.avatar,
        senderFirstName: parsedSender.firstName,
        senderLastName: parsedSender.lastName,
        senderUserName: parsedSender.userName,
      }
    );

    //5. store the message in sorted set
    await redis.zadd(
      `conversation:${conversationId}:messages`,
      timeStamp,
      JSON.stringify(message)
    );
    
    return res.sendStatus(200);
  } catch (error) {
    if (error instanceof Error) {
      return res.sendStatus(500);
    }
    next(error);
  }
};
