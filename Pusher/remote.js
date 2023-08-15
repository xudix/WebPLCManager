let serverConfig = require("./config").get("PushServer_FCSA");

import("./modules/RemoteServerApp.js")
.then(serverModule => {
    serverApp = new serverModule.RemoveServerApp(serverConfig);
})
.catch(err => {throw err});

    








