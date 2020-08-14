"use strict";
/**
 * Ws模块封装 EasySocket.js v0.1
 * 该模块仅支持单列模式，不能同时启用多个连接
 * @authar kyour@vip.qq.com
 */
(function(w){

    /**
     * 创建对象构造函数
     * new Swoft(conf)
     * @param object conf 连接参数
     */
    var sw = function(conf){
        //更新配置
        for(var k in conf){
            this.conf[k] = conf[k];
        }
        if ("WebSocket" in w){
            console.log('您的浏览器支持WebSocket!');
        }else{
            console.log('您的浏览器不支持WebSocket!');
        }
        EasySocketConn = this;

        setInterval(this.sendHeart,this.conf.heartSleep*1000);
        return this;
    };

    /**
     * 对象参数及方法注册
     */
    sw.prototype = {
        //版本
        version: '0.1',
        //默认配置
        conf: {
            url:'', //ws链接
            heart: 'heart', //心跳内容
            heartSleep: 60, //心跳间隔-秒
            reconn: true, //是否自动重连
            eventKey: 'cmd', //事件名称的键名
            debug: false //是否开启调试模式
        },
        socket: null, //socket对象
        createTime: 0, //创建时间
        reConnData: [],
        listener: {}, //监听列表
        ajaxQueue: {}, //ajax消息队列
        // 可注册的ws事件
        event:{
            open: null,
            close: null
        },

        /**
         * 初始化并连接服务器
         * @param open 连接成功的回调闭包函数
         */
        init: function(openFunc) {

            this.event.open = openFunc;

            console.log('正在连接 '+this.conf.url);
            var ws = new WebSocket(this.conf.url);
            this.socket = ws;
            //ws事件注册
            ws.onopen = this.onOpen;
            ws.onmessage = this.onMessage;
            ws.onclose = this.onClose;

        },

        /**
         * 添加后端事件监听
         * @param eventName 事件名称
         * @param func 回调闭包函数
         */
        addListener: function(eventName,func) {
            this.listener[eventName] = func;
        },

        /**
         * 向服务器发送数据
         * @param data 发送的数据内容
         * @param isReconn 是否重连发送
         */
        send: function(data,isReconn) {

            if(typeof data == 'object'){
                data = JSON.stringify(data);
            }
            if(isReconn){
                this.reConnData.push(data);
            }
            // alert('发送'+data)
            this.socket.send(data);
        },

        /**
         * 模拟ajax请求的方式
         * 用于单一请求，就不再添加事件监听
         * @param param 发送的数据内容
         * @param callBack 收到会话的回调闭包函数
         */
        ajax: function(param, callBack) {

            //生成随机SessionId
            var sessId = "Es" + (new Date()).valueOf() + String(Math.ceil(Math.random()*1000));

            var req = {
                sessId: sessId,
                data: param.data
            };
            //事件名赋值，与配置的eventKey相同
            req[this.conf.eventKey] = param[this.conf.eventKey];
            //发送请求
            this.send(req);

            //储存回调闭包函数
            this.ajaxQueue[sessId] = callBack;

            //超时检测
            if(param.outtime){
                setTimeout(function (){
                    var conn = EasySocketConn;
                    if(conn.ajaxQueue[sessId]){
                        conn.ajaxQueue[sessId](null,{code: 1, msg: 'Response timeout.'});
                        delete conn.ajaxQueue[sessId];
                    }
                },param.outtime * 1000);
            }

        },

        /**
         * 发送心跳
         */
        sendHeart: function() {
            var conn = EasySocketConn;
            if(conn.socket !== null){
                //执行闭包函数
                if(typeof conn.conf.heart.data == 'function'){
                    conn.conf.heart.data = conn.conf.heart.data();
                }
                conn.send(conn.conf.heart);
            }
        },

        /**
         * ws事件：连接成功
         */
        onOpen: function() {
            var conn = EasySocketConn;

            //重连发送数据
            for(var k in conn.reConnData){
                conn.send(conn.reConnData[k]);
            }
            if(typeof conn.event.open == 'function'){
                conn.event.open();
                conn.event.open = null;
            }
        },

        /**
         * ws事件：收到服务端消息
         */
        onMessage: function(evt) {
            var conn = EasySocketConn;
            //解析服务器数据
            var data = conn.deJson(evt.data);
            if(data === false){
                if(conn.conf.debug)
                    console.log("未解析的数据："+evt.data);
                return;
            }

            //判断是否ajax返回的消息
            if(data.sessId && conn.ajaxQueue[data.sessId]){
                conn.ajaxQueue[data.sessId](data);
                delete conn.ajaxQueue[data.sessId];
                return;
            }

            //判断是否有此事件监听
            if(data[conn.conf.eventKey] && conn.listener[data[conn.conf.eventKey]]){
                conn.listener[data[conn.conf.eventKey]](data);
            }
        },

        /**
         * ws事件：连接成功
         */
        onClose: function() {
            var conn = EasySocketConn;
            conn.socket = null;

            //断开事件回调
            if(typeof conn.event.close == 'function'){
                conn.event.close();
                // conn.event.close = null;
            }

            if(conn.conf.reconn){
                //自动重连
                if(conn.conf.debug)
                    console.log("连接断开，正在重连...");
                setTimeout(conn.init(), 1000);
            }
        },

        //字符串转json
        deJson: function(str) {
            if (typeof str == 'string') {
                try {
                    var obj = JSON.parse(str);
                    if(typeof obj == 'object' && obj ){
                        return obj;
                    }
                } catch(e) {
                    return false;
                }
            }
            return false;
        }
    };

    //es类
    w.EasySocket = sw;

    //es的实列化对象
    w.EasySocketConn = null;
})(window);
