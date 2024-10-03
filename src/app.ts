import express, { Request, Response } from "express";
import cors from "cors";
import dotenv from "dotenv";
import { userRouter } from "./routes/user.route";
import handleConnectionToMongoDB from "./connection";
import cookieParser from "cookie-parser";

const app = express();

const isProductionMode = true;

const PORT = process.env.PORT || 5001;

app.use(cookieParser());

//local routes config
dotenv.config({ path: isProductionMode ? "./.env" : "./.env.local" });

//connection to mogno databse
handleConnectionToMongoDB(process.env.DB_URL as string)
  .then(() => console.log("Connected to database", isProductionMode))
  .catch((error) => console.error(error));

//setup cors
app.use(
  cors({
    origin: isProductionMode
      ? process.env.ORIGIN_PATH
      : "http://localhost:3000",
    credentials: true,
    allowedHeaders: ["Content-Type", "Authorization"],
    exposedHeaders: ["Authorization"],
  })
);

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use("/api", userRouter);

app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
