import { __metadata } from "tslib";
import { ControllerSymbol, ControllerType } from "./controller-data-types";

export class WatchPage {
    dataTypes: Record<string, ControllerType> = {}; // data type info received from controller
    symbols: Record<string, ControllerSymbol> = {}; // symbol info received from controller
    watchList: ControllerSymbol[] = []; // list of variables being watched (subscribed to)
    persistentList: ControllerSymbol[] = [];  // list of all persistent variables

    _dataTypeCache: Record<string, string> = {}; // A dictionary for known data types of known symbols. {symbolName: symbolType}

    cacheDataType(symbolName: string, symbolType: string){
        this._dataTypeCache[symbolName] = symbolType;
    }

    getTypeObj(typeName: string): ControllerType{
        return this.dataTypes[typeName.toLocaleLowerCase()];
    }

    // get the symbol type by symbol name
    getTypeByName(symbolName: string): string{
        if(this._dataTypeCache[symbolName] === undefined){
            let list: ControllerSymbol[] = [];
            let path = this.findSymbolsByInput(symbolName.replace(/\]+$/,""), list); // remove the "]" at the end of an array
            if(list.length > 0){
                this.cacheDataType(symbolName, list[0].type);
            }

        }
        return this._dataTypeCache[symbolName];
    }

    // Find matching symbols according to input string
    // Returns the path with correct lower/upper case
    // The resulting list will be written to the input list
    findSymbolsByInput(symbolInputStr: string, list: ControllerSymbol[]): string{ 
                
        list.length = 0;
        if (
            this.symbols === undefined ||
            Object.keys(this.symbols).length == 0 ||
            this.dataTypes === undefined ||
            Object.keys(this.dataTypes).length == 0
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
        let candidateSymbols: any = this.symbols; // Record<string, ControllerSymbol>|ControllerSymbol[]
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
                        let typeObj = this.dataTypes[candidateSymbols[idx].type.toLowerCase()];
                        if(isArrayElement){
                            actualPath = (actualPath == "") ? candidateSymbols[idx].name : actualPath + candidateSymbols[idx].name;
                        }else{
                            actualPath = (actualPath == "") ? candidateSymbols[idx].name : actualPath + "." + candidateSymbols[idx].name;
                        }
                        isArrayElement = false;
                        if(candidateSymbols[idx].type.toLowerCase().startsWith("pointer to")){ // dereference any pointer type encountered
                            actualPath += "^";
                            candidateSymbols = this.dataTypes[typeObj.baseType.toLocaleLowerCase()].subItems;
                        }
                        else if(candidateSymbols[idx].type.toLowerCase().startsWith("reference to")){ //reference type. Fall back to its base type
                            candidateSymbols = this.dataTypes[typeObj.baseType.toLocaleLowerCase()].subItems;
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
                            candidateSymbols = this.dataTypes[typeObj.baseType.toLocaleLowerCase()].subItems;
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


    findPersistentSymbols(){
        this.persistentList = [];
        if(Object.keys(this.dataTypes).length > 0 && Object.keys(this.symbols).length > 0){
            for(let symbolName in this.symbols){
                this._findPersistentSymbolsRecursive(this.symbols[symbolName]);
            }
        }
    }

    // recursively find persistent symbols. Returns true if a persistent symbol is found.
    _findPersistentSymbolsRecursive(symbol: ControllerSymbol): boolean{
        let typeObj = this.getTypeObj(symbol.type);
        let hasPersistentData = false;
        if(typeObj.arrayDimension > 0){
            let newSymbolType = typeObj.arrayDimension == 1? typeObj.baseType: typeObj.name.replace(/(?<=\[)\d+\.\.\d+,\s*/, "");
            for(let i = typeObj.arrayInfo[0].startIndex; i < typeObj.arrayInfo[0].startIndex + typeObj.arrayInfo[0].length; i++){
                hasPersistentData = this._findPersistentSymbolsRecursive({
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
                hasPersistentData = this._findPersistentSymbolsRecursive({
                    name: symbol.name + "." + subitem.name,
                    type: subitem.type,
                    comment: subitem.comment,
                    isPersisted: subitem.isPersisted || symbol.isPersisted
                }) || hasPersistentData;
            });
        }else if(symbol.isPersisted){
            symbol.value = "";
            symbol.newValueStr = "";
            this.persistentList.push(symbol);
            hasPersistentData = true;
        }
        return hasPersistentData;

    }

}
