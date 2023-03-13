import { Component } from '@angular/core';
import { ControllerSymbol } from 'src/app/models/controller-data-types';
import { WatchPageService } from 'src/app/services/watch-page.service';

@Component({
  selector: 'app-persistent-page',
  templateUrl: './persistent-page.component.html',
  styleUrls: ['./persistent-page.component.scss']
})
export class PersistentPageComponent {
  
  constructor(private _service: WatchPageService){}

  public get persistentList(): ControllerSymbol[]{
    return this._service.persistentList[this._service.currentController];
  }

  public findPersistentSymbols(){
    this._service.findPersistentSymbols();
  }
}
