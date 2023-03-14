import { Socket } from "socket.io";
import { DataBroker } from "./DataBroker.js";
import * as FileSystem from "node:fs/promises";
import * as Path from "node:path";

/**
 * A generic data client that subscribes data from DataBroker.
 * It automatically listen to the event emitted by the dataBroker with the id as the event name, 
 * and use the handleDataFromBroker() method as the event handler.
 * - Override the handleDataFromBroker() method for desired behavior.
 */
export class DataClient{
    /**
     * A unique string that represents this client.
     * @type {string}
     */
    id;
    /** 
     * Collection of {controllerName: symbolNames}. symolNames is array of names of subscribed symbols 
     * @type {Record<string,string[]>}
     * */
    subscriptions = {};
    /**
     * object that contains the subscribed data in key-value pairs.
     * - Example: {
            controllerName: {
                symbolName: value,
                symbolName: value,            }
        }
        @type {Record<string, Record<string, any>>}
     */
    subscribedData = {};

    /**
     * indicate whether data is being accumulated. After the accumulation time window, data accumulated will be sent.
     * @type {boolean}
     */
    _accumulatingSubsData = false;

    /**
     * Timestamp of first data received during the current accumulation.
     * @type {number} UTC, Unix timestamp. The number of seconds that have elapsed since January 1, 1970
     */
    _dataTime;

    /**
     * The constructor will call the registerClient() method of the dataBroker.
     * @param {string} id A unique identifier for this client
     * @param {number} accumulationTime time to accumulate data, from receiving the first data to sending out the accumulated data.
     * @param {DataBroker} dataBroker 
     */
    constructor(id, accumulationTime, dataBroker){
        this.id = id;
        this._accumulationTime = accumulationTime;
        this._dataBroker = dataBroker;
        dataBroker.registerClient(this);

    }

    /**
     * Receive data from the server app. Accumulate the data for a while, then send accumulated data out
     * @param {string} controllerName 
     * @param {{symbolName: string, value: any, timeStamp: Date}} data 
     */
    receiveData(controllerName, data){
        if(this.subscribedData[controllerName] === undefined)
        { this.subscribedData[controllerName] = {}; }
        this.subscribedData[controllerName][data.symbolName] = data.value;
        if(!this._accumulatingSubsData){ // First data received. Start accumulating them
            this._dataTime = Math.floor(data.timeStamp.valueOf()/1000);
            this._accumulatingSubsData = true;
            setTimeout(() => { // after the subscription interval from receiving the first data, send the accumulated data out.
                this.sendSubscribedData();
                this._accumulatingSubsData = false;
            }, this._accumulationTime);
        }
    }

    /**
     * Send the accumulated data after the given accumulation time. This method is called in receiveData() as the action after accumulating data for the given time. It should be overriden to properly send the data out.
     */
    sendSubscribedData(){}

    /**
     * Event handler that handles message from the data broker.
     * The handler should handle data based on different messageType.
     * @param {*} message Message containing data is in the format:
     * {
     *      messageType: string,
     *      controllerName: string,
     *      data: any,
     * }
     */
    // handleDataFromBroker(message){}
}

/**
 * A client for communicating with web application over socket.oi
 */
export class WatchClient extends DataClient{


    /**
     * 
     * @param {string} id 
     * @param {number} accumulationTime 
     * @param {DataBroker} dataBroker 
     * @param {Socket} socket 
     */
    constructor(id, accumulationTime, dataBroker, socket){
        super(id, accumulationTime, dataBroker);
        this._socket = socket;
        this._addWatchEventHandlers();
    }

    sendSubscribedData(){
        this._socket.emit("subscribedData", this.subscribedData);
        this.subscribedData = {};
    }

    sendSubscriptionList(){
        this._socket.emit("watchListUpdated", this.subscriptions);
    }

    /**
     * Adds event handlers for socket events
     * @param {WatchClient} client 
     * @returns 
     */
    _addWatchEventHandlers(){
        // events from socket
        this._socket.on("requestControllerStatus", () => {
            this._dataBroker.getControllerStatus();
            //this.socket.emit("controllerStatus", this._dataBroker.getControllerStatus())
        });
        this._socket.on("addWatchSymbol", (controllerName, symbolName) => {
            this._dataBroker.subscribeCyclic(this.id, controllerName, symbolName)
            .then(res => {
                if(this.subscriptions[controllerName] == undefined)
                {this.subscriptions[controllerName] = [];}
                this.subscriptions[controllerName].push(symbolName);
                this.sendSubscriptionList();
            })
            .catch(err => console.error(`Failed to subscribe to symbol ${symbolName} from ${controllerName}`, err));
        });
        this._socket.on("removeWatchSymbol", (controllerName, symbolName) =>{
            try{
                this._dataBroker.unsubscribe(this.id, controllerName, symbolName);
                let idx = this.subscriptions[controllerName].indexOf(symbolName);
                if(idx > -1){
                    this.subscriptions[controllerName].splice(idx, 1);
                }
            }
            catch(err){
                console.error(err);
            }
        });
        this._socket.on("removeAllSymbols", () => {
            this._dataBroker.unsubscribeAll(this.id)
            .catch((err) => console.error(err) )
            .finally(() => this.subscriptions = {});
        });
        this._socket.on("requestSymbols", (controllerName) => {
            this._dataBroker.getDataTypes(controllerName);
            this._dataBroker.getSymbols(controllerName);
        });
        // Expected to receive an object of name-value pairs {controllerName: {symbolName: value}}
        this._socket.on("writeNewValues", (newValuesObj) => {
            let results = {};
            let promises = [];
            try{
                for(let controllerName in newValuesObj){
                    results[controllerName] = {};
                    for(let symbolName in newValuesObj[controllerName]){
                        promises.push(this._dataBroker.writeSymbolValue(controllerName, symbolName, newValuesObj[controllerName][symbolName])
                        .then(() => {
                            results[controllerName][symbolName] = true;
                        })
                        .catch(err => {
                            results[controllerName][symbolName] = false;
                        })) 
                    }
                }
                Promise.all(promises).then(() => {
                    this._socket.emit("writeResults", results);
                })
            }
            catch(err){
                this,this._socket.emit("error", err);
                console.error(err);
            }
        });

    }

    /**
     * Event handler that handles message from the data broker.
     * The handler should handle data based on different messageType.
     * @param {{messageType: string, controllerName: string, data: any}} message Message containing data is in the format:
     * {
     *      messageType: string,
     *      controllerName: string,
     *      data: any,
     * }
     */
    handleDataFromBroker(message){
        switch(message.messageType){
            case "subscribedData":
                this.receiveData(message.controllerName, message.data);
        }

    }

} //class WatchClient


export class LoggingClient extends DataClient{

    _fileTimer;
    /**
     * File handle for the logging file
     * @type {FileSystem.FileHandle}
     */
    _fileHandle = null;

    _buffer;
    _bufferLength = 0;
    _fileAvaileble = false;
    _subsNumber = 0;
    _subsSucceeded = 0;
    _subsFailed = 0;
    _subsHasFailure = false;
    /**
     * Indicate if a fresh subscription should be performed, during which the all symbol will be subscribed to.
     * If not in a fresh sub, only the symbols that failed in previous subscription will be retried.
     * It is set to true when 1 first started; 2 _subscribeLogging(true) called with reSubscribe = true.
     * @type {boolean} 
     */
    _freshSubscription = true;
    
    /**
     * A dictionary for looking up field name by controller name and tag name
     * @type {Record<string, Record<string,string>>} {controllerName: {symbolName: field}}
     */
    fieldsDict = {};

    /**
     * 
     * @param {*} id 
     * @param {*} accumulationTime 
     * @param { DataBroker } dataBroker 
     * @param {{logPath: string, 
    *          logFileTime: number, 
    *          logConfigs: {bucket: string,
    *                       measurement: string,
    *                       name: string,
    *                       tags: {field: string, tag: string}[]
    *                      }[]
    *          }} loggingConfig  Configuration for logging.
    *  - logPath is where the log files will be stored
    *  - logFileTime, in miliseconds, specifies the max time duration for a single data file. After this time, a new file will be created.
    *  - name is the controller's name, which should match the name in the controller object
    *  - tag is the full symbol name in the PLC
    *  - bucket, measurement, and field is the name of this entry in the data base.
     */
    constructor(id, accumulationTime, dataBroker, loggingConfig){
        super(id, accumulationTime, dataBroker);
        this.configs = loggingConfig;
        this.autoResubscribe = true;
        
        this._subscribeLogging();

    }

    /**
     * Write the data accumulated in subscribedData to the buffer, then call _writeToFile.
     */
    sendSubscribedData(){
        let measurement;
        for(let controllerName in this.subscribedData){
            for(let config of this.configs.logConfigs){
                if(config.name == controllerName){
                    measurement = config.measurement;
                    break;
                }
            }
            this._bufferLength += this._buffer.write(`${measurement} `, this._bufferLength, 'binary');
            for(let symbolName in this.subscribedData[controllerName]){
                this._bufferLength += this._buffer.write(`${this.fieldsDict[controllerName][symbolName]}=${this.subscribedData[controllerName][symbolName]},`, this._bufferLength, 'binary');
            }
            this._bufferLength += (this._buffer.write(` ${this._dataTime}\n`, this._bufferLength-1, 'binary') - 1); // -1 in offset to remove the last comma
        }
        this.subscribedData = {};
        this._writeToFile();
    }

    /**
     * 
     * @param {boolean} reSubscribe Force the client to unsubscribe all symbols and re subscribe them from the data broker.
     */
    async _subscribeLogging(reSubscribe = false){
        if(reSubscribe){ // If a resubscribe is needed, unsubscribe all previous ones, then start over.
            this._dataBroker.unsubscribeAll(this.id).then(async () => {
                this.sendSubscribedData();  // purge out current accumulated data
                this.subscriptions = {};
                this._subsNumber = 0;
                this._subsFailed = 0;
                this._subsHasFailure = false;
                this._subsSucceeded = 0;
                this._freshSubscription = true;
                this._subscribeLogging(false);
            })
        }
        else{
            this.configs.logConfigs.forEach(config => { // iterate all configs (for all controllers)
                let controllerName = config.name;
                if(this._dataBroker._controllers[controllerName] !== undefined){ // The specified controller exist
                    if(this.fieldsDict[controllerName] === undefined){
                        this.fieldsDict[controllerName] = {};
                    }
                    if(this.subscriptions[controllerName] === undefined){
                        this.subscriptions[controllerName] = [];
                    }
                    config.tags.forEach(tag => { // iterate all symbols defined
                        let symbolName = tag.tag;
                        this.fieldsDict[controllerName][symbolName] = tag.field;
                        if(this._freshSubscription) {this._subsNumber += 1;} // just cound the number of defined tags, for allocating the buffer.
                        if(this._freshSubscription || (!tag.success)){  // If it's not a fresh subscription, only subscribe to the ones that failed previously.
                            this._dataBroker.subscribeCyclic(this.id, controllerName, symbolName)
                                .then(() => {
                                    this.subscriptions[controllerName].push(symbolName);
                                    tag.success = true;
                                    //this._subsSucceeded += 1;
                                    //if(!this._freshSubscription) {this._subsFailed -= 1;} // If this is to go over the failed subscriptions again, reduce the fail number
                                })
                                .catch(err => {
                                    //if(this._freshSubscription) {this._subsFailed += 1;}
                                    tag.success = false;
                                    this._subsHasFailure = true;
                                    console.error(`LoggingClient: Failed to subscribe to symbol ${symbolName} from ${controllerName}`, err)
                                });
                        }
                        
                    })
                }
            });
            if(this._freshSubscription){ // Consider to re-allocate the buffer
                this._buffer = Buffer.alloc((this._subsNumber+1)*100);
            }
            this._freshSubscription = false;
            if(this.autoResubscribe){
                setTimeout(() => {
                    if (this._subsHasFailure) { this._subscribeLogging(false); }
                }, this.configs.logFileTime);
            }
        }
        
    }

    async _writeToFile(){
        if(this._bufferLength > 0){ // only write if there's data to write
            if(this._fileHandle == null){
                this._fileAvaileble = false;
                this._fileHandle = {};  // to prevent another file creation operation before this one is done.
                this.tempFilePath = Path.join(this.configs.logPath, this._dataTime+".temp")
                await FileSystem.open(this.tempFilePath, "a+")
                .then(fileHandle => {
                    this._fileHandle = fileHandle;
                    this._writeLine()
                    this._fileTimer = setTimeout(() => {
                        this.switchFile();
                    }, this.configs.logFileTime);
                })
                .catch(err => {
                    this._fileHandle = null;
                    console.error("Failed to create temp file", err);
                })
            }
            else if(this._fileAvaileble){
                await this._writeLine();
            }
        }
    }

    async _writeLine(){
        this._fileAvaileble = false;
        await this._fileHandle.write(this._buffer,0,this._bufferLength)
        .then((res) => {
            //console.log(`Written ${res.bytesWritten} bytes.`);
            this._bufferLength = 0;
            this._fileAvaileble = true;
        })
        .catch(err => console.error(`Failed to write to file.`, err));
    }

    /**
     * Close the current logging file and rename it. The next write operation will be on a new file.
     */
    switchFile(){
        this._fileAvaileble = false;
        this._fileHandle.close()
        .then(() => {
            FileSystem.rename(this.tempFilePath, Path.join(this.configs.logPath, this._dataTime+".data"))
            .then(() => {
            })
            .catch(err =>{
                console.error("Failed to rename file.");
            })
            .finally(() => {
                this._fileHandle = null;
            })
        });
        
    }

    restartLogging(){
        this._subscribeLogging(true);
    }

}

