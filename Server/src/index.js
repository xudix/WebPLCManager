// setup ADS controller
const adsconfig851 = require("./configs/ADSLocal851Config.json");
//const adsconfig852 = require("./configs/ADSLocal852Config.json");
const serverConfig = require("./configs/PLCServerConfig.json");
const serialConfigs = require("./configs/serialConfig_test.json");

// Create controller instance here so that the ServerApp is not specific to ADS
import("./modules/ADSController.js")
    .then(ads => {
        controller851 = new ads.ADSController(adsconfig851);
        //controller852 = new ads.ADSController(adsconfig852);
        return import("./modules/PLCServerApp.js")
    })
    .then(serverModule => {
        serverApp = new serverModule.ServerApp({...serverConfig}, [controller851]);
    })
    .catch(err => {throw err});








