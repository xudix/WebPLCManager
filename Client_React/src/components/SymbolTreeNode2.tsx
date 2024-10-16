import { Box, List, ListItem, ListItemButton, Stack, SvgIcon, SxProps, Table, TableBody, TableCell, TableRow, Typography } from "@mui/material";
import Grid from "@mui/material/Grid2"
import { IControllerSymbol } from "../models/controller-data-types";
import { useContext, useEffect, useRef, useState } from "react";
import { ExpandLess, ExpandMore } from "@mui/icons-material";
import { treeLevelContext } from "../models/utilities";
import { CurrentControllerContext, useDataTypes } from "../services/ControllerInfoContext";
import useOnScreen from "../models/onScreenDetection";
import { useSymbolWatchManager } from "../services/Socket";

interface ISymbolTreeNodeProps {
  name: string,
  symbol: IControllerSymbol

}

export default function SymbolTreeNode2(props: ISymbolTreeNodeProps) {
  const [value, setValue] = useState<number|boolean|string|object|null|undefined>(null)
  const [isExpanded, setIsExpanded] = useState(false);
  const treeLevel = useContext(treeLevelContext);
  const currentController = useContext(CurrentControllerContext);
  const dataTypes = useDataTypes();
  const thisTypeObj = dataTypes[currentController][props.symbol.type.toLocaleLowerCase()];
  const hasSubNodes = (thisTypeObj.subItemCount > 0 || thisTypeObj.arrayDimension > 0);
  const ref = useRef<HTMLDivElement>(null)
  const isOnScreen = useOnScreen(ref);
  const symbolWatchManager = useSymbolWatchManager();

  let subNodes;
  if (isExpanded) {

    if (thisTypeObj.subItemCount > 0) {
      // has sub items
      subNodes = thisTypeObj.subItems.map(subItem =>
        <SymbolTreeNode2 name={props.name + "." + subItem.name} symbol={subItem} key={props.name + "." + subItem.name}></SymbolTreeNode2>
      )
    }
    // add support for array
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
  useEffect(()=>{
    const typeObj = dataTypes[currentController][props.symbol.type.toLocaleLowerCase()];
    let symbolPath = props.name;
    if(typeObj.name.toLocaleLowerCase().startsWith("pointer to ")){
      symbolPath = symbolPath + '^';
    }
    if(isOnScreen){
      symbolWatchManager.subscribe("Tree"+props.name, currentController, symbolPath, typeObj.baseType, (data?: number|boolean|string|null) => {
        setValue(data);
      })
    }
    else{
      symbolWatchManager.unsubscribe("Tree"+props.name, currentController, symbolPath);
    }

    return () => {
      symbolWatchManager.unsubscribe("Tree"+props.name, currentController, props.name);
    }
  }, [currentController, dataTypes, isOnScreen, props.name, props.symbol.type, symbolWatchManager])

  
  return (
    <ListItem key={props.name} sx={{ padding: 0, width: "100%" }} >
      <Stack spacing={0} padding={0} width={"100%"} >
        <ListItemButton onClick={handleClick} sx={{ padding: 0, width: "100%" }} alignItems="flex-start" ref={ref}>
          <TreeNodeIndent level={treeLevel}></TreeNodeIndent>
          {hasSubNodes ? (isExpanded ? <ExpandLess /> : <ExpandMore />) : <SvgIcon />}
          {/* <ListItemText primary={props.symbol.name} sx={{ margin: 0 }} /> */}
          <SymbolDisplay fullName={props.name} symbolObj={props.symbol} value={value}></SymbolDisplay>
          
        </ListItemButton>
        {hasSubNodes ? (
          <treeLevelContext.Provider value={treeLevel + 1}>
            <List dense={true} sx={{ padding: "0 0 0 2rem" }}>
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
    <Typography variant="button" width={"24px"}>|--</Typography>
  )
}

function SymbolDisplay({fullName, symbolObj, value}:{fullName: string, symbolObj: IControllerSymbol, value?: number|boolean|string|object|null}) {
  const stackHoverSX:SxProps = {
    width: "100%",
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
    margin: "0 0 0 1rem",
    width: "100%",
    '& td':{
      padding: 0,
    }
  }

  

  return (
    <Stack spacing={0} padding={0} sx={stackHoverSX}>
      <Grid container>
        <Grid size={6}>
          <Typography className="symbol-name-display">{symbolObj.name}</Typography>
        </Grid>
        <Grid size={6}>
          <Typography >{formatValue(value)}</Typography>
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
}