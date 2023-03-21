const path = require('node:path');
// setup ADS controller

// Hopefully the rest is platform independent
// configs, will move to json in the future
serverConfig = {
    port: 2333,
    cors: {
        origin: "http://localhost:4200",
        methods: ["GET", "POST", "DELETE"]
    },
    subscriptionInterval: 1000, // ms, time between readings
    rootPath: __dirname,
};

import("./modules/PLCServerApp.js")
.then(serverModule => {
    let loggingConfig = {
        configPath: path.join(__dirname, "configs"),  // Configuration file will be stored to this path, with the name [controllerName]logging.json
        logPath: path.join(__dirname, "data"),
        logFileTime: 120000,
        bucket: "DacLabTest",
        logConfigs: []// [logging851,logging852]
    }
    serverApp = new serverModule.ServerApp(serverConfig, [], loggingConfig);
})
.catch(err => {throw err});

    








