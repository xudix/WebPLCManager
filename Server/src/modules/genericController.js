export class GenericController{

    /**
     * Indicate whether the client is connected
     * @type {boolean}
     */
    get isConnected(){
        return false;
    };
    error;          // object, error message from the client
    name;


    // Try to connect to the target system. Return a Promise.
    _connect(){
        return new Promise(function(resolve, reject){
            reject(new Error("connect() method is not implemented!"))
        })
    }

    // Try to disconnect from the target system. Return a Promise.
    _disconnect(){
        return new Promise(function(resolve, reject){
            reject(new Error("disconnect() method is not implemented!"))
        })
    }

    // Try to get the data types from the target system. Return a Promise<dataTypes>.
    getDataTypes(){
        return new Promise(function(resolve, reject){
            reject(new Error("getDataTypes() method is not implemented!"))
        })
    }

    // Try to get the symbols from the target system. Return a Promise<symbols>.
    getSymbols(){
        return new Promise(function(resolve, reject){
            reject(new Error("getSymbols() method is not implemented!"))
        })
    }

    // Try to subscribe to a symbol for cyclic reading from the target system.
    // symbolName: string is the name of the requested symbol.
    // callback: Callback function that is called when reading is received
    // interval: ms, time between readings
    // Return a Promise<object>.
    subscribeCyclic(symbolName, callback, interval){
        return new Promise(function(resolve, reject){
            reject(new Error("subscribe() method is not implemented!"))
        })
    }

    // Try to subscribe to a symbol for changes from the target system.
    // symbolName: string is the name of the requested symbol.
    // callback: Callback function that is called when reading is received
    // Return a Promise<object>.
    subscribeOnChange(symbolName, callback){
        return new Promise(function(resolve, reject){
            reject(new Error("subscribe() method is not implemented!"))
        })
    }

    // Try to unsubscribe to a symbol from the target system. Return a Promise<object>.
    // symbolName: string is the name of the requested symbol.
    unsubscribe(symbolName){
        return new Promise(function(resolve, reject){
            reject(new Error("unsubscribe() method is not implemented!"))
        })
    }

    // Try to unsubscribe to all symbols from the target system. Return a Promise<object>.
    unsubscribeAll(){
        return new Promise(function(resolve, reject){
            reject(new Error("unsubscribeAll() method is not implemented!"))
        })
    }

    // Try to read a symbol's value from the target system. Return a Promise<object>.
    // symbolName: string is the name of the requested symbol.
    readSymbolValue(symbolName){
        return new Promise(function(resolve, reject){
            reject(new Error("readSymbolValue() method is not implemented!"))
        })
    }

    // Try to write a symbol's value to the target system. Return a Promise<object>.
    // symbolName: string is the name of the requested symbol.
    writeSymbolValue(symbolName, value){
        return new Promise(function(resolve, reject){
            reject(new Error("writeSymbolValue() method is not implemented!"))
        })
    }

    primitiveTypes = new Set(['BOOL', 'BYTE', 'WORD', 'DWORD', 'SINT', 'USINT',
        'INT', 'UINT', 'DINT', 'UDINT', 'LINT', 'ULINT', 'REAL', 'LREAL', 'TIME']); 
    

}