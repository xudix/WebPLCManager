import { Injectable } from '@angular/core';
import { Socket } from 'ngx-socket-io';
import { SymbolList } from '../models/symbol-list.model';
import { ControllerSymbol, ControllerType } from '../models/controller-data-types';

@Injectable({
  providedIn: 'root'
})
export class SymbolListService {

  private model: SymbolList;

  // Properties exposed to component / view
  public symbolInputStr: string = "";
  public currentPath: string = ""; // The path obtained by resolving the input string
  public currentSymbols: ControllerSymbol[] = [];
  public displayList: ControllerSymbol[] = []; 

  public get symbolInfoAvailable(): boolean{
    return Object.keys(this.model.dataTypes).length > 0 && Object.keys(this.model.symbols).length > 0;
  }

  // private variables
  private previousInput: string = "some string"; // just to trigger symbol change at initial run
  private watchableTypes = new Set(['BOOL', 'BYTE', 'WORD', 'DWORD', 'SINT', 'USINT', 
    'INT', 'UINT','DINT', 'UDINT', 'LINT', 'ULINT', 'REAL', 'LREAL']); // FIXME: how to handle ENUM and TIME?

  //symbolListObservable = this.socket.fromEvent<ControllerSymbol[]>("subItemUpdated");

  constructor(private socket: Socket) {
    this.model = new SymbolList();
    
    socket.on("dataTypes", (newTypes: Record<string ,ControllerType>)=>{
      this.model.dataTypes = newTypes;
      this.symbolInputChanged();
    });

    socket.on("symbols", (newSymbols: Record<string, ControllerSymbol>) => {
      this.model.symbols = newSymbols;
      this.symbolInputChanged();
    });

  }

  addSymbolToWatch() {
    this.currentSymbols.forEach((symbol) => {
      if (this.watchableTypes.has(symbol.type) || symbol.type.includes("STRING")) { // FIXME: how to handle ENUM and TIME?
        this.socket.emit("addWatchSymbol", symbol.name);
      }
    });
  }

  requestSymbols(){
    this.socket.emit("requestSymbols");
  }

  // Search a symbol in symbols and types info
  symbolInputChanged(){
    if (
      this.model.symbols === undefined ||
      Object.keys(this.model.symbols).length == 0 ||
      this.model.dataTypes === undefined ||
      Object.keys(this.model.dataTypes).length == 0
    )
    { return; }
    if (this.symbolInputStr === this.previousInput){ // input is not actually changed
      return;
    }
    this.previousInput = this.symbolInputStr;
    this.currentSymbols = [];
    this.displayList = [];
    this.currentPath = this.model.findSymbolsByInput(this.symbolInputStr, this.displayList);
    if (this.displayList.length > 0) {
      this.currentSymbols.push({
        name: (this.currentPath == "") ? this.displayList[0].name : this.currentPath + "." + this.displayList[0].name,
        type: this.displayList[0].type,
        comment: this.displayList[0].comment
      });
    }

  }// symbolInputChanged()

  symbolDoubleClicked(symbol: ControllerSymbol){
    let actualName = (this.currentPath == "") ? symbol.name : this.currentPath + "." + symbol.name;
    if(this.model.dataTypes[symbol.type.toLowerCase()].subItemCount == 0){
      // No sub item. Can add to watch.
      // FIXME: how to handle ENUM and TIME?
      if(this.watchableTypes.has(symbol.type) || symbol.type.includes("STRING")) 
        this.socket.emit("addWatchSymbol", actualName);
    }
    else{ // it has sub items. use it as the current path
      this.symbolInputStr = actualName + ".";
      this.symbolInputChanged();
    }
  }


  
} // class SymbolListService
