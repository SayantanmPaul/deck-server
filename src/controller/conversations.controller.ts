import { NextFunction, Request, Response } from "express";
import { z } from "zod";
import { redis } from "../lib/redis";
import UserModel from "../models/user.model";
import {
  Message,
  MessageArraySchema,
  MessageSchema,
} from "../schema/validations";
import ConversationModel from "../models/conversation.model";
import MessageModel from "../models/messsage.model";
import { nanoid } from "nanoid";
import { pusherServer, toPusherKey } from "../lib/pusher";

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

    const { conversationId, textMessage } = z
      .object({
        conversationId: z.string(),
        textMessage: z.string(),
      })
      .parse(body);

    //1. split conversation to get the userIds
    const [userId1, userId2] = conversationId.split("--");

    const user = req.body.user;

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

    const messageData: Message = {
      _id: nanoid(),
      senderId: String(user._id),
      text: textMessage,
      timeStamp: timeStamp,
    };

    const message = MessageSchema.parse(messageData);

    // console.log("pusher 1");
    
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

    // console.log("pusher 2");

    //5. store the message in sorted set
    await redis.zadd(
      `conversation:${conversationId}:messages`,
      timeStamp,
      JSON.stringify(message)
    );

    //6. Check if the conversation exists in MongoDB otherwise crease one
    let conversation = await ConversationModel.findOne({
      participates: {
        $all: [user._id, frindId],
      },
    });

    if (!conversation) {
      conversation = new ConversationModel({
        participants: [userId1, userId2],
        messages: [],
      });
    }

    //7. Create and save the message in MongoDB
    const newMessage = new MessageModel({
      senderId: String(user._id),
      text: textMessage,
      timeStamp: timeStamp,
    });

    await newMessage.save();

    //8. Add the new message to the conversation's messages
    conversation.messages.push(newMessage._id);
    await conversation.save();

    return res.sendStatus(200);
  } catch (error) {
    if (error instanceof Error) {
      return res.sendStatus(500);
    }
    next(error);
  }
};
