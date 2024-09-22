import { NextFunction, Request, Response } from "express";
import { z } from "zod";
import { redis } from "../lib/redis";
import UserModel from "../models/user.model";

export const getConversationsMessages = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
    try {
        
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
    
    const conversationPartner = await redis.get(`userId:${conversationPartnerId}`);
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
    } });

  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(422).json({ error: error.message });
    }
    next(error)
  }
}