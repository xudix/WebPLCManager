

import express from 'express';
import http from 'http';
// import { io } from "socket.io-client"; 
//import cors from 'cors';
//import path from 'path';
// import { RemoteLogger } from './RemoteLogger.js';
import * as fs from "fs/promises";
import { EventLogger } from "node-windows";

import { Pusher } from './Pusher.js';

export class RemoveServerApp{

    constructor(serverConfig){
        this._serverConfig = serverConfig;
        this.eventLogger = new EventLogger("Data Pusher")

        // local logger and data pusher
        // this._ioClient = io(this._serverConfig.PLCloggerURL);
        // this._logger = new RemoteLogger(this._ioClient, this._serverConfig.loggingConfig);
        // this._logger.on("log", (...args) => this.logMessage(args));
        this._pusher = new Pusher(this._serverConfig, this._logger);
        this._pusher.on("log", (...args) => this.logMessage(args));

        // this._ioClient.on("connect", () => {
        //     this._ioClient.emit("createRemoteLoggingClient");
        //     this._ioClient.emit("remoteLoggingStarted");
        //     this._pusher.processPLCFiles();
        // })

        // HTTP server
        this.expressApp = express();
        this.httpServer = http.createServer(this.expressApp);

        // HTTP routers
        this.loadAPIs().then(()=>{
            // This allows dynamic router reload
            this.expressApp.use((req, res, next) => {
                this._router(req, res, next);
            })
        })
        this.expressApp.put("/api/load-api", (req, res) => {
            this.loadAPIs();
            res.sendStatus(200);
        })

        this.httpServer.listen(this._serverConfig.port, () => {
            console.log(`Listening on port ${this._serverConfig.port}`);
        })


    }

    async loadAPIs(){
        this._router = express.Router(); // Create a new router to clear old routes
        fs.readdir("./modules/APIs/").then(async (files) => {
            files.forEach((file) => {
                if(file.endsWith(".js")){
                    console.log(`Importing ${file}`);
                    import("./APIs/"+file)
                        .then((module) => {
                            //console.log(module);
                            module.load.call(this);
                        })
                }
            })
        })

    }

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