
/**
 * Module dependencies.
 */
 
 // [hp] branch check
 
"use strict";
var express = require('express')
  , routes = require('./routes')
  , http = require('http')
  , path = require('path');

var app = express();


app.configure(function(){
  app.set('port', process.env.PORT || 3000);
  app.set('views', __dirname + '/views');
  app.set('view engine', 'ejs');
  app.use(express.favicon());
  app.use(express.logger('dev'));
  app.use(express.bodyParser());
  app.use(express.methodOverride());
  app.use(app.router);
  app.use(express.static(path.join(__dirname, 'public')));
});

app.configure('development', function(){
  app.use(express.errorHandler());
});

app.get('/', routes.index);
//app.get('/game', routes.game);
app.post('/game', routes.game);
app.get('/gameover', routes.gameover);

var server = http.createServer(app);
server.listen(app.get('port'), function(){
  console.log("Express server listening on port " + app.get('port'));
});

var io = require('socket.io').listen(server,{'log level': 1});
var _userId = 0;

// socket.ioへの接続（ゲームスタート）イベント監視
io.sockets.on('connection', function(socket){
	
	// クライアントをIDで判別し、
	// Socket.IOのセッションとして扱われるsocket.handshake.userIdに格納
	console.log('game start! - userID : ' + _userId);
	socket.handshake.userId = _userId;
	_userId ++;

	// プレイヤー情報の座標アップデートイベント監視
	socket.on('player-update', function(data) {
		socket.broadcast.json.emit('player-update', {userId: socket.handshake.userId, data: data});
	});

	// 弾丸の生成イベント監視
	socket.on('bullet-create', function(data) {
		socket.broadcast.json.emit('bullet-create', {userId: socket.handshake.userId, data: data});
	});

	// 着弾した弾丸の消滅イベント監視
	socket.on('bullet-delete', function(data) {
		socket.broadcast.json.emit('bullet-delete', {data: data});
	});

	// 許容数より溢れた弾丸の消滅イベント監視
	socket.on('overflow-bullet-delete', function(data) {
		socket.broadcast.json.emit('bullet-delete', {userId: socket.handshake.userId});
	});

	// HP表示減算イベント監視
	socket.on('disp-damage', function(data) {
		socket.broadcast.json.emit('disp-damage', {userId: socket.handshake.userId, power: data});
	});

	// 切断イベント(既存の切断イベント)監視
	socket.on('disconnect', function() {
		socket.broadcast.json.emit('disconnect-user', {userId: socket.handshake.userId});
	});

	// プレーヤーが撃墜されたお知らせイベント監視 yamauchi
	socket.on('inform-otherUnitBroken', function(data) {
		socket.broadcast.json.emit('inform-otherUnitBroken', {data: data});
	});

	// 
	socket.on('unit-escape', function(data) {
		socket.broadcast.json.emit('unit-escape', {userId: socket.handshake.userId});
	});

});
