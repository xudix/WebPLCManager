import { useContext, createContext, useReducer } from "react";

import { io } from "socket.io-client";
import { ILoggingServerConfig } from "../models/logging-config-type.ts";
import { IControllerType } from "../models/controller-data-types.ts";

// "undefined" means the URL will be computed from the `window.location` object
const URL =
  process.env.NODE_ENV === "production" ? undefined : "http://localhost:2333";

export const socket = io(URL);

export function registerSocketEventHandlers() {
  socket.on("broadcast", handleBroadcast);
  socket.on("controllerStatus", handleControllerStatus);
  socket.on("subscribedData", handleSubscribedData);
  socket.on("watchListUpdated", handleWatchListUpdated);
  socket.on("loggingConfigUpdated", handleLoggingConfigUpdated);
  socket.on("connect", handleConnect);
  socket.on("error", handleError);
}

export function unregisterSocketEventHandlers() {
  socket.off("broadcast", handleBroadcast);
  socket.off("controllerStatus", handleControllerStatus);
  socket.off("subscribedData", handleSubscribedData);
  socket.off("watchListUpdated", handleWatchListUpdated);
  socket.off("loggingConfigUpdated", handleLoggingConfigUpdated);
  socket.off("connect", handleConnect);
  socket.off("error", handleError);
}

// handles broadcast data received from the server
function handleBroadcast(message: {
  messageType: string;
  controllerName: string;
  data: any;
}): void {
  switch (message.messageType) {
    case "dataTypes":
      break;
    case "symbols":
      break;
    case "controllerStatus":
      break;
  }
}

function handleControllerStatus(
  controllerStatus: Record<string, boolean>,
): void {}

function handleSubscribedData(
  newData: Record<string, Record<string, any>>,
): void {}

function handleWatchListUpdated(newWatchList: Record<string, string[]>): void {}

function handleLoggingConfigUpdated(
  loggingConfig: ILoggingServerConfig | undefined,
): void {}

function handleConnect(): void {
  // This is actually reestablishing connection. Subscribe to all previous watches.
  socket.emit("createWatchClient");
  socket.emit("requestControllerStatus");
  // for(let controllerName in this._model.watchList){
  //     this._model.watchList[controllerName].forEach((symbol) => {
  //     socket.emit("addWatchSymbol", controllerName, symbol.name);
  //     });
}

function handleError(err: any): void {
  console.log(err);
}
