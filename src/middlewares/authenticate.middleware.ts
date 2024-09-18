import { NextFunction, Request, Response } from "express";
import jwt, { JwtPayload, VerifyErrors } from "jsonwebtoken";
import UserModel from "../models/user.model";
import { redis } from "../lib/redis";

//Middleware to authenticate JWT token
export const authenticateToken = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    // token from cookies or authorization header
    const token =
      req.cookies.accessToken ||
      req.headers["authorization"]?.replace("Bearer", "");

    if (!token) return res.sendStatus(401);

    //token verification
    jwt.verify(
      token,
      process.env.JWT_SECRET as string,
      async (
        error: VerifyErrors | null,
        decoded: JwtPayload | string | undefined
      ) => {
        if (error) {
          return res.status(403).json({ error: "Invalid or expired token" });
        }

        const { _id } = decoded as jwt.JwtPayload;

        const cachedUser = await redis.get(`userId:${_id}`);
        
        if (cachedUser) {
          req.body.user = JSON.parse(cachedUser);
        } else {
          const user = await UserModel.findById(_id).select("-password");
  
          if (!user) {
            return res.status(401).json({ error: "Invalid or expired token" });
          }
          //attach the user to the request body for later use in the request cycle
          req.body.user = user;
        }

        next();
      }
    );
  } catch (error) {
    next(error);
  }
};
