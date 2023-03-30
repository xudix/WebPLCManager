import { GenericController } from "./genericController.js";
import ads from "ads-client";


/**
 * Controller object based on ads-client library
 */
export class ADSController extends GenericController{
    // setting up the ADS client
    
    /**
     * Object containing all subscriptions at this point. 
     * -Property names are the symbol names of each subscribed symbol.
     * -Property value is a notification object containing the handle and other info
     */
    subscriptions = {};
    /**
     * Object containing handles created on the PLC from variable names. Use this to subscribe to pointer and reference types. 
     * Handles should be released if not needed anymore.
     */
    handles = {}; // 

    


    get isConnected(){
        return this._isConnected && this.client.connection.connected;
    }

    _isConnected = false;

    /**
     * 
     * @param {*} config see the documentation for ads-client library for required parameters in the config
     */
    constructor(config){
        super();
        this._config = config;
        this.name = config.name || config.targetAdsPort.toString();  // use the port number as controller name here
        this.client = new ads.Client(config);
        this._addEventHandlers();
        this._connect();
        
    }

    _addEventHandlers(){
        this.client.on('connectionLost', () => {
            this._isConnected = false;
        });
        this.client.on('reconnect', () => {
            this._isConnected = true;
            this._resubscribeHandles();
            
        });
        this.client.on('disconnect', () => {
            this._isConnected = false;
        });
        this.client.on('connect', connectionInfo => {
            console.log(connectionInfo);
            this._isConnected = true;
        });
    }
    


    // Try to connect to the target system. Return a Promise.
    _connect(){
        this.client.connect()   // retry after anything happened
        .then((res) =>{
            console.log(`Connected to the ${res.targetAmsNetId}`)
            console.log(`Router assigned us AmsNetId ${res.localAmsNetId} and port ${res.localAdsPort}`)
        })
        .catch((err) => {
            console.error('Failed to Connect to ADS Target:', err);
            setTimeout(() => {
                this._connect();
            }, this._config.retryTime);
        });
    }

    // Try to disconnect from the target system. Return a Promise.
    _disconnect(){
        return this.client.disconnect();
    }

    /**
     * Try to get the data types from the target system. 
     * @returns Promise. If resolved, datatypes object is returned.
     */
    getDataTypes(){
        return new Promise((resolve, reject) => {
            this.client.readAndCacheDataTypes()
                .then( adsTypesData => {
                    let typesObj = {};
                    for(let key in adsTypesData){ // Convert the data from the ads-client lib to a format we want
                        typesObj[key] = {
                            name: adsTypesData[key].name,
                            baseType: adsTypesData[key].type == "" ? adsTypesData[key].name : adsTypesData[key].type,
                            comment: adsTypesData[key].comment,
                            size: adsTypesData[key].size,
                            subItemCount: adsTypesData[key].subItemCount,
                            subItems: [],
                            arrayDimension: adsTypesData[key].arrayDimension,
                            arrayInfo: adsTypesData[key].arrayData,
                            enumInfo: {},
                            isPersisted: false
                        }
                        adsTypesData[key].subItems.forEach((subItem) => {
                            typesObj[key].subItems.push({
                                name: subItem.name,
                                type: subItem.type,
                                comment: subItem.comment,
                                isPersisted: ((subItem.flags >> 8) & 1) == 1
                            });
                        });
                        if(adsTypesData[key].enumInfo != undefined){
                            adsTypesData[key].enumInfo.forEach((enumObj) => {
                                typesObj[key].enumInfo[enumObj.name] = ads.ADS.BASE_DATA_TYPES.fromBuffer({}, typesObj[key].baseType, enumObj.value);
                            })
                        }

                    } // for let key in adsTypesData
                    this.adsTypesData = typesObj;
                    resolve(typesObj);
                })
                .catch(err => reject(err));
        })
    }

    // Try to get the symbols from the target system. Return a Promise<symbols>.
    getSymbols(){
        return new Promise((resolve, reject) => {
            this.client.readAndCacheSymbols()
                .then( adsSymsData => {
                    let symsObj = {};
                    for(let key in adsSymsData){
                        symsObj[key] = {
                            name: adsSymsData[key].name,
                            type: adsSymsData[key].type,
                            comment: adsSymsData[key].comment,
                            isPersisted: (adsSymsData[key].flags & 1) == 1
                        }
                    } // for let key in adsSymsData
                    this.adsSymsData = symsObj;
                    resolve(symsObj);
                })
                .catch(err => reject(err));
        })
    }

    // Try to subscribe to a symbol for cyclic reading from the target system.
    // symbolName: string is the name of the requested symbol.
    // callback: Callback function that is called when reading is received
    // The callback function takes one object input {value: any, symbolName: string, type: string, timeStamp: Time}
    // interval: ms, time between readings
    // Return a Promise<object>. The object is the subscription object.
    subscribeCyclic(symbolName, callback, interval){
        return this._subscribe(symbolName, callback, interval, false);
    }

    // Try to subscribe to a symbol for changes from the target system.
    // symbolName: string is the name of the requested symbol.
    // callback: Callback function that is called when reading is received
    // Return a Promise<object>.
    subscribeOnChange(symbolName, callback){
        return this._subscribe(symbolName, callback, 1, true);
    }

    // Try to unsubscribe to a symbol from the target system. Return a Promise<object>.
    // symbolName: string is the name of the requested symbol.
    unsubscribe(symbolName){
        return new Promise((resolve, reject) => {
            if(this.subscriptions[symbolName] == undefined){
                reject(new Error(`${symbolName} is not subscribed.`));
            }
            else{
                this.client.unsubscribe(this.subscriptions[symbolName].notificationHandle)
                    .then(res => {
                        delete this.subscriptions[symbolName];
                        if(this.handles[symbolName]){
                            this.client.deleteVariableHandle(this.handles[symbolName].handle)
                                .catch(err => console.error(err));
                            delete this.handles[symbolName];
                        }
                        resolve(res);
                    })
                    .catch(err => reject(err));
            }
        })
    }

    // Try to unsubscribe to all symbols from the target system. Return a Promise<object>.
    unsubscribeAll(){
        return new Promise((resolve, reject) => {
            this.client.unsubscribeAll()
                .then( res => {
                    this.subscriptions = {};
                    let handleArray = [];
                    for(let symbolName in this.handles){
                        handleArray.push(this.handles[symbolName]);
                    }
                    if(handleArray.length > 0){
                        this.client.deleteVariableHandleMulti(handleArray).catch(err => console.error(err));
                        this.handles = {};
                    }
                    resolve(res);
                })
                .catch(err => reject(err));
        });
    }

    // Try to read a symbol's value from the target system. Return a Promise<object>.
    // symbolName: string is the name of the requested symbol.
    readSymbolValue(symbolName){
        return new Promise((resolve, reject) => {
            this.client.readSymbol(symbolName).then(res => {
                reolve(res.value);
            })
            .catch(err => reject(err));
        });
    }

    // Try to write a symbol's value to the target system. Return a Promise<object>.
    // symbolName: string is the name of the requested symbol.
    writeSymbolValue(symbolName, value){
        return this.client.writeSymbol(symbolName, value, true);
    }

    // Try to get the symbol's data type (string) by the symbol's full name
    // symbolName: string is the name of the requested symbol.
    // Return a string for the data type
    getSymbolTypeByName(symbolName){
        return new Promise((resolve, reject) => {
            this.client.getSymbolInfo(symbolName).then((res) => {
                resolve(res.type)
            })

        })
    }

    // Try to subscribe to a symbol for cyclic reading from the target system.
    // symbolName: string is the name of the requested symbol.
    // callback: Callback function that is called when reading is received
    // The callback function takes one object input {value: any, symbolName: string, type: string, timeStamp: Time}
    // interval: ms, time between readings
    // Return a Promise<object>. The object is the subscription object.
    _subscribe(symbolName, callback, interval, onChange){
        return new Promise((resolve, reject) =>{
            let adsCallBack;
            this.client.getSymbolInfo(symbolName).then((symbolInfo) => { // check if the symbol is a pointer or reference type
                if (symbolInfo.indexGroup > ads.ADS.ADS_RESERVED_INDEX_GROUPS.SymbolValueByHandle &&
                    symbolInfo.indexGroup < ads.ADS.ADS_RESERVED_INDEX_GROUPS.IOImageRWIB)
                // Pointer seems to have indexGroup of 0xF014, and reference has indexGroup of 0xF016. Not sure if other cases exist.
                // The range set here is (0xF005, 0xF020)
                {
                    // Need to create a handle, then subscribe to that handle. Cannot directly subscribe to that name.
                    this.client.createVariableHandle(symbolName).then(async (handleInfo) => {
                        this.handles[symbolName] = handleInfo;
                        this.handles[symbolName].callback = callback;   // save the callback here so that it can be restored during resubscription
                        if(this.adsTypesData == undefined){
                            await this.getDataTypes();
                        }
                        let symbolType = this.adsTypesData[symbolInfo.type.toLowerCase()];
                        adsCallBack = (data, subsObj) => {
                            this.client.convertFromRaw(data.value, symbolType.baseType).then( (result) => {
                                callback({
                                    value: result,
                                    symbolName: symbolName,
                                    type: symbolType.name,
                                    timeStamp: data.timeStamp
                                });
                            })
                            .catch(err => console.error(err));
                        }
                        this.client.subscribeRaw(ads.ADS.ADS_RESERVED_INDEX_GROUPS.SymbolValueByHandle, handleInfo.handle, symbolType.size, adsCallBack, interval, onChange)
                            .then(res => {
                                this.subscriptions[symbolName] = res;
                                resolve(res);
                            })
                            .catch(err => reject(err))
                    })
                    .catch(err => reject(err))
                }
                else { // Not a reference or pointer. Directly subscribe to it by name.
                    adsCallBack = function(data, subsObj){
                        callback({
                            value: data.value,
                            symbolName: symbolName,
                            type: data.type.type,
                            timeStamp: data.timeStamp
                        });
                    }
                    this.client.subscribe(symbolName, adsCallBack, interval, onChange)
                        .then(res => {
                            this.subscriptions[symbolName] = res;
                            resolve(res);
                        })
                        .catch(err => reject(err));
                }
            })
            .catch(err => reject(err));

        })
    }

    /**
     * This is function is used for reestablishing subscriptions to handles (reference and pointer types) after a controller reconnect (restart)
     */
    _resubscribeHandles(){
        Object.keys(this.handles).forEach((symbolName) => {
            let subObject = this.subscriptions[symbolName];
            this._subscribe(symbolName, this.handles[symbolName].callback, subObject.settings.cycleTime, subObject.settings.transmissionMode == 4)
                .catch(err => console.error(`failed to resubscribe to ${symbolName}`, err))
        })
    }
    

}