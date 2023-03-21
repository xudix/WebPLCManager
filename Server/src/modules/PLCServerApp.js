
import { DataBroker } from './DataBroker.js';
import { WatchClient, PLCLoggingClient } from './DataClients.js';
import { GenericController } from './genericController.js';


import express from 'express';
import http from 'http';
import { Server as SocketIOServer } from 'socket.io';
import path from 'path';
import cors from 'cors';


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
     *          clientPath: string,
     *          loggingConfig: { 
     *              configPath: string,
     *              logPath: string,
     *              logFileTime: number,
     *              bucket: string,
     *              }
     *          }} serverConfig Configurations for the server. Current fields: {port: number, cors: {origin:string, methods: string[]}, subscriptionInterval: number}
     *  - logPath is where the log files will be stored
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
        
        // Logging client
        this.loggingClient = new PLCLoggingClient("logging", this._serverConfig.subscriptionInterval/2, this.dataBroker, this._serverConfig.loggingConfig);

        // Watch clients: create one when a socket client is connected
        this.ioServer.on("connection", socket =>{
            socket.on("createWatchClient", () => {
                new WatchClient(socket.id, this._serverConfig.subscriptionInterval/2, this.dataBroker, socket, this.loggingClient);            
                socket.on("disconnect", (reason) => {
                    console.log(`Socket ${socket.id} has disconnected`);
                    this.dataBroker.unregisterClient(socket.id);
                });
            })
            
            socket.on("createRemoteLoggingClient", () => {
                this.loggingClient.remoteSocket = socket;
                console.log("Remote logging client connected.")

                socket.on("remoteLoggingStarted", () => {
                    this.loggingClient.writeToLocalFile = false;
                })

                socket.on("disconnect", () => {
                    this.loggingClient.writeToLocalFile = true;
                    this.loggingClient.remoteSocket = undefined;
                    console.log("Remote logging client disconnected.")
                })

            })
            

            this.dataBroker.getControllerStatus();

            console.log(`Socket ${socket.id} has connected`);
        });


        // HTTP routers
        this.expressApp.use(express.static(this._serverConfig.clientPath));
        this.expressApp.use(express.text());
        this.expressApp.use(cors())

        this.expressApp.get("/api/log-status", (req, res) => {
            res.json({subsSucceeded: this.loggingClient.subsSucceeded, subsFailed: this.loggingClient.subsFailed});
        });

        /**
         * The GET method for /api/log-file/ will perform a switch file, then return the new data file name
         */
        this.expressApp.get("/api/log-file", (req, res) => {
            if(this.loggingClient !== undefined){
                this.loggingClient.switchFile()
                    .then((newFileName) => {
                        res.status(200).send(newFileName);
                    })
                    .catch((err) => {
                        res.status(500).send(err);
                    })
            }
        });

        this.expressApp.delete("/api/log-file/:fileName",(req, res) => {
            let fileName = req.params.fileName;
            if(this.loggingClient !== undefined){
                this.loggingClient.deleteDataFile(fileName)
                    .then(() => {
                        res.sendStatus(200);
                    })
                    .catch((err) => res.status(500).send(`Delete ${fileName} failed.`));
            }
            else{
                res.status(400).send("Logging Client is not running.");
            }
        })

        this.expressApp.get("/", (req, res) => {
            res.sendFile(path.join(this._serverConfig.clientPath, 'index.html'));
          });

        this.httpServer.listen(this._serverConfig.port, () => {
            console.log(`Listening on port ${this._serverConfig.port}`);
        })
        

    }

}