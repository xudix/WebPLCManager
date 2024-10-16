
import { CurrentControllerContext, useControllerStatus, useDataTypes, useSymbols } from "../services/ControllerInfoContext";
import { Box, List } from "@mui/material";
import SymbolTreeNode2 from "./SymbolTreeNode2";


interface ISymbolTreeProps {
  controllerName: string;
  filter: string;
  showGlobalSymbols?: boolean;
  showSystemSymbols?: boolean
}

export default function SymbolTree2(props: ISymbolTreeProps) {
  /**
 * symbol info received from controller. {controllerName: {symbolname: symbolObj}}. symbolname is lower case.
 */
  const symbols = useSymbols();
  /**
   * data type info received from controller. {controllerName: {typename: typeObj}}. typename is lower case
   */
  const dataTypes = useDataTypes();
  const controllerStatus = useControllerStatus();

  if (Object.keys(symbols).length == 0) {
    return (
      <div>
        No Symbol Info Available.
      </div>
    )
  }

  if (Object.keys(dataTypes).length == 0) {
    return (
      <div>
        No Type Info Available.
      </div>
    )
  }

  if (controllerStatus[props.controllerName]) {
    if (symbols[props.controllerName]) {
      const treeItems = Object.keys(symbols[props.controllerName]).map((symbolName) => {
        const lowerName = symbolName.toLocaleLowerCase();
        if (!props.showGlobalSymbols && lowerName.startsWith("global_")) {
          return null;
        }
        if (!props.showSystemSymbols &&
          (lowerName.startsWith("constants.") || lowerName.startsWith("twincat_") || lowerName.startsWith("parameterlist"))) {
          return null;
        }
        const symObj = symbols[props.controllerName][symbolName];
        return (
          <SymbolTreeNode2 name={symObj.name} symbol={symObj} key={symObj.name}></SymbolTreeNode2>
        )
      })

      return (
        <Box>
          <CurrentControllerContext.Provider value={props.controllerName}>
            <List dense={true} disablePadding={true}>
              {treeItems}
            </List>
          </CurrentControllerContext.Provider>
          
        </Box>
      )
    }
    else {
      return (
        <Box>
          Symbol infomation for {props.controllerName} is not availavle.
        </Box>
      )
    }

  }
  else {
    return (
      <Box>
        Controller {props.controllerName} is not connected.
      </Box>
    )
  }






}