import { Box, InputAdornment, List, ListItem, ListItemButton, Stack, SvgIcon, SxProps, Table, TableBody, TableCell, TableRow, TextField, Tooltip, Typography } from "@mui/material";
import Grid from "@mui/material/Grid2"
import { IControllerSymbol, IControllerType } from "../../models/controller-data-types";
import { ChangeEvent, useContext, useEffect, useRef, useState } from "react";
import { CloudUpload, Download, ExpandLess, ExpandMore, Visibility, Clear, Send, VisibilityOff } from "@mui/icons-material";
import { IModelTreeNode, SubscriptionGroupPrefixContext, treeLevelContext } from "../../models/utilities";
import { CurrentControllerContext, useCurrentMeasurement, useDataTypes, useLoggingUpdater, useNewValues, useUpdateNewValues, watchableTypes } from "../../services/ControllerInfoContext";
import useOnScreen from "../../models/onScreenDetection";
import { socket, useSymbolWatchManager } from "../../services/Socket";
import { useWatchListUpdater } from "../../models/WatchListProvider";

interface ISymbolTreeNodeProps {
  modelTreeNode: IModelTreeNode,
  /**
   * If set to number/boolean/string, will show it as value. if set to null, will inhibit the value display. If not set (undefined), will subscribe to value when in view port.
   */
  displayValue?: number | boolean | string | object | null | undefined, // This is for displaying array elements
  showAddToWatchIcon?: boolean,  // toggle the display of the "add to watch" icon 
  showRemoveFromWatchIcon?: boolean, // toggle the display of  the "remove from watch" icon
  showFullPath?: boolean, // toggle the display of symbol's full path instead of symbol name
}

export default function SymbolTreeNode(props: ISymbolTreeNodeProps) {
  /** value obtained from PLC subscription */
  const [value, setValue] = useState<number | boolean | string | object | null | undefined>(null)
  /** flags if user expanded this node */
  const [isExpanded, setIsExpanded] = useState(false);
  const treeLevel = useContext(treeLevelContext);
  const currentController = useContext(CurrentControllerContext); // only needed for data subscription
  const ref = useRef<HTMLDivElement>(null)
  const isOnScreen = useOnScreen(ref);
  const symbolWatchManager = useSymbolWatchManager();
  const subsPrefix = useContext(SubscriptionGroupPrefixContext);


  const valueToDisplay = (props.displayValue != undefined) ? props.displayValue : value;

  // generate the sub nodes
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
              <SymbolTreeNode modelTreeNode={subNode} key={subsPrefix + subNode.name}
                displayValue={valueToDisplay[i]}
                showAddToWatchIcon={props.showAddToWatchIcon}
                showRemoveFromWatchIcon={props.showRemoveFromWatchIcon} />
            )
          }
          else {
            subNodes.push(
              <SymbolTreeNode modelTreeNode={subNode} key={subsPrefix + subNode.name}
                displayValue={null}
                showAddToWatchIcon={props.showAddToWatchIcon}
                showRemoveFromWatchIcon={props.showRemoveFromWatchIcon}  />
            )
          }
        }
        else {
          // not array, no value to pass
          // if null it set, value display for all decendents will be inhibited.
          subNodes.push(
            <SymbolTreeNode modelTreeNode={subNode} key={subsPrefix + subNode.name}
            displayValue={props.displayValue == null ? null : undefined}
            showAddToWatchIcon={props.showAddToWatchIcon}
            showRemoveFromWatchIcon={props.showRemoveFromWatchIcon}  />
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
        symbolWatchManager.subscribe(subsPrefix + symbolPath,
          currentController, symbolPath, props.modelTreeNode.type,
          (data?: number | boolean | string | null) => {
            setValue(data);
          })
      }
      else {
        symbolWatchManager.unsubscribe(subsPrefix + symbolPath, currentController, symbolPath);
      }

      return () => {
        symbolWatchManager.unsubscribe(subsPrefix + symbolPath, currentController, symbolPath);
      }
    }


  }, [currentController, isOnScreen, props.displayValue, props.modelTreeNode.type, props.modelTreeNode.name, props.modelTreeNode.symbol.type, symbolWatchManager, subsPrefix])

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
          <SymbolDisplay treeNode={props.modelTreeNode}
            value={valueToDisplay} 
            showAddToWatchIcon={props.showAddToWatchIcon}
            showRemoveFromWatchIcon={props.showRemoveFromWatchIcon}
            showFullPath={props.showFullPath}
            ></SymbolDisplay>


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

function SymbolDisplay({ treeNode, value, showAddToWatchIcon, showRemoveFromWatchIcon, showFullPath }:
   { 
    treeNode: IModelTreeNode,
    value?: number | boolean | string | object | null,
    showAddToWatchIcon?: boolean,
    showRemoveFromWatchIcon?: boolean,
    showFullPath?: boolean
   }) {
  const updateLogging = useLoggingUpdater();
  const symbolWatchManager = useSymbolWatchManager();
  const currentController = useContext(CurrentControllerContext);
  const currentMeasurement = useCurrentMeasurement();
  //const newValuesObj = useNewValues();
  const updateNewValues = useUpdateNewValues();
  const updateWatchList = useWatchListUpdater();
  const [newValueText, setNewValueText] = useState("");
  const newValueDelayTimer = useRef<NodeJS.Timeout | number>(0);
  const inputDelay = 300;

  function addToLogging(){
    if(updateLogging){
      updateLogging({
        type: "add",
        controllerName: currentController,
        measurement: currentMeasurement,
        tag: {
          tag: treeNode.name,
          field: inferField(treeNode.name)||treeNode.name,
        }
      });
    }
  }

  function addToWatchList(){
    if(updateWatchList){
      updateWatchList({type: "add", controllerName: currentController, item: treeNode});
    }
  }

  function removeFromWatchList(){
    if(updateWatchList){
      updateWatchList({
        type: "remove",
        controllerName: currentController,
        item: treeNode,
      })
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
    //symbolWatchManager.writeValue(currentController, treeNode.name, newValuesObj[currentController]?.[treeNode.name]||"");
    symbolWatchManager.writeValue(currentController, treeNode.name, newValueText);
    
  }

  // after receiving confirmation of write result, clear the new value
  useEffect(() => {
    function handleWriteResult(result: Record<string, Record<string, boolean>>){
      if(result[currentController]?.[treeNode.name]){
        clearNewValue();
      }
    }

    socket.on("writeResults", handleWriteResult);

    return (() => {
      socket.off("writeResults", handleWriteResult);
    })
  })

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
          fullPath={treeNode.name}
          type={treeNode.symbol.type}
          comment={treeNode.symbol.comment} />}
      arrow
      placement="top-start"
      id="symbol-info-tooltip"
      enterDelay={1000}
      enterNextDelay={1000}
    >
      <Stack spacing={0} padding={0} sx={outerStackSX}>
        <Grid container maxHeight="3em" sx={{}} spacing={1}>
          <Grid size={4} sx={symbolNameSX}>
            <Typography component="div" className="symbol-name-display"
              sx={{ textOverflow: "ellipsis", textWrap: "nowrap", overflow: "hidden" }}>
              {showFullPath? treeNode.name: treeNode.symbol.name}
            </Typography>

          </Grid>
          <Grid size={showFullPath?8:"grow"} sx={{ overflow: "hidden", height: "100%", display: "flex" }}>
            <Grid size={6} sx={{ display: "inline-block" }}>
              <Stack direction="row" sx={{ width: "100%", overflow: "hidden" }}>
                {showAddToWatchIcon ? (
                  <Tooltip title="Watch" arrow placement="left">
                    <Visibility id="watch-button" cursor="pointer" onClick={addToWatchList} />
                  </Tooltip>
                ) : null}
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
                    // value={newValuesObj[currentController]?.[treeNode.name]||""}
                    value={newValueText}
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
                  {showRemoveFromWatchIcon ? (
                    <Tooltip title="Remove" arrow placement="bottom">
                      <VisibilityOff id="remove-watch-button" cursor="pointer" onClick={removeFromWatchList} />
                    </Tooltip>
                  ) : null}
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
    setNewValueText(event.target.value);
    if(newValueDelayTimer){
      clearTimeout(newValueDelayTimer.current);
    }
    newValueDelayTimer.current = setTimeout(() => {
      if(updateNewValues){
        if(event.target.value == ""){
          updateNewValues({
            type: "delete",
            controllerName: currentController,
            symbol: treeNode.name
          });
        }
        else{
          updateNewValues({
            type: "add",
            controllerName: currentController,
            symbol: treeNode.name,
            value: event.target.value
          })
        }
      }
    }, inputDelay);
  }

  function clearNewValue(){
    setNewValueText("");
    if(updateNewValues){
      updateNewValues({
        type: "delete",
        controllerName: currentController,
        symbol: treeNode.name,
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