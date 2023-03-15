import { Component } from '@angular/core';
import { MatTabChangeEvent } from '@angular/material/tabs';
import { WatchPageService } from './services/watch-page.service';

@Component({
  selector: 'app-root',
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.scss']
})
export class AppComponent {
  title = 'Controller Watch';

  /**
 * List of controller names obtained from the server
 */
  public get controllerList(): string[] {
    return Object.keys(this._service.controllerStatus);
  }

  /**
   * Configured controllers, and whether it's connected to the server.
   * {controllerName: isConnected}
   */
  public get controllerStatus() {
    return this._service.controllerStatus;
  }

  // Properties for view
  public get currentController(): string {
    return this._service.currentController;
  }

  public set currentController(controllerName: string) {
    this._service.setCurrentController(controllerName);
  }

  constructor(private _service: WatchPageService){}

  /**
   * 
   * @param newTab 0: Watch Symbols; 1: Manage Persistents; 2: Manage Logging
   */
  selectedIndexChange(newTab: number){
    if(newTab == 2){ // manage logging page
      this._service.requestLoggingConfig();
    }
  }

}
