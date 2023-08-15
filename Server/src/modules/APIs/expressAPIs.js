
import express from 'express';
import path from 'path';
import cors from 'cors';
import * as FileSystem from "node:fs/promises";

export function load() {
    console.log("loading APIs");
    this._router.use(express.static(this._serverConfig.clientDir));
    this._router.use(express.text());
    this._router.use(cors())

    this._router.get("/api/log-status", (req, res) => {
        res.json({ subsSucceeded: this.loggingClient.subsSucceeded, subsFailed: this.loggingClient.subsFailed });
    });

    /**
     * If a file name is specified, then that file will be returned.
     */
    this._router.get("/api/log-file/:fileName", (req, res) => {
        let fileName = req.params.fileName;
        if (fileName){
            // requesting a specific file
            const options = {
                root: this._serverConfig.loggingConfig.logDir,
                headers: {
                    'Content-name' : fileName,
                    'Content-Type': 'text/plain'
                }
            }
            res.status(200).sendFile(fileName, options, (err) => {
                if(err){
                    res.status(404).send(err);
                }
            })
        }
    });

    /**
     * The GET method for /api/log-files/ will perform a switch file, then return an array of all available data files in the folder.
     */
    this._router.get("/api/log-files", (req, res) => {
        if (this.loggingClient !== undefined) {
            this.loggingClient.switchFile()
                .then(() => {
                    FileSystem.readdir(this._serverConfig.loggingConfig.logDir).then((fileNames) => {
                        for(let i = 0; i < fileNames.length; i++){
                            if(fileNames[i].endsWith("temp")){
                                fileNames.splice(i,1);
                                i--;
                            }
                        }
                        res.status(200).send(fileNames);
                    })
                    .catch((err) => {
                        res.status(500).send(err);
                    })
                })
                .catch((err) => {
                    res.status(500).send(err);
                })
        }
    });

    this._router.delete("/api/log-file/:fileName", (req, res) => {
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

    this._router.get("/", (req, res) => {
        res.sendFile(path.join(this._serverConfig.clientDir, 'index.html'));
    });

    this._router.get("/api/about", (req, res) => {
        res.status(200).send('Version 0.1');
    })


}