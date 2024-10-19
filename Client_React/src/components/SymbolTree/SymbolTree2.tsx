 
import { CurrentControllerContext, DataTypesContext, SymbolsContext, useControllerStatus, useDataTypes, useSymbols } from "../../services/ControllerInfoContext";
import { Box, List } from "@mui/material";
import SymbolTreeNode2 from "./SymbolTreeNode2";
import { DataTypesInfo, IControllerSymbol, IControllerType, SymbolsInfo } from "../../models/controller-data-types";
import { useModelTree, ModelTreeContext, IModelTreeNode } from "../../models/utilities";
import SymbolTreeNode from "./SymbolTreeNode";


interface ISymbolTreeProps {
  modelTreeRoot: IModelTreeNode[],
  controllerName: string,
  showGlobalSymbols?: boolean,
  showSystemSymbols?: boolean
}


export default function SymbolTree2(props: ISymbolTreeProps) {
  /**
 * symbol info received from controller. {controllerName: {symbolname: symbolObj}}. symbolname is lower case.
 */
  // const symbols = useSymbols();
  /**
   * data type info received from controller. {controllerName: {typename: typeObj}}. typename is lower case
   */
  // const dataTypes = useDataTypes();
  // const controllerStatus = useControllerStatus();

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

  if (!props.modelTreeRoot){
    return (
      <div>
        Model tree is not available.
      </div>
    );
  }

  const treeItems = [];
  for(const node of props.modelTreeRoot){
    const lowerName = node.name.toLocaleLowerCase();
    if (!props.showGlobalSymbols && lowerName.startsWith("global_")) {
      continue;
    }
    if (!props.showSystemSymbols &&
      (lowerName.startsWith("constants.") || lowerName.startsWith("twincat_") || lowerName.startsWith("parameterlist"))) {
      continue;
    }
    if(isDuplicatedIOSymbol(lowerName)){
      continue;
    }

    if(node.filterPassed){
      treeItems.push(<SymbolTreeNode modelTreeNode={node} key={node.name}/>);
    }
    
  }
  return (
    <Box sx={{padding: 1, overflowY: "scroll"}}>
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
  function isDuplicatedIOSymbol(symbolName: string):boolean{
    const aSplitName = symbolName.toLocaleLowerCase().split(/[.]/);
    let partName = aSplitName[0]; // partial name of the symbol
    for(let i = 1; i < aSplitName.length; i++){
      if(symbols[props.controllerName][partName]){
        // this partial name exist. 
        return true;
      }
      partName += "." + aSplitName[i];
    }
    return false;

  }

  function filterSymbols(){
    console.log("filter called");
    
    const maxLoopCount = 20;
    let nameFilters: RegExp[] = [], typeFilters: RegExp[] = [];
    if(typeof props.symbolFilter == "string"){
      nameFilters = splitFilterString(props.symbolFilter);
    }
    else if(Array.isArray(props.symbolFilter)){
      // it's an array of RegExp. Apply it to the symbol name
      nameFilters = props.symbolFilter;
    }
    else{
      // props.symbolFilter is an object {name?: string | RegExp[], type?: string | RegExp[]}
      if(typeof props.symbolFilter?.name == "string"){
        nameFilters = splitFilterString(props.symbolFilter.name);
      }
      else if(Array.isArray(props.symbolFilter?.name)){
        nameFilters = props.symbolFilter.name;
      }
      if(typeof props.symbolFilter?.type == "string"){
        typeFilters = splitFilterString(props.symbolFilter.type);
      }
      else if(Array.isArray(props.symbolFilter?.type)){
        typeFilters = props.symbolFilter.type;
      }
    }


    //filter symbols list with name
    if(nameFilters.length == 0){
      filteredSymbols[props.controllerName] = symbols[props.controllerName];
      filteredTypes[props.controllerName] = dataTypes[props.controllerName];
    }
    else{
      for(const symbolName in symbols[props.controllerName]){
        // kick globals and systems out
        const lowerName = symbolName.toLocaleLowerCase();
        if (!props.showGlobalSymbols && lowerName.startsWith("global_")) {
          continue;
        }
        if (!props.showSystemSymbols &&
          (lowerName.startsWith("constants.") || lowerName.startsWith("twincat_") || lowerName.startsWith("parameterlist"))) {
            continue;
        }
        if(isDuplicatedIOSymbol(lowerName)){
          continue;
        }

        const symObj = symbols[props.controllerName][symbolName];
        if(checkSymbolForName(symObj, nameFilters)){
          // this symbol matched
          const typeObj = dataTypes[props.controllerName][symObj.type.toLocaleLowerCase()];
          filteredSymbols[props.controllerName][symbolName] = symObj;
          filteredTypes[props.controllerName][symObj.type.toLocaleLowerCase()] = typeObj;
          console.log(`Added main ${symObj.type}`);
          
          //recursively add all the needed data types
          const newTypes: Record<string, IControllerType> = {};
          newTypes[typeObj.name.toLocaleLowerCase()] = typeObj;
          for(let i = 0; i < maxLoopCount; i++ ){
            let newTypeAdded = false;
            for(const lowerTypeName in newTypes){
              let newTypeObj = newTypes[lowerTypeName];
              // add the subitems for this new type
              if(newTypeObj.subItemCount > 0){
                newTypeObj.subItems.forEach(subsymbol =>{
                  if (!filteredTypes[props.controllerName][subsymbol.type.toLocaleLowerCase()]){
                    filteredTypes[props.controllerName][subsymbol.type.toLocaleLowerCase()]
                      = dataTypes[props.controllerName][subsymbol.type.toLocaleLowerCase()];
                    newTypeAdded = true;
                    newTypes[subsymbol.type.toLocaleLowerCase()]
                      = dataTypes[props.controllerName][subsymbol.type.toLocaleLowerCase()];
                    console.log(`Added sub ${subsymbol.type}`);
                    
                  }
                })
              }

              while(newTypeObj.arrayDimension > 0){
                // array, add it's element's type
                const nodeTypeObj: IControllerType = {...newTypeObj};
                if(nodeTypeObj.size){
                  nodeTypeObj.size /= nodeTypeObj.arrayInfo[0].length;
                }
                nodeTypeObj.arrayDimension -= 1;
                nodeTypeObj.arrayInfo.slice(1);
                if(newTypeObj.arrayDimension > 1){
                  // multi-dimension array. The subitem will still be an array
                  // dimension in type name should change from [0..9,0..2] to [0..2]
                  nodeTypeObj.name = nodeTypeObj.name.replace(/(?<=\[)\d+\.\.\d+,\s*/,'');
                }
                else{
                  // 1-D array, sub items are of base type
                  nodeTypeObj.name = nodeTypeObj.baseType;
                  const lowerBaseType = nodeTypeObj.baseType.toLowerCase();
                  nodeTypeObj.baseType = dataTypes[props.controllerName][lowerBaseType].baseType;
                  nodeTypeObj.enumInfo = dataTypes[props.controllerName][lowerBaseType].enumInfo;
                }
                if(!filteredTypes[props.controllerName][nodeTypeObj.name.toLocaleLowerCase()]){
                  filteredTypes[props.controllerName][nodeTypeObj.name.toLocaleLowerCase()]
                    = nodeTypeObj;
                  newTypeAdded = true;
                  console.log(`Added array ${nodeTypeObj.name}`);
                }
                newTypeObj = nodeTypeObj;
              }
              // add the base type
              if(!filteredTypes[props.controllerName][newTypeObj.baseType.toLocaleLowerCase()]){
                filteredTypes[props.controllerName][newTypeObj.baseType.toLocaleLowerCase()]
                  = dataTypes[props.controllerName][newTypeObj.baseType.toLocaleLowerCase()];
                newTypeAdded = true;
                newTypes[newTypeObj.baseType.toLocaleLowerCase()]
                  = dataTypes[props.controllerName][newTypeObj.baseType.toLocaleLowerCase()];
                console.log(`Added base ${newTypeObj.baseType}`);
                
              }
              
              //done with this new type
              delete newTypes[lowerTypeName];
            }
  
            if(!newTypeAdded){
              console.log(`Add type finished in ${i} loops.`)
              break;
            }
          }
        }
      }
    }
    
    

  }

  function checkSymbolForName(symbol: IControllerSymbol, nameFilters: RegExp[]): boolean{
    if(nameFilters.length > 0){
      if(symbol.name.match(nameFilters[0]) != null){
        // name match. see if subitems need to be checked
        if(nameFilters.length == 1){
          // this is the only filter. success
          return true;
        }
        else{
          const subNameFilters = nameFilters.slice(1);
          for(const sub of dataTypes[props.controllerName][symbol.type.toLocaleLowerCase()].subItems){
            if(checkSymbolForName(sub, subNameFilters)){
              return true
            }
          }
          return false;
        }
      }
      else{
        return false;
      }
    }
    else{
      return true;
    }
  }

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
        // RegExp literal symbol
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
      else if(!isInRegExLiteral && (str[end] == '.' || str[end] == '[' || str[end] == ']')){
        // separator for symbol or array
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

  // Find matching symbols according to input string
  // Returns the path with correct lower/upper case
  // The resulting list will be written to the input list
  function findSymbolsStartWithFilter(
    filter: string,
    symbols: Record<string, IControllerSymbol>,
    dataTypes: Record<string, IControllerType>,
    resultList: IControllerSymbol[],
  ): string {
    resultList.length = 0;
    if (
      !symbols||
      Object.keys(symbols).length == 0 ||
      !dataTypes ||
      Object.keys(dataTypes).length == 0
    ) {
      return "";
    }

    const lowerName = filter.toLowerCase().replace("^", ""); // input tag name in lower case. Remove all "^" since we will dereference all pointers anyways
    let actualPath: string = ""; // The correct tag name with right lower/upper case
    let newSymbolType: string = "";
    let isArrayElement = false; // array elements have different rule for
    let found: boolean = false;
    //const arrayReg = /(.*)(?:\[)(\d*)(?:\]?)$/; // Regular expression used to match array indexing
    //let regMatch: string[]|null;

    const splitName = lowerName.split(/[\[\]\.]+/); // lower case name, splited by .
    let currentName =
      splitName.length > 1 ? splitName[0] + "." + splitName[1] : lowerName; // This is in lower case. Build up the name piece by piece
    let candidateSymbols: Record<string, IControllerSymbol>|IControllerSymbol[] = symbols; // Record<string, ControllerSymbol>|ControllerSymbol[]
    const lastLevel = Math.max(2, splitName.length);

    const handleMatchBeforeLastLevel = () => {
      // not at the last level yet
      const typeObj: IControllerType = dataTypes[candidateSymbols[idx].type.toLocaleLowerCase()];
      if (isArrayElement) {
        actualPath += candidateSymbols[idx].name;
        // actualPath =
        //   actualPath == ""
        //     ? candidateSymbols[idx].name
        //     : actualPath + candidateSymbols[idx].name;
      } else {
        actualPath =
          actualPath == ""
            ? candidateSymbols[idx].name
            : actualPath + "." + candidateSymbols[idx].name;
      }
      isArrayElement = false;
      if (candidateSymbols[idx].type.toLowerCase().startsWith("pointer to")) {
        // dereference any pointer type encountered
        actualPath += "^";
        candidateSymbols = dataTypes[typeObj.baseType.toLocaleLowerCase()].subItems;
      } else if (candidateSymbols[idx].type.toLowerCase().startsWith("reference to")) {
        //reference type. Fall back to its base type
        candidateSymbols = dataTypes[typeObj.baseType.toLocaleLowerCase()].subItems;
      } else if (typeObj.arrayDimension > 0) {
        // array type
        isArrayElement = true;
        if (typeObj.arrayDimension == 1) {
          // last dimension of the array. The type for the list items will be the base type
          newSymbolType = typeObj.baseType;
        } else {
          // not the last dimension. The type for the list items are still arrays.
          newSymbolType = typeObj.name.replace(/(?<=\[)\d+\.\.\d+,\s*/, "",);
        }
        candidateSymbols = [];
        for (
          let j = typeObj.arrayInfo[0].startIndex;
          j <
          typeObj.arrayInfo[0].startIndex + typeObj.arrayInfo[0].length;
          j++
        ) {
          candidateSymbols.push({
            name: `[${j}]`,
            type: newSymbolType,
            comment: typeObj.comment,
          });
        }
      } else {
        candidateSymbols = dataTypes[typeObj.baseType.toLocaleLowerCase()].subItems;
      }
      found = true;
    }

    for (let currentLevel = 2; currentLevel <= lastLevel; currentLevel++) {
      found = false;
      for (const idx in candidateSymbols) {
        let match;
        if (currentLevel == lastLevel){
          // array elements have names like [0] [12]. in this case currentName is the index number
          match = isArrayElement ?
            candidateSymbols[idx].name.includes(currentName) : 
            candidateSymbols[idx].name.toLowerCase().startsWith(currentName);
          if(match){
            resultList.push(candidateSymbols[idx]);
          }
        }
        else{
          // array elements have names like [0] [12]. in this case currentName is the index number
          match = isArrayElement ?
            candidateSymbols[idx].name.slice(1,-1) == currentName : 
            candidateSymbols[idx].name.toLowerCase() == (currentName);
          if(match){
            handleMatchBeforeLastLevel();
            break;
          }
          else{
            match = isArrayElement ?
              candidateSymbols[idx].name.includes(currentName) : 
              candidateSymbols[idx].name.toLowerCase().startsWith(currentName);
            if(match){
              handleMatchBeforeLastLevel();
              break;
            }
          }
        }
      } // for(let idx in candidateSymbols)
      if (!found) {
        break; // break from for(let currentLevel = 2; currentLevel <= lastLevel; currentLevel++)
      }

      if (Object.keys(candidateSymbols).length == 0) {
        break;
      } // break from  for(let currentLevel = 2; currentLevel <= lastLevel; currentLevel++)
      currentName = splitName[currentLevel];
    } // for(let currentLevel = 2; currentLevel <= lastLevel; currentLevel++)
    return actualPath;
  } // findSymbolsByInput





}// SymbolTree2






