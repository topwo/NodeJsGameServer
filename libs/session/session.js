/**
 * Created by egret on 16/1/21.
 */
var ExBuffer = require('ExBuffer');
var Log = require('../log/log.js');
var Utils = require('../util/utils.js');
var Util = require('util');
var EventEmitter = require('events').EventEmitter;

Session.DATA = 'data';

function Session(sock){
    this.id = 0;
    this.sock = sock;
    this.closeHandles = [];
    this.isClose = false;
    this.exBuffer = null;
    this.gameServer = null;
    this.closeByActive = false;
    this.remoteAddress = this.sock.remoteAddress + ':' + this.sock.remotePort;
    //Log.debug('SessionCreate:' + this.remoteAddress);

    this.$initSock();
}
Util.inherits(Session, EventEmitter);

Session.prototype.$initSock = function() {
    var self = this;
    function onReceivePackData(buffer){
        self.emit(Session.DATA, buffer);
    }

    this.exBuffer = new ExBuffer().ushortHead().bigEndian();
    this.exBuffer.on('data', onReceivePackData);

    //Socket接收到数据
    this.sock.on('data', function(data) {
        self.exBuffer.put(data);
    });

    //WebSocket接收到数据
    this.sock.on('message', function(data) {
        if(!data['copy']){
            Log.warn('Session收到未知数据:' + data);
            return;
        }
        self.exBuffer.put(data);
    });

    //Socket/WebSocket关闭
    this.sock.on('close', function() {
        self.$destroy();
    });

    //Socket错误处理
    this.sock.on('error', function(err) {
        Log.debug('socket error：' + err);

        self.close();
        self.$destroy();
    });
};

Session.prototype.send = function(data){
    if(this.isClose){
        return;
    }
    var len = data.length;

    //写入2个字节表示本次包长
    var headBuf = new Buffer(2);
    headBuf.writeUInt16BE(len, 0);
    this.writeBufferToSocket(headBuf);

    //写入包体
    this.writeBufferToSocket(data);
}

Session.prototype.sendByWebSocket = function (data) {
    if(this.isClose){
        return;
    }
    var len = data.length;

    //写入2个字节表示本次包长
    var headBuf = new Buffer(2);
    headBuf.writeUInt16BE(len, 0);

    //写入包体
    var sendBuf = Buffer.concat([headBuf, data], 2 + len);
    this.writeBufferToSocket(sendBuf);
}

Session.prototype.writeBufferToSocket = function(buf){
    if(this.sock['write']){
        //Socket使用
        this.sock.write(buf);
    }
    else{
        //WebSocket使用
        this.sock.send(buf);
    }
}

Session.prototype.close = function(isActive){
    if(this.isClose){
        return;
    }

    //是否是主动断开，默认为false
    if(!isActive){
        isActive = false;
    }

    this.closeByActive = isActive;

    if(this.sock['end']){
        //Socket使用
        this.sock.end();
        this.sock.destroy();
    }
    else{
        //WebSocket使用
        this.sock.close();
    }
}

Session.prototype.addCloseCallBack = function(cb){
    if(this.isClose){
        return;
    }
    this.closeHandles.push(cb)
}

Session.prototype.$destroy = function() {
    //Log.debug('SessionClose:' + this.remoteAddress);
    this.isClose = true;

    this.sock.removeAllListeners('data');
    this.sock.removeAllListeners('message');
    this.sock.removeAllListeners('close');
    this.sock.removeAllListeners('error');
    this.sock = null;

    this.exBuffer.removeAllListeners('data');
    this.exBuffer = null;

    this.removeAllListeners(Session.DATA);
    for(var i= 0, len=this.closeHandles.length; i<len; i++){
        Utils.invokeCallback(this.closeHandles[i], this.closeByActive);
    }
    this.closeHandles.length = 0;
    this.closeHandles = null;
}

Session.prototype.bindGameServer = function(gameServerName) {
    this.gameServer = gameServerName;
}

module.exports = Session;