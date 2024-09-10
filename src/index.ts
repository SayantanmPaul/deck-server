import express, { Request, Response } from "express";
import cors from "cors";
import dotenv from 'dotenv'
import { userRouter } from "./routes/user.route";
import handleConnectionToMongoDB from './connection';

const app = express();
//local routes config
dotenv.config({ path: "./.env.local" });

//connection to mogno databse
handleConnectionToMongoDB(process.env.DB_URL as string)
  .then(() => console.log("Connected to databse"))
  .catch((error) => console.error(error));

//setup cors
app.use(
  cors({
    origin: process.env.ORIGIN_PATH,
    credentials: true,
  })
);

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use("/api", userRouter);


app.listen(process.env.PORT, () => {
  console.log(`Server is running on port ${process.env.PORT}`);
})