import { GenericController } from "./genericController.js";
import ads from "ads-client";


// Client object from ads-client library.
export class ADSController extends GenericController{
    // setting up the ADS client
    
    
    subscriptions = {}; // Object containing all subscriptions at this point. Property names are the symbol names of each subscribed symbol.
    get isConnected(){
        return this.client.connection.connected;
    }

    // Takes a config object to setup the connection
    constructor(config){
        super();
        this.client = new ads.Client(config);
        
    }
    


    // Try to connect to the target system. Return a Promise.
    connect(){
        return this.client.connect();
    }

    // Try to disconnect from the target system. Return a Promise.
    disconnect(){
        return this.client.disconnect();
    }

    // Try to get the data types from the target system. Return a Promise<dataTypes>.
    getDataTypes(){
        return new Promise((resolve, reject) => {
            this.client.readAndCacheDataTypes()
                .then( adsTypesData => {
                    let typesObj = {};
                    for(let key in adsTypesData){
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
        let adsCallBack = function(data, subsObj){
            callback({
                value: data.value,
                symbolName: subsObj.target,
                type: data.type.type,
                timeStamp: data.timeStamp
            })
        }
        return new Promise((resolve, reject) => {
            this.client.subscribe(symbolName, adsCallBack, interval, false)
                .then( res => {
                    this.subscriptions[symbolName] = res;
                    resolve(res);
                })
                .catch(err => reject(err));
        });
    }

    // Try to subscribe to a symbol for changes from the target system.
    // symbolName: string is the name of the requested symbol.
    // callback: Callback function that is called when reading is received
    // Return a Promise<object>.
    subscribeOnChange(symbolName, callback){
        return new Promise((resolve, reject) => {
            this.client.subscribe(symbolName, callback)
                .then( res => {
                    this.subscriptions[symbolName] = res;
                    resolve(res);
                })
                .catch(err => reject(err));
        });
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

    

}