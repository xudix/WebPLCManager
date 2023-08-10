import { SerialPort } from "serialport";
import { InterByteTimeoutParser } from '@serialport/parser-inter-byte-timeout'
import { DataClient } from "./DataClients.js";
import EventEmitter from "node:events";

export class SerialBridgeApp extends DataClient {
  /**
   *
   * @param {*} config configurations
   */
  constructor(id, accumulationTime, dataBroker, serialConfig) {
    super(id, accumulationTime, dataBroker);

    this.testflag = false;

    this._serialConfig = serialConfig;
    if(!this.testflag){
        this._openPort();
    }

    if(this.testflag){
        setInterval(() => {
            this._receiveQueue.push((new Date()).toString());

        }, 5000);
    }

    this._subscribeCtrl();
  }

  

  /**
   * Receive data from the dataBroker app. Handle communication
   * @param {string} controllerName
   * @param {{symbolName: string, value: any, timeStamp: Date}} data
   */
  receiveData(controllerName, data) {
    if(this.testflag){
        this.log.info(data);
        //console.log(data.toString())
    }
    if(data.symbolName.endsWith("ctrl")){
        // updated control value i.e. control message from controller. Only last 3 bits are used:
        // | Initialization Request (IR) | Receive Accepted (RA) | Transmit Request (TR) |
        if(this._prevctrl != data.value){
            if(data.value & 0b100){
                // initialize request
                this._initialize();
                this._sendStatus(0b100);
            }
            else{
                let ctrlChange = this._status ^ data.value;
                if(ctrlChange & 0b100){
                    // set IA to 0
                    this._sendStatus(this._status &= 0b011);
                }
                if(ctrlChange & 0b001){
                    // transmit request is toggled. Transmit is requested by controller
                    this._transmit(data.value);
                }
            }
        }
        if((this._status & 0b010) == (data.value & 0b010)){
            // Receive accepted RA and receive request RR are the same. Ready for next receive
            this._receive(data.value);
        }
        this._prevctrl = data.value;
    }
  }

  /**
   * Open serial communicaiton port. 
   */
  _openPort(){
    this._serialport = new SerialPort(this._serialConfig, (err) => {
        if(err){
            this.log.error(`Error opening ${this._serialConfig.path}: `, err);
        }
        // Retry? Doesn't seem very meaningful...
    })
    const parser = this._serialport.pipe(new InterByteTimeoutParser({ interval: 30, maxBufferSize: 255 }))
    parser.on("data", (data) => {
        //this.log.info(`${data.length} received from ${this._serialport.path}: `, data.toString())
        while(this._receiveQueue.length >= this.maxQueueLength){
            this._receiveQueue.shift();
        }
        this._receiveQueue.push(data.toString());
        this._receive();
    })
  }


  _initialize(){
    this.log.info(`Initialize Serial Bridge ${this._serialConfig.path}`);
    this._receiveBusy = false;
    this._sendQueue = [];
    this._receiveQueue = [];
  }

  _subscribeCtrl(){
    this._dataBroker.subscribeOnChange(this.id, this._serialConfig.controllerName, `${this._serialConfig.serialFunctionBlockPath}.ctrl`)
    .then(() => {
            // make another cyclic subscription, which is not normally supported by DataBroker
            return this._dataBroker._controllers[this._serialConfig.controllerName].subscribeCyclic(`${this._serialConfig.serialFunctionBlockPath}.ctrl`, (data) => {
                this.receiveData(this._serialConfig.controllerName, data);
            }, 500)
            .then(() => {
                this._writeWatchDogCyclic();
            })
    })
    .catch((err) => {
        this.log.error(`Error subscribing ctrl OnChange for ${this._serialConfig.path}:`, err);
        setTimeout(() => {
            this._subscribeCtrl();
        }, 5000);
    })
    // this._dataBroker.subscribeOnChange(this.id, serialConfig.controllerName, `${serialConfig.serialFunctionBlockPath}.ctrl`);
    // this._dataBroker.subscribeCyclic(this.id, serialConfig.controllerName, `${serialConfig.serialFunctionBlockPath}.ctrl`, 500);
  }


  /**
   * Send status to the controller. Will also update the _status in this object.
   * Status variable: Only last 3 bits are used:
   * | Initialization Accepted (IA) | Receive Request (RR) | Transmit Accepted (TA) |
   * Toggling RR or TA bit represents the corresponding status message.
   * Setting IA to 1 for reset completed
   * @param {number} newStatus new status value
   */
  async _sendStatus(newStatus){
    if(this._sendStatusTimer)
        clearTimeout(this._sendStatusTimer);
    this._status = newStatus;
    return this._dataBroker.writeSymbolValue(this._serialConfig.controllerName, `${this._serialConfig.serialFunctionBlockPath}.status`, newStatus)
    .catch(err => {
        this.log.error(`Error sending status for ${this._serialConfig.path}:`, err);
        this._sendStatusTimer = setTimeout(() => {
            this._sendStatus(this._status);
        }, 1000);
    })
  }


  _sendStatusTimer;

  /**
   * Get data from the controller and send through serial port
   */
  async _transmit(){
    if(this._transmitTimer)
        clearTimeout(this._transmitTimer);
    // get the string from the controller
    return this._dataBroker.readSymbolValue(this._serialConfig.controllerName, `${this._serialConfig.serialFunctionBlockPath}.strSend`)
    .then(data => {
        if(this.testflag){
            // for testing
            this.log.info(`Write ${data.length} chars to ${this._serialConfig.path}: ${data}`);
        }
        else{
            this._serialport.write(data);
        }
        // send status with toggled Transmit Accepted (TA) bit
        this._sendStatus(this._status ^ 0b001);
    })
    .catch(err => {
        this.log.error(`Error transmitting to ${this._serialConfig.path}:`, err)
        this._transmitTimer = setTimeout(() => {this._transmit()}, 1000);
    })
  }

  _transmitTimer;

  /**
   * Send data received from serial port to the controller
   */
  async _receive(){
    if(this._receiveTimer){
        clearInterval(this._receiveTimer);
    }
    if(!this._receiveBusy){
        if(this._receiveQueue.length > 0){         
            this._receiveBusy = true;
            return this._dataBroker.writeSymbolValue(this._serialConfig.controllerName, `${this._serialConfig.serialFunctionBlockPath}.strReceive`, this._receiveQueue[0])
            .then(() => {
                this._receiveQueue.shift();
                this._receiveBusy = false;
                // send status with toggled Receive Request RR bit 
                this._sendStatus(this._status ^ 0b010);
            })
            .catch(err => {
                this.log.error(`Error receiving from ${this._serialConfig.path}:`, err);
                this._receiveTimer = setTimeout(() => {this._receive()}, 1000);
            })
        }
    }
    else{
        this.log.info('receive is busy')
    }
    
  }

  /**
   * @type {NodeJS.Timeout}
   */
  _receiveTimer;

  /**
   * @type {boolean}
   */
  _receiveBusy;

  /**
   * Start writing the watchdog variable to the controller
   */
  _writeWatchDogCyclic(){
    setInterval(() => {
        this._dataBroker.writeSymbolValue(this._serialConfig.controllerName, `${this._serialConfig.serialFunctionBlockPath}.watchDog`, this._watchDog)
        .catch(err => {
            this.log.error(`Serial Bridge ${this._serialConfig.path} failed to write watchdog.`)
        })
        this._watchDog++;
        if(this._watchDog > 32767){
            this._watchDog = -32767;
        }
    }, 1000);
  }

  /**
   * Max length for send and receive queues.
   * @type {number}
   */
  maxQueueLength;
  
  testflag = false;

  _serialConfig;

  /**
   * @type {SerialPort}
   */
  _serialport;

  /**
   * Previous ctrl data value. Only last 3 bits are used:
   * | Initialization Request (IR) | Receive Accepted (RA) | Transmit Request(TR) |
   * Toggling RA or TR bit represents the corresponding control message.
   * Setting IR to 1 for reset.
   * @type {number}
   */
  _prevctrl = 0;

  /**
   * Status variable. Only last 3 bits are used:
   * | Initialization Accepted (IA) | Receive Request (RR) | Transmit Accepted (TA) |
   * Toggling RR or TA bit represents the corresponding status message.
   * Setting IA to 1 for reset completed
   * @type {number}
   */
  _status = 0;

  _sendQueue = [];

  _receiveQueue = [];

  _watchDog = 0;


}
