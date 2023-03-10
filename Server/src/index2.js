// setup ADS controller
const adsconfig = require("../ADSLocal852Config.json");

// Hopefully the rest is platform independent
// configs, will move to json in the future
serverConfig = {
    port: 2334,
    cors: {
        origin: "http://localhost:4200",
        methods: ["GET", "POST"]
    },
    subscriptionInterval: 1000, // ms, time between readings
    rootPath: __dirname,
};

import("./modules/ADSController.js")
    .then(ads => {
        controller = new ads.ADSController(adsconfig);
        return import("./modules/server.js")
    })
    .then(serverModule => {
        serverApp = new serverModule.ServerApp(serverConfig, controller);
    })
    .catch(err => {throw err});








