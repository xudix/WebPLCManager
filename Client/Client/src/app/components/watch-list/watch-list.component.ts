import { Component, OnInit, OnDestroy } from '@angular/core';
import { Subscription } from 'rxjs';
import { startWith } from 'rxjs';
import { ControllerSymbol } from 'src/app/models/controller-data-types';
import { WatchListService } from 'src/app/services/watch-list.service';

@Component({
  selector: 'app-watch-list',
  templateUrl: './watch-list.component.html',
  styleUrls: ['./watch-list.component.scss']
})
export class WatchListComponent implements OnInit, OnDestroy {
  
  public get watchList(): ControllerSymbol[]{
    return this.watchListService.watchList;
  }
  //private _watchListSub?: Subscription;



  constructor(private watchListService: WatchListService){};

  ngOnInit(): void {
    // this._watchListSub = this.watchListService.watchList.subscribe(newWatchList => {
    //   this.watchList = newWatchList;
    // });
  }

  ngOnDestroy(): void {
    // if(this._watchListSub != undefined)
    //   this._watchListSub.unsubscribe();
  }

  clear(){
    this.watchListService.removeAllSymbols();

  }

  writeNewValues(){
    this.watchListService.writeNewValues();

  }
}
