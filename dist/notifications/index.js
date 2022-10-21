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
exports.validateReceipts = exports.sendNotifications = exports.createMessages = exports.getPushTokens = void 0;
const expo_server_sdk_1 = require("expo-server-sdk");
const db_1 = __importDefault(require("../db"));
let expo = new expo_server_sdk_1.Expo();
let tickets = [];
const getPushTokens = (userID) => __awaiter(void 0, void 0, void 0, function* () {
    const { rows } = yield db_1.default.query("SELECT push_tokens FROM users WHERE id = $1 AND allows_notifications = true", [userID]);
    if (rows.length > 0) {
        const { push_tokens } = rows[0];
        return push_tokens;
    }
});
exports.getPushTokens = getPushTokens;
const createMessages = (pushTokens, body, conversationID, senderName) => {
    let messages = [];
    for (let token of pushTokens) {
        if (!expo_server_sdk_1.Expo.isExpoPushToken(token)) {
            console.error(`Push token ${token} is not a valid Expo push token`);
            continue;
        }
        messages.push({
            to: token,
            sound: "default",
            body,
            title: senderName,
            data: {
                url: `exp://192.168.30.24:19000/--/messages/${conversationID}/${senderName}`,
            },
        });
    }
    return messages;
};
exports.createMessages = createMessages;
const sendNotifications = (messages) => {
    let chunks = expo.chunkPushNotifications(messages);
    (() => __awaiter(void 0, void 0, void 0, function* () {
        for (let chunk of chunks) {
            try {
                let ticketChunk = yield expo.sendPushNotificationsAsync(chunk);
                console.log(ticketChunk);
                tickets.push(...ticketChunk);
            }
            catch (error) {
                console.error(error);
            }
        }
    }))();
};
exports.sendNotifications = sendNotifications;
const validateReceipts = () => {
    let receiptIds = [];
    for (let ticket of tickets) {
        if (ticket.id) {
            receiptIds.push(ticket.id);
        }
    }
    let receiptIdChunks = expo.chunkPushNotificationReceiptIds(receiptIds);
    (() => __awaiter(void 0, void 0, void 0, function* () {
        for (let chunk of receiptIdChunks) {
            try {
                let receipts = yield expo.getPushNotificationReceiptsAsync(chunk);
                console.log(receipts);
                for (let receiptId in receipts) {
                    let { status, details } = receipts[receiptId];
                    if (status === "ok") {
                        continue;
                    }
                    else if (status === "error") {
                        console.error(`There was an error sending a notification`);
                        if (details && details.error) {
                            console.error(`The error code is ${details.error}`);
                        }
                    }
                }
            }
            catch (error) {
                console.error(error);
            }
        }
    }))();
};
exports.validateReceipts = validateReceipts;
