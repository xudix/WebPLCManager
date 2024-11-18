import { Box, Button, Grid2, InputAdornment, List, ListItem, ListItemButton, ListItemText, Stack, SvgIcon, TextField, Tooltip, Typography } from "@mui/material";
import { ILoggingConfig, ILoggingTagConfig } from "../models/logging-config-type";
import { ChangeEvent, MouseEvent, useState } from "react";
import { socket } from "../services/Socket";
import { AllInclusive, Clear, CloudOff, CloudSync, DeleteForever, ExpandLess, ExpandMore, Refresh, Stairs } from "@mui/icons-material";
import { useLoggingServerConfig, useLoggingUpdater } from "../services/ControllerInfoContext";
import DownloadIcon from '@mui/icons-material/Download';
import UploadIcon from '@mui/icons-material/Upload';
import styled from "@emotion/styled";




interface ILoggingManagerProps {

}

export default function LoggingManager(props: ILoggingManagerProps) {
  const localLoggingServerConfig = useLoggingServerConfig();
  const updateConfig = useLoggingUpdater();

  function sendConfig() {

    if (localLoggingServerConfig) {
      for (const config of localLoggingServerConfig.logConfigs) {
        config.tags = config.tags.filter((tag) => tag.status != "remove");
      }
      socket.emit("writeLoggingConfig", localLoggingServerConfig);
    }
  }

  function exportConfig(){
    //create  file for download
    const blob = new Blob([JSON.stringify(localLoggingServerConfig,null,2)], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.download = "logging.json";
    link.href = url;
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  }

  async function uploadConfig(event: ChangeEvent<HTMLInputElement>){
    if(event.target.files?.[0]){      
      return event.target.files[0].text().then((text) => {
        updateConfig?.({
          type: "reset",
          newServerConfig: JSON.parse(text),
        })
        event.target.value = "";
      })
    }
    else{
      return Promise.resolve();
    }
  }

  return (
    <Stack id="logging-main-stack" direction="column" sx={{height:"100%"}}>
      <Typography variant="h6" width="100%" textAlign="center" color="purple">Logging Configurations</Typography>
      <Stack id="logging-buttons-stack" direction="row" padding={1} spacing={1} justifyContent="end">
        <Button variant="contained" onClick={exportConfig} startIcon={<DownloadIcon />}>
          Export Config
        </Button>
        <Button
          component="label"
          role={undefined}
          variant="contained"
          tabIndex={-1}
          startIcon={<UploadIcon />}
        >
          Upload Config
          <VisuallyHiddenInput
            type="file"
            onChange={uploadConfig}
          />
        </Button>
        <Button variant="contained" color="success" onClick={() => socket.emit("requestLoggingConfig")} >
          <Refresh />
          Refresh
        </Button>
        <Button variant="contained" onClick={sendConfig} color="warning">
          Send Config
        </Button>
      </Stack>
      <Box sx={{overflowY:"scroll"}}>
        <List>
          {localLoggingServerConfig?.logConfigs.map(
            (config) => <LoggingConfigDisplay config={config} key={config.measurement} />
          )}
        </List>
      </Box>
      


    </Stack>
  )

}

const VisuallyHiddenInput = styled('input')({
  clip: 'rect(0 0 0 0)',
  clipPath: 'inset(50%)',
  height: 1,
  overflow: 'hidden',
  position: 'absolute',
  bottom: 0,
  left: 0,
  whiteSpace: 'nowrap',
  width: 1,
});

/**
 * Display a config under a measurement and controller name
 * @param config the config object for one measurement
 * @returns 
 */
function LoggingConfigDisplay({ config }: { config: ILoggingConfig }) {
  const [isExpanded, setIsExpanded] = useState(true);
  const updateConfig = useLoggingUpdater();

  const hasSubNodes = (config.tags.length > 0);
  let allDisabled = true;
  for (const tag of config.tags) {
    if (!tag.disabled) {
      allDisabled = false;
      break;
    }
  }

  return (
    <ListItem sx={{ padding: 0, width: "100%" }}>
      <Stack spacing={0} sx={{ padding: 0, width: "100%" }} direction="column">
        <ListItemButton onClick={handleExpandClick}
          sx={{
            borderTop: "3px solid purple",
            borderBottom: "1px solid purple",
            position: "sticky",
            top: "0em",
            backgroundColor: "white",
            zIndex: 50,
          }}
        >
          {hasSubNodes ? (isExpanded ? <ExpandMore /> : <ExpandLess />) : <SvgIcon />}
          <ListItemText primary={`Measurement: ${config.measurement}`} />
          <ListItemText primary={`Controller: ${config.name}`} />
          <Tooltip title={allDisabled ? "Click to Enable All" : "Click to Disable All"} arrow>
          <Box>
            {allDisabled ?
              <CloudOff onClick={handleDisableAll} />
              : <CloudSync onClick={handleDisableAll} />
            }
          </Box>
        </Tooltip>
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
                  key={config.measurement + config.name + tag.field}
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

  function handleDisableAll(event: MouseEvent){
    // stop propogation so it doesn't change the expansion status
    event.stopPropagation();
    if(updateConfig){
      config.tags.forEach((tag, index) => {
        updateConfig({
          type: "modify",
          measurement: config.measurement,
          controllerName: config.name,
          tag: { ...tag, disabled: !allDisabled },
          index: index,
        });
      });
    }
    
  }
} // LoggingConfigDisplay


/**
 * Display the config for one symbol
 * @param 
 * @returns 
 */
function LoggingItemDisplay({ measurement, controllerName, tag, index }
  : { measurement: string, controllerName: string, tag: ILoggingTagConfig, index: number }) {
  const updateConfig = useLoggingUpdater();

  return (
    <ListItem sx={{ paddingY: 0, width: "100%", borderTop: "1px solid purple" }}>
      <Stack direction="row" spacing={0} sx={{ padding: "0.2em 0", width: "100%" }}>
        
        <Grid2 container sx={{ flex: "1 1 auto" }} >
          <Grid2 size={{ xs: 12, lg: 6 }} display="flex" sx={{}}>
            <Typography component="div" sx={{ textOverflow: "ellipsis", textWrap: "wrap", overflow: "hidden", wordBreak:"break-word" }}>{tag.tag}</Typography>
          </Grid2>
          <Grid2 size={{ xs: 12, lg: 6 }} display="flex">
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
                    textWrap: "wrap",
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
        <Tooltip title={tag.disabled ? "Disabled. Click to Enable." : "Enabled. Click to Disable."} arrow>
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
        tag: { ...tag },
        index: index,
      });
    }
  }
} //LoggingItemDisplay