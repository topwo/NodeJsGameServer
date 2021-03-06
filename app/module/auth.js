/**
 * Created by egret on 16/2/25.
 */
var Auth = module.exports;

var Global = require('../../libs/global/global.js');
var Utils = require('../../libs/util/utils.js');
var UserSessionService = require('../../libs/session/userSessionService.js');
var DbUserModel = require('../model/dbUser.js');
var GameUser = require('../model/gameUser.js');
var GameDataService = require('../data/gameDataService.js');
var UserDao = require('../dao/userDao.js');
var GameProto = require('../proto/gameProto.js');
var SystemProto = require('../proto/systemProto.js');
var Log = require('../../libs/log/log.js');
var MyDate = require('../../libs/date/date.js');
var UserCache = require('../cache/userCache.js');
var BackMessage = require('../message/backMessage.js');


Auth.login = function(userSession, account) {
    UserCache.getUserByName(account, function(cacheDbUser){
        if(cacheDbUser){
            Auth.loginSuccess(userSession, cacheDbUser);
            Log.debug('存在缓存')
        } else {
            UserDao.getUserByName(account, function(err, dbUser){
                if (err){
                    Log.error(err);
                } else {
                    if (dbUser) {
                        Auth.loginSuccess(userSession, dbUser);
                    } else{
                        Auth.create(userSession, account);
                    }
                }
            })
        }
    });
}

Auth.create = function(userSession, account) {
    var dbUser = new DbUserModel();
    dbUser.name = account;
    dbUser.money = Math.ceil(Math.random() * 10000);
    dbUser.last_scene_id = 1;
    UserDao.createUser(dbUser, function(err, dbUser){
        if (err){
            Log.error(err);
        } else {
            Auth.loginSuccess(userSession, dbUser);
        }
    })
}

Auth.loginSuccess = function(userSession, dbUser){
    //在Redis中缓存用户数据
    dbUser.last_login_time = MyDate.unix();
    UserCache.setUser(dbUser);

    //设置用户在线
    UserCache.setOnline(dbUser.id);
    userSession.addCloseCallBack(function(){
        //设置用户下线
        UserCache.setOffline(dbUser.id);
    });

    //在内存中缓存用户数据
    var user = new GameUser();
    user.id = dbUser.id;
    user.name = dbUser.name;
    user.sessionId = userSession.id;
    GameDataService.addUser(user, userSession);
    UserSessionService.addSession(userSession);

    //通知WorldServer用户登录成功
    var onlineMsg = new SystemProto.system_clientOnline();
    onlineMsg.userId = dbUser.id;
    onlineMsg.userSessionId = userSession.id;
    BackMessage.sendToWorld(onlineMsg);
}


Auth.offline = function(data){
    var userSession = UserSessionService.getSession(data.userSessionID);
    userSession && userSession.close();

    //通知WorldServer用户下线
    BackMessage.sendToWorld(data);
}