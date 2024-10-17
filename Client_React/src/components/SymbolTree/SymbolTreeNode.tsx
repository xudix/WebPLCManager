import { TreeItem2 } from "@mui/x-tree-view"
import { IControllerSymbol } from "../../models/controller-data-types"
import { CurrentControllerContext, useDataTypes } from "../../services/ControllerInfoContext"
import { useContext } from "react";
import { Box } from "@mui/material";


interface ISymbolTreeNodeProps{
  name: string,
  symbol: IControllerSymbol,
  key?: string
}

export default function SymbolTreeNode(props: ISymbolTreeNodeProps){

  const dataTypes = useDataTypes();
  const currentController = useContext(CurrentControllerContext);
  const allTypes = dataTypes[currentController];
  const thisTypeName = props.symbol.type.toLocaleLowerCase();
  const subItemsOfThis = allTypes[thisTypeName].subItems;
  let subNodes;
  if (allTypes[thisTypeName].subItemCount > 0) {
    subNodes = subItemsOfThis.map(symbol => (
      <SymbolTreeNode name={props.name+"."+symbol.name} key={props.name+"."+symbol.name} symbol={symbol}></SymbolTreeNode>
    ))
  }
  else{
    subNodes = null;
  }
  
  return (
    <TreeItem2 itemId={props.name} key={props.name} label={props.name}>
      <Box>
        <div>Name: {props.name}</div>
        <div>Type: {props.symbol.type}</div>
        <div>Comment: {props.symbol.comment}</div>
      </Box>
      
      {subNodes}
    </TreeItem2>
  )
}