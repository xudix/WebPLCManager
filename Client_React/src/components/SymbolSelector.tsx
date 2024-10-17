import { FormControl, InputLabel, MenuItem, Select, SelectChangeEvent, Stack } from "@mui/material";
import SymbolTree2 from "./SymbolTree/SymbolTree2";
import { useControllerStatus } from "../services/ControllerInfoContext";
import { useEffect, useState } from "react";
import { socket } from "../services/Socket";




export default function SymbolSelector(){

  const controllerStatus = useControllerStatus();
  const [currentController, setCurrentController] = useState<string>("")

  function handleControllerSelectionChange(event: SelectChangeEvent){
    setCurrentController(event.target.value)
  }

  let controllerAvailable = false;
  const controllerSelectItems = Object.keys(controllerStatus).map((controllerName) => {
    if(controllerStatus[controllerName]){
      controllerAvailable = true;
    }
    return controllerStatus[controllerName] && <MenuItem value={controllerName} key={controllerName}>{controllerName}</MenuItem>
  });

  // automatically select a controller is none is selected
  // clear currentController is lost connection
  useEffect(() => {

    // if currentController is blank and a controller is available, switch to it
    if(currentController == ""){
      for (const controllerName in controllerStatus) {
        if(controllerStatus[controllerName]){
          setCurrentController(controllerName);
          break;
        }
      }
    }
    else{
      // currentController is not blank. 
      // first make sure the current is connected
      if(controllerStatus[currentController]){
        // this occurs either 1. currentController selection changed 2. controller status changed
        // request symbols anyways.
        socket.emit("requestSymbols", currentController);
        return;
      }
      else{
        // current selection is not connected. Pick the first connected one.
        let newControllerSelection = "";
        for (const controllerName in controllerStatus) {
          if(controllerStatus[controllerName]){
            newControllerSelection = controllerName;
            break;
          }
        }
        setCurrentController(newControllerSelection);
      }
    }
  }, [controllerStatus,currentController])

  return (
    <Stack height={"100%"}>
      <FormControl sx={{margin: "1em"}}>
        <InputLabel id="controller-select-label">
          {currentController == "" ? 
            (controllerAvailable ? "Select Controller" : "No Controller Available...")
            :"Current Controller"}
        </InputLabel>
        <Select 
          labelId="controller-select-label"
          value={currentController}
          label="No Controller Available..."
          onChange={handleControllerSelectionChange}
        >
          {controllerSelectItems}
        </Select>
      </FormControl>
      

      <SymbolTree2 controllerName={currentController} filter="" showGlobalSymbols={false} showSystemSymbols={false} ></SymbolTree2>
    </Stack>
  )
}