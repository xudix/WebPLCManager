import { Box, Button, List, Stack, Typography } from "@mui/material";
import { useWatchList } from "../models/WatchListProvider";
import { CurrentControllerContext } from "../services/ControllerInfoContext";
import SymbolTreeNode from "./SymbolTree/SymbolTreeNode";
import { SubscriptionGroupPrefixContext } from "../models/utilities";


interface IWatchPaneProps {

}

export default function WatchPane(props: IWatchPaneProps) {
  const watchList = useWatchList();
  const subscriptionGroupPrefix = "W";

  return (
    <Box sx={{height:"100%", overflow:"clip", display:"flex", flexDirection:"column"}}>
      <Stack direction="row" padding={1} spacing={1} >
        <Typography variant="button" flex={"1 1 auto"}>Watch List</Typography>
        <Button variant="contained" >Write All Values</Button>
        <Button variant="contained" color="warning" >Clear Watch List</Button>
      </Stack>
      <Box sx={{ padding: 0, overflowY: "scroll", overflowX: "clip", flex:"1 1 0px" }}>
        <SubscriptionGroupPrefixContext.Provider value={subscriptionGroupPrefix}>
          {Object.keys(watchList).map((controllerName) => (
            <CurrentControllerContext.Provider value={controllerName}>
              <List dense={true} disablePadding={true} key={subscriptionGroupPrefix + controllerName}>
                {Object.keys(watchList[controllerName]).map((symbolName) => (
                  <SymbolTreeNode
                    showRemoveFromWatchIcon={true}
                    modelTreeNode={watchList[controllerName][symbolName]}
                    key={subscriptionGroupPrefix + watchList[controllerName][symbolName].name
                    }
                  />
                ))}
              </List>
            </CurrentControllerContext.Provider>
          ))}
        </SubscriptionGroupPrefixContext.Provider>
      </Box>

    </Box>
  )


}