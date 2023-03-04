import { Injectable } from '@angular/core';
import { Socket } from 'ngx-socket-io';
import { WatchPage } from '../models/watch-page.model';
import { ControllerSymbol, ControllerType } from '../models/controller-data-types';

@Injectable({
  providedIn: 'root'
})
export class WatchPageService {

  // private data
  private _model: WatchPage;
  private _dataExpireTime: number = 3000; // ms, time for subscription to expire. If no new data is received before expiration, data will be removed.
  private _expireTimers: Record<string,any> = {};

  // Properties exposed to component / view
  public symbolInputStr: string = "";
  public currentPath: string = ""; // The path obtained by resolving the input string
  public selectedSymbols: ControllerSymbol[] = [];
  public candidateList: ControllerSymbol[] = []; 

  public get symbolInfoAvailable(): boolean{
    return Object.keys(this._model.dataTypes).length > 0 && Object.keys(this._model.symbols).length > 0;
  }

  public get watchList(): ControllerSymbol[]{
    return this._model.watchList;
  };

  // private variables
  private previousInput: string = "some string"; // just to trigger symbol change at initial run
  private watchableTypes = new Set(['BOOL', 'BYTE', 'WORD', 'DWORD', 'SINT', 'USINT', 
    'INT', 'UINT','DINT', 'UDINT', 'LINT', 'ULINT', 'REAL', 'LREAL']); // FIXME: how to handle ENUM and TIME?

  //symbolListObservable = this.socket.fromEvent<ControllerSymbol[]>("subItemUpdated");

  constructor(private socket: Socket) {
    this._model = new WatchPage();
    
    socket.on("dataTypes", (newTypes: Record<string ,ControllerType>)=>{
      this._model.dataTypes = newTypes;
      this.symbolInputChanged();
    });

    socket.on("symbols", (newSymbols: Record<string, ControllerSymbol>) => {
      this._model.symbols = newSymbols;
      this.symbolInputChanged();
    });

    socket.on("subscribedData", (newData: Record<string, any>) =>  {
      this.updateValues(newData);
    });

    socket.on("watchListUpdated", (newWatchList: string[]) => {
      this._model.watchList = [];
      newWatchList.forEach((symbolName) => {
        this._model.watchList.push({
          name: symbolName,
          comment: "",
          type: this._model.getTypeByName(symbolName),
          value: null,
          newValueStr: ""
        });
        this._expireTimers[symbolName] = null;
      });
    });

    socket.on("connect", () => { // This is actually reestablishing connection. Subscribe to all previous watches.
      this._model.watchList.forEach((symbol) => {
        socket.emit("addWatchSymbol", symbol.name);
      });

    });

    socket.on("error", (err: any) =>{
      console.log(err);
    })

  }

  // request to subscribe to a symbol in the watch list
  addSymbolToWatch() {
    this.selectedSymbols.forEach((symbol) => {
      if (this.watchableTypes.has(symbol.type) || symbol.type.includes("STRING")) { // FIXME: how to handle ENUM and TIME?
        this.socket.emit("addWatchSymbol", symbol.name);
      }
    });
  }

  // Request to load symbols list from the controller
  requestSymbols(){
    this.socket.emit("requestSymbols");
  }

  // Search a symbol in symbols and types info
  symbolInputChanged(){
    if (
      this._model.symbols === undefined ||
      Object.keys(this._model.symbols).length == 0 ||
      this._model.dataTypes === undefined ||
      Object.keys(this._model.dataTypes).length == 0
    )
    { return; }
    if (this.symbolInputStr === this.previousInput){ // input is not actually changed
      return;
    }
    this.previousInput = this.symbolInputStr;
    this.selectedSymbols = [];
    this.candidateList = [];
    this.currentPath = this._model.findSymbolsByInput(this.symbolInputStr, this.candidateList);
    if (this.candidateList.length > 0) {
      this.selectedSymbols.push({
        name: (this.currentPath == "") ? this.candidateList[0].name : this.currentPath + "." + this.candidateList[0].name,
        type: this.candidateList[0].type,
        comment: this.candidateList[0].comment
      });
    }

  }// symbolInputChanged()

  // When something is double clicked in the candidate window, 
  // if it has sub items, set it as the path
  // if it is a primitive type, add it to watch list
  symbolDoubleClicked(symbol: ControllerSymbol){
    let actualName: string;
    if(symbol.name[0] == "["){ // for array
      actualName = (this.currentPath == "") ? symbol.name : this.currentPath + symbol.name;
    }
    else{
      actualName = (this.currentPath == "") ? symbol.name : this.currentPath + "." + symbol.name;
    }
     
    let typeObj = this._model.dataTypes[symbol.type.toLowerCase()];
    if(typeObj.subItemCount > 0){ // large type. Will have sub items
      this.symbolInputStr = actualName + ".";
      this.symbolInputChanged();
    }
    else if(typeObj.arrayDimension > 0){ // This is an array
      this.symbolInputStr = actualName + "[";
      this.symbolInputChanged();
    }
    else if(symbol.type.toLocaleLowerCase().startsWith("pointer to")) // for pointers, double click => dereference it
    {
      this.symbolInputStr = actualName + "^";
      this.symbolInputChanged();
    }
    else if(this.watchableTypes.has(typeObj.baseType) || typeObj.baseType.includes("STRING")){ // primitive, enum, or string type
      this.socket.emit("addWatchSymbol", actualName);
      this._model.cacheDataType(actualName, symbol.type);
      // symbol.name = actualName;
      // this.watchList.push(symbol)
    }
    else{
      console.error(`Unable to resolve the type of ${symbol}.`)
    }
  }

  // update the values shown in the watch list after new data is received
  updateValues(newData: Record<string, any>) {
    this._model.watchList.forEach((symbol) => {
      if (newData[symbol.name] != undefined) { // newData contains a value for this symbol
        if(typeof newData[symbol.name] == "object" && (newData[symbol.name].name != undefined && newData[symbol.name].value != undefined)){
          symbol.value = `${newData[symbol.name].name} ( ${newData[symbol.name].value} )` 
        }
        else{
          symbol.value = newData[symbol.name];
        }
        if(this._expireTimers[symbol.name]){
          clearTimeout(this._expireTimers[symbol.name]);
        }
        this._expireTimers[symbol.name] = setTimeout(() => {
          symbol.value = null;
        }, this._dataExpireTime);
      }
    })

  }

  // unsubscribe from all watched symbols
  removeAllSymbols(){
    this.socket.emit("removeAllSymbols");
    this._model.watchList = [];
  }

  // remove one watched symbol
  removeSymbol(symbolName: string){
    this.socket.emit("removeWatchSymbol", symbolName);
  }

  // write new values from the watch list to the Controller
  writeNewValues(){
    let newValues: Record<string, any> = {}; // a collection of key-value pairs.
    let hasNewValues: boolean = false;
    this._model.watchList.forEach((symbol) =>{
      if(symbol.newValueStr != undefined && symbol.newValueStr.length > 0){
        let typeObj = this.getTypeObj(symbol.type);
        if(typeObj.name.toLocaleLowerCase().startsWith("bool")){ // handles string to boolean
          if(symbol.newValueStr.toLocaleLowerCase() == "true"){
            newValues[symbol.name] = true;
          }
          else if(symbol.newValueStr.toLocaleLowerCase() == "false"){
            newValues[symbol.name] = false;
          }
        } // handles boolean
        else if(Object.keys(typeObj.enumInfo).length > 0 ){// handles enum
          let lowerNewValStr = symbol.newValueStr.toLocaleLowerCase();
          let num = Number(symbol.newValueStr);
          if(Number.isNaN(num)){
            for(let name in typeObj.enumInfo){
              if(name.toLocaleLowerCase() == lowerNewValStr){
                newValues[symbol.name] = name;
                break;
              }
            }
          }else{
            for(let name in typeObj.enumInfo){
              if(typeObj.enumInfo[name] == num){
                newValues[symbol.name] = name;
                break;
              }
            }
          }
        }// handles enum
        else{ // other types. Just send the string
          newValues[symbol.name] = symbol.newValueStr;
        }
        symbol.newValueStr = "";
        hasNewValues = true;
      }
    });
    if(hasNewValues){
      this.socket.emit("writeNewValues", newValues);
    }
  }

  getTypeObj(typeName: string): ControllerType{
    return this._model.getTypeObj(typeName);
  }

}
