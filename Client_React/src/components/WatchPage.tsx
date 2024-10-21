
import { useControllerStatus } from "../services/ControllerInfoContext";

import SplitPane from "react-split-pane";
import { Box } from "@mui/material";
import "./SplitPaneStyles.css"
import SymbolSelector from "./SymbolSelector";
import LoggingManager from "./LoggingManager";

export function WatchPage() {
  const controllerStatus = useControllerStatus();

  if (Object.keys(controllerStatus).length > 0) {
    return (
      <SplitPane split="horizontal" size={"80vh"} style={{ position: "static" }}>
        <SplitPane split="vertical" defaultSize={"50%"} style={{ position: "absolute" }}>
          <SymbolSelector></SymbolSelector>

          <LoggingManager/>
        </SplitPane>
        <Box>Watch area</Box>
      </SplitPane>

    );
  }
  else {
    return (
      <div>
        No controller connected.
      </div>
    )
  }


}
