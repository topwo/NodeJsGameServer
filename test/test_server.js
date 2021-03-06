/**
 * Created by egret on 16/1/21.
 */
var Link = require('../libs/net/link.js');
var Global = require('../libs/global/global.js');
var Session = require('../libs/session/session.js');
var Log = require('../libs/log/log.js');
var Proto = require('../app/proto/gameProto.js');
var EventEmitter = require('events').EventEmitter;

Global.serverName = 'testServer';
Log.init('testServer', 0);

var Event = new EventEmitter();
var SUM_CLIENT = 1;

//连接
var clients = [];
var successNum = 0;
var failNum = 0;
var now = Date.now();
var players = [];

var arr = [];
for(var i=0; i<SUM_CLIENT; i++){
    while(true){
        var flag = Math.ceil(Math.random() * 10000);
        if(arr.indexOf(flag) == -1){
            arr.push(flag);
            break;
        }
    }
}
for(var i=0; i<SUM_CLIENT; i++){
    connect(i);
}

function connect(index){
    Link.connectByWebSocket('127.0.0.1', 8880, function(client){
    //Link.connect('127.0.0.1', 8880, function(client){
        Log.debug('连接成功');
        client.addCloseCallBack(function(){
            Log.debug('连接关闭');
        });
        clients.push(client);

        //登录认证
        var account = 'yangsong' + arr[index];
        var sendMsg = new Proto.user_login_c2s();
        sendMsg.account = account;
        client.send(sendMsg.encode());
        //console.log(sendMsg.encode());

        client.on(Session.DATA, function(data){
            //console.log(data);

            var msg = Proto.decode(data);
            if(msg.msgId == Proto.ID_user_login_s2c){
                //console.log(account, '收到用户消息:', msg);
                //进入游戏
                sendMsg = new Proto.user_joinScene_c2s();
                sendMsg.sceneId = msg.user.sceneId;
                client.send(sendMsg.encode());
            }
            else if(msg.msgId == Proto.ID_user_joinScene_s2c){
                console.log(account, '收到用户消息:', msg);
                var player = {};
                player.id = msg.player.id;
                player.x = msg.player.x;
                player.y = msg.player.y;
                players[player.id] = player;

                //开始走路
                startWalk(client, player);

                //开始聊天
                startChat(client, account);

            } else if(msg.msgId == Proto.ID_obj_walk_s2c){
                console.log(account, '收到用户消息:', msg);
                var player = players[msg.id];
                player.x = msg.data.x;
                player.y = msg.data.y;
            } else if(msg.msgId == Proto.ID_obj_walk_stop_s2c){
                var player = players[msg.id];
                player.x = msg.x;
                player.y = msg.y;
            } else if(msg.msgId == Proto.ID_user_chat_s2c){
                console.log(account, '收到用户消息:', msg);
                //successNum++
                //if(successNum + failNum == SUM_CLIENT){
                //    Event.emit('success');
                //}
            } else {
                console.log(account, '收到用户消息:', msg);
            }
        })

    }, function(){
        failNum++
        if(successNum + failNum == SUM_CLIENT){
            Event.emit('success');
        }
    })
}

function startChat(client, account){
    setInterval(sendChat, 5000, client, account);
}

function sendChat(client, account){
    return;

    var sendMsg = new Proto.user_chat_c2s();
    sendMsg.chatMsg = 'Hello ' + account;
    sendMsg.channel = 1;
    client.send(sendMsg.encode());
}

function startWalk(client, player){
    setTimeout(sendWalk, Math.ceil(Math.random()*20000), client, player);
}

var radianArr = [
    Math.atan2(1, 0),
    Math.atan2(-1, 0),
    Math.atan2(0, 1),
    Math.atan2(0, -1),

    Math.atan2(-1, 1),
    Math.atan2(1, -1),
    Math.atan2(-1, -1),
    Math.atan2(1, 1),
];
function sendWalk(client, player){
    var sendMsg = new Proto.player_walk_c2s();
    sendMsg.data.time = Date.now();
    sendMsg.data.x = player.x;
    sendMsg.data.y = player.y;
    sendMsg.data.speed = 240;
    sendMsg.data.radian = radianArr[Math.floor(Math.random()*radianArr.length)];
    client.send(sendMsg.encode());

    startWalk(client, player);
}

//关闭
Event.on('success', function(){
    console.log('成功数：' + successNum)
    console.log('失败数：' + failNum)
    console.log('耗时：'+ (Date.now()-now));
    setTimeout(function(){
        for(var i=0;i<clients.length; i++){
            clients[i].close()
        }
    }, 3000);
})

process.on('uncaughtException', function(err) {
    Log.error('Caught exception: ' + err.stack);
});