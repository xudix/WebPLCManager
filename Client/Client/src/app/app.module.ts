import { NgModule } from '@angular/core';
import { BrowserModule } from '@angular/platform-browser';
import { AngularSplitModule } from 'angular-split';
import { MatTabsModule } from '@angular/material/tabs'
import { MatSelectModule } from '@angular/material/select';

import { AppComponent } from './app.component';

import { FormsModule } from '@angular/forms';
import { SocketIoModule, SocketIoConfig } from 'ngx-socket-io';
import { WatchPageComponent } from './components/watch-page/watch-page.component';
import { PersistentPageComponent } from './components/persistent-page/persistent-page.component';
import { BrowserAnimationsModule } from '@angular/platform-browser/animations';
import { LoggingPageComponent } from './components/logging-page/logging-page.component';
import { SymbolSelectorComponent } from './components/symbol-selector/symbol-selector.component';


const config_dev: SocketIoConfig = {url: 'http://localhost:2333', options: {}};
const config_SameDomain: SocketIoConfig = {url: "", options: {}};

@NgModule({
  declarations: [
    AppComponent,
    WatchPageComponent,
    PersistentPageComponent,
    LoggingPageComponent,
    SymbolSelectorComponent
  ],
  imports: [
    BrowserModule,
    FormsModule,
    SocketIoModule.forRoot(config_dev),
    AngularSplitModule,
    BrowserAnimationsModule,
    MatTabsModule,
    MatSelectModule,
  ],
  providers: [],
  bootstrap: [AppComponent]
})
export class AppModule { }
