const path = require('node:path');
// setup ADS controller
const adsconfig851 = require("../ADSLocal851Config.json");
const adsconfig852 = require("../ADSLocal852Config.json");
const logging851 = require("../screen1logging.json")
const logging852 = require("../screen2logging.json")

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
            logPath: path.join(__dirname, "data"),
            logFileTime: 10000,
            logConfigs: [logging851,logging852]
        }
        serverApp = new serverModule.ServerApp(serverConfig, [controller851, controller852], loggingConfig);
    })
    .catch(err => {throw err});








