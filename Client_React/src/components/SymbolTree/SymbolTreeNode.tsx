import { Box, List, ListItem, ListItemButton, Stack, SvgIcon, SxProps, Table, TableBody, TableCell, TableRow, Typography } from "@mui/material";
import Grid from "@mui/material/Grid2"
import { IControllerSymbol, IControllerType } from "../../models/controller-data-types";
import { MutableRefObject, useContext, useEffect, useRef, useState } from "react";
import { ExpandLess, ExpandMore, ModelTraining } from "@mui/icons-material";
import { IModelTreeNode, treeLevelContext, useModelTree } from "../../models/utilities";
import { CurrentControllerContext, useDataTypes, watchableTypes } from "../../services/ControllerInfoContext";
import useOnScreen from "../../models/onScreenDetection";
import { useSymbolWatchManager } from "../../services/Socket";

interface ISymbolTreeNodeProps {
  modelTreeNode: IModelTreeNode,
  // name: string, // full path of the symbol
  // symbol: IControllerSymbol,
  // type?: IControllerType, // if type is not supplied, it will be looked up from useDataTypes
  displayValue?: number|boolean|string|object|null|undefined, // This is for displaying array elements
  //symbolFilter?: {name?: string | RegExp[], type?: string | RegExp[]} | string | RegExp[] | null  // if given a string, the filter will be applied to the name. 
}

export default function SymbolTreeNode(props: ISymbolTreeNodeProps) {
  /** value obtained from PLC subscription */
  const [value, setValue] = useState<number|boolean|string|object|null|undefined>(null)
  /** flags if user expanded this node */
  const [isExpanded, setIsExpanded] = useState(false); 
  const treeLevel = useContext(treeLevelContext);
  const currentController = useContext(CurrentControllerContext); // only needed for data subscription
  // const dataTypes = useDataTypes();
  // const thisTypeObj = props.type || dataTypes[currentController][props.symbol.type.toLocaleLowerCase()];
  // const hasSubNodes = (thisTypeObj && (thisTypeObj.subItemCount > 0 || thisTypeObj.arrayDimension > 0));
  const ref = useRef<HTMLDivElement>(null)
  const isOnScreen = useOnScreen(ref);
  const symbolWatchManager = useSymbolWatchManager();


  const valueToDisplay = (props.displayValue != undefined && props.displayValue != null) ? props.displayValue:value;
  
  const subNodes: (JSX.Element|null)[] = [];
  let hasSubNodes = false;
  for(let i = 0; i < props.modelTreeNode.subNodes.length; i++){
    const subNode = props.modelTreeNode.subNodes[i];
    if(subNode.filterPassed){
      hasSubNodes = true;
      if(props.modelTreeNode.requestExpand || isExpanded){
        // render subnode
        if(props.modelTreeNode.isArrayRoot){
          // array. need to pass a displayValue
          if(Array.isArray(valueToDisplay) && i < valueToDisplay.length){
            subNodes.push(
              <SymbolTreeNode modelTreeNode={subNode} key={subNode.name}
                displayValue={valueToDisplay[i]}/>
            )
          }
          else{
            subNodes.push(
              <SymbolTreeNode modelTreeNode={subNode} key={subNode.name}
                displayValue={null}/>
            )
          }
        }
        else{
          // not array, no value to pass
          subNodes.push(
            <SymbolTreeNode modelTreeNode={subNode} key={subNode.name}/>
          )
        }
      }
    }
  }
  

  // Expand or fold this node after clicking 
  const handleClick = () => {
    if (hasSubNodes){
      setIsExpanded(!isExpanded);
    }
  }

  // just expanded this node. Scroll it to the center
  useEffect(() => {
    if(isExpanded){
      
      ref.current?.scrollIntoView({
        behavior: "smooth",
        block: "center"
      })
    }
  },[isExpanded])

  // subscribe to the reading when it's in view
  useEffect(() => {
    if ((props.displayValue == undefined)
        && (watchableTypes.has(props.modelTreeNode.baseType) 
            || props.modelTreeNode.baseType.includes("STRING"))
      ) {
      let symbolPath = props.modelTreeNode.name;
      if (props.modelTreeNode.symbol.type.toLocaleLowerCase().startsWith("pointer to ")) {
        symbolPath = symbolPath + '^';
      }
      if (isOnScreen) {
        symbolWatchManager.subscribe("Tree" + symbolPath, 
          currentController, symbolPath, props.modelTreeNode.baseType, 
          (data?: number | boolean | string | null) => {
            setValue(data);
          })
      }
      else {
        symbolWatchManager.unsubscribe("Tree" + symbolPath, currentController, symbolPath);
      }

      return () => {
        symbolWatchManager.unsubscribe("Tree" + symbolPath, currentController, symbolPath);
      }
    }
    
    
  }, [currentController, isOnScreen, props.displayValue, props.modelTreeNode.baseType, props.modelTreeNode.name, props.modelTreeNode.symbol.type, symbolWatchManager])
  
  // if (hasFilter && (!filterPassed)){
  //   return null
  // }

  return (
    <ListItem key={props.modelTreeNode.name} sx={{ padding: 0, width: "100%"}} >
      <Stack spacing={0} padding={0} width={"100%"} >
        <ListItemButton onClick={handleClick} sx={{ padding: 0}} alignItems="flex-start" ref={ref}>
          <TreeNodeIndent level={treeLevel}></TreeNodeIndent>
          {hasSubNodes ? (isExpanded ? <ExpandLess /> : <ExpandMore />) : <SvgIcon />}
          {/* <ListItemText primary={props.symbol.name} sx={{ margin: 0 }} /> */}
          <SymbolDisplay fullName={props.modelTreeNode.name} symbolObj={props.modelTreeNode.symbol} 
            value={valueToDisplay}></SymbolDisplay>
          
        </ListItemButton>
        {hasSubNodes ? (
          <treeLevelContext.Provider value={treeLevel + 1}>
            <List dense={true} sx={{ padding: "0 0 0 2em" }}>
              {subNodes}
            </List>
          </treeLevelContext.Provider>
        ) : null}

      </Stack>


    </ListItem>
  )
}

function TreeNodeIndent({ level }: { level: number }) {
  if (level < 1) {
    return null;
  }

  return (
    <Typography component="div" variant="button" minWidth={"24px"}>|--</Typography>
  )
} // TreeNodeIndent

function SymbolDisplay({fullName, symbolObj, value}:{fullName: string, symbolObj: IControllerSymbol, value?: number|boolean|string|object|null}) {
  const stackHoverSX:SxProps = {
    flex: "1 1 auto",
    overflow: "hidden",
    borderTop: "1px solid purple",
    '&:hover .symbol-name-display':{
      fontWeight: "bold"
    },
    '&:hover .symbol-info-display':{
      visibility: "visible",
      height: "auto"
    }
  }
  const tableSX:SxProps = {
    visibility: "collapse",
    margin: "0 0 0 1em",
    width: "100%",
    '& td':{
      padding: 0,
    }
  }

  

  return (
    <Stack spacing={0} padding={0} sx={stackHoverSX}>
      <Grid container maxHeight="3em" sx={{overflow:"clip"}} spacing={1}>
        <Grid size={6} sx={{overflow: "clip", height: "100%"}}>
          <Typography component="div" className="symbol-name-display" 
            sx={{textOverflow: "ellipsis", textWrap: "nowrap", overflow: "hidden"}}>
            {symbolObj.name}
          </Typography>
        </Grid>
        <Grid size={6} sx={{overflow: "clip", height: "100%"}}>
          <Typography component="div" sx={{textOverflow: "ellipsis", textWrap: "nowrap", overflow: "hidden"}}>{formatValue(value)}</Typography>
        </Grid>
      </Grid>
      <Table className="symbol-info-display" sx={tableSX}>
        <TableBody>
          <TableRow>
            <TableCell>Full Path: </TableCell>
            <TableCell>{fullName}</TableCell>
          </TableRow>
          <TableRow>
            <TableCell>Type: </TableCell>
            <TableCell>{symbolObj.type}</TableCell>
          </TableRow>
          <TableRow>
            <TableCell>Comment: </TableCell>
            <TableCell>{symbolObj.comment}</TableCell>
          </TableRow>
        </TableBody>

      </Table>
      {/* <Typography className="symbol-info-display" sx={{ visibility: "collapse", height: 0}}>Full Path: {props.key}</Typography>
      <Typography className="symbol-info-display" sx={{ visibility: "collapse", height: 0}}>Type: {props.symbol.type}</Typography>
      <Typography className="symbol-info-display" sx={{ visibility: "collapse", height: 0}}>Comment: {props.symbol.comment}</Typography> */}
    </Stack>

  )

  function formatValue(value?: number|boolean|string|null|undefined|object ){
    if(value != null && value != undefined){
      switch(typeof value){
        case "boolean":
          return value?"TRUE":"FALSE";
        case "object":
          return JSON.stringify(value);
      
        default:
          return value;

      }
    }
    else{
      return null;
    }
  }

} // SymbolDisplay


  /**
   * Split the filter string into an array of Regex. 
   * Each part of the input string (a Regex literal or sub strings separated by dot '.') is converted to a Regex. 
   * For example, MAIN.FB./abc/ is converted to [/MAIN/i, /FB/i, /abc/i].
   * @param str 
   * @returns An array of RegExp, with option 'i' (case insensitive)
   */
  function splitFilterString(str: string): RegExp[]{
    const result: RegExp[] = [];
    let start = 0;
    let end = 0;
    let isInRegExLiteral = false;
    while(end < str.length){
      if(str[end] == '/'){
        if(end > start){
          // something exist before this regex literal symbol.
          if (str[end-1] != '\\'){
            // it's not escaped, so it flags the start or end of a regex literal
            result.push(new RegExp(str.slice(start, end),"i")); // all RegEx are made case insensitive
          }
        }
        start = end + 1;
        isInRegExLiteral = !isInRegExLiteral;
      }
      else if(!isInRegExLiteral && str[end] == '.'){
        if(end > start){
          result.push(new RegExp(str.slice(start, end),"i")); // all RegEx are made case insensitive
        }
        start = end + 1;
      }
      end++;
    }
    if(end > start){
      result.push(new RegExp(str.slice(start, end),"i")); // all RegEx are made case insensitive
    }
    return result;
  }
