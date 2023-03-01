import { NgModule } from '@angular/core';
import { BrowserModule } from '@angular/platform-browser';
import { AngularSplitModule } from 'angular-split';

import { AppComponent } from './app.component';
import { SymbolListComponent } from './components/symbol-list/symbol-list.component';
import { WatchListComponent } from './components/watch-list/watch-list.component';

import { FormsModule } from '@angular/forms';
import { SocketIoModule, SocketIoConfig } from 'ngx-socket-io';
import { WatchPageComponent } from './components/watch-page/watch-page.component';


const config: SocketIoConfig = {url: 'http://localhost:2333', options: {}};

@NgModule({
  declarations: [
    AppComponent,
    SymbolListComponent,
    WatchListComponent,
    WatchPageComponent
  ],
  imports: [
    BrowserModule,
    FormsModule,
    SocketIoModule.forRoot(config),
    AngularSplitModule
  ],
  providers: [],
  bootstrap: [AppComponent]
})
export class AppModule { }
