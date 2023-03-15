const path = require('node:path');
// setup ADS controller
const adsconfig851 = require("./configs/ADSLocal851Config.json");
const adsconfig852 = require("./configs/ADSLocal852Config.json");
const logging851 = require("./configs/ScreeningReactor1logging.json")
const logging852 = require("./configs/ScreeningReactor2logging.json")

// Hopefully the rest is platform independent
// configs, will move to json in the future
serverConfig = {
    port: 2333,
    cors: {
        origin: "http://localhost:4200",
        methods: ["GET", "POST"]
    },
    subscriptionInterval: 1000, // ms, time between readings
    rootPath: __dirname,
};

import("./modules/ADSController.js")
    .then(ads => {
        controller851 = new ads.ADSController(adsconfig851);
        controller852 = new ads.ADSController(adsconfig852);
        return import("./modules/serverApp.js")
    })
    .then(serverModule => {
        let loggingConfig = {
            configPath: path.join(__dirname, "configs"),  // Configuration file will be stored to this path, with the name [controllerName]logging.json
            logPath: path.join(__dirname, "data"),
            logFileTime: 120000,
            logConfigs: []// [logging851,logging852]
        }
        serverApp = new serverModule.ServerApp(serverConfig, [controller851, controller852], loggingConfig);
    })
    .catch(err => {throw err});








