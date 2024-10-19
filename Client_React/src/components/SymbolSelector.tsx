import { FormControl, InputAdornment, InputLabel, MenuItem, Select, SelectChangeEvent, Stack, TextField } from "@mui/material";
import { useControllerStatus } from "../services/ControllerInfoContext";
import { ChangeEvent, useEffect, useState } from "react";
import { socket } from "../services/Socket";
import ClearIcon from '@mui/icons-material/Clear';

import SymbolTree from "./SymbolTree/SymbolTree";



export default function SymbolSelector(){

  const controllerStatus = useControllerStatus();
  const [currentController, setCurrentController] = useState<string>("");
  const [filter, setFilter] = useState("");

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

  const controllerSelectLabel = currentController == "" ? 
    (controllerAvailable ? "Select Controller" : "No Controller Available...")
    :"Current Controller";

  return (
    <Stack height={"100%"}>
      
      <FormControl sx={{margin: "1em"}}>
        
        <InputLabel id="controller-select-label">
          {controllerSelectLabel}
        </InputLabel>
        <Select 
          labelId="controller-select-label"
          value={currentController}
          label={controllerSelectLabel}
          onChange={handleControllerSelectionChange}
          variant="outlined"
        >
          {controllerSelectItems}
        </Select>
      </FormControl>
        <TextField id="symbol-filter-input" label="Filter Symbols" sx={{marginX: "1em"}}
          slotProps={{
            input:{
              endAdornment: 
                <InputAdornment position="end">
                  <ClearIcon></ClearIcon>
                </InputAdornment>
            }
          }}
          value={filter}
          onChange={handleFilterInput}
        />
      
      <SymbolTree filterStr={filter}
        controllerName={currentController}
        showGlobalSymbols={false} showSystemSymbols={false}/>

      
    </Stack>
  )




  function handleControllerSelectionChange(event: SelectChangeEvent){
    setCurrentController(event.target.value)
  }

  function handleFilterInput (event: ChangeEvent<HTMLInputElement>){
    setFilter(event.target.value)
  }

  
}

