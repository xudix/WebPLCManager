import { Socket } from "socket.io";
import { DataBroker } from "./DataBroker.js";
import * as FileSystem from "node:fs/promises";
import * as Path from "node:path";
import { json } from "express";

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
     * @type {number} UTC, Unix timestamp, ms precision. The number of milliseconds that have elapsed since January 1, 1970
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
        if(dataBroker != undefined){
            this._dataBroker = dataBroker;
            dataBroker.registerClient(this);
        }

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
            this._dataTime = data.timeStamp.valueOf();
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
 * A client for communicating with web application over socket.io
 */
export class WatchClient extends DataClient{


    /**
     * 
     * @param {string} id 
     * @param {number} accumulationTime 
     * @param {DataBroker} dataBroker 
     * @param {Socket} socket 
     * @param {PLCLoggingClient} loggingClient The logging client managed by the watch page
     */
    constructor(id, accumulationTime, dataBroker, socket, loggingClient){
        super(id, accumulationTime, dataBroker);
        this._socket = socket;
        this._loggingClient = loggingClient;
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
        this._socket.on("requestLoggingConfig", () => {
            this._socket.emit("loggingConfigUpdated", this._loggingClient.loggingConfig);
        });
        this._socket.on("writeLoggingConfig", (newConfig) => {
            if(newConfig != undefined){
                this._loggingClient.loggingConfig = newConfig;
                setTimeout(() => {
                    this._socket.emit("loggingConfigUpdated", this._loggingClient.loggingConfig);
                }, 2000);
            }

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


export class PLCLoggingClient extends DataClient{


    get loggingConfig(){
        return this._loggingConfig;
    }

    /**
    * @param {{logPath: string, 
    *          logFileTime: number, 
    *          logConfigs: {measurement: string,
    *                       name: string,
    *                       tags: {field: string, tag: string, status: string}[]
    *                      }[]
    *          }} newConfig  Configuration for logging.
    *  - logPath is where the log files will be stored
    *  - logFileTime, in miliseconds, specifies the max time duration for a single data file. After this time, a new file will be created.
    *  - name is the controller's name, which should match the name in the controller object
    *  - tag is the full symbol name in the PLC
    *  - measurement and field are the name of this entry in the data base.
     */
    set loggingConfig(newConfig){
        // FIXME: check validity of logging config
        this._loggingConfig.logPath = (newConfig.logPath || this._loggingConfig.logPath);
        this._loggingConfig.logFileTime = (newConfig.logFileTime || this._loggingConfig.logFileTime);
        this._loggingConfig.logConfigs = newConfig.logConfigs;
        this.restartLogging();
        for(let config of this._loggingConfig.logConfigs){
            FileSystem.writeFile(Path.join(this._loggingConfig.configPath, config.name + "logging.json"), JSON.stringify(config,null,2));
        }
        
    }

    /**
     * This boolean controls whether the data will be write to files on the PLC.
     * - if true, the data will be written to local files on the PLC.
     * - if false, no data will be written to files.
     * @type {boolean}
     */
    writeToLocalFile = true;

    /**
     * Number of sucessful subscriptions from the controller.
     */
    subsSucceeded = 0;
    /**
     * Number of failed subscriptions from the controller.
     */
    subsFailed = 0;

    /**
     * A socket.io socket goingn to the remote logging client. If this socket exists, data received by this logging client will be transmitted through the socket.
     * @type {Socket}
     */
    remoteSocket;


    /**
     * Timer that controls the switching of temp file
     */
    _fileTimer;
    /**
     * File handle for the logging file
     * @type {FileSystem.FileHandle}
     */
    _fileHandle = null;

    /**
     * Buffer for data to be written to the file
     */
    _buffer;
    /**
     * Number of bytes in _buffer
     */
    _bufferLength = 0;
    /**
     * Indicate if the file is being used (for writing, closing, rename, etc.). When file is not available, write to file operation will 
     */
    _fileAvaileble = false;
    /**
     * An array of Promises that need to be exmined for all complete
     */
    _promises = [];
    _subsNumber = 0;
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
    _fieldsDict = {};

    /**
     * 
     * @param {*} id 
     * @param {*} accumulationTime 
     * @param { DataBroker } dataBroker 
     * @param {{configPath: string,
     *          logPath: string, 
    *           logFileTime: number, 
    *           bucket: string,
    *           logConfigs: {bucket: string,
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
        this._loggingConfig = loggingConfig;
        let controllerStatus = dataBroker.getControllerStatus();
        for(let controllerName in controllerStatus){
            console.log(process.cwd());
            this._promises.push(FileSystem.readFile(Path.join(this._loggingConfig.configPath, controllerName + "logging.json"))
                .then((data) => {
                    if(this._loggingConfig.logConfigs == undefined) { this._loggingConfig.logConfigs = []; }
                    this._loggingConfig.logConfigs.push(JSON.parse(data));
                })
                .catch(err => console.error(`Failed to load logging configuration for ${controllerName}.`, err)));
        }
        Promise.all(this._promises).then(() => {
            this.autoResubscribe = true;
            this._subscribeLogging();
        })
        this._clearOldTempFiles();
    }

    /**
     * Write the data accumulated in subscribedData to the buffer, then call _writeToFile.
     */
    sendSubscribedData(){
        let measurement;
        for (let controllerName in this.subscribedData) {
            for (let config of this.loggingConfig.logConfigs) {
                if (config.name == controllerName) {
                    measurement = config.measurement;
                    break;
                }
            }
            this._bufferLength += this._buffer.write(`${measurement} `, this._bufferLength, 'binary');
            for (let symbolName in this.subscribedData[controllerName]) {
                let data = this.subscribedData[controllerName][symbolName];
                switch (typeof data) {    // Different format for different type of data
                    case "object":
                        if (data.name != undefined && data.value != undefined) { // enum type
                            this._bufferLength += this._buffer.write(`${this._fieldsDict[controllerName][symbolName]}=${data.value},`, this._bufferLength, 'binary');
                            this._bufferLength += this._buffer.write(`${this._fieldsDict[controllerName][symbolName]}.name="${data.name.replaceAll("\\", "\\\\").replaceAll("\"", "\\\"")}",`, this._bufferLength, 'binary');   // record name and value at the same time
                        }
                        break;
                    case "string":
                        data = data.replaceAll("\\", "\\\\").replaceAll("\"", "\\\"");
                        this._bufferLength += this._buffer.write(`${this._fieldsDict[controllerName][symbolName]}="${data}",`, this._bufferLength, 'binary');   // need to add double quotation to string
                        break;
                    default:
                        this._bufferLength += this._buffer.write(`${this._fieldsDict[controllerName][symbolName]}=${data},`, this._bufferLength, 'binary');
                }
            }
            this._bufferLength += (this._buffer.write(` ${this._dataTime}\n`, this._bufferLength - 1, 'binary') - 1); // -1 in offset to remove the last comma
        }
        this.subscribedData = {};
        // Depending on whether a remote logger is connected, write to local file or send data to remote.
        if (this.writeToLocalFile || this.remoteSocket === undefined){
            this._writeToFile();
        }
        if (this.remoteSocket != undefined){
            this.remoteSocket.emit("lpData", this._buffer.toString("binary", 0, this._bufferLength));
            this._bufferLength = 0;
        }
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
                this.subsFailed = 0;
                this._subsHasFailure = false;
                this.subsSucceeded = 0;
                this._freshSubscription = true;
                this._subscribeLogging(false);
            })
        }
        else{
            this._subsHasFailure = false;
            this._promises = [];
            this.loggingConfig.logConfigs.forEach(config => { // iterate all configs (for all controllers)
                let controllerName = config.name;
                if(this._dataBroker._controllers[controllerName] !== undefined){ // The specified controller exist
                    if(this._fieldsDict[controllerName] === undefined){
                        this._fieldsDict[controllerName] = {};
                    }
                    if(this.subscriptions[controllerName] === undefined){
                        this.subscriptions[controllerName] = [];
                    }
                    config.tags.forEach(tag => { // iterate all symbols defined
                        let symbolName = tag.tag;
                        this._fieldsDict[controllerName][symbolName] = tag.field.replaceAll(" ","\\ ").replaceAll(",","\\,").replaceAll("=","\\=");
                        if(this._freshSubscription) {this._subsNumber += 1;} // just cound the number of defined tags, for allocating the buffer.
                        if(this._freshSubscription || (tag.status === undefined) || tag.status != "success"){  // If it's not a fresh subscription, only subscribe to the ones that failed previously.
                            this._promises.push(this._dataBroker.subscribeCyclic(this.id, controllerName, symbolName)
                                .then(() => {
                                    this.subscriptions[controllerName].push(symbolName);
                                    tag.status = "success";
                                    this.subsSucceeded += 1;
                                    if(!this._freshSubscription) {this.subsFailed -= 1;} // If this is to go over the failed subscriptions again, reduce the fail number
                                })
                                .catch(err => {
                                    if(this._freshSubscription) {this.subsFailed += 1;}
                                    tag.status = "fail";
                                    this._subsHasFailure = true;
                                    //console.error(`LoggingClient: Failed to subscribe to symbol ${symbolName} from ${controllerName}`, err)
                                }));
                        }
                        
                    })
                }
            });
            if(this._freshSubscription){ // Consider to re-allocate the buffer
                this._buffer = Buffer.alloc((this._subsNumber+1)*100);
            }
            Promise.all(this._promises).then(() => {
                this._freshSubscription = false;
                console.log(`Logging subscriptions: ${this.subsSucceeded} succeeded, ${this.subsFailed} failed.`)
                if(this.autoResubscribe){
                    setTimeout(() => {
                        if (this._subsHasFailure) { this._subscribeLogging(false); }
                    }, 5000);
            }
            });
            
        }
        
    }

    async _writeToFile(){
        if(this._bufferLength > 0){ // only write if there's data to write
            if(this._fileHandle === null){
                this._fileAvaileble = false;
                this._fileHandle = {};  // to prevent another file creation operation before this one is done.
                this.tempFilePath = Path.join(this.loggingConfig.logPath, this._dataTime+".temp")
                await FileSystem.open(this.tempFilePath, "a+")
                .then(async fileHandle => {
                    this._fileHandle = fileHandle;
                    await this._writeData()
                    this._fileTimer = setTimeout(() => {
                        this.switchFile();
                    }, this.loggingConfig.logFileTime);
                })
                .catch(err => {
                    this._fileHandle = null;
                    console.error("Failed to create temp file", err);
                })
            }
            else if(this._fileAvaileble){
                await this._writeData();
            }
        }
    }

    async _writeData(){
        this._fileAvaileble = false;
        await this._fileHandle.write(this._buffer,0,this._bufferLength)
        .then((res) => {
            //console.log(`Written ${res.bytesWritten} bytes.`);
            this._bufferLength = 0;
        })
        .catch(err => console.error(`Failed to write to file.`, err))
        .finally(() => {
            this._fileAvaileble = true;
        });
    }

    /**
     * Look in the data folder, and convert all existing .temp files to .lp file.
     */
    async _clearOldTempFiles(){
        await FileSystem.readdir(this._loggingConfig.logPath)
            .then(async (files) => {
                for(let fileName of files){
                    if (fileName.endsWith(".temp")){
                        let oldName = Path.join(this.loggingConfig.logPath, fileName);
                        await FileSystem.rename(oldName, oldName.replace(".temp", ".lp"));
                    }
                }
            })
    }

    /**
     * Close the current logging file and rename it. The next write operation will be on a new file.
     * @returns {Promise<string>} New file name is returned if resolved.
     */
    switchFile(){
        clearTimeout(this._fileTimer);
        return new Promise((resolve, reject) => {
            if(this._fileHandle == null){
                resolve("");
                return;
            }
            if(this._fileAvaileble){
                this._fileAvaileble = false;
                this._fileHandle.close()
                    .then(() => {
                        let newFileName = this.tempFilePath.replace(".temp", `_${this.loggingConfig.bucket}.lp`);
                        FileSystem.rename(this.tempFilePath, newFileName)
                            .then(() => {
                                resolve(newFileName);
                            })
                            .catch(err => {
                                console.error("Failed to rename temp file.", err);
                                setTimeout(() => {
                                    this._clearOldTempFiles();
                                }, 1000);
                                reject(err);
                            })
                            .finally(() => {
                                this._fileHandle = null;
                            })
                    })
                    .catch(err => {
                        console.error("Failed to close temp file.", err);
                        reject(err);
                    });
            }
            else{
                setTimeout(() => {
                    this.switchFile()
                        .then((newFileName) => resolve(newFileName))
                        .catch(err => reject(err));
                }, 5000);
            }
            
        });
        
        
    }

    /**
     * Unsubscribe to all symbols, then resubscribe. Use this after a configuration change.
     */
    restartLogging(){
        this._subscribeLogging(true);
    }

    deleteDataFile(fileName){
        return FileSystem.unlink(Path.join(this.loggingConfig.logPath, fileName));
    }

    

} // class LoggingClient

