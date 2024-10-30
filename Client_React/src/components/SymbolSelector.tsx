import { Box, FormControl, FormControlLabel, FormLabel, InputAdornment, InputLabel, MenuItem, Radio, RadioGroup, Select, SelectChangeEvent, Stack, Switch, TextField, Tooltip } from "@mui/material";
import { CurrentMeasurementContext, useControllerStatus, useLoggingServerConfig, useLoggingUpdater } from "../services/ControllerInfoContext";
import { ChangeEvent, useEffect, useRef, useState } from "react";
import { socket } from "../services/Socket";
import ClearIcon from '@mui/icons-material/Clear';

import SymbolTree from "./SymbolTree/SymbolTree";
import { PlaylistAdd } from "@mui/icons-material";
import { SubscriptionGroupPrefixContext } from "../models/utilities";

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
  const [filterMode, setFilterMode] = useState("startWith");
  const [filterPersistent, setFilterPersistent] = useState(false);    // flags if show only persistent variables

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

  useEffect(() => {
    if (currentMeasurement == "" && localLoggingServerConfig) {
      for (const config of localLoggingServerConfig.logConfigs) {
        if (config.name == currentController) {
          setCurrentMeasurement(config.measurement);
          return;
        }
      }
    }
    else if (localLoggingServerConfig) {
      // current measurement is not blank, change it if it's not in the config
      for (const config of localLoggingServerConfig.logConfigs) {
        if (config.name == currentController && config.measurement == currentMeasurement) {
          // this measurement exist in current controller, quit
          return;
        }
      }
      // not found. measurement doesn't exist
      for (const config of localLoggingServerConfig.logConfigs) {
        if (config.name == currentController) {
          // pick the first measurement
          setCurrentMeasurement(config.measurement);
          return;
        }
      }
      // no measurement available. set it to blank
      setCurrentMeasurement("");
    }
    else {
      // no config available
      setCurrentMeasurement("");
    }

  }, [currentController, currentMeasurement, localLoggingServerConfig])

  const controllerSelectLabel = currentController == "" ?
    (controllerAvailable ? "Select Controller" : "No Controller Available...")
    : "Current Controller";

  return (
    <Stack height={"100%"}>
      <Stack direction="row" spacing={1} margin={1}>
        <FormControl sx={{ margin: "0em", flex: "0 1 10em" }}>
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
        <FormControl sx={{ margin: "0em", flex: "0 1 12em" }}>
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
        <TextField id="new-measurement-input" label="Create Logging Measurement"
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
          <PlaylistAdd onClick={createMeasurement} fontSize="large" />
        </Tooltip>
      </Stack>
      <Stack direction="row" spacing={1} margin={1} alignItems="end">
        <FormControl size="small">
          <FormLabel id="filter-mode-label" >Filter Symbols</FormLabel>
          <RadioGroup row name="filter-mode-buttons-group" value={filterMode} onChange={handleFilterModeChange}>
            <FormControlLabel value="startWith" control={<Radio size="small" />} label="Start With" />
            <FormControlLabel value="include" control={<Radio size="small" />} label="Include" />
          </RadioGroup>
        </FormControl>
        <Box flex="1 1 auto" display="flex" flexDirection="row" alignItems="end">
          <TextField id="symbol-filter-input" label="Filter Symbols"
            sx={{
              flex: "1 1 auto",
              marginLeft: "0em",
              height: "fit-content",
            }}
            size="small"
            slotProps={{
              input: {
                endAdornment:
                  <InputAdornment position="end" sx={{ cursor: "pointer" }}>
                    <ClearIcon onClick={() => { setFilter(""); setDelayedFilter("") }}></ClearIcon>
                  </InputAdornment>
              }
            }}
            value={filter}
            onChange={handleFilterInput}
          />
          <FormControl component="fieldset" margin="dense">
            <FormLabel component="legend">Persistent?</FormLabel>
            <FormControlLabel
              checked={filterPersistent}
              control={<Switch color="primary" />}
              label={filterPersistent? "Yes":"No"}
              labelPlacement="start"
              onChange={() => setFilterPersistent(!filterPersistent)}
            />
          </FormControl>
        </Box>

      </Stack>
      <SubscriptionGroupPrefixContext.Provider value="S">
        <CurrentMeasurementContext.Provider value={currentMeasurement}>
          <SymbolTree
            filterStr={delayedFilter}
            filterMode={filterMode}
            filterPersistent={filterPersistent}
            controllerName={currentController}
            showGlobalSymbols={false} showSystemSymbols={false} />

        </CurrentMeasurementContext.Provider>
      </SubscriptionGroupPrefixContext.Provider>
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

  function handleFilterModeChange(event: SelectChangeEvent){
    setFilterMode(event.target.value)
  }

  

  function createMeasurement() {

    if (updateLoggingConfig) {
      updateLoggingConfig({
        type: "add",
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

