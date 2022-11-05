"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const dotenv_1 = __importDefault(require("dotenv"));
const socket_io_1 = require("socket.io");
const uuid_1 = require("uuid");
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const notifications_1 = require("./notifications");
dotenv_1.default.config();
const io = new socket_io_1.Server();
const sessionMap = new Map();
io.use((socket, next) => {
    const sessionID = socket.handshake.auth.sessionID;
    if (sessionID) {
        const session = sessionMap.get(sessionID);
        if (session) {
            socket.sessionID = sessionID;
            socket.userID = session.userID;
            socket.userSocketID = session.userSocketID;
            socket.username = session.username;
            socket.connected = true;
            session.connected = true;
            sessionMap.set(session.userID, session);
            return next();
        }
    }
    const userID = socket.handshake.auth.userID;
    const username = socket.handshake.auth.username;
    if (!userID)
        return next(new Error("Invalid userID"));
    const newSessionID = (0, uuid_1.v4)();
    const newUserSocketID = (0, uuid_1.v4)();
    socket.sessionID = newSessionID;
    socket.userSocketID = newUserSocketID;
    socket.userID = userID;
    socket.username = username;
    sessionMap.set(userID, {
        userID,
        sessionID: newSessionID,
        userSocketID: newUserSocketID,
        username,
        connected: true,
    });
    next();
});
io.on("connection", (socket) => {
    console.log("New connection", socket.userID);
    socket.join(socket.userSocketID);
    socket.emit("session", {
        sessionID: socket.sessionID,
    });
    socket.on("sendMessage", ({ senderID, receiverID, conversationID, text, senderName, }) => __awaiter(void 0, void 0, void 0, function* () {
        const token = socket.handshake.auth.accessToken;
        jsonwebtoken_1.default.verify(token, process.env.ACCESS_TOKEN_SECRET, (err, decoded) => __awaiter(void 0, void 0, void 0, function* () {
            if (err)
                return;
            if (decoded && decoded.ID === senderID) {
                const receiver = sessionMap.get(receiverID);
                if (receiver && receiver.connected)
                    return (socket
                        .to(receiver.userSocketID)
                        .emit("getMessage", {
                        senderID,
                        text,
                        senderName,
                        conversationID,
                    }));
                const tokens = yield (0, notifications_1.getPushTokens)(receiverID);
                if (tokens) {
                    const messages = (0, notifications_1.createMessages)(tokens, text, conversationID, senderName);
                    (0, notifications_1.sendNotifications)(messages);
                }
            }
        }));
    }));
    socket.on("disconnect", () => {
        const userSession = sessionMap.get(socket.userID);
        if (userSession) {
            userSession.connected = false;
            sessionMap.set(userSession.userID, userSession);
        }
    });
});
io.listen(3000);
console.log("Listening on port 3000");
