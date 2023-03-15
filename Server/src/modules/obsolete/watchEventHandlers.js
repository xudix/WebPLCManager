export function watchEventHandlers(client){

    client.socket.on("addWatchSymbol", (symbolName) => {
        client.server.subscribeCyclic(client.socket.id, symbolName);
    });

    client.socket.on("removeWatchSymbol", (symbolName) =>{
        client.server.unsubscribe(client.socket.id, symbolName);
    });

    client.socket.on("removeAllSymbols", () => {
        client.server.unsubscribeAll(client.socket.id);
    });

    client.socket.on("requestSymbols", () => {
        client.server.getDataTypes();
        client.server.getSymbols();
    });

    // Expected to receive an object of name-value pairs {symbolName: value}
    client.socket.on("writeNewValues", (newValuesObj) => {
        for(let symbolName in newValuesObj){
            client.server.writeSymbolValue(client.socket.id, symbolName, newValuesObj[symbolName]);
        }
        
    });

    return client;
}