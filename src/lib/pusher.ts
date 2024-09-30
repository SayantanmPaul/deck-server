import PusherServer from "pusher";
import dotenv from "dotenv";

dotenv.config({ path: "./.env.local" });

export const pusherServer = new PusherServer({
  appId: process.env.PUSHER_APP_ID!,
  key: process.env.PUSHER_APP_KEY!,
  secret: process.env.PUSHER_APP_SECRET!,
  cluster: "ap2",
  useTLS: true,
});

export const toPusherKey = (key: string) => {
  return key.replace(/:/g, "__");
};