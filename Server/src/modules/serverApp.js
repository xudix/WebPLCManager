
import { ADSController } from './ADSController.js';
import { DataBroker } from './DataBroker.js';
import { WatchClient, LoggingClient } from './DataClients.js';
import { GenericController } from './genericController.js';


import express from 'express';
import http from 'http';
import { Server as SocketIOServer } from 'socket.io';
import path from 'path';
import { Interface } from 'readline';


// New version of server.js. Changing the structure of things

export class ServerApp{


    /**
     * A name-value collection of controllers
     * @type {Record<string, GenericController>}
     */
    _controllers = {}; // GenericController object


    // controllers: array of GenericController, or Record<string, GenericController> where string is the controller name
    /**
     * 
     * @param {{port: number, cors: {origin:string, methods: string[]}, subscriptionInterval: number, rootPath: string}} serverConfig Configurations for the server. Current fields: {port: number, cors: {origin:string, methods: string[]}, subscriptionInterval: number, rootPath: string}
     * @param {GenericController[]} controllers 
     * @param {{logPath: string, 
     *          logFileTime: number, 
     *          logConfigs: {bucket: string,
     *                       measurement: string,
     *                       name: string,
     *                       tags: {field: string, tag: string}[]
     *                      }[]
     *          }} loggingConfig  Configuration for logging.
     *  - logPath is where the log files will be stored
     *  - logFileTime, in miliseconds, specifies the max time duration for a single data file. After this time, a new file will be created.
     *  - name is the controller's name, which should match the name in the controller object
     *  - tag is the full symbol name in the PLC
     *  - bucket, measurement, and field is the name of this entry in the data base.
     * 
     */
    constructor(serverConfig, controllers, loggingConfig){
        this._serverConfig = serverConfig;
        this._loggingConfigs = loggingConfig;

        // convert controllers into name-value pairs
        if(controllers.name != undefined){ // it's a single controller object
            this._controllers[controllers.name] = controllers;
        }
        else{
            for(let key in controllers){
                if(controllers[key].name != undefined){
                    this._controllers[controllers[key].name] = controllers[key];
                }
                else{
                    throw new Error(`Unknown input Controllers ${controllers}`);
                }
            }
        }
        
        // HTTP server
        this.expressApp = express();
        this.httpServer = http.createServer(this.expressApp);
        this.ioServer = new SocketIOServer(this.httpServer, {cors: serverConfig.cors});

        // Data Broker
        this.dataBroker = new DataBroker(this._controllers, {subscriptionInterval: serverConfig.subscriptionInterval});
        this.dataBroker.on("broadcast", (message) => {
            this.ioServer.emit("broadcast", message);
        })
        
        // Logging client
        this.loggingClient = new LoggingClient("logging", this._serverConfig.subscriptionInterval*0.8, this.dataBroker, loggingConfig);

        // Watch clients: create one when a socket client is connected
        this.ioServer.on("connection", socket =>{
            const client = new WatchClient(socket.id, this._serverConfig.subscriptionInterval/2, this.dataBroker, socket, this.loggingClient);            
            
            socket.on("disconnect", (reason) => {
                console.log(`Socket ${socket.id} has disconnected`);
                this.dataBroker.unregisterClient(socket.id);
            });

            this.dataBroker.getControllerStatus();

            console.log(`Socket ${socket.id} has connected`);
        });


        // HTTP responses
        this.expressApp.use(express.static(path.join(this._serverConfig.rootPath,'client')));

        this.expressApp.get("/", (req, res) => {
            res.sendFile(path.join(this._serverConfig.rootPath, 'client', 'index.html'));
          });

        this.httpServer.listen(this._serverConfig.port, () => {
            console.log(`Listening on port ${this._serverConfig.port}`);
        })
        

    }

}