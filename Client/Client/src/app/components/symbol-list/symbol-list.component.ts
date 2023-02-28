import { Component, OnInit, OnDestroy } from '@angular/core';
import { Observable, Subscription} from 'rxjs';

import { SymbolListService } from 'src/app/services/symbol-list.service';
import { ControllerSymbol } from 'src/app/models/controller-data-types';

@Component({
  selector: 'app-symbol-list',
  templateUrl: './symbol-list.component.html',
  styleUrls: ['./symbol-list.component.scss']
})
export class SymbolListComponent implements OnInit, OnDestroy {

  //symbolListObservable?: Observable<ControllerSymbol[]>;
  // private _symbolListSub: Subscription;
  
  inputDelay = 500;



  constructor (private service: SymbolListService){
    
  }

  // Properties for the component HTML
  public get symbolInputStr(){
    return this.service.symbolInputStr;
  }

  public set symbolInputStr(input: string){
    this.service.symbolInputStr = input;
  }

  public get symbolInfoAvailable(){
    return this.service.symbolInfoAvailable;
  }

  public get displayList(){
    return this.service.displayList;
  }

  public get currentPath(){
    return this.service.currentPath;
  }

  ngOnInit(): void {

    //this.symbolListObservable = this.symbolListService.symbolListObservable;
    // this._symbolListSub = this.symbolListService.symbolListObservable.subscribe(newList => {
      
    // })
  }

  ngOnDestroy(): void {
    
  }

  private inputTimeOutID?: any;
  symbolInputChanged(){
    if(this.inputTimeOutID){
      clearTimeout(this.inputTimeOutID);
    }
    this.inputTimeOutID = setTimeout(() => {
      this.service.symbolInputChanged();
    }, this.inputDelay);
    
  }

  clearInput(){
    this.service.symbolInputStr = "";
    this.service.symbolInputChanged();
  }

  symbolSelected(item: ControllerSymbol){
    // FIXME: allow multiple choices
    this.service.currentSymbols[0] = item;
  }

  symbolDoubleClicked(symbol: ControllerSymbol){
    this.service.symbolDoubleClicked(symbol);
  }

  addSymbol(){
    this.service.addSymbolToWatch();
  }




}
