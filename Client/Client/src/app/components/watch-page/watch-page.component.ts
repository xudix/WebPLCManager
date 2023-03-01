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
  public get watchList(): ControllerSymbol[]{
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

  symbolSelected(item: ControllerSymbol){
    // FIXME: allow multiple choices
    this._service.selectedSymbols[0] = item;
  }

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
