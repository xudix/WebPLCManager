import { Component } from '@angular/core';
import { elementAt, expand } from 'rxjs';
import { IControllerSymbol } from 'src/app/models/controller-data-types';
import { ILoggingConfig, LoggingConfig, LoggingServerConfig } from 'src/app/models/logging-config-type';
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

  /**
   * A list of all measurements under the current 
   */
  public get measurements(): string[]{
    let measurements: string[] = [];
    if (this._service.loggingConfig !== undefined){
      for(let config of this._service.loggingConfig.logConfigs){
        if(config.name == this._service.currentController){ measurements.push(config.measurement); }
      }
    }
    return measurements;    
  }

  /**
   * New symbol for logging will use this measurement
   */
  public get currentMeasurement(): string{
    if (this.measurements.length > 0 && !this.measurements.includes(this._service.currentMeasurement)) { this._service.currentMeasurement =  this.measurements[0]}
    return this._service.currentMeasurement;
  }

  public set currentMeasurement(newValue: string){
    this._service.currentMeasurement = newValue;
  }

  /**
   * new measurement name input by user
   */
  newMeasurementName: string = "";

  
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

  /**
   * Indicate if a specific logging group (controllerName + measurement) should be expanded
   * @param groupName 
   * @returns 
   */
  isExpanded(groupName: string){
    if(this.expanded[groupName] === undefined){
      this.expanded[groupName] = true;
    }
    return this.expanded[groupName];
  }

  /**
   * Toggle the expand state of a logging group (controllerName + measurement)
   * @param groupName 
   */
  toggleExpanded(groupName: string){
    this.expanded[groupName] = !this.isExpanded(groupName);
  }

  /**
   * Toggle the "onChange" option for a symbol
   * @param symbol 
   */
  toggleOnChange(symbol: any){
    if(symbol.onChange){
      symbol.onChange = false;
    }
    else{
      symbol.onChange = true;
    }
    this.symbolModified(symbol);
  }

  toggleEnable(symbol: any){
    if(symbol.disabled){
      symbol.disabled = false;
    }
    else{symbol.disabled = true;}
    this.symbolModified(symbol);
  }

  /**
   * If any symbol is enabled, will disable all. If all symbols are disabled, enable all
   * @param config 
   */
  toggleGroupEnable(config: ILoggingConfig){
    for(let symbol of config.tags){
      if( !symbol.disabled ){
        config.tags.forEach((symbol) =>{
          symbol.disabled = true;
          this.symbolModified(symbol);
        } );
        return;
      }
    }
    config.tags.forEach((symbol) =>{
      symbol.disabled = false;
      this.symbolModified(symbol);
    } )
  }

  removeGroup(config: ILoggingConfig){
    if (this._service.loggingConfig){
      let idx = this._service.loggingConfig.logConfigs.indexOf(config);
      if (idx > -1){
        this._service.loggingConfig.logConfigs.splice(idx, 1);
      }
    }
  }

  addNewMeasurement(){
    if(this.newMeasurementName == "") return;
    if(this._service.loggingConfig == undefined){ this._service.loggingConfig = new LoggingServerConfig(600000, "./data/");}
    for (let config of this._service.loggingConfig.logConfigs) {
      if (config.name == this._service.currentController && config.measurement == this.newMeasurementName) {
        return;
      }
    }
    this._service.loggingConfig.logConfigs.push(new LoggingConfig(this._service.currentController, this.newMeasurementName))
    this.currentMeasurement = this.newMeasurementName;
    this.newMeasurementName = "";
  }
  
  private expanded: Record<string, boolean> = {};



}
