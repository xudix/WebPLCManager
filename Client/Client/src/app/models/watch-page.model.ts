import { __metadata } from "tslib";
import { ControllerSymbol, ControllerType } from "./controller-data-types";

export class WatchPage {
    dataTypes: Record<string, ControllerType> = {};
    symbols: Record<string, ControllerSymbol> = {};
    watchList: ControllerSymbol[] = [];

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

        let lowerName = symbolInputStr.toLowerCase();// input tag name in lower case
        let actualPath: string = ""; // The correct tag name with right lower/upper case
        let newSymbolType: string = "";
        let newSymbolComment: string = "";
        let found: boolean = false;
        //const arrayReg = /(.*)(?:\[)(\d*)(?:\]?)$/; // Regular expression used to match array indexing
        //let regMatch: string[]|null;

        let splitName = lowerName.split("."); // lower case name, splited by .
        let currentName = splitName.length > 1 ? splitName[0] + "." + splitName[1]: lowerName; // This is in lower case. Build up the name piece by piece
                   
        let currentSymbols: any = this.symbols; // Record<string, ControllerSymbol>|ControllerSymbol[]
        let lastLevel = Math.max(2, splitName.length);
        for(let currentLevel = 2; currentLevel <= lastLevel; currentLevel++){
            found = false;
            if(currentName.includes("[")){ // input is in a array
                let arrayNameSplit = currentName.split(/[\[\]]+/); // for a variable varName[0][3] arrayNameSplt is something like["varName","0","3",""]
                for (let idx in currentSymbols) { // look at all current symbols
                    if (currentSymbols[idx].name.toLowerCase().startsWith(arrayNameSplit[0])) {
                        let typeObj = this.dataTypes[currentSymbols[idx].type.toLocaleLowerCase()];
                        if (typeObj.arrayDimension > 0) { // this symbol is an array
                            found = true;
                            actualPath = (actualPath == "") ? currentSymbols[idx].name : actualPath + "." + currentSymbols[idx].name;
                            // Iteratively put the array path together and find the type
                            for (let i = 1; i <= typeObj.arrayDimension; i++) {
                                if(currentLevel == lastLevel){// last level in the symbol name input. Need to write list
                                    if(i >= arrayNameSplit.length) // All dimensions specified in the input has been parsed
                                        break; // Leaving unspecified item is allowed
                                    else if(i == arrayNameSplit.length - 1){ // last dimension specified. 
                                        for (let j = typeObj.arrayInfo[i - 1].startIndex; j < typeObj.arrayInfo[i - 1].startIndex + typeObj.arrayInfo[i - 1].length; j++) {
                                            list.push({
                                                name: `[${j}]`,
                                                type: i < typeObj.arrayDimension ? typeObj.name : typeObj.baseType, // If this is the last dimension, it will be the base type.
                                                comment: typeObj.comment
                                            })
                                        }
                                    }
                                    else{ // not the last dimension specified. need to parse the input number.
                                        let index = parseInt(arrayNameSplit[i]);
                                        if (Number.isNaN(index) || index < typeObj.arrayInfo[i - 1].startIndex || index >= typeObj.arrayInfo[i - 1].startIndex + typeObj.arrayInfo[i - 1].length) // if index is invalid, use 0
                                        { index = typeObj.arrayInfo[i - 1].startIndex; }
                                        actualPath += `[${index}]`;
                                    }

                                } 
                                else{ // not at the last level of symbol name input yet. If array dim is not specified, assume them to 0.
                                    if(i >= arrayNameSplit.length){ // All dimensions specified in the input has been parsed. The rest dimensions will be assumed to be startIndex
                                        actualPath += `[${typeObj.arrayInfo[i - 1].startIndex}]`;
                                    }
                                    else{ // dimension specified. need to parse the input number.
                                        let index = parseInt(arrayNameSplit[i]);
                                        if (Number.isNaN(index) || index < typeObj.arrayInfo[i - 1].startIndex || index >= typeObj.arrayInfo[i - 1].startIndex + typeObj.arrayInfo[i - 1].length) // if index is invalid, use 0
                                        { index = 0; }
                                        actualPath += `[${index}]`;
                                    }
                                    currentSymbols = this.dataTypes[typeObj.baseType.toLocaleLowerCase()].subItems;
                                } // if (currentLevel == lastLevel)
                            }
                            break; // break from for(let idx in currentSymbols)
                        }  // if(typeObj.arrayDimension > 0)
                    } // if(currentSymbols[idx].name.startsWith(arrayNameSplit[0]))
                } // for(let idx in currentSymbols)
                if (!found){
                { break; } // break from for(let currentLevel = 2; currentLevel <= lastLevel; currentLevel++)
                }
            }
            else{ // input is not in an array
                for(let idx in currentSymbols){
                    if(currentSymbols[idx].name.toLowerCase().startsWith(currentName)){ // find a match
                        if(currentLevel == lastLevel){ // last level in the symbol name input
                            list.push(currentSymbols[idx]);
                        }
                        else{ // not at the last level yet
                            newSymbolType = currentSymbols[idx].type;
                            actualPath = (actualPath == "") ? currentSymbols[idx].name : actualPath + "." + currentSymbols[idx].name;
                            newSymbolComment = currentSymbols[idx].comment;
                            currentSymbols = this.dataTypes[newSymbolType.toLocaleLowerCase()].subItems;
                            found = true;
                            break;
                        }
                    }
                }
                if (!found)
                { break; } // break from  for(let currentLevel = 2; currentLevel <= lastLevel; currentLevel++)

            }

            if(Object.keys(currentSymbols).length == 0)
            { break; } // break from  for(let currentLevel = 2; currentLevel <= lastLevel; currentLevel++)
            currentName = splitName[currentLevel];

        } // for(let currentLevel = 2; currentLevel <= lastLevel; currentLevel++)
        return actualPath;
    } // findSymbol
}
