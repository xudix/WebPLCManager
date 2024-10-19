import { Box, List, ListItem, ListItemButton, Stack, SvgIcon, SxProps, Table, TableBody, TableCell, TableRow, Typography } from "@mui/material";
import Grid from "@mui/material/Grid2"
import { IControllerSymbol, IControllerType } from "../../models/controller-data-types";
import { MutableRefObject, useContext, useEffect, useRef, useState } from "react";
import { ExpandLess, ExpandMore } from "@mui/icons-material";
import { treeLevelContext } from "../../models/utilities";
import { CurrentControllerContext, useDataTypes, watchableTypes } from "../../services/ControllerInfoContext";
import useOnScreen from "../../models/onScreenDetection";
import { useSymbolWatchManager } from "../../services/Socket";

interface ISymbolTreeNodeProps {
  name: string, // full path of the symbol
  symbol: IControllerSymbol,
  type?: IControllerType, // if type is not supplied, it will be looked up from useDataTypes
  displayValue?: number|boolean|string|object|null|undefined, // This is for displaying array elements
  //symbolFilter?: {name?: string | RegExp[], type?: string | RegExp[]} | string | RegExp[] | null  // if given a string, the filter will be applied to the name. 
}

export default function SymbolTreeNode2(props: ISymbolTreeNodeProps) {
  const [value, setValue] = useState<number|boolean|string|object|null|undefined>(null)
  const [isExpanded, setIsExpanded] = useState(false);
  const treeLevel = useContext(treeLevelContext);
  const currentController = useContext(CurrentControllerContext);
  const dataTypes = useDataTypes();
  const thisTypeObj = props.type || dataTypes[currentController][props.symbol.type.toLocaleLowerCase()];
  const hasSubNodes = (thisTypeObj && (thisTypeObj.subItemCount > 0 || thisTypeObj.arrayDimension > 0));
  const ref = useRef<HTMLDivElement>(null)
  const isOnScreen = useOnScreen(ref);
  const symbolWatchManager = useSymbolWatchManager();

  if(!thisTypeObj){
    debugger
  }

  const valueToDisplay = (props.displayValue != undefined && props.displayValue != null) ? props.displayValue:value;
  
  //handle filter
  // let filterPassed: boolean = true;
  // let hasFilter = (props.symbolFilter != null && props.symbolFilter != undefined);
  // let nameFilters: RegExp[] = [], typeFilters: RegExp[] = [];
  // const subNodeFilter = {};
  // if(hasFilter){
  //   if(typeof props.symbolFilter == "string"){
  //     nameFilters = splitFilterString(props.symbolFilter);
  //   }
  //   else if(Array.isArray(props.symbolFilter)){
  //     // it's an array of RegExp. Apply it to the symbol name
  //     nameFilters = props.symbolFilter;
  //   }
  //   else{
  //     // props.symbolFilter is an object {name?: string | RegExp[], type?: string | RegExp[]}
  //     if(typeof props.symbolFilter?.name == "string"){
  //       nameFilters = splitFilterString(props.symbolFilter.name);
  //     }
  //     else if(Array.isArray(props.symbolFilter?.name)){
  //       nameFilters = props.symbolFilter.name;
  //     }
  //     if(typeof props.symbolFilter?.type == "string"){
  //       typeFilters = splitFilterString(props.symbolFilter.type);
  //     }
  //     else if(Array.isArray(props.symbolFilter?.type)){
  //       typeFilters = props.symbolFilter.type;
  //     }
  //   }

  //   if(nameFilters.length > 0){
  //     if(props.symbol.name.match(nameFilters[0]) != null){
  //       // match. check subnodes
  //       if(nameFilters.length > 1){
  //         filterPassed = false;
  //         subNodeFilter.name = nameFilters.slice(1);
  //       }
  //       else{
  //         hasFilter = false;
  //       }
  //     }
  //     else{
  //       filterPassed = false;
  //       subNodeFilter.name = [...nameFilters];
  //     }
  //   }

  // }

  let subNodes: (JSX.Element|null)[] = [];
  // if (isExpanded || (hasFilter && (!filterPassed))) {
  if (isExpanded) {  

    if (thisTypeObj.subItemCount > 0) {
      // has sub items
      subNodes = thisTypeObj.subItems.map(subItem =>
        <SymbolTreeNode2 name={props.name + "." + subItem.name} symbol={subItem}
         key={props.name + "." + subItem.name}
        ></SymbolTreeNode2>
        // <SymbolTreeNode2 name={props.name + "." + subItem.name} symbol={subItem}
        //  symbolFilter={subNodeFilter} key={props.name + "." + subItem.name}
        // ></SymbolTreeNode2>
      )
    }
    // support for array
    
    if (thisTypeObj.arrayDimension > 0){
      subNodes = [];
      //let nodeDataTypeStr = thisTypeObj.baseType;
      const nodeTypeObj: IControllerType = {...thisTypeObj};
      if(nodeTypeObj.size){
        nodeTypeObj.size /= nodeTypeObj.arrayInfo[0].length;
      }
      nodeTypeObj.arrayDimension -= 1;
      nodeTypeObj.arrayInfo.slice(1);
      if(thisTypeObj.arrayDimension > 1){
        // multi-dimension array. The subitem will still be an array
        // dimension in type name should change from [0..9,0..2] to [0..2]
        nodeTypeObj.name = nodeTypeObj.name.replace(/(?<=\[)\d+\.\.\d+,\s*/,'');
      }
      else{
        // 1-D array, sub items are of base type
        nodeTypeObj.name = nodeTypeObj.baseType;
        const lowerBaseType = nodeTypeObj.baseType.toLowerCase();
        nodeTypeObj.baseType = dataTypes[currentController][lowerBaseType].baseType;
        nodeTypeObj.enumInfo = dataTypes[currentController][lowerBaseType].enumInfo;

      }

      for(let i = 0; i < thisTypeObj.arrayInfo[0].length; i++){
        const indexStr = `[${thisTypeObj.arrayInfo[0].startIndex + i}]`;
        const nodeSymbol: IControllerSymbol = {
          name: props.symbol.name + indexStr,
          type: nodeTypeObj.name,
          comment: props.symbol.comment,
          isPersisted: props.symbol.isPersisted
        }
        // take an element from value array and give it to sub node
        let nodeDisplayValue=null;
        if(Array.isArray(valueToDisplay) && (i < valueToDisplay.length)){
          nodeDisplayValue = valueToDisplay[i];
        }
        subNodes.push(
          <SymbolTreeNode2 key={props.name+indexStr} name={props.name+indexStr}
           symbol={nodeSymbol} type={nodeTypeObj} displayValue={nodeDisplayValue}
          />
          // <SymbolTreeNode2 key={props.name+indexStr} name={props.name+indexStr}
          //  symbol={nodeSymbol} type={nodeTypeObj} displayValue={nodeDisplayValue}
          //  symbolFilter={subNodeFilter}/>

        )
      }
    }// support for array

    // for(const subnode of subNodes){
    //   if(subnode != null){
    //     // at least one subnode passed the filter. This should be rendered.
    //     filterPassed = true;
    //     break;
    //   }
    //   else if(thisTypeObj.subItemCount > 0){
    //     ;
    //   }
    // }
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
    const typeObj = dataTypes[currentController][props.symbol.type.toLocaleLowerCase()];
    // only subscribe when 1. no displayValue is provided; 2. it's a string or primitive type
    
    if ((props.displayValue == undefined) && typeObj != undefined
      && (watchableTypes.has(typeObj.baseType) || typeObj.baseType.includes("STRING"))) {
      let symbolPath = props.name;
      if (typeObj.name.toLocaleLowerCase().startsWith("pointer to ")) {
        symbolPath = symbolPath + '^';
      }
      // if (isOnScreen) {
      //   symbolWatchManager.subscribe("Tree" + props.name, currentController, symbolPath, typeObj.baseType, (data?: number | boolean | string | null) => {
      //     setValue(data);
      //   })
      // }
      else {
        symbolWatchManager.unsubscribe("Tree" + props.name, currentController, symbolPath);
      }

      return () => {
        symbolWatchManager.unsubscribe("Tree" + props.name, currentController, props.name);
      }
    }
    
    
  }, [currentController, dataTypes, isOnScreen, props.displayValue, props.name, props.symbol.type, symbolWatchManager])
  
  // if (hasFilter && (!filterPassed)){
  //   return null
  // }

  return (
    <ListItem key={props.name} sx={{ padding: 0, width: "100%"}} >
      <Stack spacing={0} padding={0} width={"100%"} >
        <ListItemButton onClick={handleClick} sx={{ padding: 0}} alignItems="flex-start" ref={ref}>
          <TreeNodeIndent level={treeLevel}></TreeNodeIndent>
          {hasSubNodes ? (isExpanded ? <ExpandLess /> : <ExpandMore />) : <SvgIcon />}
          {/* <ListItemText primary={props.symbol.name} sx={{ margin: 0 }} /> */}
          <SymbolDisplay fullName={props.name} symbolObj={props.symbol} 
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
