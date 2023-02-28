import { ControllerSymbol, ControllerType } from "./controller-data-types";

export class SymbolList {
    dataTypes: Record<string, ControllerType> = {};
    symbols: Record<string, ControllerSymbol> = {};
    // currentSymbols: ControllerSymbol[] = [];
    // list: ControllerSymbol[] = [];

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
        let actualName: string = ""; // The correct tag name with right lower/upper case
        let newSymbolType: string = "";
        let newSymbolComment: string = "";
        let found: boolean = false;

        let splitName = lowerName.split("."); // lower case name, splited by .
        
        if (splitName.length < 3) { // it's probably a base symbol.
            // loop through the list of all symbols
            for (let symbolName in this.symbols) {
                if (symbolName.startsWith(lowerName)) {
                    list.push(this.symbols[symbolName]);
                }
            }
        }// splitName.length < 3
        else { // more than two parts, need to dig into dataTypes
            let currentName = splitName[0] + "." + splitName[1]; // This is in lower case. Build up the name piece by piece
            
            if (this.symbols[currentName] != null) { // current tag exist
                newSymbolType = this.symbols[currentName].type;
                actualName = this.symbols[currentName].name;
            }
            else { // the tag doesn't exist. Use the one that start with the input name
                for (let symbol in this.symbols) {
                    if (symbol.startsWith(currentName)) {
                        newSymbolType = this.symbols[symbol].type;
                        actualName = this.symbols[symbol].name;
                        found = true;
                        break;
                    }
                }
                if (!found)
                { return ""; }
            }// this.model.symbols[currentName] == null
            // dive into the sub items in data type
            for (let currentLevel = 2; currentLevel < splitName.length; currentLevel++) {
                if (this.dataTypes[newSymbolType.toLowerCase()].subItemCount == 0) {
                    return ""; // The current type does not have sub items. The input does not correspond to anything
                }
                // find the corresponding sub item
                found = false;
                if (currentLevel < splitName.length - 1) { // not at the last level yet. 
                    for (let subitem of this.dataTypes[newSymbolType.toLowerCase()].subItems) {
                        if (subitem.name.toLowerCase().startsWith(splitName[currentLevel])) {
                            newSymbolType = subitem.type;
                            actualName += "." + subitem.name;
                            newSymbolComment = subitem.comment;
                            found = true;
                            break;
                        }
                    }
                    if (!found)
                    { return ""; }
                } // currentLevel < splitName.length - 1
                else { // at the last level. Partial name match is sufficient
                    for (let subitem of this.dataTypes[newSymbolType.toLowerCase()].subItems) {
                        if (subitem.name.toLowerCase().startsWith(splitName[currentLevel])) {
                            list.push({
                                name: subitem.name,
                                type: subitem.type,
                                comment: subitem.comment
                            });
                        }
                    }// for subitem of dataTypes[].subItems
                } // currentLevel = splitName.length - 1
            }// for currentLevel < splitName.length


        }// splitName.length >= 3
        return actualName;

    } // findSymbol



}
