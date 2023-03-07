import { NgModule } from '@angular/core';
import { BrowserModule } from '@angular/platform-browser';
import { AngularSplitModule } from 'angular-split';
import { MatTabsModule } from '@angular/material/tabs'

import { AppComponent } from './app.component';

import { FormsModule } from '@angular/forms';
import { SocketIoModule, SocketIoConfig } from 'ngx-socket-io';
import { WatchPageComponent } from './components/watch-page/watch-page.component';
import { PersistentPageComponent } from './components/persistent-page/persistent-page.component';
import { BrowserAnimationsModule } from '@angular/platform-browser/animations';


const config: SocketIoConfig = {url: 'http://localhost:2333', options: {}};

@NgModule({
  declarations: [
    AppComponent,
    WatchPageComponent,
    PersistentPageComponent
  ],
  imports: [
    BrowserModule,
    FormsModule,
    SocketIoModule.forRoot(config),
    AngularSplitModule,
    BrowserAnimationsModule,
    MatTabsModule
  ],
  providers: [],
  bootstrap: [AppComponent]
})
export class AppModule { }
