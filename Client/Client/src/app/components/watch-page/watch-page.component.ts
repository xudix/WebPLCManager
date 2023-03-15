import { Component } from '@angular/core';
import { IControllerSymbol } from 'src/app/models/controller-data-types';
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

    /**
   * List of controller names obtained from the server
   */
    public get controllerList(): string[]{
      return Object.keys(this._service.controllerStatus);
    }

  public get watchList(): Record<string, IControllerSymbol[]>{
    return this._service.watchList;
  }

  constructor(private _service: WatchPageService){

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
