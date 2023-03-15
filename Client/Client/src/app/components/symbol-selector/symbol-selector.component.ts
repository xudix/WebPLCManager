import { Component, Input } from '@angular/core';
import { IControllerSymbol } from 'src/app/models/controller-data-types';
import { WatchPageService } from 'src/app/services/watch-page.service';

@Component({
  selector: 'app-symbol-selector',
  templateUrl: './symbol-selector.component.html',
  styleUrls: ['./symbol-selector.component.scss']
})
export class SymbolSelectorComponent {

  public get symbolInputStr() {
    return this._service.symbolInputStr;
  }

  public set symbolInputStr(input: string){
    this._service.symbolInputStr = input;
  }
  
  public get currentPath(){
    return this._service.currentPath;
  }

  public get candidateList(){
    return this._service.candidateList;
  }


  public get symbolInfoAvailable(){
    return this._service.symbolInfoAvailable;
  }

  /**
   * Set which page this component is in. This affects the behavior after clicking a symbol.
   */
  @Input() currentPage: string = "";

    // private variables
  private inputDelay = 500;
  private inputTimeOutID?: any;



  constructor(private _service: WatchPageService) {

  }

  symbolInputChanged() {
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
  symbolSelected(item: IControllerSymbol){
    // FIXME: allow multiple choices
    this._service.selectedSymbols[0] = item;
  }

  /**
   * Special behavior: When something is double clicked in the candidate window, 
   * if it has sub items, set it as the path
   * if it is a primitive type, add it to watch list
   * @param {IControllerSymbol} symbol 
   */
  symbolDoubleClicked(symbol: IControllerSymbol, currentPage: string){
    this._service.symbolDoubleClicked(symbol, currentPage);
  }



}
