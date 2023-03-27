import { NgModule } from '@angular/core';
import { BrowserModule } from '@angular/platform-browser';
import { AngularSplitModule } from 'angular-split';
import { MatTabsModule } from '@angular/material/tabs'
import { MatSelectModule } from '@angular/material/select';
import { MatIconModule } from '@angular/material/icon'
import { MatButtonModule } from '@angular/material/button'
//import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { BrowserAnimationsModule } from '@angular/platform-browser/animations';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { MatCardModule } from "@angular/material/card";
import { MatTooltipModule } from '@angular/material/tooltip';

import { SocketIoModule, SocketIoConfig } from 'ngx-socket-io';

import { AppComponent } from './app.component';

import { WatchPageComponent } from './components/watch-page/watch-page.component';
import { PersistentPageComponent } from './components/persistent-page/persistent-page.component';
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
    ReactiveFormsModule,
    SocketIoModule.forRoot(config_SameDomain),
    AngularSplitModule,
    BrowserAnimationsModule,
    MatTabsModule,
    MatSelectModule,
    MatTooltipModule,
    MatInputModule,
    MatButtonModule,
    MatIconModule,
    MatCardModule,
  ],
  providers: [],
  bootstrap: [AppComponent]
})
export class AppModule { }
