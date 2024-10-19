import {
  useContext,
  createContext,
  useReducer,
  useState,
  useEffect,
  ReactElement,
} from "react";

import { ILoggingServerConfig } from "../models/logging-config-type.ts";
import {
  IControllerType,
  DataTypesInfo,
  SymbolsInfo,
} from "../models/controller-data-types.ts";
import { socket } from "./Socket.ts";


export const DataTypesContext = createContext<DataTypesInfo>({});
/**
 * data type info received from controller. {controllerName: {typename: typeObj}}. typename is lower case
 */
export function useDataTypes(): DataTypesInfo {
  return useContext<DataTypesInfo>(DataTypesContext);
}

export const SymbolsContext = createContext<SymbolsInfo>({});
/**
 * symbol info received from controller. {controllerName: {symbolname: symbolObj}}. symbolname is lower case.
 */
export function useSymbols(): SymbolsInfo {
  return useContext<SymbolsInfo>(SymbolsContext);
}

const ControllerStatusContext = createContext<Record<string, boolean>>({});
/**
 * Configured controllers, and whether it's connected to the server.
 * {controllerName: isConnected}
 */
export function useControllerStatus(): Record<string, boolean> {
  return useContext(ControllerStatusContext);
}

export const CurrentControllerContext = createContext<string>("");

export function ControllerInfoProvider({ children }: { children: ReactElement }) {
  const [dataTypes, setDataTypes] = useState<DataTypesInfo>({});
  const [symbols, setSymbols] = useState<SymbolsInfo>({});
  const [controllerStatus, setControllerStatus] = useState<
    Record<string, boolean>
  >({});
  useEffect(() => {
    // handles broadcast data received from the server
    function handleBroadcast(message: {
      messageType: string;
      controllerName: string;
      data: any;
    }): void {
      switch (message.messageType) {
        case "dataTypes":
          setDataTypes((previous) => {
            const newObj = { ...previous };
            newObj[message.controllerName] = message.data;
            return newObj;
          });
          console.log("data types received");
          break;
        case "symbols":
          setSymbols((previous) => {
            const newObj = { ...previous };
            newObj[message.controllerName] = message.data;
            return newObj;
          });
          console.log("symbols received");
          break;
        case "controllerStatus":
          updateControllerStauts(message.data);
          break;
      }
    }

    function handleControllerStatus(
      controllerStatus: Record<string, boolean>,
    ): void {
      setControllerStatus(controllerStatus);
    }

    /**
     * If the status value did not change, do not call the setControllerStatus method which would trigger a re-render
     * @param newStatus 
     * @returns 
     */
    const updateControllerStauts = (newStatus: Record<string, boolean>) => {
      if (Object.keys(controllerStatus).length != Object.keys(newStatus).length) {
        setControllerStatus(newStatus);
        console.log("changed status length");
      }
      else {
        for (const name in controllerStatus) {
          if (controllerStatus[name] != newStatus[name]) {
            setControllerStatus(newStatus);
            console.log("changed status");
            return;
          }
        }
      }
    }
    
    function handleDisconnect(){
      setControllerStatus({});
    }

    socket.on("broadcast", handleBroadcast);
    socket.on("controllerStatus", handleControllerStatus);
    socket.on("disconnect", handleDisconnect);

    return () => {
      socket.off("broadcast", handleBroadcast);
      socket.off("controllerStatus", handleControllerStatus);
      socket.off("disconnect", handleDisconnect);
    }
  }, [controllerStatus]);





  return (
    <DataTypesContext.Provider value={dataTypes}>
      <SymbolsContext.Provider value={symbols}>
        <ControllerStatusContext.Provider value={controllerStatus}>
          {children}
        </ControllerStatusContext.Provider>
      </SymbolsContext.Provider>
    </DataTypesContext.Provider>
  );


}//ControllerInfoProvider

/**
 * These are the primitive types that can be simply subscribed to.
 */
export const watchableTypes = new Set(['BOOL', 'BYTE', 'WORD', 'DWORD', 'SINT', 'USINT',
  'INT', 'UINT', 'DINT', 'UDINT', 'LINT', 'ULINT', 'REAL', 'LREAL', 'TIME']); 