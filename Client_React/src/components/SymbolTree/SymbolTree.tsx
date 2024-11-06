
import { CurrentControllerContext, useDataTypes, useSymbols } from "../../services/ControllerInfoContext";
import { Box, List } from "@mui/material";
import { DataTypesInfo, IControllerSymbol, IControllerType, SymbolsInfo } from "../../models/controller-data-types";
import { IModelTreeNode, SubscriptionGroupPrefixContext } from "../../models/utilities";
import SymbolTreeNode from "./SymbolTreeNode";
import { useContext, useMemo } from "react";


interface ISymbolTreeProps {
  controllerName: string,
  filterStr: string,
  filterMode: string,   // flags if the filter should look for symbols "start with" or "include" the filter word
  filterPersistent: boolean,  // flags if show only persistent variables
  showGlobalSymbols?: boolean,
  showSystemSymbols?: boolean,
}


export default function SymbolTree(props: ISymbolTreeProps) {
  
  const subsPrefix = useContext(SubscriptionGroupPrefixContext)
  /**
 * symbol info received from controller. {controllerName: {symbolname: symbolObj}}. symbolname is lower case.
 */
  const symbols = useSymbols();
  /**
   * data type info received from controller. {controllerName: {typename: typeObj}}. typename is lower case
   */
  const dataTypes = useDataTypes();
  //const controllerStatus = useControllerStatus();

  //const filterObj = useMemo(() => parseFilterString(props.filterStr), [props.filterStr]);
  const filterObj = parseFilterString(props.filterStr, props.filterMode, props.filterPersistent);
  const modelTree = useMemo(() => generateModelTree(symbols, dataTypes), [dataTypes, symbols]);
  // apply filter to each tree node

  const start = Date.now();
  modelTree[props.controllerName]?.forEach((treeNode) => {
    applyFilter(treeNode, filterObj);
  })
  const end = Date.now();
  console.log(`Filter time ${end - start} ms.`)

  if (!modelTree[props.controllerName]) {
    return (
      <div>
        Model tree is not available.
      </div>
    );
  }

  const treeItems = [];
  for (const node of modelTree[props.controllerName]) {
    const lowerName = node.name.toLocaleLowerCase();
    if (!props.showGlobalSymbols && lowerName.startsWith("global_")) {
      continue;
    }
    if (!props.showSystemSymbols &&
      (lowerName.startsWith("constants.") || lowerName.startsWith("twincat_") || lowerName.startsWith("parameterlist"))) {
      continue;
    }
    if (isDuplicatedIOSymbol(lowerName)) {
      continue;
    }

    if (node.filterPassed) {
      treeItems.push(<SymbolTreeNode modelTreeNode={node} key={subsPrefix + node.name} showAddToWatchIcon={true} />);
    }

  }
  return (
    <Box sx={{ padding: 1, overflowY: "scroll", overflowX:"clip"}}>
      <CurrentControllerContext.Provider value={props.controllerName}>
        <List dense={true} disablePadding={true}>
          {treeItems}
        </List>
      </CurrentControllerContext.Provider>

    </Box>
  )

  /**
   * TwinCAT adds input/output symbols (declared with %I and %Q) to symbol list even if they're a part of another object.
   * This function tries to identify them by checking if the name of this symbol is part of another symbol
   */
  function isDuplicatedIOSymbol(symbolName: string): boolean {
    const aSplitName = symbolName.toLocaleLowerCase().split(/[.]/);
    let partName = aSplitName[0]; // partial name of the symbol
    for (let i = 1; i < aSplitName.length; i++) {
      if (symbols[props.controllerName][partName]) {
        // this partial name exist. 
        return true;
      }
      partName += "." + aSplitName[i];
    }
    return false;
  }







}// SymbolTree

function parseFilterString(filterStr: string, filterMode: string, filterPersistent: boolean): { name: RegExp[], type: RegExp[], persistent: boolean } {
  const result: { name: RegExp[], type: RegExp[], persistent: boolean } = { name: [], type: [], persistent: filterPersistent };

  result.name = splitFilterString(filterStr, filterMode);

  return result;

}

/**
 * Split the filter string into an array of Regex. 
 * Each part of the input string (a Regex literal or sub strings separated by dot '.') is converted to a Regex. 
 * For example, MAIN.FB./abc/ is converted to [/MAIN/i, /FB/i, /abc/i].
 * @param str 
 * @returns An array of RegExp, with option 'i' (case insensitive)
 */
function splitFilterString(str: string , filterMode: string): RegExp[] {
  const result: RegExp[] = [];
  let start = 0;
  let end = 0;
  let isInRegExLiteral = false;
  const prefix = (filterMode == "startWith")? "^":"";
  while (end < str.length) {
    if (str[end] == '/') {
      // RegExp literal symbol
      if (end > start) {
        // something exist before this regex literal symbol.
        if (str[end - 1] != '\\') {
          // it's not escaped, so it flags the start or end of a regex literal
          let newReg;
          try{
            newReg = new RegExp(prefix+str.slice(start, end), "i"); // all RegEx are made case insensitive
          }
          catch{
            newReg = new RegExp("", "i");
          }
          result.push(newReg);
        }
      }
      start = end + 1;
      isInRegExLiteral = !isInRegExLiteral;
    }
    else if (!isInRegExLiteral && (str[end] == '.' || str[end] == '[' || str[end] == ']')) {
      // separator for symbol or array
      if (end > start) {
        let newReg;
          try{
            newReg = new RegExp(prefix+str.slice(start, end), "i"); // all RegEx are made case insensitive
          }
          catch{
            newReg = new RegExp("", "i");
          }
          result.push(newReg);
      }
      start = end + 1;
    }
    end++;
  }
  if (end > start) {
    let newReg;
          try{
            newReg = new RegExp(prefix+str.slice(start, end), "i"); // all RegEx are made case insensitive
          }
          catch{
            newReg = new RegExp("", "i");
          }
          result.push(newReg);
  }
  return result;
}

/**
 * Generate the model of the symbol tree
 * @param symbols 
 * @param dataTypes 
 * @returns model tree in the form of {controllerName: [symbol1, symbol2, ...]}
 */
function generateModelTree(symbols: SymbolsInfo, dataTypes: DataTypesInfo): Record<string, IModelTreeNode[]> {
  const start = Date.now();
  const modelTree: Record<string, IModelTreeNode[]> = {};
  //let nodeCount = 0;
  if (symbols && dataTypes) {
    for (const controllerName in symbols) {
      if (dataTypes[controllerName]) {
        // both symbols and datatypes have this controller. Will build a tree for it
        modelTree[controllerName] = [];
        for (const symbolName in symbols[controllerName]) {
          const symObj = symbols[controllerName][symbolName];
          modelTree[controllerName].push(generateNode(symObj.name, controllerName, symObj));
        }
      }
    }
  }
  const end = Date.now();
  console.log(`Tree generation time ${end - start} ms.`)
  //console.log(`new tree generatedd with ${nodeCount} nodes.`);

  return modelTree;

  /**
   * Recursively generate a tree node and it's sub nodes
   * @param name 
   * @param symObj 
   * @param typeObj if not provided, the type will be inferred form dataTypes hook.
   */
  function generateNode(name: string, controllerName: string, symObj: IControllerSymbol, typeObj?: IControllerType): IModelTreeNode {
    //nodeCount++;
    let subNodes: IModelTreeNode[] = [];
    let isArrayRoot = false;
    if (!typeObj) {
      typeObj = dataTypes[controllerName][symObj.type.toLocaleLowerCase()];
    }
    // generate subNodes for subitems
    if (typeObj.subItemCount > 0) {
      subNodes = typeObj.subItems.map(
        (symbol) => generateNode(name + '.' + symbol.name, controllerName, symbol)
      );
    }
    else if (typeObj.arrayDimension > 0) {
      isArrayRoot = true;
      let nodeTypeObj: IControllerType;
      // generate subnodes for array
      if(typeObj.arrayDimension == 1){
        const lowerBaseType = typeObj.baseType.toLowerCase();
        nodeTypeObj = {...dataTypes[controllerName][lowerBaseType]}
      }
      else{
        nodeTypeObj = { ...typeObj };
        if (nodeTypeObj.size) {
          nodeTypeObj.size /= nodeTypeObj.arrayInfo[0].length;
        }
        nodeTypeObj.arrayDimension -= 1;
        nodeTypeObj.arrayInfo = typeObj.arrayInfo.slice(1);
        nodeTypeObj.name = nodeTypeObj.name.replace(/(?<=\[)\d+\.\.\d+,\s*/, '');
      }
      
      for (let i = 0; i < typeObj.arrayInfo[0].length; i++) {
        const indexStr = `[${typeObj.arrayInfo[0].startIndex + i}]`;
        const nodeSymbolObj: IControllerSymbol = {
          name: symObj.name + indexStr,
          type: nodeTypeObj.name,
          comment: symObj.comment,
          isPersistent: symObj.isPersistent
        }
        subNodes.push(generateNode(name + indexStr, controllerName, nodeSymbolObj, nodeTypeObj));
      }
    }
    return {
      name: name,
      symbol: symObj,
      type: typeObj,
      filterPassed: true,
      subNodes: subNodes,
      isArrayRoot: isArrayRoot
    }
  }
}

/**
 * 
 * @param treeNode 
 * @param symbolFilter If null, no filter will be applied, and the whole tree will be reset to filterPasse = true, requestExpand = false
 * @returns True if the current node or its decendent passed the filter
 */
function applyFilter(treeNode: IModelTreeNode, symbolFilter: { name: RegExp[], type: RegExp[], persistent?: boolean } | null): boolean {
  // no filter. 
  if (symbolFilter == null || (symbolFilter.name.length == 0 && symbolFilter.type.length == 0) && !symbolFilter.persistent) {
    // reset the tree's filter-related state
    treeNode.filterPassed = true;
    treeNode.requestExpand = false;
    treeNode.subNodes.forEach((subNode) => applyFilter(subNode, null))
    return true;
  }

  
  // filter exist
  const nameFilters = symbolFilter.name;
  const typeFilters = symbolFilter.type;
  let nameFiltersForSub:  RegExp[], typeFiltersForSub: RegExp[],
   namePass: boolean, typePass: boolean;

  // check name filters
  if(nameFilters.length == 0){
    nameFiltersForSub = [];
    namePass = true;
  }
  else if(treeNode.symbol.name.match(nameFilters[0]) != null){
    // match first part of name
    if(nameFilters.length == 1){
      namePass = true;
      nameFiltersForSub = [];
    }
    else{
      namePass = false;
      nameFiltersForSub = nameFilters.slice(1);
    }
  }
  else{
    // name not match
    namePass = false;
    nameFiltersForSub = nameFilters;
  }

  //check type filters
  if(typeFilters.length == 0){
    typeFiltersForSub = [];
    typePass = true;
  }
  else if(treeNode.symbol.type.match(typeFilters[0]) != null){
    // match first part of type
    if(typeFilters.length == 1){
      typePass = true;
      typeFiltersForSub = [];
    }
    else{
      typePass = false;
      typeFiltersForSub = nameFilters.slice(1);
    }
  }
  else{
    // type not match
    typePass = false;
    typeFiltersForSub = typeFilters;
  }

  //check persistent
  const persistentPass = ((!symbolFilter.persistent) || treeNode.symbol.isPersistent)??false;
  const persistentForSub = !persistentPass;

  if(namePass && typePass && persistentPass){
    // all filter passed
    treeNode.filterPassed = true;
    treeNode.requestExpand = false;
    treeNode.subNodes.forEach((subNode) => applyFilter(subNode, {name: [], type: []}))
  }
  else{
    // not all filter passed. check decendents
    treeNode.filterPassed = false;
    treeNode.requestExpand = false;
    treeNode.subNodes.forEach((subNode) => {
      if(applyFilter(subNode,{name: nameFiltersForSub, type: typeFiltersForSub, persistent: persistentForSub})){
        treeNode.filterPassed = true;
        treeNode.requestExpand = true;
      }
    })

  }
  return treeNode.filterPassed;
}





