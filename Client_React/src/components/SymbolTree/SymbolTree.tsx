
import { CurrentControllerContext, DataTypesContext, SymbolsContext, useControllerStatus, useDataTypes, useSymbols } from "../../services/ControllerInfoContext";
import { Box, List } from "@mui/material";
import SymbolTreeNode2 from "./SymbolTreeNode2";
import { DataTypesInfo, IControllerSymbol, IControllerType, SymbolsInfo } from "../../models/controller-data-types";
import { useModelTree, ModelTreeContext, IModelTreeNode } from "../../models/utilities";
import SymbolTreeNode from "./SymbolTreeNode";
import { useMemo } from "react";


interface ISymbolTreeProps {
  controllerName: string,
  filterStr: string,
  showGlobalSymbols?: boolean,
  showSystemSymbols?: boolean
}


export default function SymbolTree(props: ISymbolTreeProps) {
  /**
 * symbol info received from controller. {controllerName: {symbolname: symbolObj}}. symbolname is lower case.
 */
  const symbols = useSymbols();
  /**
   * data type info received from controller. {controllerName: {typename: typeObj}}. typename is lower case
   */
  const dataTypes = useDataTypes();
  //const controllerStatus = useControllerStatus();

  const filterObj = useMemo(() => parseFilterString(props.filterStr), [props.filterStr]);
  const modelTree = useMemo(() => generateTree(symbols, dataTypes), [dataTypes, symbols]);
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
      treeItems.push(<SymbolTreeNode modelTreeNode={node} key={node.name} />);
    }

  }
  return (
    <Box sx={{ padding: 1, overflowY: "scroll" }}>
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

function parseFilterString(filterStr: string): { name: RegExp[], type: RegExp[] } {
  const result: { name: RegExp[], type: RegExp[] } = { name: [], type: [] };

  result.name = splitFilterString(filterStr);

  return result;

}

/**
 * Split the filter string into an array of Regex. 
 * Each part of the input string (a Regex literal or sub strings separated by dot '.') is converted to a Regex. 
 * For example, MAIN.FB./abc/ is converted to [/MAIN/i, /FB/i, /abc/i].
 * @param str 
 * @returns An array of RegExp, with option 'i' (case insensitive)
 */
function splitFilterString(str: string): RegExp[] {
  const result: RegExp[] = [];
  let start = 0;
  let end = 0;
  let isInRegExLiteral = false;
  while (end < str.length) {
    if (str[end] == '/') {
      // RegExp literal symbol
      if (end > start) {
        // something exist before this regex literal symbol.
        if (str[end - 1] != '\\') {
          // it's not escaped, so it flags the start or end of a regex literal
          result.push(new RegExp(str.slice(start, end), "i")); // all RegEx are made case insensitive
        }
      }
      start = end + 1;
      isInRegExLiteral = !isInRegExLiteral;
    }
    else if (!isInRegExLiteral && (str[end] == '.' || str[end] == '[' || str[end] == ']')) {
      // separator for symbol or array
      if (end > start) {
        result.push(new RegExp(str.slice(start, end), "i")); // all RegEx are made case insensitive
      }
      start = end + 1;
    }
    end++;
  }
  if (end > start) {
    result.push(new RegExp(str.slice(start, end), "i")); // all RegEx are made case insensitive
  }
  return result;
}

/**
 * Generate the model of the symbol tree
 * @param symbols 
 * @param dataTypes 
 * @returns model tree in the form of {controllerName: [symbol1, symbol2, ...]}
 */
function generateTree(symbols: SymbolsInfo, dataTypes: DataTypesInfo): Record<string, IModelTreeNode[]> {
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
      // generate subnodes for array
      const nodeTypeObj: IControllerType = { ...typeObj };
      if (nodeTypeObj.size) {
        nodeTypeObj.size /= nodeTypeObj.arrayInfo[0].length;
      }
      nodeTypeObj.arrayDimension -= 1;
      nodeTypeObj.arrayInfo = typeObj.arrayInfo.slice(1);
      if (typeObj.arrayDimension > 1) {
        // multi-dimension array. The subitem will still be an array
        // dimension in type name should change from [0..9,0..2] to [0..2]
        nodeTypeObj.name = nodeTypeObj.name.replace(/(?<=\[)\d+\.\.\d+,\s*/, '');
      }
      else {
        // 1-D array, sub items are of base type
        nodeTypeObj.name = nodeTypeObj.baseType;
        const lowerBaseType = nodeTypeObj.baseType.toLowerCase();
        nodeTypeObj.baseType = dataTypes[controllerName][lowerBaseType].baseType;
        nodeTypeObj.enumInfo = dataTypes[controllerName][lowerBaseType].enumInfo;
      }
      for (let i = 0; i < typeObj.arrayInfo[0].length; i++) {
        const indexStr = `[${typeObj.arrayInfo[0].startIndex + i}]`;
        const nodeSymbolObj: IControllerSymbol = {
          name: symObj.name + indexStr,
          type: nodeTypeObj.name,
          comment: symObj.comment,
          isPersisted: symObj.isPersisted
        }
        subNodes.push(generateNode(name + indexStr, controllerName, nodeSymbolObj, nodeTypeObj));
      }
    }
    return {
      name: name,
      symbol: symObj,
      baseType: typeObj.baseType,
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
function applyFilter(treeNode: IModelTreeNode, symbolFilter: { name: RegExp[], type: RegExp[] } | null): boolean {
  // no filter. 
  if (symbolFilter == null || symbolFilter.name.length == 0 && symbolFilter.type.length == 0) {
    // reset the tree's filter-related state
    treeNode.filterPassed = true;
    treeNode.requestExpand = false;
    treeNode.subNodes.forEach((subNode) => applyFilter(subNode, null))
    return true;
  }

  const nameFilters = symbolFilter.name;
  const typeFilters = symbolFilter.type;

  // filter exist
  if (treeNode.symbol.name.match(nameFilters[0]) == null) {
    // no match. check decendents
    treeNode.filterPassed = false;
    treeNode.requestExpand = false;
    treeNode.subNodes.forEach((subNode) => {
      if (applyFilter(subNode, symbolFilter)) {
        treeNode.filterPassed = true;
        treeNode.requestExpand = true;
      }
    });
  }
  else {
    // match. 
    if (nameFilters.length == 1) {
      // only one filter. No need to check decendents
      treeNode.filterPassed = true;
      treeNode.requestExpand = false; // This node passed. No need to display all it's decendent
      // reset the status of all its decendents. filterPassed = true 
      treeNode.subNodes.forEach((subNode) => applyFilter(subNode, { name: [], type: typeFilters }));
    }
    else {
      // more than one filter. Check the decendents
      treeNode.filterPassed = false;
      treeNode.requestExpand = false;
      treeNode.subNodes.forEach((subNode) => {
        if (applyFilter(subNode, { name: nameFilters.slice(1), type: typeFilters })) {
          treeNode.filterPassed = true;
          treeNode.requestExpand = true;
        }
      });
    }
  }
  return treeNode.filterPassed;
}





