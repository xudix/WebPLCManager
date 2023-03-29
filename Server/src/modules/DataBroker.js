import { EventEmitter } from 'node:events';
import { DataClient } from './DataClients.js';
import { GenericController } from './genericController.js';

/**
 * Data Broker that handles the communication with the PLC and dispatch data to data clients.
 */
export class DataBroker extends EventEmitter{
    
    /**
     * An object of subscribed symbols. This is used for dispatching
     * 
     * Content: 
     *  {
            controllerName1:{
                symbolName1: [clientIDa, clientIDb],
                symbolName2: [clientIDc, clientIDd],
            }
            controllerName2:{
                symbolName3: [clientIDe, clientIDf],
                symbolName4: [clientIDg, clientIDh],
            }
        }
        @type {Record <string, Record<string, string[]>>}
     */
    _subscriptionsBySymbol = {}; 

    /**
     * An object of subscribed symbols. This is used for unsubscription.
     * 
     * Content: 
     * {
            clientID:{
                controllerName1: [symbolName1, symbolName2],
                controllerName2: [symbolName1, symbolName2],
            }
            clientID:{
                controllerName1: [symbolName1, symbolName2],
                controllerName2: [symbolName1, symbolName2],
            }
        }
        @type {Record<string, Record<string, string[]>>}
     */
    _subscriptionsByClient = {}
    
    /**
     * DataClient objects managed by registerClient and unregisterClient method. Used for event handling.
     * Key-value pair of {clientID, clientObject}
     * @type {Record<String, DataClient>}
     */
    _clients = {};

    /**
     * A cache for data types. {controllerName: dataTypes}, where dataTypes is a collection of {typeName: typeObject}
     * @type {Record<string, Record<string, any>>}
    */
    _dataTypes = {}; 
    /**
     * A cache for symbols. {controllerName: symbols}, where symbols is a collection of {symbolName: symbolObject} 
     * @type {Record<string, Record<string, any>>}
     * */
    _symbols = {}; 

    /**
     * 
     * @param {Record<string, GenericController>} controllers {controllerName: controllerObj}
     * @param {any} config options for the DataBroker. Currently used items: {subscriptionInterval: number}
     */
    constructor(controllers, config){
        super();
        this.config = config;
        /**Collection of controller objects */
        this._controllers = controllers;
        for(let controllerName in controllers){
            this._subscriptionsBySymbol[controllerName] = {};
        }

        //cyclic detection of controller status
        setInterval(() => {
            this.getControllerStatus();
        }, (5000));

        // object for emitting message
        this.log = {
            info : (...args) => {
                let msg = "";
                args.forEach(arg => msg += arg.toString() + "\n");
                this.emit("log", "info", msg);
            },
            warn : (...args) => {
                let msg = "";
                args.forEach(arg => msg += arg.toString() + "\n");
                this.emit("log", "warn", msg);
            },
            error : (...args) => {
                let msg = "";
                args.forEach(arg => msg += arg.toString() + "\n");
                this.emit("log", "error", msg);
            }
        }

    }

    /**
     * Get the status of available controllers. Will emit a broadcast event with messageType: "controllerStatus" with the returned data.
     * @returns {Record<string, boolean>} {controllerName: isConnected} key-value pair indicating the names of controller and if they are connected.
     */
    getControllerStatus(){
        let result = {};
        for(let controllerName in this._controllers){
            result[controllerName] = this._controllers[controllerName].isConnected;
        }
        this.emit("broadcast", {
            messageType: "controllerStatus",
            controllerName: "",
            data: result,
        });
        return result;

    }

    /**
     * Gets the data types from the controller. Emits a "dataTypes" event with message object: 
     * {
     *  messageType: "dataTypes",
     *  controllerName: controllerName,
     *  data: dataTypes,
     * }
     * 
     * @param {string} controllerName name of controller
     * @returns Promise. When resolved, the data is the data types received. 
     */
    getDataTypes(controllerName){
        return new Promise((resolve, reject) => {
            this._controllers[controllerName].getDataTypes().then((dataTypes) => {
                this.emit("broadcast", {
                    messageType: "dataTypes",
                    controllerName: controllerName,
                    data: dataTypes,
                });
                this._dataTypes[controllerName] = dataTypes;
                this.log.info(`Data types updated from ${controllerName}: ${Object.keys(dataTypes).length} data types found.`)
                resolve(dataTypes);
            })
            .catch(err => {
                //console.error(`Failed to read data types from ${controllerName}.`, err);
                //this.emit("error", new Error(`Failed to read data types from ${controllerName}.`));
                reject(err);
            });
        });
        
    }

    /**
     * Try to get the symbols from the target system. Emits a "symbols" event with message object: 
     * {
     *  messageType: "symbols",
     *  controllerName: controllerName,
     *  data: symbols,
     * }
     * @param {string} controllerName name of controller
     * @returns Promise. When resolved, the data is the symbols received from controller. 
     */
    getSymbols(controllerName){
        return new Promise((resolve, reject) => {
            this._controllers[controllerName].getSymbols().then((symbols) => {
                this.emit("broadcast", {
                    messageType: "symbols",
                    controllerName: controllerName,
                    data: symbols,
                });
                this._symbols[controllerName] = symbols;
                this.log.info(`Symbols updated from ${controllerName}: ${Object.keys(symbols).length} symbols found.`)
                resolve(symbols);
            })
            .catch(err => {
                //console.error(`Failed to read symbols from ${controllerName}.`, err);
                //this.emit("error", new Error(`Failed to read symbols from ${controllerName}.`));
                reject(err);
            });
        });
        
    }

    /**
     * Try to subscribe to a symbol for cyclic reading from the target system.
        If the symbol is already subscribed to, just add the client to the symbol item under subscriptions object.
        If the symbol is not subscribed to, ask the controller to subscribe.
     * @param {string} clientID
     * @param {string} controllerName 
     * @param {string} symbolName
     * @returns Promise. If resolved, the data to the resolve function is a subscription object.
     */
    subscribeCyclic(clientID, controllerName, symbolName){
        return this._subscribe(clientID, controllerName, symbolName, false);
    }


    /**
     * Try to subscribe to a symbol for changes from the target system.
        If the symbol is already subscribed to, just add the client to the symbol item under subscriptions object.
        If the symbol is not subscribed to, ask the controller to subscribe.
     * @param {string} clientID 
     * @param {string} controllerName
     * @param {string} symbolName 
     * @returns Promise. If resolved, the data to the resolve function is a subscription object.
     */
    subscribeOnChange(clientID, controllerName, symbolName){
        return this._subscribe(clientID, controllerName, symbolName, true); 
    }

    /**
     * Try to subscribe to a symbol for cyclic reading from the target system.
        If the symbol is already subscribed to, just add the client to the symbol item under subscriptions object.
        If the symbol is not subscribed to, ask the controller to subscribe.
     * @param {string} clientID
     * @param {string} controllerName 
     * @param {string} symbolName
     * @param {boolean} onChange    Indicate if the symbol should be subscribed to with OnChange mode. If false, it will be cyclic mode.
     * @returns Promise. If resolved, the data to the resolve function is a subscription object.
     */
    _subscribe(clientID, controllerName, symbolName, onChange = false){
        return new Promise((resolve, reject) => {
            if(this._subscriptionsBySymbol[controllerName][symbolName] === undefined || this._subscriptionsBySymbol[controllerName][symbolName].length == 0){ // This symbol was not subscribed to
                if(this._controllers[controllerName] == undefined){
                    reject(new Error(`Controller ${controllerName} is not defined.`))
                }
                else if(!this._controllers[controllerName].isConnected){
                    reject(new Error(`Controller ${controllerName} is not connected.`))
                }
                else{
                    let subscriptionPromise;
                    if(onChange){
                        subscriptionPromise = this._controllers[controllerName].subscribeOnChange(symbolName, (data) => this.dispatchSubscriptions(controllerName, data));
                    }
                    else{
                        subscriptionPromise = this._controllers[controllerName].subscribeCyclic(symbolName, (data) => this.dispatchSubscriptions(controllerName, data), this.config.subscriptionInterval);
                    }
                    subscriptionPromise.then((res) => {
                            this._subscriptionsBySymbol[controllerName][symbolName] = [clientID];
                            if (this._subscriptionsByClient[clientID] == undefined) { this._subscriptionsByClient[clientID] = {} }
                            if (this._subscriptionsByClient[clientID][controllerName] == undefined) { this._subscriptionsByClient[clientID][controllerName] = []; }
                            if (!this._subscriptionsByClient[clientID][controllerName].includes(symbolName)) { this._subscriptionsByClient[clientID][controllerName].push(symbolName); }                            
                            resolve(res);
                        })
                        .catch(err => {
                            reject(err);
                        });
                }
            }
            else{
                if(!this._subscriptionsBySymbol[controllerName][symbolName].includes(clientID)){ // this symbol is not already subscribed by this client
                    this._subscriptionsBySymbol[controllerName][symbolName].push(clientID);
                    if (this._subscriptionsByClient[clientID] == undefined) 
                    { this._subscriptionsByClient[clientID] = {} }
                    if (this._subscriptionsByClient[clientID][controllerName] == undefined) 
                    { this._subscriptionsByClient[clientID][controllerName] = []; }
                    this._subscriptionsByClient[clientID][controllerName].push(symbolName);
                    resolve()
                }
            }
        });
    }


    /**
     * Try to unsubscribe to a symbol for a client
     * First remove the client from the symbol item under the subscriptions object. If no one is subscribing to this symbol anymore, ask the controller to unsubscribe.
     * @param {string} clientID 
     * @param {string} controllerName 
     * @param {string} symbolName 
     * @returns Promise. No data is passed to the resolve function
     */
    unsubscribe(clientID, controllerName, symbolName){
        return new Promise((resolve, reject) => {
            try{
                let idx = this._subscriptionsBySymbol[controllerName][symbolName].indexOf(clientID);
                if (idx > -1) {
                    this._subscriptionsBySymbol[controllerName][symbolName].splice(idx, 1);
                }
                if (this._subscriptionsBySymbol[controllerName][symbolName].length == 0) { // no one is subscribing to this anymore
                    this._controllers[controllerName].unsubscribe(symbolName).catch(err => {
                        this.log.error(`Failed to unsubscribe to ${symbolName}`, err)
                        reject(err);
                        return;
                    });
                }
                idx = this._subscriptionsByClient[clientID][controllerName].indexOf(symbolName);
                if (idx > -1)
                { this._subscriptionsByClient[clientID][controllerName].splice(idx,1); }
                resolve();
            }
            catch(err){
                reject(err);
            }
        });
        
    }

    /**
     * Try to unsubscribe to all symbols from the target system. Return a Promise<object>.
     * @param {string} clientID 
     * @returns Promise. If resolved, no data is returned.
     */
    unsubscribeAll(clientID){
        return new Promise((resolve, reject) => {
            try{
                for(let controllerName in this._subscriptionsByClient[clientID]){
                    this._subscriptionsByClient[clientID][controllerName].forEach((symbolName) => {
                        let idx = this._subscriptionsBySymbol[controllerName][symbolName].indexOf(clientID);
                        if (idx > -1) {
                            this._subscriptionsBySymbol[controllerName][symbolName].splice(idx, 1);
                        }
                        if (this._subscriptionsBySymbol[controllerName][symbolName].length == 0) { // no one is subscribing to this anymore
                            this._controllers[controllerName].unsubscribe(symbolName).catch(err => this.log.error(`Failed to subscribe to ${symbolName}`, err));
                        }
                    });
                }
                delete this._subscriptionsByClient[clientID];
                resolve();
            }
            catch(err){
                reject(err);
            }
            
        });

        
    }

    /**
     * Try to read a symbol's value from the target system.
     * @param {string} controllerName 
     * @param {string} symbolName 
     * @returns Promise. If resolved, data provided to the resolve function is the value received from the controller.
     */
    readSymbolValue(controllerName, symbolName){
        return this._controllers[controllerName].readSymbolValue(symbolName);
    }

    /**
     * Try to write a symbol's value to the target system.
     * @param {string} controllerName 
     * @param {string} symbolName 
     * @param {*} value string, number, or other things that can be written to PLC
     * @returns Promise, If resolved, write is successful and value and data type are returned {value, type} (object)
     */
    writeSymbolValue(controllerName, symbolName, value){
        return this._controllers[controllerName].writeSymbolValue(symbolName, value);
    }

    /**
     * Callback function for subscription.
       This method is called when subscription data is received from the controller.
       After data is received, it is dispatched to the corresponding DataClient by emitting an event. 
       Event name is the client ID, and event message is
       {
        messageType: "subscribedData",
        controllerName: controllerName,
        data: data,
       }
     * @param {string} controllerName 
     * @param {{value: any, symbolName: string, type: string, timeStamp: Time}} data 
     */
    dispatchSubscriptions(controllerName, data){ // 
        data.timeStamp = new Date();
        if(typeof data.symbolName != "string")
            throw new  Error("Not Implemented in dispatchSubscriptions(): Unable to dispatch subscriptions without symbol name.");
        // put values to the client objects
        
        this._subscriptionsBySymbol[controllerName][data.symbolName].forEach((clientID) => {
            this._clients[clientID].receiveData(controllerName, data);
        });
    } // dispatchSubscriptions()


    /**
     * Add a data client to the list of clients
     * @param {DataClient} dataClient 
     */
    registerClient(dataClient){
        this._clients[dataClient.id] = dataClient;
    }

    /**
     * Remove a data client from the list of clients. Will call unsubscribeAll() for this client.
     * @param {string | DataClient} client The id of the client, or the client object containing an id.
     */
    unregisterClient(client){
        try{
            let clientID;
            if(typeof client == "string"){
                clientID = client;
            }
            else{
                clientID = client.id;
            }
            this.unsubscribeAll(clientID)
            .catch((err) => {
                this.log.error(err);
            }).finally( () => {
                delete this._clients[clientID];
            });
        }
        catch(err){
            this.log.error(err);
        }
    }

    
} // class DataBroker