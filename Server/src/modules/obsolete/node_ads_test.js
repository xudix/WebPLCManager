
var ads = require('node-ads')

var options = {
    host: "172.16.20.100",
    amsNetIdTarget: "5.91.185.6.1.1",
    amsNetIdSource: "10.0.0.105.1.1",
    amsPortTarget: 851
}

var myHandle = {
    symname: 'Main.benchScale.centerHeaterCtrl.magna.status.volts',       
    bytelength: ads.LREAL,  

    //OPTIONAL: (These are set by default)       
    transmissionMode: ads.NOTIFY.CYCLIC,// (other option is ads.NOTIFY.CYCLIC)
    //maxDelay: 0,  -> Latest time (in ms) after which the event has finished
    cycleTime: 1000// -> Time (in ms) after which the PLC server checks whether the variable has changed
}



var client = ads.connect(options, function() {
    console.log("Connected")
    this.notify(myHandle)
})

client.on('notification', function(handle){
    console.log(handle.value)
})

process.on('exit', function () {
    console.log("exit")
})

process.on('SIGINT', function() {
    client.end(function() {
        process.exit()
    })
})

client.on('error', function(error) {
    console.log(error)
})