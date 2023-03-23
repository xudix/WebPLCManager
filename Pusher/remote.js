let serverConfig = require("./config").get("PushServer_Plasma");

import("./modules/RemoteServerApp.js")
.then(serverModule => {
    serverApp = new serverModule.RemoveServerApp(serverConfig);
})
.catch(err => {throw err});

    








