import { Socket } from "socket.io-client";
import { WatchPage } from "../models/watch-page.model";
import {
  IControllerSymbol,
  IControllerType,
} from "../models/controller-data-types";
import {
  ILoggingServerConfig,
  LoggingServerConfig,
  LoggingConfig,
} from "../models/logging-config-type";

export class WatchPageService {
  // private data
  private _model: WatchPage;
  private _dataExpireTime: number = 3000; // ms, time for subscription to expire. If no new data is received before expiration, data will be removed.
  private _expireTimers: Record<string, any> = {};

  // Properties exposed to component / view
  /**
   * Current controller name. All search and subscription operation will be done to this controller.
   */
  public currentController: string = "";
  /**
   * New symbol for logging will use this measurement
   */
  public currentMeasurement: string = "";
  public symbolInputStr: string = "";
  public currentPath: string = ""; // The path obtained by resolving the input string
  public selectedSymbols: IControllerSymbol[] = [];
  public candidateList: IControllerSymbol[] = [];

  public get controllerStatus() {
    return this._model.controllerStatus;
  }

  private set controllerStatus(value) {
    this._model.controllerStatus = value;
  }

  public get persistentList() {
    return this._model.persistentList;
  }

  public get symbolInfoAvailable(): boolean {
    return (
      this._model.dataTypes[this.currentController] !== undefined &&
      Object.keys(this._model.dataTypes).length > 0 &&
      this._model.symbols[this.currentController] !== undefined &&
      Object.keys(this._model.symbols).length > 0
    );
  }

  public get watchList(): Record<string, IControllerSymbol[]> {
    return this._model.watchList;
  }

  public get loggingConfig(): ILoggingServerConfig | undefined {
    return this._model.loggingConfig;
  }

  public set loggingConfig(newConfig: ILoggingServerConfig | undefined) {
    this._model.loggingConfig = newConfig;
  }

  // private variables
  private previousInput: string = "some string"; // just to trigger symbol change at initial run
  private watchableTypes = new Set([
    "BOOL",
    "BYTE",
    "WORD",
    "DWORD",
    "SINT",
    "USINT",
    "INT",
    "UINT",
    "DINT",
    "UDINT",
    "LINT",
    "ULINT",
    "REAL",
    "LREAL",
  ]); // FIXME: how to handle ENUM and TIME?

  //symbolListObservable = this.socket.fromEvent<ControllerSymbol[]>("subItemUpdated");

  constructor(private socket: Socket) {
    this._model = new WatchPage();

    // handles broadcast data received from the server
    socket.on(
      "broadcast",
      (message: { messageType: string; controllerName: string; data: any }) => {
        switch (message.messageType) {
          case "dataTypes":
            this._model.dataTypes[message.controllerName] = message.data;
            this.symbolInputChanged(true);
            break;
          case "symbols":
            this._model.symbols[message.controllerName] = message.data;
            this.symbolInputChanged(true);
            break;
          case "controllerStatus":
            this.controllerStatus = message.data;
            if (this.currentController == "") {
              this.setCurrentController(Object.keys(message.data)[0]);
            }
            break;
        }
      },
    );

    socket.on(
      "controllerStatus",
      (controllerStatus: Record<string, boolean>) => {
        this._model.controllerStatus = controllerStatus;
      },
    );

    socket.on(
      "subscribedData",
      (newData: Record<string, Record<string, any>>) => {
        this.updateValues(newData);
      },
    );

    socket.on("watchListUpdated", (newWatchList: Record<string, string[]>) => {
      this._model.watchList = {};
      for (let controllerName in newWatchList) {
        this._model.watchList[controllerName] = [];
        newWatchList[controllerName].forEach((symbolName) => {
          this._model.watchList[controllerName].push({
            name: symbolName,
            comment: "",
            type: this._model.getTypeByName(controllerName, symbolName),
            value: null,
            newValueStr: "",
          });
          this._expireTimers[controllerName + symbolName] = null;
        });
      }
    });

    socket.on(
      "loggingConfigUpdated",
      (loggingConfig: ILoggingServerConfig | undefined) => {
        this.loggingConfig = loggingConfig;
      },
    );

    socket.on("connect", () => {
      // This is actually reestablishing connection. Subscribe to all previous watches.
      socket.emit("createWatchClient");
      socket.emit("requestControllerStatus");
      for (let controllerName in this._model.watchList) {
        this._model.watchList[controllerName].forEach((symbol) => {
          socket.emit("addWatchSymbol", controllerName, symbol.name);
        });
      }
    });

    socket.on("error", (err: any) => {
      console.log(err);
    });
  }

  setCurrentController(controllerName: string) {
    if (Object.keys(this.controllerStatus).includes(controllerName)) {
      this.currentController = controllerName;
      this.requestSymbols();
      this.symbolInputChanged(true);
    }
  }

  // request to subscribe to a symbol in the watch list
  addSymbolToWatch() {
    this.selectedSymbols.forEach((symbol) => {
      if (
        this.watchableTypes.has(symbol.type) ||
        symbol.type.includes("STRING")
      ) {
        // FIXME: how to handle ENUM and TIME?
        this.socket.emit("addWatchSymbol", this.currentController, symbol.name);
      }
    });
  }

  addSymbolToLogging(
    controllerName: string,
    measurement: string,
    symbolName: string,
  ): boolean {
    if (measurement == "") return false;
    let newLoggingSymbol = {
      field: symbolName,
      tag: symbolName,
      status: "new",
    };
    if (this.loggingConfig === undefined) {
      this.loggingConfig = new LoggingServerConfig(600000, "./data/");
    }
    for (let config of this.loggingConfig.logConfigs) {
      if (config.name == controllerName && config.measurement == measurement) {
        for (let symbol of config.tags) {
          if (symbol.tag == symbolName) {
            // this symbol is already in logging. quit.
            return false;
          }
        }
        // symbol is not in logging config
        config.tags.push(newLoggingSymbol);
        return true;
      }
    }
    // No config available for the particular controller and measurement
    let newConfig = new LoggingConfig(controllerName, measurement);
    newConfig.tags.push(newLoggingSymbol);
    this.loggingConfig.logConfigs.push(newConfig);
    return true;
  }

  // Request to load symbols list from the controller
  requestSymbols() {
    this.socket.emit("requestSymbols", this.currentController);
  }

  requestLoggingConfig() {
    this.socket.emit("requestLoggingConfig");
  }

  /**
   * Search a symbol in symbols and types info
   * @param forceUpdate If set to true, a search will be performed whether the text is changed or not.
   * @returns
   */
  symbolInputChanged(forceUpdate: boolean = false) {
    if (!this.symbolInfoAvailable) {
      return;
    }
    if (!forceUpdate && this.symbolInputStr === this.previousInput) {
      // input is not actually changed
      return;
    }
    this.previousInput = this.symbolInputStr;
    this.selectedSymbols = [];
    this.candidateList = [];
    this.currentPath = this._model.findSymbolsByInput(
      this.currentController,
      this.symbolInputStr,
      this.candidateList,
    );
    if (this.candidateList.length > 0) {
      this.selectedSymbols.push({
        name:
          this.currentPath == ""
            ? this.candidateList[0].name
            : this.currentPath + "." + this.candidateList[0].name,
        type: this.candidateList[0].type,
        comment: this.candidateList[0].comment,
      });
    }
  } // symbolInputChanged()

  // When something is double clicked in the candidate window,
  // if it has sub items, set it as the path
  // if it is a primitive type, add it to watch list
  symbolDoubleClicked(symbol: IControllerSymbol, currentPage: string) {
    let actualName: string;
    if (symbol.name[0] == "[") {
      // for array
      actualName =
        this.currentPath == "" ? symbol.name : this.currentPath + symbol.name;
    } else {
      actualName =
        this.currentPath == ""
          ? symbol.name
          : this.currentPath + "." + symbol.name;
    }

    let typeObj =
      this._model.dataTypes[this.currentController][symbol.type.toLowerCase()];
    if (typeObj.subItemCount > 0) {
      // large type. Will have sub items
      this.symbolInputStr = actualName + ".";
      this.symbolInputChanged();
    } else if (typeObj.arrayDimension > 0) {
      // This is an array
      this.symbolInputStr = actualName + "[";
      this.symbolInputChanged();
    } else if (symbol.type.toLocaleLowerCase().startsWith("pointer to")) {
      // for pointers, double click => dereference it
      this.symbolInputStr = actualName + "^";
      this.symbolInputChanged();
    } else if (
      this.watchableTypes.has(typeObj.baseType) ||
      typeObj.baseType.includes("STRING")
    ) {
      // primitive, enum, or string type
      switch (currentPage) {
        case "watch":
          this.socket.emit(
            "addWatchSymbol",
            this.currentController,
            actualName,
          );
          break;
        case "logging":
          this.addSymbolToLogging(
            this.currentController,
            this.currentMeasurement,
            actualName,
          );
          break;
      }
      this._model.cacheDataType(
        this.currentController,
        actualName,
        symbol.type,
      );
      // symbol.name = actualName;
      // this.watchList.push(symbol)
    } else {
      console.error(`Unable to resolve the type of ${symbol}.`);
    }
  }

  // update the values shown in the watch list after new data is received
  updateValues(newData: Record<string, Record<string, any>>) {
    for (let controllerName in this._model.watchList) {
      this._model.watchList[controllerName].forEach((symbol) => {
        if (
          newData[controllerName] != undefined &&
          newData[controllerName][symbol.name] != undefined
        ) {
          // newData contains a value for this symbol
          if (
            typeof newData[controllerName][symbol.name] == "object" &&
            newData[controllerName][symbol.name].name != undefined &&
            newData[controllerName][symbol.name].value != undefined
          ) {
            // enum type object
            symbol.value = `${newData[controllerName][symbol.name].name} ( ${newData[controllerName][symbol.name].value} )`;
          } else {
            symbol.value = newData[controllerName][symbol.name];
          }
          if (this._expireTimers[controllerName + symbol.name]) {
            clearTimeout(this._expireTimers[controllerName + symbol.name]);
          }
          this._expireTimers[controllerName + symbol.name] = setTimeout(() => {
            symbol.value = null;
          }, this._dataExpireTime);
        }
      });
    }
  }

  // unsubscribe from all watched symbols
  removeAllSymbols() {
    this.socket.emit("removeAllSymbols");
    this._model.watchList = {};
  }

  // remove one watched symbol
  removeSymbol(controllerName: string, symbolName: string) {
    this.socket.emit("removeWatchSymbol", controllerName, symbolName);
  }

  // write new values from the watch list to the Controller
  writeNewValues() {
    let newValues: Record<string, Record<string, any>> = {}; // a collection of key-value pairs.
    let hasNewValues: boolean = false;
    for (let controllerName in this._model.watchList) {
      newValues[controllerName] = {};
      this._model.watchList[controllerName].forEach((symbol) => {
        if (symbol.newValueStr != undefined && symbol.newValueStr.length > 0) {
          let typeObj = this._getTypeObj(controllerName, symbol.type);
          if (typeObj.name.toLocaleLowerCase().startsWith("bool")) {
            // handles string to boolean
            if (symbol.newValueStr.toLocaleLowerCase() == "true") {
              newValues[controllerName][symbol.name] = true;
            } else if (symbol.newValueStr.toLocaleLowerCase() == "false") {
              newValues[controllerName][symbol.name] = false;
            }
          } // handles boolean
          else if (Object.keys(typeObj.enumInfo).length > 0) {
            // handles enum
            let lowerNewValStr = symbol.newValueStr.toLocaleLowerCase();
            let num = Number(symbol.newValueStr);
            if (Number.isNaN(num)) {
              // not a number. Input is the name of the enum
              for (let name in typeObj.enumInfo) {
                if (name.toLocaleLowerCase() == lowerNewValStr) {
                  newValues[controllerName][symbol.name] = name;
                  break;
                }
              }
            } else {
              // input is the value of the enum
              for (let name in typeObj.enumInfo) {
                if (typeObj.enumInfo[name] == num) {
                  newValues[controllerName][symbol.name] = name;
                  break;
                }
              }
            }
          } // handles enum
          else {
            // other types. Just send the string
            newValues[controllerName][symbol.name] = symbol.newValueStr;
          }
          symbol.newValueStr = "";
          hasNewValues = true;
        }
      });
    }

    if (hasNewValues) {
      this.socket.emit("writeNewValues", newValues);
    }
  }

  _getTypeObj(controllerName: string, typeName: string): IControllerType {
    return this._model.getTypeObj(controllerName, typeName);
  }

  findPersistentSymbols() {
    this._model.findPersistentSymbols(this.currentController);
  }

  sendLoggingConfig() {
    //first remove all items labeled as "remove"
    if (this.loggingConfig != undefined) {
      for (let config of this.loggingConfig.logConfigs) {
        for (let i = 0; i < config.tags.length; i++) {
          if (config.tags[i].status == "remove") {
            config.tags.splice(i, 1);
            i--;
          }
        }
      }
      this.socket.emit("writeLoggingConfig", this.loggingConfig);
    }
  }
}
