
import express from 'express';

export function load() {
    console.log("loading APIs");
    
    this._router.get("/info", (req, res) => {
        res.send(JSON.stringify({
            status: this._pusher.loggingStatus,
            Errors: this.errorQueue,
            Warns: this.warnQueue,
            Info: this.infoQueue
        }, null, 4))
    })

    
}