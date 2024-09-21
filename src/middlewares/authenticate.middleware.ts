import { NextFunction, Request, Response } from "express";
import jwt, { JwtPayload, VerifyErrors } from "jsonwebtoken";
import UserModel from "../models/user.model";
import { redis } from "../lib/redis";
import { generateAccessToken } from "../controller/user.controller";

//Middleware to authenticate JWT token
export const authenticateToken = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    // token from cookies or authorization header
    const accessToken =
      req.cookies.accessToken ||
      req.headers["authorization"]?.replace("Bearer", "").trim();

    if (!accessToken) return res.sendStatus(403);

    //token verification
    jwt.verify(
      accessToken,
      process.env.JWT_SECRET as string,
      async (
        error: VerifyErrors | null,
        decoded: JwtPayload | string | undefined
      ) => {
        if (error?.name === "TokenExpiredError") {
          const refreshToken = req.cookies.refreshToken;
          if (!refreshToken) {
            return res.sendStatus(403);
          }

          //refresh token verification
          jwt.verify(
            refreshToken,
            process.env.REFRESH_TOKEN_SECRET as string,
            async (
              err: VerifyErrors | null,
              refreshDecoded: string | jwt.JwtPayload | undefined
            ) => {
              if (err) {
                return res.status(403).json({ error: "Invalid refresh token" });
              }

              const { _id } = refreshDecoded as jwt.JwtPayload;

              const user = await UserModel.findById(_id).select("-password");
              if (!user) {
                return res.status(403).json({ error: "User not found" });
              }

              const newAccessToken = generateAccessToken(_id);
              res.cookie("accessToken", newAccessToken, {
                httpOnly: true,
                secure: true,
                maxAge: 60 * 60 * 1000,
                sameSite: false,
              });

              req.body.user = user;
              return next();
            }
          );
        }

        // if (error) {
        //   return res.status(403).json({ error: "Invalid or expired token" });
        // }
        else if (decoded) {
          const { _id } = decoded as jwt.JwtPayload;

          const cachedUser = await redis.get(`userId:${_id}`);

          // if (cachedUser) {
          //   req.body.user = JSON.parse(cachedUser);
          // } else {
            const user = await UserModel.findById(_id).select("-password");

            if (!user) {
              return res
                .status(401)
                .json({ error: "Invalid or expired token" });
            }
            //attach the user to the request body for later use in the request cycle
            req.body.user = user;
          // }

          return next();
        }
        else
          return res.status(403).json({ error: "Invalid or expired token" });
      }
    );
  } catch (error) {
    next(error);
  }
};
