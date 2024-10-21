import {
  v2 as cloudinary,
  UploadApiErrorResponse,
  UploadApiResponse,
} from "cloudinary";
import dotenv from "dotenv";
import stream, { Readable } from "stream";

dotenv.config({ path: "./.env" });

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

export default cloudinary;

export const uploadContentToCloudinary = (
  fileBuffer: Buffer
): Promise<UploadApiResponse> => {
  return new Promise((resolve, reject) => {
    const uploadStream = cloudinary.uploader.upload_stream(
      {
        folder: "conversation-content",
        resource_type: "auto",
        type: "authenticated",
      },
      (
        err: UploadApiErrorResponse | undefined,
        res: UploadApiResponse | undefined
      ) => {
        if (err) reject(`cloudinary error: ${JSON.stringify(err)}`);
        else if (!res) {
          reject("No response received from Cloudinary.");
        } else {
          resolve(res); 
        } 
      }
    );

    const bufferStream = new Readable(); 
    bufferStream.push(fileBuffer);
    bufferStream.push(null); 
    bufferStream.pipe(uploadStream);
  });
};
