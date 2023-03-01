// Event handlers for socket connection
import { watchEventHandlers } from './watchEventHandlers.js';
import * as utilities from './utilityFunctions.js';
import express from 'express';
import http from 'http';
import { Server as SocketIOServer } from 'socket.io';

// Server object that handles HTTP, socket, and manages subscriptions from different clients
// Use socket.io to handle data transfer
export class ServerApp{
    
    // Properties for Watch App management
    _accumulatingSubsData = false;
    _watchClientsObj = {}; // An object of Watch clients.
        // Each property name is the socket id of the client

    // An object of subscribed symbols.
    _subscriptionsObj = {}; 
        // Each property name is symbol name, and property value is an array of client ID that subscribed to this symbol




    constructor(serverConfig, controller) {
        this.config = serverConfig;
        console.log(this.config)

        // HTTP server
        this.expressApp = express();
        this.httpServer = http.createServer(this.expressApp);
        this.ioServer = new SocketIOServer(this.httpServer, {cors: serverConfig.cors});
        
        // Connect to controller
        this.controller = controller;
        // this.controller.on("connect", () =>{
        //     this.getDataTypes();
        //     this.getSymbols();
        // })
        this.controller.connect().then((res) =>{
            console.log(`Connected to the ${res.targetAmsNetId}`)
            console.log(`Router assigned us AmsNetId ${res.localAmsNetId} and port ${res.localAdsPort}`)
        })
        .catch(err =>{
            console.error('Failed to Connect to ADS Target:', err);
        })

        // For socket connection: define actions 
        this.ioServer.on("connection", socket =>{
            const client = new ClientRecord(this, socket);
            utilities.pipe(watchEventHandlers)(client);   // more event handlers can be added to pipe

            this._watchClientsObj[socket.id] = client;
            
            socket.on("disconnect", (reason) => {
                console.log(`Socket ${socket.id} has disconnected`)
                this.unsubscribeAll(socket.id);
                delete this._watchClientsObj[socket.id];
            });

            this.getDataTypes();
            this.getSymbols();
            console.log(`Socket ${socket.id} has connected`);
        });



        this.httpServer.listen(this.config.port, () => {
            console.log(`Listening on port ${serverConfig.port}`);
        })


    }

    // Try to get the data types from the target system.
    getDataTypes(){
        this.controller.getDataTypes().then( dataTypes => {
            this.ioServer.emit("dataTypes", dataTypes);
            this.dataTypes = dataTypes;
            console.log(`Data types updated: ${Object.keys(dataTypes).length} data types found.`)
        })
        .catch(err => {
            console.error("Failed to read data types.", err);
            this.ioServer.emit("error", new Error(`Failed to read data types.`));
        });
    }

    // Try to get the symbols from the target system.
    getSymbols(){
        this.controller.getSymbols().then( symbols => {
            this.ioServer.emit("symbols", symbols);
            this.symbols = symbols;
            console.log(`Symbols updated: ${Object.keys(symbols).length} symbols found.`)
        })
        .catch(err => {
            console.error("Failed to read symbols.", err);
            this.ioServer.emit("error", new Error(`Failed to read symbols.`));
        });
    }

    // Try to subscribe to a symbol for cyclic reading from the target system.
    // symbolName: string is the name of the requested symbol.
    subscribeCyclic(clientID, symbolName){
        if(this._subscriptionsObj[symbolName] === undefined || this._subscriptionsObj[symbolName].length == 0){ // This symbol was not subscribed to
            this.controller.subscribeCyclic(symbolName, (data) => this.dispatchSubscriptions.call(this, data), this.config.subscriptionInterval)
                .then((res) => {
                    this._subscriptionsObj[symbolName] = [clientID];
                    this._watchClientsObj[clientID].subscriptions.push(symbolName);
                    this._watchClientsObj[clientID].sendSubscriptionList();
                })
                .catch(err => {
                    this._watchClientsObj[clientID].socket.emit("error", new Error(`Failed to subscribe to symbol ${symbolName}`));
                    console.error(`Failed to subscribe to symbol ${symbolName}`, err)
                });
        }
        else{
            if(!this._subscriptionsObj[symbolName].includes(clientID)){ // this symbol is not already subscribed by this client
                this._subscriptionsObj[symbolName].push(clientID);
                this._watchClientsObj[clientID].subscriptions.push(symbolName);
                this._watchClientsObj[clientID].sendSubscriptionList();
            }
        }
    }

    // Try to subscribe to a symbol for changes from the target system.
    // symbolName: string is the name of the requested symbol.
    subscribeOnChange(clientID, symbolName){
        throw new Error("subscribeOnChange() method is not implemented!");
    }

    // Try to unsubscribe to a symbol from the target system. Return a Promise<object>.
    // symbolName: string is the name of the requested symbol.
    unsubscribe(clientID, symbolName){
        let idx = this._subscriptionsObj[symbolName].indexOf(clientID);
        if(idx > -1){
            this._subscriptionsObj[symbolName].splice(idx, 1);
            idx = this._watchClientsObj[clientID].subscriptions.indexOf(symbolName);
            if(idx > -1){
                this._watchClientsObj[clientID].subscriptions.splice(idx, 1);
                this._watchClientsObj[clientID].sendSubscriptionList();
            }
        }
        if(this._subscriptionsObj[symbolName].length == 0){ // no one is subscribing to this anymore
            this.controller.unsubscribe(symbolName).catch(err => console.error(`Failed to subscribe to ${symbolName}`, err));
        }
    }

    // Try to unsubscribe to all symbols from the target system. Return a Promise<object>.
    unsubscribeAll(clientID){
        this._watchClientsObj[clientID].subscriptions.forEach((symbolName) => {
            let idx = this._subscriptionsObj[symbolName].indexOf(clientID);
            if (idx > -1) {
                this._subscriptionsObj[symbolName].splice(idx, 1);
            }
            if (this._subscriptionsObj[symbolName].length == 0) { // no one is subscribing to this anymore
                this.controller.unsubscribe(symbolName).catch(err => console.error(`Failed to subscribe to ${symbolName}`, err));
            }
        });
        this._watchClientsObj[clientID].subscriptions = [];
        this._watchClientsObj[clientID].sendSubscriptionList();
    }

    // Try to read a symbol's value from the target system. Return a Promise<object>.
    // symbolName: string is the name of the requested symbol.
    readSymbolValue(clientID, symbolName){
        this.controller.readSymbolValue(symbolName)
            .then((value) => {
                watchClientsObj[clientID].socket.emit("symbolValue", {symbolName: symbolName, value: value});
            })
            .catch( err => {
                watchClientsObj[clientID].socket.emit("error", new Error(`Failed to read symbol ${symbolName}`));
                console.error(`Failed to read symbol ${symbolName}`, err);
            });
    }

    // Try to write a symbol's value to the target system. Return a Promise<object>.
    // symbolName: string is the name of the requested symbol.
    // value: string, number, or other things that can be written to PLC
    writeSymbolValue(clientID, symbolName, valueStr){
        //let newValue = await this.strToType(symbolName, valueStr)
        //console.log(`${symbolName}: ${newValue}`)
        //this.controller.writeSymbolValue(symbolName, newValue)
        this.controller.writeSymbolValue(symbolName, valueStr) // Looks like I can just pass a string to it???
            .catch( err => {
                this._watchClientsObj[clientID].socket.emit("error", new Error(`Failed to write symbol ${symbolName}`, err));
                console.error(`Failed to write symbol ${symbolName}`, err);
            });
    }

    // callback function for subscription.
    // This method is called when subscription data is received from the controller
    dispatchSubscriptions(data){ // data: {value: any, symbolName: string, type: string, timeStamp: Time}
        if(typeof data.symbolName != "string")
            throw new  Error("Not Implemented in dispatchSubscriptions(): Unable to dispatch subscriptions without symbol name.");
        // put values to the client objects
        
        this._subscriptionsObj[data.symbolName].forEach((clientID) => {
            this._watchClientsObj[clientID].subscribedData[data.symbolName] = data.value;
        });
        
        if(!this._accumulatingSubsData){ // First data received. Start accumulating them
            this._accumulatingSubsData = true;
            setTimeout(() => { // after the subscription interval from receiving the first data, send the accumulated data out.
                for(let clientID in this._watchClientsObj){
                    this._watchClientsObj[clientID].sendSubscribedData();
                }
                this._accumulatingSubsData = false;
            }, this.config.subscriptionInterval/2);
        }

    } // dispatchSubscriptions()

    /*
    // Convert the string representation of the value to the correct type for the given symbol
    async strToType(symbolName, valueStr){
        let value = "";
        await this.controller.getSymbolTypeByName(symbolName).then((type) => {
            console.log(`Type of ${symbolName} is ${type}.`);
            value = valueStr;
        })
        .catch(err => {throw err});
        return value;
    }
    */


}// class ServerApp

class ClientRecord{
    subscriptions = []; // string[], names of subscribed symbols
    subscribedData = {}; // object that contains the subscribed data in key-value pairs, i.e. {symbolName: value}

    constructor(server, socket){
        this.server = server;
        this.socket = socket;
    }

    sendSubscribedData(){
        this.socket.emit("subscribedData", this.subscribedData);
        this.subscribedData = {};
    }

    sendSubscriptionList(){
        this.socket.emit("watchListUpdated", this.subscriptions)

    }
}