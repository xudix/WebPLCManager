import { Injectable } from '@angular/core';
import { Socket } from 'ngx-socket-io';
import { WatchList } from '../models/watch-list.model';
import { ControllerSymbol } from '../models/controller-data-types';


@Injectable({
  providedIn: 'root'
})
export class WatchListService {
  //watchList = this.socket.fromEvent<ControllerSymbol[]>("watchListUpdated");
  private _dataExpireTime: number = 3000; // ms, time for subscription to expire. If no new data is received before expiration, data will be removed.
  private _expireTimers: Record<string,any> = {};

  public get watchList(): ControllerSymbol[]{
    return this.model.list;
  };


  private model: WatchList = new WatchList();

  constructor(private socket: Socket) {
    socket.on("subscribedData", (newData: Record<string, any>) =>  {
      this.updateValues(newData);
    });

    socket.on("watchListUpdated", (newWatchList: string[]) => {
      this.model.list = [];
      newWatchList.forEach((symbolName) => {
        this.model.list.push({
          name: symbolName,
          comment: "",
          type: "",
          value: null,
          newValue: null
        });
        this._expireTimers[symbolName] = null;
      });
    });

    socket.on("connect", () => { // This is actually reestablishing connection. Subscribe to all previous watches.
      this.model.list.forEach((symbol) => {
        socket.emit("addWatchSymbol", symbol.name);
      });

    });


  }


  updateValues(newData: Record<string, any>) {
    this.model.list.forEach((symbol) => {
      if (newData[symbol.name] != undefined) { // newData contains a value for this symbol
        symbol.value = newData[symbol.name];
        if(this._expireTimers[symbol.name]){
          clearTimeout(this._expireTimers[symbol.name]);
        }
        this._expireTimers[symbol.name] = setTimeout(() => {
          symbol.value = null;
        }, this._dataExpireTime);
      }
    })

  }

  removeAllSymbols(){
    this.socket.emit("removeAllSymbols");
    this.model.list = [];
  }

  removeSymbol(symbolName: string){
    this.socket.emit("removeWatchSymbol", symbolName);
  }

  writeNewValues(){
    let newValues: Record<string, string> = {}; // a collection of key-value pairs. values are stored in string.
    let hasNewValues: boolean = false;
    this.model.list.forEach((symbol) =>{
      if(symbol.newValue != null && symbol.newValue.length > 0){
        newValues[symbol.name] = symbol.newValue;
        symbol.newValue = null;
        hasNewValues = true;
      }
    });
    if(hasNewValues){
      this.socket.emit("writeNewValues", newValues);
    }

  }



  

}
