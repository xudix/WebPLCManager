
import express from 'express';
import path from 'path';
import cors from 'cors';
import * as FileSystem from "node:fs/promises";

export function load() {
    console.log("loading APIs");
    
    this.expressApp.get("/info", (req, res) => {
        res.send(JSON.stringify({
            status: this._pusher.loggingStatus,
            Errors: this.errorQueue,
            Warns: this.warnQueue,
            Info: this.infoQueue
        }, null, 4))
    })

    
}