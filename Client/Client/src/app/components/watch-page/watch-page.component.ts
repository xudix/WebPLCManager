import { Component } from '@angular/core';
import { ControllerSymbol } from 'src/app/models/controller-data-types';
import { WatchPageService } from 'src/app/services/watch-page.service';


@Component({
  selector: 'app-watch-page',
  templateUrl: './watch-page.component.html',
  styleUrls: ['./watch-page.component.scss']
})
export class WatchPageComponent {

  // Properties for view
  public get currentController(): string{
    return this._service.currentController;
  }

  public set currentController(controllerName: string){
    this._service.setCurrentController(controllerName);
  }

  /**
   * List of controller names obtained from the server
   */
  public get controllerList(): string[]{
    return Object.keys(this._service.controllerStatus);
  }

  /**
     * Configured controllers, and whether it's connected to the server.
     * {controllerName: isConnected}
     */
  public get controllerStatus(){
    return this._service.controllerStatus;
  }

  public get watchList(): Record<string, ControllerSymbol[]>{
    return this._service.watchList;
  }
  public get symbolInputStr(){
    return this._service.symbolInputStr;
  }

  public set symbolInputStr(input: string){
    this._service.symbolInputStr = input;
  }

  public get symbolInfoAvailable(){
    return this._service.symbolInfoAvailable;
  }

  public get candidateList(){
    return this._service.candidateList;
  }

  public get currentPath(){
    return this._service.currentPath;
  }


  // private variables
  private inputDelay = 500;
  private inputTimeOutID?: any;

  constructor(private _service: WatchPageService){

  }

  setCurrentController(controllerName: string){
    this._service.setCurrentController(controllerName);
  }

  symbolInputChanged(){
    if(this.inputTimeOutID){
      clearTimeout(this.inputTimeOutID);
    }
    this.inputTimeOutID = setTimeout(() => {
      this._service.symbolInputChanged();
    }, this.inputDelay);
    
  }

  clearInput(){
    this._service.symbolInputStr = "";
    this._service.symbolInputChanged();
  }

  /**
   * Remove certain part of the input string from the end to go to the previous level of symbol.
   */
  previousLevel(){
    let end_dot = this._service.symbolInputStr.lastIndexOf(".",this._service.symbolInputStr.length-2);
    let end_bracket = this._service.symbolInputStr.lastIndexOf("[");
    let end = Math.max(end_dot + 1, end_bracket)
    if(end > 0){
      this._service.symbolInputStr = this._service.symbolInputStr.slice(0, end);
      this._service.symbolInputChanged();
    }
    else{
      this.clearInput();
    }
  }

  // 
  symbolSelected(item: ControllerSymbol){
    // FIXME: allow multiple choices
    this._service.selectedSymbols[0] = item;
  }

  /**
   * Special behavior: When something is double clicked in the candidate window, 
   * if it has sub items, set it as the path
   * if it is a primitive type, add it to watch list
   * @param {ControllerSymbol} symbol 
   */
  symbolDoubleClicked(symbol: ControllerSymbol){
    this._service.symbolDoubleClicked(symbol);
  }

  addSymbol(){
    this._service.addSymbolToWatch();
  }

  clear(){
    this._service.removeAllSymbols();

  }

  writeNewValues(){
    this._service.writeNewValues();

  }

}
