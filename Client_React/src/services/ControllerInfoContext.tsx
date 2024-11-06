import {
  useContext,
  createContext,
  useReducer,
  useState,
  useEffect,
  ReactElement,
  Dispatch,
} from "react";

import { ILoggingConfig, ILoggingServerConfig, ILoggingTagConfig, LoggingServerConfig } from "../models/logging-config-type.ts";
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

export const CurrentMeasurementContext = createContext<string>("");
export function useCurrentMeasurement(){
  return useContext(CurrentMeasurementContext);
}

// logging configuration

interface ILoggingUpdateAction {
  type: "add" | "modify" | "remove" | "reset" | "delete",
  newLoggingConfig?: ILoggingConfig,
  newServerConfig?: ILoggingServerConfig,
  measurement?: string,
  controllerName?: string,
  /**
   * when calling, should pass a new object created by spread syntax {...tag}, since React may call this reducer twice, and the underlying object could be changed after the first call.
   */
  tag?: ILoggingTagConfig,
  /**
   * for modify and remove. the index of the modified/removed item the tags array
   */
  index?: number 
}

const LoggingUpdaterContext = createContext<Dispatch<ILoggingUpdateAction> | null>(null);
const LoggingServerConfigContext = createContext<ILoggingServerConfig | null>(null);
export function useLoggingUpdater(){
  return useContext(LoggingUpdaterContext);
}
export function useLoggingServerConfig() {
  return useContext(LoggingServerConfigContext);
}

// reducer for logging config management
/**
 * handles the update logic for logging configurations. For use with the reducer.
 * @param loggingConfig 
 * @param action 
 * @returns 
 */
function loggingConfigUpdater(loggingConfig: ILoggingServerConfig, action: ILoggingUpdateAction) {
  const newServerConfig = { ...loggingConfig };
  let measurement, controllerName;
  const tags: ILoggingTagConfig[] = [];
  if (action.newLoggingConfig) {
    measurement = action.newLoggingConfig.measurement;
    controllerName = action.newLoggingConfig.name;
    for (const tagConfig of action.newLoggingConfig.tags) {
      tags.push({ ...tagConfig, status: "new" });
    }
  }
  else if (action.measurement && action.controllerName && action.tag) {
    measurement = action.measurement;
    controllerName = action.controllerName;
    tags.push({ ...action.tag, status: "new" });
  }
  switch (action.type) {
    case "add":
      // to add, either provide a ILoggingConfig with the new tag(s), or provide the tag
      if ((measurement && controllerName)) {
        // check existing configs
        for (const config of newServerConfig.logConfigs) {
          if (config.measurement == measurement
            && config.name == controllerName
          ) {
            config.tags.push(...tags);
            return newServerConfig;  // from looping through loggingConfig.logConfigs
          }
        }
        // the measurement and controller name was not found. Create a new config
        newServerConfig.logConfigs.push(
          {
            measurement: measurement,
            name: controllerName,
            tags: tags,
          }
        )
        return newServerConfig;
      }
      return loggingConfig;
    case "modify":
      
    console.log("onchange clicked");
      // for modify, only one tag can be procesed at a time. passing ILoggingConfig is not supported. index must be specified
      if ((action.measurement && action.controllerName && action.tag && (action.index != undefined))) {
        // no valid tag config to add. quit.
        for (const config of newServerConfig.logConfigs) {
          if (config.measurement == action.measurement
            && config.name == action.controllerName
          ) {
            config.tags[action.index] = { ...action.tag, status: "modified" };
            return newServerConfig;  // from looping through loggingConfig.logConfigs
          }
        }
      }
      return loggingConfig;

    case "delete":
    case "remove":
      // for remove, only one tag can be procesed at a time. passing ILoggingConfig is not supported. index must be specified
      // If the tag is marked as remove, it'll be marked as modified so remove is undone.
      console.log("delete clicked");
      if ((action.measurement && action.controllerName && action.tag && (action.index != undefined))) {
        // no valid tag config to add. quit.
        for (const config of newServerConfig.logConfigs) {
          if (config.measurement == action.measurement
            && config.name == action.controllerName
          ) {
            if (action.tag.status == "remove") {
              config.tags[action.index].status = "modified";
            }
            else {
              config.tags[action.index].status = "remove";
            }
            return newServerConfig;  // from looping through loggingConfig.logConfigs
          }
        }
      }
      return loggingConfig;

    case "reset":
      return action.newServerConfig ? action.newServerConfig : loggingConfig;
  }
}

// for write new value operation
const newValuesContext = createContext<Record<string,string>>({})
const newvaluesUpdaterContext = createContext<Dispatch<
  {
    type: string,
    symbol?: string,
    value?: string,
  }
> | null>(null);

/**
 * Records the new values to be written to the controller. {symbolName: value in string}
 */
export function useNewValues(){
  return useContext(newValuesContext);
}

/**
 * Update the new values to be written to the controller
 */
export function useUpdateNewValues(){
  return useContext(newvaluesUpdaterContext);
} 

function newValuesUpdater(
  newValuesObj: Record<string,string>|null,
  action:{
    type: string,
    symbol?: string,
    value?: string,
  } 
): Record<string,string>{
  let result;
  switch(action.type){
    case "add":
      result = newValuesObj? {...newValuesObj} : {};
      if(action.symbol && action.value){
        result[action.symbol] = action.value;
      }
      break;
    case "delete":
    case "remove":
      if(newValuesObj){
        result = {...newValuesObj};
        if(action.symbol){
          delete result[action.symbol];
        }
      }
      else{
        result = {};
      }
      break;
    case "reset":
      result = {};
      break;
    default:
      result = newValuesObj? {...newValuesObj} : {}
  }
  return result;
}
//

export function ControllerInfoProvider({ children }: { children: ReactElement }) {
  const [dataTypes, setDataTypes] = useState<DataTypesInfo>({});
  const [symbols, setSymbols] = useState<SymbolsInfo>({});
  const [controllerStatus, setControllerStatus] = useState<
    Record<string, boolean>
  >({});
  const [localLoggingServerConfig, updateLoggingConfig] = useReducer(loggingConfigUpdater, new LoggingServerConfig(1000, ""));
  const [remoteLoggingServerConfig, setRemoteLoggingServerConfig] = useState<ILoggingServerConfig | null>(null);
  const [newValuesObj, updateNewValues] = useReducer(newValuesUpdater, {})

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

    function requestLoggingConfig() {
      socket.emit("requestLoggingConfig");
      console.log("request logging config");
    }

    function handleNewLoggingConfig(newConfig: ILoggingServerConfig) {

      console.log("logging config received");
      setRemoteLoggingServerConfig(newConfig);
      // merge remote and local??
      updateLoggingConfig({ type: "reset", newServerConfig: newConfig });
    }

    socket.on("broadcast", handleBroadcast);
    socket.on("controllerStatus", handleControllerStatus);
    socket.on("disconnect", handleDisconnect);
    socket.on("connect", requestLoggingConfig);
    socket.on("loggingConfigUpdated", handleNewLoggingConfig);

    if (remoteLoggingServerConfig == null) {
      requestLoggingConfig();
    }

    

    return () => {
      socket.off("broadcast", handleBroadcast);
      socket.off("controllerStatus", handleControllerStatus);
      socket.off("disconnect", handleDisconnect);
      socket.off("connect", requestLoggingConfig);
      socket.off("loggingConfigUpdated", handleNewLoggingConfig);
    }
  }, [controllerStatus, remoteLoggingServerConfig]);





  return (
    <DataTypesContext.Provider value={dataTypes}>
      <SymbolsContext.Provider value={symbols}>
        <ControllerStatusContext.Provider value={controllerStatus}>
          <LoggingServerConfigContext.Provider value={localLoggingServerConfig}>
            <LoggingUpdaterContext.Provider value={updateLoggingConfig}>
              <newValuesContext.Provider value={newValuesObj}>
                <newvaluesUpdaterContext.Provider value={updateNewValues}>
                  {children}
                </newvaluesUpdaterContext.Provider>
              </newValuesContext.Provider>
              

            </LoggingUpdaterContext.Provider>
          </LoggingServerConfigContext.Provider>
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