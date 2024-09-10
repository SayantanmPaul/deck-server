import express from 'express'
import { handleUserSignIn, handleUserSignUp } from '../controller/user.controller';

export const userRouter = express.Router();

userRouter.post("/user/signup", handleUserSignUp);

userRouter.post('/user/signin', handleUserSignIn);

