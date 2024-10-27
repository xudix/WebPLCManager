import { Box, InputAdornment, List, ListItem, ListItemButton, Stack, SvgIcon, SxProps, Table, TableBody, TableCell, TableRow, TextField, Tooltip, Typography } from "@mui/material";
import Grid from "@mui/material/Grid2"
import { IControllerSymbol, IControllerType } from "../../models/controller-data-types";
import { ChangeEvent, MutableRefObject, useContext, useEffect, useRef, useState } from "react";
import { CloudUpload, Download, ExpandLess, ExpandMore, Visibility, Clear, Send } from "@mui/icons-material";
import { IModelTreeNode, treeLevelContext, useModelTree } from "../../models/utilities";
import { CurrentControllerContext, useCurrentMeasurement, useDataTypes, useLoggingUpdater, useNewValues, useUpdateNewValues, watchableTypes } from "../../services/ControllerInfoContext";
import useOnScreen from "../../models/onScreenDetection";
import { useSymbolWatchManager } from "../../services/Socket";

interface ISymbolTreeNodeProps {
  modelTreeNode: IModelTreeNode,
  // name: string, // full path of the symbol
  // symbol: IControllerSymbol,
  // type?: IControllerType, // if type is not supplied, it will be looked up from useDataTypes
  displayValue?: number | boolean | string | object | null | undefined, // This is for displaying array elements
  //symbolFilter?: {name?: string | RegExp[], type?: string | RegExp[]} | string | RegExp[] | null  // if given a string, the filter will be applied to the name. 
}

export default function SymbolTreeNode(props: ISymbolTreeNodeProps) {
  /** value obtained from PLC subscription */
  const [value, setValue] = useState<number | boolean | string | object | null | undefined>(null)
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


  const valueToDisplay = (props.displayValue != undefined && props.displayValue != null) ? props.displayValue : value;

  const subNodes: (JSX.Element | null)[] = [];
  let hasSubNodes = false;
  for (let i = 0; i < props.modelTreeNode.subNodes.length; i++) {
    const subNode = props.modelTreeNode.subNodes[i];
    if (subNode.filterPassed) {
      hasSubNodes = true;
      if (props.modelTreeNode.requestExpand || isExpanded) {
        // render subnode
        if (props.modelTreeNode.isArrayRoot) {
          // array. need to pass a displayValue
          if (Array.isArray(valueToDisplay) && i < valueToDisplay.length) {
            subNodes.push(
              <SymbolTreeNode modelTreeNode={subNode} key={subNode.name}
                displayValue={valueToDisplay[i]} />
            )
          }
          else {
            subNodes.push(
              <SymbolTreeNode modelTreeNode={subNode} key={subNode.name}
                displayValue={null} />
            )
          }
        }
        else {
          // not array, no value to pass
          subNodes.push(
            <SymbolTreeNode modelTreeNode={subNode} key={subNode.name} />
          )
        }
      }
    }
  }


  // Expand or fold this node after clicking 
  const handleClick = () => {
    if (hasSubNodes) {
      setIsExpanded(!isExpanded);
    }
  }

  // just expanded this node. Scroll it to the center
  useEffect(() => {
    if (isExpanded) {

      ref.current?.scrollIntoView({
        behavior: "smooth",
        block: "center"
      })
    }
  }, [isExpanded])

  // subscribe to the reading when it's in view
  useEffect(() => {
    if ((props.displayValue == undefined)
      && (watchableTypes.has(props.modelTreeNode.type.baseType)
        || props.modelTreeNode.type.baseType.includes("STRING"))
    ) {
      let symbolPath = props.modelTreeNode.name;
      if (props.modelTreeNode.symbol.type.toLocaleLowerCase().startsWith("pointer to ")) {
        symbolPath = symbolPath + '^';
      }
      if (isOnScreen) {
        symbolWatchManager.subscribe("Tree" + symbolPath,
          currentController, symbolPath, props.modelTreeNode.type,
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


  }, [currentController, isOnScreen, props.displayValue, props.modelTreeNode.type, props.modelTreeNode.name, props.modelTreeNode.symbol.type, symbolWatchManager])

  // if (hasFilter && (!filterPassed)){
  //   return null
  // }position: hasSubNodes?"relative":"sticky",

  const mainItemSx: SxProps = {
    padding: 0,
    // width: "100%",
    // overflow: "clip",
    position: (props.modelTreeNode.requestExpand || isExpanded) ? "sticky" : "auto",
    top: (props.modelTreeNode.requestExpand || isExpanded) ? `${(treeLevel) * 2}em` : "",
    zIndex: (props.modelTreeNode.requestExpand || isExpanded) ? 50 - treeLevel : "auto",
    backgroundColor: "white",
    cursor: "default",
    '&:hover': {
      backgroundColor: "gold",
    }
  }

  return (
    <ListItem sx={{ padding: 0, width: "100%" }} >
      <Stack spacing={0} padding={0} width={"100%"} >
        <ListItemButton onClick={handleClick} sx={mainItemSx} alignItems="flex-start" ref={ref}>
          <TreeNodeIndent level={treeLevel}></TreeNodeIndent>
          {hasSubNodes ? (isExpanded ? <ExpandLess /> : <ExpandMore />) : <SvgIcon />}
          {/* <ListItemText primary={props.symbol.name} sx={{ margin: 0 }} /> */}
          <SymbolDisplay fullName={props.modelTreeNode.name} symbolObj={props.modelTreeNode.symbol}
            value={valueToDisplay} ></SymbolDisplay>


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

function SymbolDisplay({ fullName, symbolObj, value }: { fullName: string, symbolObj: IControllerSymbol, value?: number | boolean | string | object | null }) {
  const updateLogging = useLoggingUpdater();
  const symbolWatchManager = useSymbolWatchManager();
  const currentController = useContext(CurrentControllerContext);
  const currentMeasurement = useCurrentMeasurement();
  const newValuesObj = useNewValues();
  const updateNewValues = useUpdateNewValues();

  function addToLogging(){
    if(updateLogging){
      updateLogging({
        type: "add",
        controllerName: currentController,
        measurement: currentMeasurement,
        tag: {
          tag: fullName,
          field: inferField(fullName)||fullName,
        }
      });
    }
  }

  function inferField(fullName: string){
    const splitName = fullName.split(".");
    if(splitName.length > 1 && splitName.at(-1)?.toLocaleLowerCase().includes("value")){
      return splitName.at(-2);
    }
    else{
      return splitName.at(-1);
    }
  }

  /**
   * write new value to controller 
   */
  function writeValue(){
    symbolWatchManager.writeValue(currentController, fullName, newValuesObj[fullName]||"");
    clearNewValue();
  }

  const outerStackSX: SxProps = {
    flex: "1 1 auto",
    borderTop: "1px solid purple",
    overflow: "hidden",
    paddingY: "0.2em"
  }

  const symbolNameSX: SxProps = {
    //overflow: "clip",
    //position: "relative",
    //display: "inline-block",
    height: "100%",
    maxWidth: "15em",
    '&:hover': {
      fontWeight: "bold"
    }
  }


  return (
    <Tooltip
      title={
        <SymbolInfoDisplay
          fullPath={fullName}
          type={symbolObj.type}
          comment={symbolObj.comment} />}
      arrow
      placement="right-start"
      id="symbol-info-tooltip"
    >
      <Stack spacing={0} padding={0} sx={outerStackSX}>
        <Grid container maxHeight="3em" sx={{}} spacing={1}>
          <Grid size={4} sx={symbolNameSX}>
            <Typography component="div" className="symbol-name-display"
              sx={{ textOverflow: "ellipsis", textWrap: "nowrap", overflow: "hidden" }}>
              {symbolObj.name}
            </Typography>

          </Grid>
          <Grid size={"grow"} sx={{ overflow: "hidden", height: "100%", display: "flex" }}>
            <Grid size={6} sx={{ display: "inline-block" }}>
              <Stack direction="row" sx={{ width: "100%", overflow: "hidden" }}>
                <Tooltip title="Watch" arrow placement="left">
                  <Visibility id="watch-button" cursor="pointer" />
                </Tooltip>
                {(value == null || value == undefined) ? <SvgIcon /> :
                  <Tooltip title="Add to Logging" arrow placement="top">
                    <CloudUpload id="log-button" cursor="pointer" onClick={addToLogging}/>
                  </Tooltip>
                }
                <Tooltip title={formatValue(value)} arrow placement="bottom-start">
                  <Typography id="value-display" component="div" 
                    sx={{ textOverflow: "ellipsis", textWrap: "nowrap", whiteSpace: "nowrap", overflow: "hidden", flex: "1 1 auto", paddingLeft:"0.3em" }}
                  >
                    {formatValue(value)}
                  </Typography>
                </Tooltip>


              </Stack>
            </Grid>
            <Grid size={6}>
              {(value == null || value == undefined) ? <Box sx={{ display: "flex", flex: "1 1 1px" }} /> :
                <Box sx={{ display: "flex", flex: "1 1 1px" }}>
                  <TextField
                    id="new-value-input"
                    value={newValuesObj[fullName]||""}
                    onChange={handleNewValueChange}
                    variant="outlined"
                    sx={
                      {
                        flex: "1 1 auto",
                        padding: 0,
                        '& input': {
                          paddingX: "0.5em",
                          paddingY: 0,
                          textOverflow: "ellipsis",
                          textWrap: "nowrap",
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
                            <Clear onClick={clearNewValue}/>
                          </InputAdornment>
                      }
                    }}
                  ></TextField>
                  <Tooltip title="Write to Controller" arrow placement="bottom">
                    <Send id="write-button" cursor="pointer" onClick={writeValue}/>
                  </Tooltip>
                </Box>
              }
            </Grid>
            {/* <Box sx={{ display: "flex", flex: "1 1 1px", paddingRight: "0.3em", overflow:"clip" }}>
              
            </Box> */}

          </Grid>
        </Grid>
      </Stack>
    </Tooltip>


  )

  function handleNewValueChange(event: ChangeEvent<HTMLInputElement>){
    if(updateNewValues){
      if(event.target.value == ""){
        updateNewValues({
          type: "delete",
          symbol: fullName
        });
      }
      else{
        updateNewValues({
          type: "add",
          symbol: fullName,
          value: event.target.value
        })
      }
    }
  }

  function clearNewValue(){
    if(updateNewValues){
      updateNewValues({
        type: "delete",
        symbol: fullName,
      })
    }
  }

  function formatValue(value?: number | boolean | string | null | undefined | object) {
    if (value != null && value != undefined) {
      switch (typeof value) {
        case "boolean":
          return value ? "TRUE" : "FALSE";
        case "object":
          return JSON.stringify(value);

        default:
          return value;

      }
    }
    else {
      return null;
    }
  }

} // SymbolDisplay

function SymbolInfoDisplay({ fullPath, type, comment }: { fullPath: string, type: string, comment: string }) {
  const symbolInfoDispSX: SxProps = {
    //backgroundColor: "gold",
    '& td': {
      padding: 0,
    },
    //overflow:"clip",
    // border: "2px solid purple",
    // borderTop: "0",

    // borderRadius: "0.5em",
    // padding: "0.1em",
    // borderTopLeftRadius: "0",
    // borderTopRightRadius: "0",
  }
  const infoLabelSx: SxProps = {
    width: "6em",
    verticalAlign: "top",
    color: "inherit",
  }
  const infoValueSx: SxProps = {
    overflowWrap: "anywhere",
    color: "inherit",
  }

  return (
    <Box sx={symbolInfoDispSX}>
      <Table >
        <TableBody>
          <TableRow >
            <TableCell sx={infoLabelSx}>Full Path: </TableCell>
            <TableCell sx={infoValueSx}>{fullPath}</TableCell>
          </TableRow>
          <TableRow>
            <TableCell sx={infoLabelSx}>Type: </TableCell>
            <TableCell sx={infoValueSx}>{type}</TableCell>
          </TableRow>
          <TableRow>
            <TableCell sx={infoLabelSx}>Comment: </TableCell>
            <TableCell sx={infoValueSx}>{comment}</TableCell>
          </TableRow>
        </TableBody>

      </Table>
    </Box>
  )
}