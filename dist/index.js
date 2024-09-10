"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const fs_1 = __importDefault(require("fs"));
console.log(123);

const addNumber = (a, b) => {
    return a + b;
};
fs_1.default.writeFileSync("test.txt", "123");
console.log(addNumber(1, 2));
