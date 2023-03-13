import { Socket } from "socket.io";
import { DataBroker } from "./DataBroker.js";

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
     * @param {{symbolName: string, value: any}} data 
     */
    receiveData(controllerName, data){
        if(this.subscribedData[controllerName] === undefined)
        { this.subscribedData[controllerName] = {}; }
        this.subscribedData[controllerName][data.symbolName] = data.value;
        if(!this._accumulatingSubsData){ // First data received. Start accumulating them
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
            });
        });
        this._socket.on("removeWatchSymbol", (controllerName, symbolName) =>{
            this._dataBroker.unsubscribe(this.id, controllerName, symbolName);
        });
        this._socket.on("removeAllSymbols", () => {
            this._dataBroker.unsubscribeAll(this.id);
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

    _currentTime;
    

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
        loggingConfig.logConfigs.forEach(config => {
            if(dataBroker._controllers[config.name] !== undefined){ // The specified controller exist
                config.tags.forEach(tag => {
                    dataBroker.subscribeCyclic(id, config.name, tag.tag)
                })
            }
        });

    }

    sendSubscribedData(){
        
    }

}

