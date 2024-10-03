import { NextFunction, Request, Response } from "express";
import jwt, { JwtPayload, VerifyErrors } from "jsonwebtoken";
import UserModel from "../models/user.model";
import { redis } from "../lib/redis";
import { generateAccessToken } from "../controller/user.controller";
import dotenv from 'dotenv';

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

          console.log(refreshToken);

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
                res.clearCookie("accessToken");
                res.clearCookie("refreshToken");
                return res.status(403).json({ error: "Invalid refresh token" });
              }

              const { _id } = refreshDecoded as jwt.JwtPayload;

              const user = await UserModel.findById(_id).select("-password");
              if (!user) {
                return res.status(403).json({ error: "User not found" });
              }

              dotenv.config({ path: "./.env" });

              const cookieOptions = {
                httpOnly: false,
                secure: false,
                maxAge: 8 * 24 * 60 * 60 * 1000,
                sameSite:
                  process.env.NODE_ENV === "production"
                    ? ("none" as const)
                    : ("lax" as const),
                path: "/",
              };

              const newAccessToken = generateAccessToken(_id);
              res.cookie("accessToken", newAccessToken, cookieOptions);

              res.setHeader(
                "Set-Cookie",
                `accessToken=${newAccessToken}; Max-Age=${cookieOptions.maxAge}; Path=${cookieOptions.path}; SameSite=${cookieOptions.sameSite}`
              );

              req.body.user = user;
              return next();
            }
          );
        } else if (decoded) {
          const { _id } = decoded as jwt.JwtPayload;

          const user = await UserModel.findById(_id).select("-password");

          if (!user) {
            return res.status(401).json({ error: "Invalid or expired token" });
          }
          //attach the user to the request body for later use in the request cycle
          req.body.user = user;
          return next();
        } else
          return res.status(403).json({ error: "Invalid or expired token" });
      }
    );
  } catch (error) {
    next(error);
  }
};
