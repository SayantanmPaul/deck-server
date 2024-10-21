import multer, { StorageEngine } from "multer";
import { Request } from "express";

// Configure the storage engine
const storage: StorageEngine = multer.memoryStorage();

const upload = multer({ storage: storage }).single("file");

export default upload;
