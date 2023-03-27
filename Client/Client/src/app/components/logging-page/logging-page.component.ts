import { Component } from '@angular/core';
import { expand } from 'rxjs';
import { IControllerSymbol } from 'src/app/models/controller-data-types';
import { ILoggingConfig } from 'src/app/models/logging-config-type';
import { WatchPageService } from 'src/app/services/watch-page.service';


@Component({
  selector: 'app-logging-page',
  templateUrl: './logging-page.component.html',
  styleUrls: ['./logging-page.component.scss']
})
export class LoggingPageComponent {

  public get loggingConfig(){
    return this._service.loggingConfig;
  }

  
  constructor(private _service: WatchPageService){

  }

  requestLoggingConfig(){
    this._service.requestLoggingConfig();
  }

  removeSymbol(symbol: any){
    if(symbol.status == "remove"){
      symbol.status = "modified";
    }
    else{
      symbol.status = "remove";
    }
  }

  duplicateSymbol(configIdx: number, symbolIdx: number){
    
    if(this._service.loggingConfig?.logConfigs[configIdx].tags[symbolIdx] != undefined){
      let dupItem = {...this._service.loggingConfig.logConfigs[configIdx].tags[symbolIdx]};
      dupItem.status = "new";
      this._service.loggingConfig?.logConfigs[configIdx].tags.splice(symbolIdx+1, 0, dupItem);
    }
    
  }

  symbolModified(symbol: any){
    symbol.status = "modified";
  }

  sendLoggingConfig(){
    this._service.sendLoggingConfig();
  }

  isExpanded(controllerName: string){
    if(this.expanded[controllerName] === undefined){
      this.expanded[controllerName] = true;
    }
    return this.expanded[controllerName];
  }

  toggleExpanded(controllerName: string){
    this.expanded[controllerName] = !this.isExpanded(controllerName);
  }
  
  private expanded: Record<string, boolean> = {};

}
