
import { DataBroker } from './DataBroker.js';
import { WatchClient, PLCLoggingClient } from './DataClients.js';
import { GenericController } from './genericController.js';


import express from 'express';
import http from 'http';
import { Server as SocketIOServer } from 'socket.io';
import path from 'path';
import cors from 'cors';
import * as FileSystem from "node:fs/promises";


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
     * @param {{port: number, 
     *          cors: {origin:string, methods: string[]}, 
     *          subscriptionInterval: number, 
     *          clientDir: string,
     *          loggingConfig: { 
     *              configPath: string,
     *              logDir: string,
     *              logFileTime: number,
     *              bucket: string,
     *              }
     *          }} serverConfig Configurations for the server. Current fields: {port: number, cors: {origin:string, methods: string[]}, subscriptionInterval: number}
     *  - logDir is where the log files will be stored
     *  - logFileTime, in miliseconds, specifies the max time duration for a single data file. After this time, a new file will be created.
     *  - bucket is the name of bucket in the data base.
     * @param {GenericController[]} controllers 
     * 
     */
    constructor(serverConfig, controllers){
        this._serverConfig = serverConfig;

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
        this.ioServer = new SocketIOServer(this.httpServer, {cors: this._serverConfig.cors});

        // Data Broker
        this.dataBroker = new DataBroker(this._controllers, {subscriptionInterval: serverConfig.subscriptionInterval});
        this.dataBroker.on("broadcast", (message) => {
            this.ioServer.emit("broadcast", message);
        })
        this.dataBroker.on("log", (...args) => this.logMessage(args));
        
        // Logging client
        this.loggingClient = new PLCLoggingClient("logging", this._serverConfig.subscriptionInterval/2, this.dataBroker, this._serverConfig.loggingConfig);
        this.loggingClient.on("log", (...args) => this.logMessage(args));

        // Watch clients: create one when a socket client is connected
        this.ioServer.on("connection", socket =>{

            // This is for browser client
            socket.on("createWatchClient", () => {
                this.logMessage(["info", "Watch Client Requested."]);
                let client = new WatchClient(socket.id, this._serverConfig.subscriptionInterval/2, this.dataBroker, socket, this.loggingClient);
                client.on("log", (...args) => this.logMessage(args));
                socket.on("disconnect", (reason) => {
                    this.logMessage(["info", `Socket ${socket.id} has disconnected`]);
                    this.dataBroker.unregisterClient(socket.id);
                });
            })
            
            // This is for remote logger
            socket.on("createRemoteLoggingClient", () => {
                this.loggingClient.remoteSocket = socket;
                this.logMessage(["info", "Remote logging client connected."]);

                socket.on("remoteLoggingStarted", () => {
                    this.loggingClient.writeToLocalFile = false;
                    this.loggingClient.switchFile();
                })

                socket.on("disconnect", () => {
                    this.loggingClient.writeToLocalFile = true;
                    this.loggingClient.remoteSocket = undefined;
                    this.logMessage(["info", "Remote logging client disconnected."]);
                })

            })
            

            this.dataBroker.getControllerStatus();

            this.logMessage(["info", `Socket ${socket.id} has connected`]);
        });


        // HTTP routers
        this.loadAPIs()
        this.expressApp.put("api/load-api", (req, res) => {
            this.loadAPIs();
        })
        // this.expressApp.use(express.static(this._serverConfig.clientDir));
        // this.expressApp.use(express.text());
        // this.expressApp.use(cors())

        // this.expressApp.get("/api/log-status", (req, res) => {
        //     res.json({subsSucceeded: this.loggingClient.subsSucceeded, subsFailed: this.loggingClient.subsFailed});
        // });

        // /**
        //  * The GET method for /api/log-file/ will perform a switch file, then return the new data file name
        //  */
        // this.expressApp.get("/api/log-file", (req, res) => {
        //     if(this.loggingClient !== undefined){
        //         this.loggingClient.switchFile()
        //             .then((newFileName) => {
        //                 res.status(200).send(newFileName);
        //             })
        //             .catch((err) => {
        //                 res.status(500).send(err);
        //             })
        //     }
        // });

        // this.expressApp.delete("/api/log-file/:fileName",(req, res) => {
        //     let fileName = req.params.fileName;
        //     if(this.loggingClient !== undefined){
        //         this.loggingClient.deleteDataFile(fileName)
        //             .then(() => {
        //                 res.sendStatus(200);
        //             })
        //             .catch((err) => res.status(500).send(`Delete ${fileName} failed.`));
        //     }
        //     else{
        //         res.status(400).send("Logging Client is not running.");
        //     }
        // })

        // this.expressApp.get("/", (req, res) => {
        //     res.sendFile(path.join(this._serverConfig.clientDir, 'index.html'));
        //   });

        this.httpServer.listen(this._serverConfig.port, () => {
            this.logMessage(["info", `Listening on port ${this._serverConfig.port}`]);
        })
        

    }

    async loadAPIs(){
        FileSystem.readdir("./modules/APIs/").then(async (files) => {
            files.forEach((file) => {
                if(file.endsWith(".js")){
                    console.log(`Importing ${file}`);
                    import("./APIs/"+file)
                        .then((module) => {
                            console.log(module);
                            module.load.call(this);
                        })
                }
            })
        })

    }

    // variables for logging messages
    maxLog = 100;

    /**
     * @type {string[]}
     */
    infoQueue = [];

    /**
     * @type {string[]}
     */
    warnQueue = [];

    /**
     * @type {string[]}
     */
    errorQueue = [];

    /**
     * Handle messages (info, warn, or error) emitted by the logger and the pusher
     */
    logMessage(args){
        let msgType = args[0];
        let msg;
        switch(msgType){
            case "info":
                while (this.infoQueue.length >= this.maxLog) { this.infoQueue.shift(); }
                msg = "Info " + new Date() + ": " + args[1];
                console.info(msg);
                this.infoQueue.push(msg);
                break;

            case "warn":
                while (this.warnQueue.length >= this.maxLog) { this.warnQueue.shift(); }
                msg = "Warn " + new Date() + ": " + args[1];
                console.warn(msg);
                this.warnQueue.push(msg);
                break;

            case "error":
                while (this.errorQueue.length >= this.maxLog) { this.errorQueue.shift(); }
                msg = "ERROR " + new Date() + ": " + args[1];
                console.error(msg)
                this.errorQueue.push(msg);
                break;
        }
    }

}