import { __metadata } from "tslib";
import { IControllerSymbol, IControllerType } from "./controller-data-types";
import { ILoggingConfig, ILoggingServerConfig } from "./logging-config-type";

export class WatchPage {
    /**
     * Configured controllers, and whether it's connected to the server.
     * {controllerName: isConnected}
     */
    controllerStatus: Record<string, boolean> = {}; 
    /**
     * data type info received from controller. {controllerName: {typename: typeObj}}. typename is lower case
     */
    dataTypes: Record<string, Record<string, IControllerType>> = {};
    /**
     * symbol info received from controller. {controllerName: {symbolname: symbolObj}}. symbolname is lower case.
     */
    symbols: Record<string, Record<string, IControllerSymbol>> = {};
    /**
     * List of variables being watched (subscribed to)
     */
    watchList: Record<string, IControllerSymbol[]> = {};
    /**
     * list of all persistent variables
     */
    persistentList: Record<string, IControllerSymbol[]> = {};
    /**
     * Configurations for data logging on the server. This can be edited in the logging page.
     */
    loggingConfig?: ILoggingServerConfig;


    /**
     * A dictionary for known data types of known symbols. {controllerName: {symbolName: symbolType}}
     */
    _dataTypeCache: Record<string, Record<string, string>> = {};

    cacheDataType(controllerName: string, symbolName: string, symbolType: string){
        if(this._dataTypeCache[controllerName] == undefined)
        { this._dataTypeCache[controllerName] = {}; }
        this._dataTypeCache[controllerName][symbolName] = symbolType;
    }

    getTypeObj(controllerName: string, typeName: string): IControllerType{
        return this.dataTypes[controllerName][typeName.toLocaleLowerCase()];
    }

    // get the symbol type by symbol name
    getTypeByName(controllerName: string, symbolName: string): string{
        if(this._dataTypeCache[controllerName] === undefined || this._dataTypeCache[controllerName][symbolName] === undefined){
            let list: IControllerSymbol[] = [];
            let path = this.findSymbolsByInput(controllerName, symbolName.replace(/\]+$/,""), list); // remove the "]" at the end of an array
            if(list.length > 0){
                this.cacheDataType(controllerName, symbolName, list[0].type);
            }
            else
                return ""; // nothing found for input symbol name
        }
        return this._dataTypeCache[controllerName][symbolName];
    }

    // Find matching symbols according to input string
    // Returns the path with correct lower/upper case
    // The resulting list will be written to the input list
    findSymbolsByInput(controllerName: string, symbolInputStr: string, list: IControllerSymbol[]): string{ 
                
        list.length = 0;
        if (
            this.symbols === undefined ||
            this.symbols[controllerName] === undefined || 
            Object.keys(this.symbols[controllerName]).length == 0 ||
            this.dataTypes === undefined ||
            this.dataTypes[controllerName] === undefined ||
            Object.keys(this.dataTypes[controllerName]).length == 0
        )
        { return ""; }

        let lowerName = symbolInputStr.toLowerCase().replace("^","");// input tag name in lower case. Remove all "^" since we will dereference all pointers anyways
        let actualPath: string = ""; // The correct tag name with right lower/upper case
        let newSymbolType: string = "";
        let isArrayElement = false; // array elements have different rule for 
        let found: boolean = false;
        //const arrayReg = /(.*)(?:\[)(\d*)(?:\]?)$/; // Regular expression used to match array indexing
        //let regMatch: string[]|null;

        let splitName = lowerName.split(/[\[\]\.]+/); // lower case name, splited by .
        let currentName = splitName.length > 1 ? splitName[0] + "." + splitName[1]: lowerName; // This is in lower case. Build up the name piece by piece
        let candidateSymbols: any = this.symbols[controllerName]; // Record<string, ControllerSymbol>|ControllerSymbol[]
        let lastLevel = Math.max(2, splitName.length);

        for(let currentLevel = 2; currentLevel <= lastLevel; currentLevel++){
            found = false;
            for(let idx in candidateSymbols){
                let match = isArrayElement? candidateSymbols[idx].name.includes(currentName) :candidateSymbols[idx].name.toLowerCase().startsWith(currentName);
                if(match){ // find a match
                    if(currentLevel == lastLevel){ // last level in the symbol name input
                        list.push(candidateSymbols[idx]);
                    }
                    else{ // not at the last level yet
                        let typeObj = this.getTypeObj(controllerName, candidateSymbols[idx].type);
                        if(isArrayElement){
                            actualPath = (actualPath == "") ? candidateSymbols[idx].name : actualPath + candidateSymbols[idx].name;
                        }else{
                            actualPath = (actualPath == "") ? candidateSymbols[idx].name : actualPath + "." + candidateSymbols[idx].name;
                        }
                        isArrayElement = false;
                        if(candidateSymbols[idx].type.toLowerCase().startsWith("pointer to")){ // dereference any pointer type encountered
                            actualPath += "^";
                            candidateSymbols = this.dataTypes[controllerName][typeObj.baseType.toLocaleLowerCase()].subItems;
                        }
                        else if(candidateSymbols[idx].type.toLowerCase().startsWith("reference to")){ //reference type. Fall back to its base type
                            candidateSymbols = this.dataTypes[controllerName][typeObj.baseType.toLocaleLowerCase()].subItems;
                        }
                        else if(typeObj.arrayDimension > 0){ // array type
                            isArrayElement = true;
                            if(typeObj.arrayDimension == 1){ // last dimension of the array. The type for the list items will be the base type
                                newSymbolType = typeObj.baseType;
                            }
                            else{ // not the last dimension. The type for the list items are still arrays.
                                newSymbolType = typeObj.name.replace(/(?<=\[)\d+\.\.\d+,\s*/, "");
                            }
                            candidateSymbols = [];
                            for (let j = typeObj.arrayInfo[0].startIndex; j < typeObj.arrayInfo[0].startIndex + typeObj.arrayInfo[0].length; j++) {
                                candidateSymbols.push({
                                    name: `[${j}]`,
                                    type: newSymbolType,
                                    comment: typeObj.comment
                                })
                            }
                        }
                        else{
                            candidateSymbols = this.dataTypes[controllerName][typeObj.baseType.toLocaleLowerCase()].subItems;
                        }
                        found = true;
                        break; // break from for(let idx in candidateSymbols)
                    }
                }
            } // for(let idx in candidateSymbols)
            if(!found){
                break; // break from for(let currentLevel = 2; currentLevel <= lastLevel; currentLevel++)
            }

            if(Object.keys(candidateSymbols).length == 0)
            { break; } // break from  for(let currentLevel = 2; currentLevel <= lastLevel; currentLevel++)
            currentName = splitName[currentLevel];

        } // for(let currentLevel = 2; currentLevel <= lastLevel; currentLevel++)
        return actualPath;
    } // findSymbol


    findPersistentSymbols(controllerName: string){
        this.persistentList[controllerName] = [];
        if(this.dataTypes[controllerName] !== undefined &&
            Object.keys(this.dataTypes[controllerName]).length > 0 &&
            this.symbols[controllerName] !== undefined &&
            Object.keys(this.symbols[controllerName]).length > 0)
        {
            for(let symbolName in this.symbols[controllerName]){
                this._findPersistentSymbolsRecursive(controllerName, this.symbols[controllerName][symbolName]);
            }
        }
    }

    // recursively find persistent symbols. Returns true if a persistent symbol is found.
    _findPersistentSymbolsRecursive(controllerName: string, symbol: IControllerSymbol): boolean{
        let typeObj = this.getTypeObj(controllerName, symbol.type);
        let hasPersistentData = false;
        if(typeObj.arrayDimension > 0){
            let newSymbolType = typeObj.arrayDimension == 1? typeObj.baseType: typeObj.name.replace(/(?<=\[)\d+\.\.\d+,\s*/, ""); // This regexp removes the first dimension of array definition. ARRAY [a..b,c..d] becomes ARRAY [c..d]
            for(let i = typeObj.arrayInfo[0].startIndex; i < typeObj.arrayInfo[0].startIndex + typeObj.arrayInfo[0].length; i++){
                hasPersistentData = this._findPersistentSymbolsRecursive(controllerName, {
                    name: symbol.name+`[${i}]`,
                    type: newSymbolType,
                    comment: typeObj.comment,
                    isPersisted: symbol.isPersisted
                });
                if(!hasPersistentData) // Try the first element in the array. If no persistent data, no need to continue.
                    break;
            }
        }
        else if(typeObj.subItemCount > 0){
            typeObj.subItems.forEach((subitem) => {
                hasPersistentData = this._findPersistentSymbolsRecursive(controllerName, {
                    name: symbol.name + "." + subitem.name,
                    type: subitem.type,
                    comment: subitem.comment,
                    isPersisted: subitem.isPersisted || symbol.isPersisted
                }) || hasPersistentData;
            });
        }else if(symbol.isPersisted){
            symbol.value = "";
            symbol.newValueStr = "";
            this.persistentList[controllerName].push(symbol);
            hasPersistentData = true;
        }
        return hasPersistentData;

    }

}
