
import express from 'express';
import path from 'path';
import cors from 'cors';

export function load() {
    console.log("loading APIs");
    console.log(this);
    this.expressApp.use(express.static(this._serverConfig.clientDir));
    this.expressApp.use(express.text());
    this.expressApp.use(cors())

    this.expressApp.get("/api/log-status", (req, res) => {
        res.json({ subsSucceeded: this.loggingClient.subsSucceeded, subsFailed: this.loggingClient.subsFailed });
    });

    /**
     * The GET method for /api/log-file/ will perform a switch file, then return the new data file name
     */
    this.expressApp.get("/api/log-file", (req, res) => {
        if (this.loggingClient !== undefined) {
            this.loggingClient.switchFile()
                .then((newFileName) => {
                    res.status(200).send(newFileName);
                })
                .catch((err) => {
                    res.status(500).send(err);
                })
        }
    });

    this.expressApp.delete("/api/log-file/:fileName", (req, res) => {
        let fileName = req.params.fileName;
        if (this.loggingClient !== undefined) {
            this.loggingClient.deleteDataFile(fileName)
                .then(() => {
                    res.sendStatus(200);
                })
                .catch((err) => res.status(500).send(`Delete ${fileName} failed.`));
        }
        else {
            res.status(400).send("Logging Client is not running.");
        }
    })

    this.expressApp.get("/", (req, res) => {
        res.sendFile(path.join(this._serverConfig.clientDir, 'index.html'));
    });
}