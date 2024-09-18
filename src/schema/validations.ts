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
