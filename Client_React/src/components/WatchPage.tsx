import { useEffect } from "react";
import { useDataTypes, useSymbols, useControllerStatus } from "../services/ControllerInfoContext";
import { socket } from "../services/Socket";
import SymbolTree2 from "./SymbolTree2";

export function WatchPage() {
  const controllerStatus = useControllerStatus();
  const dataTypes = useDataTypes();
  useEffect(()=>{
    if(Object.keys(controllerStatus).length > 0 && Object.keys(dataTypes).length == 0){
      socket.emit("requestSymbols", Object.keys(controllerStatus)[0]);
    }
  },[controllerStatus, dataTypes])

  if(Object.keys(controllerStatus).length > 0){
    return (

      <div>
        <SymbolTree2 controllerName={Object.keys(controllerStatus)[0]} filter="" showGlobalSymbols={false} showSystemSymbols={false} ></SymbolTree2>
        
      </div>
    );
  }
  else{
    return (
      <div>
        No controller connected.
      </div>
    )
  }

  
}
