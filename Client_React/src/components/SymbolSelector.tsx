import { Box, FormControl, InputAdornment, InputLabel, MenuItem, Select, SelectChangeEvent, Stack, TextField, Tooltip } from "@mui/material";
import { CurrentMeasurementContext, useControllerStatus, useLoggingServerConfig, useLoggingUpdater } from "../services/ControllerInfoContext";
import { ChangeEvent, useEffect, useRef, useState } from "react";
import { socket } from "../services/Socket";
import ClearIcon from '@mui/icons-material/Clear';

import SymbolTree from "./SymbolTree/SymbolTree";
import { PlaylistAdd } from "@mui/icons-material";

export default function SymbolSelector() {
  const inputDelay = 400;

  const controllerStatus = useControllerStatus();
  const [currentController, setCurrentController] = useState<string>("");
  const [filter, setFilter] = useState(""); // this is directly tied to the filter input box
  const [delayedFilter, setDelayedFilter] = useState("")
  const inputDelayTimer = useRef<number | NodeJS.Timeout>(0);
  const localLoggingServerConfig = useLoggingServerConfig();
  const updateLoggingConfig = useLoggingUpdater();
  const [currentMeasurement, setCurrentMeasurement] = useState<string>("");
  const [newMeasurement, setNewMeasurement] = useState("");

  let controllerAvailable = false;
  const controllerSelectItems = Object.keys(controllerStatus).map((controllerName) => {
    if (controllerStatus[controllerName]) {
      controllerAvailable = true;
    }
    return controllerStatus[controllerName] && <MenuItem value={controllerName} key={controllerName}>{controllerName}</MenuItem>
  });

  const measurementSelection = localLoggingServerConfig?.logConfigs.map((config) => {
    return <MenuItem value={config.measurement} key={config.measurement}>{config.measurement}</MenuItem>
  });

  // automatically select a controller is none is selected
  // clear currentController is lost connection
  useEffect(() => {

    // if currentController is blank and a controller is available, switch to it
    if (currentController == "") {
      for (const controllerName in controllerStatus) {
        if (controllerStatus[controllerName]) {
          setCurrentController(controllerName);
          break;
        }
      }
    }
    else {
      // currentController is not blank. 
      // first make sure the current is connected
      if (controllerStatus[currentController]) {
        // this occurs either 1. currentController selection changed 2. controller status changed
        // request symbols anyways.
        socket.emit("requestSymbols", currentController);
        return;
      }
      else {
        // current selection is not connected. Pick the first connected one.
        let newControllerSelection = "";
        for (const controllerName in controllerStatus) {
          if (controllerStatus[controllerName]) {
            newControllerSelection = controllerName;
            break;
          }
        }
        setCurrentController(newControllerSelection);
      }
    }
  }, [controllerStatus, currentController])

  const controllerSelectLabel = currentController == "" ?
    (controllerAvailable ? "Select Controller" : "No Controller Available...")
    : "Current Controller";

  return (
    <Stack height={"100%"}>
      <Box display="flex" flexDirection="row" margin="1em">
        <FormControl sx={{ margin: "0em", flex: "0 1 15em" }}>
          <InputLabel id="controller-select-label">
            {controllerSelectLabel}
          </InputLabel>
          <Select
            labelId="controller-select-label"
            value={currentController}
            label={controllerSelectLabel}
            onChange={handleControllerSelectionChange}
            variant="outlined"
            size="small"
          // sx={{
          //   '& .MuiSelect-select':{
          //     paddingY: "0.5em",
          //   }
          // }}
          >
            {controllerSelectItems}
          </Select>
        </FormControl>
        <TextField id="symbol-filter-input" label="Filter Symbols"
          sx={{
            flex: "1 1 auto",
            marginLeft: "1em",
          }}
          size="small"
          slotProps={{
            input: {
              endAdornment:
                <InputAdornment position="end" sx={{ cursor: "pointer" }}>
                  <ClearIcon onClick={() => {setFilter(""); setDelayedFilter("")}}></ClearIcon>
                </InputAdornment>
            }
          }}
          value={filter}
          onChange={handleFilterInput}
        />
      </Box>
      <Box display="flex" flexDirection="row" margin="1em" marginTop="0" alignItems="center">
        <FormControl sx={{ margin: "0em", flex: "0 1 15em" }}>
          <InputLabel id="measurement-select-label">
            Logging Measurement
          </InputLabel>
          <Select
            labelId="measurement-select-label"
            value={currentMeasurement}
            label="Logging Measurement"
            onChange={handleMeasurementSelectionChange}
            variant="outlined"
            size="small"
          // sx={{
          //   '& .MuiSelect-select':{
          //     paddingY: "0.5em",
          //   }
          // }}
          >
            {measurementSelection}
          </Select>
        </FormControl>
        <TextField id="new-measurement-input" label="Create New Logging Measurement"
          sx={{
            flex: "1 1 auto",
            marginLeft: "1em",
          }}
          size="small"
          slotProps={{
            input: {
              endAdornment:
                <InputAdornment position="end" sx={{ cursor: "pointer" }}>
                  <ClearIcon onClick={() => setNewMeasurement("")}></ClearIcon>
                </InputAdornment>
            }
          }}
          value={newMeasurement}
          onChange={handleNewMeasurementInput}
        />
        <Tooltip title="Create Measurement">
          <PlaylistAdd onClick={createMeasurement} fontSize="large"/>
        </Tooltip>
      </Box>
      <CurrentMeasurementContext.Provider value={currentMeasurement}>
        <SymbolTree filterStr={delayedFilter}
          controllerName={currentController}
          showGlobalSymbols={false} showSystemSymbols={false} />

      </CurrentMeasurementContext.Provider>


    </Stack>
  )

  function handleMeasurementSelectionChange(event: SelectChangeEvent) {
    setCurrentMeasurement(event.target.value)
  }

  function handleControllerSelectionChange(event: SelectChangeEvent) {
    setCurrentController(event.target.value)
  }

  function handleFilterInput(event: ChangeEvent<HTMLInputElement>) {
    setFilter(event.target.value);
    if (inputDelayTimer.current) {
      clearTimeout(inputDelayTimer.current)
    }
    inputDelayTimer.current = setTimeout(() => {
      setDelayedFilter(event.target.value)
    }, inputDelay);

  }

  function handleNewMeasurementInput(event: ChangeEvent<HTMLInputElement>) {
    setNewMeasurement(event.target.value);
  }

  function createMeasurement(){

    if(updateLoggingConfig){
      updateLoggingConfig({
        type:"add",
        newLoggingConfig: {
          name: currentController,
          measurement: newMeasurement,
          tags: [],
        }
      });
      setCurrentMeasurement(newMeasurement);
      setNewMeasurement("");
    }
  }


}

