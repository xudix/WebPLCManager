import { Box, Button, Grid2, InputAdornment, List, ListItem, ListItemButton, ListItemText, Stack, SvgIcon, TextField, Tooltip, Typography } from "@mui/material";
import { ILoggingConfig, ILoggingServerConfig, ILoggingTagConfig, LoggingConfig, LoggingServerConfig } from "../models/logging-config-type";
import { ChangeEvent, createContext, useContext, useEffect, useReducer, useState, Dispatch } from "react";
import { socket } from "../services/Socket";
import { AllInclusive, Clear, CloudOff, CloudSync, DeleteForever, ExpandLess, ExpandMore, Refresh, Stairs } from "@mui/icons-material";


const LoggingUpdaterContext = createContext<Dispatch<ILoggingUpdateAction> | null>(null)


interface ILoggingManagerProps {

}

export default function LoggingManager(props: ILoggingManagerProps) {
  const [localLoggingServerConfig, updateLoggingConfig] = useReducer(loggingConfigUpdater, new LoggingServerConfig(1000, "C:\\Data\\"));
  const [remoteLoggingServerConfig, setRemoteLoggingServerConfig] = useState<ILoggingServerConfig | null>(null);



  useEffect(() => {
    socket.on("connect", requestLoggingConfig);
    socket.on("loggingConfigUpdated", handleNewLoggingConfig);

    if (remoteLoggingServerConfig == null) {
      requestLoggingConfig();

    }


    function handleNewLoggingConfig(newConfig: ILoggingServerConfig) {

      console.log("logging config received");
      setRemoteLoggingServerConfig(newConfig);
      // merge remote and local??
      updateLoggingConfig({ type: "reset", newServerConfig: newConfig });
    }

    return (() => {
      socket.off("connect", requestLoggingConfig);
      socket.off("loggingConfigUpdated", handleNewLoggingConfig);
    })

  }, [remoteLoggingServerConfig])

  function requestLoggingConfig() {
    socket.emit("requestLoggingConfig");
    console.log("request logging config");
  }

  return (
    <Stack direction="column">
      <Stack direction="row">
        <Button variant="contained">
          <Refresh />
          Refresh
        </Button>
        <Button variant="contained">
          Send Config
        </Button>
      </Stack>
      <LoggingUpdaterContext.Provider value={updateLoggingConfig}>
        <List>
          {localLoggingServerConfig?.logConfigs.map(
            (config) => <LoggingConfigDisplay config={config} key={config.measurement} />
          )}
        </List>
      </LoggingUpdaterContext.Provider>


    </Stack>
  )
}


function LoggingConfigDisplay({ config }: { config: ILoggingConfig }) {
  const [isExpanded, setIsExpanded] = useState(true)

  const hasSubNodes = (config.tags.length > 0);

  return (
    <ListItem sx={{ padding: 0, width: "100%", borderTop: "3px solid purple" }}>
      <Stack spacing={0} sx={{ padding: 0, width: "100%" }} direction="column">
        <ListItemButton onClick={handleExpandClick}>
          {hasSubNodes ? (isExpanded ? <ExpandMore /> : <ExpandLess />) : <SvgIcon />}
          <ListItemText primary={`Measurement: ${config.measurement}\nController: ${config.name}`} />
        </ListItemButton>
        {isExpanded ?
          <List>
            {config.tags.map(
              (tag, index) => 
                <LoggingItemDisplay 
                  measurement={config.measurement} 
                  controllerName={config.name} 
                  tag={tag} 
                  index={index}
                  key={config.measurement+config.name+tag.field}
                  />
            )}
          </List> : false}

      </Stack>

    </ListItem>
  )

  function handleExpandClick() {
    if (hasSubNodes) {
      setIsExpanded(!isExpanded);
    }
  }
}



function LoggingItemDisplay({ measurement, controllerName, tag, index }
  : { measurement: string, controllerName: string, tag: ILoggingTagConfig, index: number }) {
  const updateConfig = useContext(LoggingUpdaterContext);

  return (
    <ListItem sx={{ paddingY: 0, width: "100%", borderTop: "1px solid purple" }}>
      <Stack direction="row" spacing={0} sx={{ padding: 0, width: "100%" }}>
        <Grid2 container sx={{ flex: "1 1 auto" }} >
          <Grid2 size={{ xs: 12, lg: 6 }} display="flex">
            <Typography>{tag.tag}</Typography>
          </Grid2>
          <Grid2 size={{ xs: 12, lg: 6 }} display="flex" paddingBottom="0.2em">
            <TextField
              value={tag.field}
              onChange={handleFieldInput}
              variant="outlined"
              sx={
                {
                  flex: "1 1 auto",
                  padding: 0,
                  '& input': {
                    paddingX: "0.5em",
                    paddingY: 0,
                    textOverflow: "ellipsis",
                    textWrap: "nowrap",
                  },
                  '& .MuiInputBase-root': {
                    padding: 0,
                  }
                }
              }
              slotProps={{
                input: {
                  endAdornment:
                    <InputAdornment position="end" sx={{ cursor: "pointer" }}>
                      <Clear onClick={handleFieldClear} />
                    </InputAdornment>
                }
              }}
            ></TextField>
          </Grid2>
        </Grid2>
        <Box sx={{ flex: "0 0 5em" }}>
          <Typography textAlign="center">{tag.status}</Typography>
        </Box>
        <Tooltip title={tag.disabled ? "Disabled" : "Enabled"} arrow>
          <Box>
            {tag.disabled ?
              <CloudOff onClick={handleEnableClick} />
              : <CloudSync onClick={handleEnableClick} />
            }
          </Box>
        </Tooltip>
        <Tooltip title={tag.onChange ? "On Change" : "Periodic"} arrow>
          <Box>
            {tag.onChange ?
              <Stairs onClick={handleOnChangeClick} />
              : <AllInclusive onClick={handleOnChangeClick} />
            }
          </Box>
        </Tooltip>
        <Tooltip title="Delete" arrow>
          <DeleteForever onClick={handleDeleteClick} />
        </Tooltip>


      </Stack>
    </ListItem>
    
  )

  function handleFieldInput(event: ChangeEvent<HTMLInputElement>) {
    if (updateConfig) {
      updateConfig({
        type: "modify",
        measurement: measurement,
        controllerName: controllerName,
        tag: { ...tag, field: event.target.value },
        index: index,
      });
    }
  }

  function handleFieldClear() {
    if (updateConfig) {
      updateConfig({
        type: "modify",
        measurement: measurement,
        controllerName: controllerName,
        tag: { ...tag, field: "" },
        index: index,
      });
    }
  }

  function handleEnableClick() {
    if (updateConfig) {
      updateConfig({
        type: "modify",
        measurement: measurement,
        controllerName: controllerName,
        tag: { ...tag, disabled: !tag.disabled },
        index: index,
      });
    }
  }

  function handleOnChangeClick() {
    
    if (updateConfig) {
      updateConfig({
        type: "modify",
        measurement: measurement,
        controllerName: controllerName,
        tag: { ...tag, onChange: !tag.onChange },
        index: index,
      });
    }
  }

  function handleDeleteClick() {
    
    if (updateConfig) {
      updateConfig({
        type: "remove",
        measurement: measurement,
        controllerName: controllerName,
        tag: {...tag},
        index: index,
      });
    }
  }

}

// reducer for logging config management

interface ILoggingUpdateAction {
  type: "add" | "modify" | "remove" | "reset",
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
      if ((measurement && controllerName && tags.length)) {
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