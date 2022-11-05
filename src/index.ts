import dotenv from "dotenv";
import { Server } from "socket.io";
import { v4 as uuidv4 } from "uuid";
import jwt from "jsonwebtoken";

import {
  createMessages,
  getPushTokens,
  sendNotifications,
} from "./notifications";
import { SessionSocket, JWT } from "./types";

dotenv.config();
const io = new Server();

const sessionMap = new Map<
  number,
  {
    sessionID: string;
    userID: number;
    userSocketID: string;
    username: string;
    connected: boolean;
  }
>();

io.use((socket, next) => {
  const sessionID = socket.handshake.auth.sessionID;
  if (sessionID) {
    const session = sessionMap.get(sessionID);
    if (session) {
      (socket as SessionSocket).sessionID = sessionID;
      (socket as SessionSocket).userID = session.userID;
      (socket as SessionSocket).userSocketID = session.userSocketID;
      (socket as SessionSocket).username = session.username;
      (socket as SessionSocket).connected = true;
      session.connected = true;

      sessionMap.set(session.userID, session);
      return next();
    }
  }

  const userID: number = socket.handshake.auth.userID;
  const username: string = socket.handshake.auth.username;
  if (!userID) return next(new Error("Invalid userID"));

  const newSessionID = uuidv4();
  const newUserSocketID = uuidv4();

  (socket as SessionSocket).sessionID = newSessionID;
  (socket as SessionSocket).userSocketID = newUserSocketID;
  (socket as SessionSocket).userID = userID;
  (socket as SessionSocket).username = username;

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
  console.log("New connection", (socket as SessionSocket).userID);
  socket.join((socket as SessionSocket).userSocketID);

  socket.emit("session", {
    sessionID: (socket as SessionSocket).sessionID,
  });

  socket.on(
    "sendMessage",
    async ({
      senderID,
      receiverID,
      conversationID,
      text,
      senderName,
    }: {
      senderID: number;
      receiverID: number;
      conversationID: number;
      text: string;
      senderName: string;
    }) => {
      const token = socket.handshake.auth.accessToken;
      jwt.verify(
        token,
        process.env.ACCESS_TOKEN_SECRET as string,
        async (
          err: jwt.VerifyErrors | null,
          decoded: string | jwt.JwtPayload | undefined
        ) => {
          if (err) return;

          if (decoded && (decoded as JWT).ID === senderID) {
            const receiver = sessionMap.get(receiverID);

            if (receiver && receiver.connected)
              return (
                socket
                  .to(receiver.userSocketID)
                  // .to((socket as SessionSocket).userSocketID)  // Add if you want messaging in multiple tabs to update at once
                  .emit("getMessage", {
                    senderID,
                    text,
                    senderName,
                    conversationID,
                  })
              );

            const tokens = await getPushTokens(receiverID);
            if (tokens) {
              const messages = createMessages(
                tokens,
                text,
                conversationID,
                senderName
              );

              sendNotifications(messages);
            }
          }
        }
      );
    }
  );

  socket.on("disconnect", () => {
    const userSession = sessionMap.get((socket as SessionSocket).userID);
    if (userSession) {
      userSession.connected = false;
      sessionMap.set(userSession.userID, userSession);
    }
  });
});

io.listen(3000);
console.log("Listening on port 3000");
