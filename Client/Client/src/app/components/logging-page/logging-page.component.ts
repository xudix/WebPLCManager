import { Component } from '@angular/core';
import { IControllerSymbol } from 'src/app/models/controller-data-types';
import { ILoggingConfig } from 'src/app/models/logging-config-type';
import { WatchPageService } from 'src/app/services/watch-page.service';


@Component({
  selector: 'app-logging-page',
  templateUrl: './logging-page.component.html',
  styleUrls: ['./logging-page.component.scss']
})
export class LoggingPageComponent {
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

  public get loggingConfig(){
    return this._service.loggingConfig;
  }


  // private variables
  private inputDelay = 500;
  private inputTimeOutID?: any;

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

  symbolModified(symbol: any){
    symbol.status = "modified";
  }

  sendLoggingConfig(){
    this._service.sendLoggingConfig();
  }

  async testFunc(){
    console.log(await fetch("http://localhost:2333/api/log-status"));
    let options = {
      method: 'POST',
      headers: {
        "Content-Type": "text/plain"
      },
      body: "testFileName.lp"
    }
    fetch("http://localhost:2333/api/log-file", options);
    fetch("http://localhost:2333/api/log-file/testFileName2.lp", {method: "DELETE"})
  }




}
