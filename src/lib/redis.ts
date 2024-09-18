import { Redis } from "ioredis";
import dotenv from "dotenv";

//local routes config
dotenv.config({ path: "./.env.local" });

const getRedisURL = () => {
  if (process.env.REDIS_URL) {
    return process.env.REDIS_URL;
  }

  throw new Error("REDIS_URL is not defined");
};

export const redis = new Redis(getRedisURL());
