import { Socket } from "socket.io";
import { DefaultEventsMap } from "socket.io/dist/typed-events";

export type SessionSocket = Socket<
  DefaultEventsMap,
  DefaultEventsMap,
  DefaultEventsMap,
  any
> & {
  sessionID: string;
  userID: number;
  userSocketID: string;
  username: string;
  connected: boolean;
};
