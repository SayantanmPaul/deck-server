import bcrypt from "bcrypt";
import { NextFunction, Request, Response } from "express";
import jwt from "jsonwebtoken";
import UserModel from "../models/user.model";
import { redis } from "../lib/redis";
import { LoginInFormSchema, SignUpFormSchema } from "../schema/validations";
import { z } from "zod";

// generate an access token for the user
export const generateAccessToken = (_id: string) => {
  return jwt.sign({ _id }, process.env.JWT_SECRET as string, {
    expiresIn: "6m",
  });
};

export const handleRefreshToken = (req: Request, res: Response) => {
  const { refreshToken } = req.cookies;

  if (!refreshToken)
    return res.sendStatus(401).json({ error: "Refresh token not found" });

  // verify the refresh token with the refresh secret
  jwt.verify(
    refreshToken,
    process.env.REFRESH_TOKEN_SECRET as string,
    async (
      err: jwt.VerifyErrors | null,
      decoded: string | jwt.JwtPayload | undefined
    ) => {
      if (err) return res.status(403).json({ error: "Invalid refresh token" });

      // Extract user info from the decoded payload and generate a new access token
      //generate the new access token from the user id and send the response
      try {
        const { _id } = decoded as jwt.JwtPayload;
        const accessToken = generateAccessToken(_id);

        const user = await UserModel.findById(_id);
        if (!user) {
          return res.status(404).json({ error: "User not found" });
        }
        return res.json({ accessToken: accessToken });
      } catch (error) {
        return res.status(403).json({ error: "Invalid refresh token" });
      }
    }
  );
};

// basic user signip fn
export const handleUserSignUp = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    //zod validations
    const trustedData = SignUpFormSchema.parse(req.body);
    const { firstName, lastName, email, password } = trustedData;

    const existingEmail = await UserModel.findOne({ email });

    if (existingEmail) {
      return res.status(409).json({ error: "User already exists" });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const newUser = await UserModel.create({
      firstName,
      lastName,
      email,
      password: hashedPassword,
    });

    const user = {
      _id: newUser._id,
      firstName: newUser.firstName,
      lastName: newUser.lastName,
      email: newUser.email,
      bio: newUser.bio,
      avatar: newUser.avatar,
      password: newUser.password,
      refreshToken: newUser.refreshToken,
    };

    await redis.set(`userId:${newUser._id}`, JSON.stringify(user));

    res.status(200).json({
      message: "User created successfully",
      user: user,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(422).json({ error: error.message });
    }
    next(error);
  }
};

//handle user sign-in
export const handleUserSignIn = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    //zod validations
    const trustedData = LoginInFormSchema.parse(req.body);

    const { email, password } = trustedData;

    let user;
    const cachedUser = await redis.get(`userId:${email}`);
  
    if (cachedUser) {
      user = JSON.parse(cachedUser);
    } else {
      user = await UserModel.findOne({ email });

      if (!user) {
        return res.status(401).json({ error: "Invalid email or password" });
      }
      await redis.set(`userId:${user._id}`, JSON.stringify(user));
    }

    const isPasswordValid = await bcrypt.compare(password, user.password);

    if (!isPasswordValid) {
      return res.status(401).json({ error: "Invalid email or password" });
    }

    //generate an access token and an refresh token for the user once the user is authenticated for email and password
    // and share with the database and the clint within cookies

    const authToken = generateAccessToken(user?._id.toString());

    const refreshToken = jwt.sign(
      { _id: user._id },
      process.env.REFRESH_TOKEN_SECRET as string,
      {
        expiresIn: "7d",
      }
    );
    const mongoUser = UserModel.hydrate(user);
    
    mongoUser.refreshToken = refreshToken;
    await mongoUser.save();

    const cookieOptions = {
      httpOnly: true,
      secure: true,
      maxAge: 8 * 24 * 60 * 60 * 1000,
      sameSite: false,
    };

    res.cookie("accessToken", authToken, cookieOptions);
    res.cookie("refreshToken", user.refreshToken, cookieOptions);

    //also send the user details and the tokens to the client
    return res.status(200).json({
      message: `Welcome ${user.firstName}`,
      currentUser: {
        _id: user._id,
        firstName: user.firstName,
        lastName: user.lastName,
        email: user.email,
        bio: user.bio,
        avatar: user.avatar,
      },
      accessToken: authToken,
      refreshToken: refreshToken,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(422).json({ error: error.message });
    }
    next(error);
  }
};

// handle user logout
export const handleUserLogout = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    //extract the refresh token from cookies
    // Find the user with the corresponding refresh token and update the DB
    const { refreshToken } = req.cookies;

    const user = await UserModel.findOneAndUpdate(
      {
        refreshToken: refreshToken,
      },
      {
        refreshToken: null,
      }
    );

    //cookie config
    const cookieOptions = {
      httpOnly: true,
      secure: true,
      sameSite: "none" as "none",
    };

    //clear the cookies
    if (!user) {
      res.clearCookie("accessToken", { ...cookieOptions });
      res.clearCookie("refreshToken", { ...cookieOptions });
      return res.sendStatus(204);
    }

    if (user) {
      const cachedUser = await redis.get(`userId:${user._id}`);

      if (cachedUser) {
        const paresUser = JSON.parse(cachedUser);

        paresUser.refreshToken = null;

        await redis.set(`userId:${user._id}`, paresUser);
      }
    }

    await user.save();

    res.clearCookie("accessToken", { ...cookieOptions });
    res.clearCookie("refreshToken", { ...cookieOptions });

    return res.status(200).json({
      message: "user logged out successfully",
    });
  } catch (error) {
    next(error);
  }
};

export const getCurrentUser = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const user = req.body.user;

    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }
    res.status(200).json({
      message: "User fetched successfully",
      user: {
        _id: user?._id,
        firstName: user?.firstName,
        lastName: user?.lastName,
        email: user?.email,
        bio: user?.bio,
        avatar: user?.avatar,
        createdAt: user?.createdAt,
        updatedAt: user?.updatedAt,
        incomingFriendRequests: user?.incomingFriendRequests,
        sentFriendRequests: user?.sentFriendRequests,
      },
    });
  } catch (error) {
    next(error);
  }
};
