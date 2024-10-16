
import { Box } from "@mui/material";
import { useDataTypes, useSymbols, CurrentControllerContext } from "../services/ControllerInfoContext";
import { SimpleTreeView } from "@mui/x-tree-view";
import SymbolTreeNode from "./SymbolTreeNode";



interface ISymbolTreeProps{
  controllerName: string;
  filter: string;
  showGlobalSymbols?: boolean;
  showSystemSymbols?: boolean
}

export default function SymbolTree(props: ISymbolTreeProps){

  /**
   * symbol info received from controller. {controllerName: {symbolname: symbolObj}}. symbolname is lower case.
   */
  const symbols = useSymbols();
  /**
   * data type info received from controller. {controllerName: {typename: typeObj}}. typename is lower case
   */
  const dataTypes = useDataTypes();

  if (Object.keys(symbols).length == 0){
    return (
      <div>
        No Symbol Info Available.
      </div>
    )
  }

  if (Object.keys(dataTypes).length == 0){
    return (
      <div>
        No Type Info Available.
      </div>
    )
  }

  const treeItems = Object.keys(symbols[props.controllerName]).map(symbolName => {
    const lowerName = symbolName.toLocaleLowerCase();
    if (!props.showGlobalSymbols && lowerName.startsWith("global_")){
      return null;
    }
    if (!props.showSystemSymbols && 
      (lowerName.startsWith("constants.") || lowerName.startsWith("twincat_")||lowerName.startsWith("parameterlist"))){
        return null;
      }
      const symObj = symbols[props.controllerName][symbolName];
    return (
      <SymbolTreeNode name={symObj.name} key={symbolName} symbol={symObj}></SymbolTreeNode>
    )
  }
    
  );

  return (
    <Box>
      <CurrentControllerContext.Provider value={props.controllerName}>
        <SimpleTreeView>
          {treeItems}
        </SimpleTreeView>
      </CurrentControllerContext.Provider>
    </Box>
  )

}