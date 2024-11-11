import { Box, Button, FormControl, InputLabel, List, MenuItem, Select, SelectChangeEvent, Stack, Typography } from "@mui/material";
import { useWatchList } from "../models/WatchListProvider";
import { CurrentControllerContext, useControllerStatus } from "../services/ControllerInfoContext";
import SymbolTreeNode from "./SymbolTree/SymbolTreeNode";
import { SubscriptionGroupPrefixContext } from "../models/utilities";
import DownloadButton from "./SymbolTree/DownloadButtons";
import UploadButton from "./SymbolTree/UploadButton";
import { cursorTo } from "readline";
import { useEffect, useState } from "react";


interface IWatchPaneProps {

}

export default function WatchPane(props: IWatchPaneProps) {
  const [currentController, setCurrentController] = useState<string>("");
  const watchList = useWatchList();
  const subscriptionGroupPrefix = "W";

  

  let controllerAvailable = false;
  const controllerSelectItems = Object.keys(watchList).map((controllerName) => {
    if (watchList[controllerName]) {
      controllerAvailable = true;
    }
    return watchList[controllerName] && <MenuItem value={controllerName} key={controllerName}>{controllerName}</MenuItem>
  });

  // if no controller is set, pick one
  if (controllerAvailable && 
      ((currentController == "") || (watchList[currentController] == undefined))
  ){
    setCurrentController(Object.keys(watchList)[0]);
  }

  const controllerSelectLabel = currentController == "" ?
    (controllerAvailable ? "Select Controller" : "No Controller Available...")
    : "Current Controller";

  function handleControllerSelectionChange(event: SelectChangeEvent) {
    setCurrentController(event.target.value)
  }

  return (
    <Box sx={{height:"100%", overflow:"clip", display:"flex", flexDirection:"column"}}>
      <Stack direction="row" padding={1} spacing={1} >
        <Typography variant="button" flex={"1 1 auto"}>Watch List</Typography>
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
          >
            {controllerSelectItems}
          </Select>
        </FormControl>
        {
          watchList[currentController] ?
            <DownloadButton
              currentController={currentController}
              modelTreeNodes={
                Object.keys(watchList[currentController]).map((symbolName) => watchList[currentController][symbolName])
              } />
            : false
        }
        
        <UploadButton currentController={currentController} />
        <Button variant="contained" >Write All Values</Button>
        <Button variant="contained" color="warning" >Clear Watch List</Button>
      </Stack>
      {
        watchList[currentController] ?
          <Box sx={{ padding: 0, overflowY: "scroll", overflowX: "clip", flex: "1 1 0px" }}>
            <SubscriptionGroupPrefixContext.Provider value={subscriptionGroupPrefix}>
              <CurrentControllerContext.Provider value={currentController}>
                <List dense={true} disablePadding={true} key={subscriptionGroupPrefix + currentController}>
                  {Object.keys(watchList[currentController]).map((symbolName) => (
                    <SymbolTreeNode
                      showRemoveFromWatchIcon={true}
                      modelTreeNode={watchList[currentController][symbolName]}
                      key={subscriptionGroupPrefix + watchList[currentController][symbolName].name
                      }
                    />
                  ))}
                </List>
              </CurrentControllerContext.Provider>
            </SubscriptionGroupPrefixContext.Provider>
          </Box>
          : false
      }

    </Box>
  )


}