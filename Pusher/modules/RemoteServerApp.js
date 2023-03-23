

import express from 'express';
import http from 'http';
import { io } from "socket.io-client"; 
//import cors from 'cors';
//import path from 'path';
import { RemoteLogger } from './RemoteLogger.js';
import { EventLogger } from "node-windows";

import { Pusher } from './Pusher.js';

export class RemoveServerApp{

    constructor(serverConfig){
        this._serverConfig = serverConfig;
        this.eventLogger = new EventLogger("Data Pusher")

        // local logger and data pusher
        this._ioClient = io(this._serverConfig.PLCloggerURL);
        this._logger = new RemoteLogger(this._ioClient, this._serverConfig.loggingConfig);
        this._logger.on("log", (...args) => this.logMessage(args));
        this._pusher = new Pusher(this._serverConfig, this._logger);
        this._pusher.on("log", (...args) => this.logMessage(args));

        this._ioClient.on("connect", () => {
            this._ioClient.emit("createRemoteLoggingClient");
            this._ioClient.emit("remoteLoggingStarted");
            this._pusher.processPLCFiles();
        })

        // HTTP server
        this.expressApp = express();
        this.httpServer = http.createServer(this.expressApp);

        // HTTP routers
        this.expressApp.get("/info", (req, res) => {
            res.send(JSON.stringify({
                status: this._pusher.loggingStatus,
                LastData: this._logger.lastDataTime,
                Errors: this.errorQueue,
                Warns: this.warnQueue,
                Info: this.infoQueue
            }, null, 4))
        })

        this.httpServer.listen(this._serverConfig.port, () => {
            console.log(`Listening on port ${this._serverConfig.port}`);
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
        switch(msgType){
            case "info":
                while (this.infoQueue.length >= this.maxLog) { this.infoQueue.shift(); }
                this.infoQueue.push("Info " + new Date() + ": " + args[1]);
                break;

            case "warn":
                while (this.warnQueue.length >= this.maxLog) { this.warnQueue.shift(); }
                this.warnQueue.push("Warn " + new Date() + ": " + args[1]);
                break;

            case "error":
                while (this.errorQueue.length >= this.maxLog) { this.errorQueue.shift(); }
                this.errorQueue.push("ERROR " + new Date() + ": " + args[1]);
                break;
        }
    }
}