import { z } from "zod";

export const SignUpFormSchema = z.object({
  firstName: z.string().min(2, "required"),
  lastName: z.string().min(2, "required"),
  email: z.string().email(),
  password: z.string().min(8),
});

export const LoginInFormSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
});

export const AddNewFriendSchema = z.object({
  email: z.string().email(),
});

export const MessageSchema = z.object({
  _id: z.string(),
  senderId: z.string(),
  text: z.string(),
  timeStamp: z.number(),
});

export const MessageArraySchema = z.array(MessageSchema);

export type Message = z.infer<typeof MessageSchema>;