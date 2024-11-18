import { useContext, createContext, useReducer } from "react";

import { io } from "socket.io-client";
import { ILoggingServerConfig } from "../models/logging-config-type.ts";
import { IControllerType } from "../models/controller-data-types.ts";
import { watchableTypes } from "./ControllerInfoContext.tsx";

// "undefined" means the URL will be computed from the `window.location` object
const URL =
  process.env.NODE_ENV === "production" ? undefined : "http://localhost:2333";

export const socket = io(URL,{autoConnect: false});

/**
 * Records the subscribers of a symbol
 */
interface IWatchedSymbol {
  value?: number|boolean|string|null,
  expirationTimer?: number|NodeJS.Timeout|null,
  subscribers: Record<string, (data?: number|boolean|string|null) => void>
}

/**
 * {symbolName: IWatchedSymbol}
 */
type SymbolRecords = Record<string, IWatchedSymbol>


class SymbolWatchManager{

  constructor() {
    this.__watchRecords = {};
    socket.on("subscribedDataReceived", (newData) => this.__handleReceivedData(newData));
    socket.on("connect", () =>
      setTimeout(() => {
        this.__resubscribe();
      }, 5000));
  }



  /**
   * The record for symbol watch subscriptions. 
   * {controllerName : SymbolRecords}
   */
  private __watchRecords: Record<string, SymbolRecords>;

  private __communicationLoss: boolean = true;

  /**
   * Time (ms) after which the received data expires
   */
  dataExpirationTime = 3000;



  /**
   * Subscribe to the value of a symbol from the controller.
   * @param subscriberID A unique ID for the subscriber
   * @param controller 
   * @param symbol The full path of the symbol
   * @param callback callback function to handle the received data
   */
  subscribe(subscriberID: string, controller: string, symbol: string, type: IControllerType, callback: (data?: number|boolean|string|null) => void){
    if(watchableTypes.has(type.baseType) || type.baseType.includes("STRING")){
      // controller not subscribed to yet
      if(!this.__watchRecords[controller]){
        this.__watchRecords[controller] = {}
      }
      // symbol not subscribed to yet
      if(!this.__watchRecords[controller][symbol]){
        this.__watchRecords[controller][symbol] = {
          subscribers: {}
        }
      }
      if(Object.keys(this.__watchRecords[controller][symbol].subscribers).length == 0){
        socket.emit("addWatchSymbol", controller, symbol)
      }
      this.__watchRecords[controller][symbol].subscribers[subscriberID] = callback;
      }
  }

  unsubscribe(subscriberID: string, controller: string, symbol: string){
    if(this.__watchRecords[controller]
      && this.__watchRecords[controller][symbol]
      && this.__watchRecords[controller][symbol].subscribers[subscriberID]
    ){
      delete this.__watchRecords[controller][symbol].subscribers[subscriberID];
      // if no one is subscribing to this symbol, unsubscribe it from server
      if(Object.keys(this.__watchRecords[controller][symbol].subscribers).length == 0){
        socket.emit("removeWatchSymbol",controller, symbol)
      }
    }

  }

  writeValue(controller: string, newValues: Record<string, any>): Promise<Record<string, Record<string, boolean>>>;
  writeValue(controller: string, symbol: string, valueStr: string): Promise<Record<string, Record<string, boolean>>>;
  writeValue(controller: string, symbolOrNewValues: string | Record<string, any>, valueStr?: string):Promise<Record<string, Record<string, boolean>>>
  {
    if(typeof symbolOrNewValues == "string"){
      // writing single symbol
      if(valueStr && (valueStr != "")){
        return this.writeValue(controller, {[symbolOrNewValues]:valueStr})  
      }
    }
    else if(symbolOrNewValues && (typeof symbolOrNewValues == "object")){
      // provided newValues object
      for(const symbolName in symbolOrNewValues){
        if(symbolOrNewValues[symbolName]=="''" || symbolOrNewValues[symbolName]=='""'){
          symbolOrNewValues[symbolName] = "";
        }
      }
      return new Promise((resolve, reject) => {
        function handleWriteResult(result: Record<string, Record<string, boolean>>){
          resolve(result);
          socket.off("writeResults", handleWriteResult);
        }
        socket.on("writeResults", handleWriteResult);
        socket.emit("writeNewValues",{[controller]:symbolOrNewValues});
        setTimeout(() => {
          socket.off("writeResults", handleWriteResult);
          reject("Time out, no result received for write operation.");
        }, 5000);

      })
    }
    return Promise.reject("Invalid arguments for write operation.")
    
  }

  private __handleReceivedData(newData: Record<string, Record<string, number|boolean|string>>){
    
    for(const controller in newData){
      if(this.__watchRecords && this.__watchRecords[controller]){
        // this controller exist in record
        for(const symbol in newData[controller]){
          if(this.__watchRecords[controller][symbol]){
            // this symbol exist in record
            if(this.__watchRecords[controller][symbol].expirationTimer){
              clearTimeout(this.__watchRecords[controller][symbol].expirationTimer);
            }
            this.__communicationLoss = false;
            for(const id in this.__watchRecords[controller][symbol].subscribers){
              this.__watchRecords[controller][symbol].subscribers[id](newData[controller][symbol])
            }
            // make the data timeout after some time. The callbacks are called with null input
            this.__watchRecords[controller][symbol].expirationTimer = setTimeout(() => {
              this.__communicationLoss = true;
              for(const id in this.__watchRecords[controller][symbol].subscribers){
                this.__watchRecords[controller][symbol].subscribers[id](null)
              }
            }, this.dataExpirationTime);
          }
        }
      }
    }
  }

  // re-subscribe to data after reconnecting
  private __resubscribe(){
    if(this.__communicationLoss){
      for(const controller in this.__watchRecords){
        for(const symbol in this.__watchRecords[controller]){
          if(Object.keys(this.__watchRecords[controller][symbol].subscribers).length > 0){
            socket.emit("addWatchSymbol", controller, symbol);
          }
        }
      }
      setTimeout(() => {
        this.__resubscribe();
      }, 5000);
    }
  }

  //private __resubscribeTimer: number|NodeJS.Timeout = 0;

}

const symbolWatchManagerContext = createContext(new SymbolWatchManager());

export function useSymbolWatchManager(){
  return useContext(symbolWatchManagerContext);
}


export function registerSocketEventHandlers() {
  socket.on("broadcast", handleBroadcast);
  socket.on("controllerStatus", handleControllerStatus);
  socket.on("subscribedDataReceived", handleSubscribedData);
  socket.on("watchListUpdated", handleWatchListUpdated);
  socket.on("loggingConfigUpdated", handleLoggingConfigUpdated);
  socket.on("connect", handleConnect);
  socket.on("error", handleError);
}

export function unregisterSocketEventHandlers() {
  socket.off("broadcast", handleBroadcast);
  socket.off("controllerStatus", handleControllerStatus);
  socket.off("subscribedDataReceived", handleSubscribedData);
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
