import { Request, Response, NextFunction } from "express";
import UserModel from "../models/user.model";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";

export const handleUserSignUp = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { firstName, lastName, email, password } = req.body;

    if (!firstName || !lastName || !email || !password) {
      return res.status(400).json({ error: "All fields are required" });
    }

    const existingEmail = await UserModel.findOne({ email });

    if (existingEmail) {
      return res.status(409).json({ error: "User already exists" });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const NewUser = await UserModel.create({
      firstName,
      lastName,
      email,
      password: hashedPassword,
    });
    res.status(200).json({
      message: "User created successfully",
      user: true,
      userEmail: NewUser.email,
    });
  } catch (error) {
    next(error);
  }
};

export const handleUserSignIn = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ error: "All fields are required" });
  }

  const user = await UserModel.findOne({ email });
  if (!user) {
    return res.status(401).json({ error: "Invalid email or password" });
  }

  const isPasswordValid = await bcrypt.compare(password, user.password);

  if (!isPasswordValid) {
    return res.status(401).json({ error: "Invalid email or password" });
  }

  if (user && isPasswordValid) {
    const authToken = jwt.sign(
      {
        email: email,
        id: user._id,
      },
      process.env.JWT_SECRET as string
    );
    return res
      .status(200)
      .json({
        message: `Welcome ${user.firstName}`,
        user: true,
        token: authToken,
      });
  }
};
