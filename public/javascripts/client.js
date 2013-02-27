// TODO: 「var a = b | c」表記は、左側がfalseだったら右側を代入するの略記か調べる

jQuery(function($) {
	
	/**************************/
	/*   各種ハンドラを設定   */
	/**************************/
	"use strict";
	
	// socket.ioにアクセスしてオブジェクトを取得
	var _socket = io.connect('http://'+location.host+'/');
	
	// 自分以外のプレイヤーの座標情報を、key(userId)を基に保持する変数
	var _userMap = {};
	
	// 自分以外の弾丸の座標情報を、key(userId)を基に保持する変数
	var _bulletMap = {};

	/*** サーバーの、プレイヤー情報の座標アップデート「socket.broadcast.json.emit()」を監視 ***/
	// 引数「data」には、ランダムに生成された位置情報etcが入っている
	_socket.on('player-update', function(data) {

		// userMapに機体(他機)が登録されていない場合（ページロード時）
		if(_userMap[data.userId] === undefined) {
			
			console.log('自分以外の機体 : userId ' + data.userId + ' - ' + data.data.username , data);
			
			/* 機体情報 */
			// 初期化
			var user = {
				x      : 0,
				y      : 0,
				v      : 0,
				rotate : 0,
				userId : data.userId,
				hp     : 60,
				damage : 0
			};

			// 機体をブラウザに描写
			user.element = $('<span class="player"><img src="/images/unit.png" />' + data.data.username + '<br /><div class="hp-area"><div class="hp"></div></div></span>')
				.attr('data-user-id', user.userId);
			$('body').append(user.element);
			
			// 機体をマップに登録
			_userMap[data.userId] = user;

			/* 弾丸情報 */
			// 初期化
			var bullet = {
				x      : -100,
				y      : -100,
				v      : 0,
				rotate : 0,
				userId : data.userId,
				power  : 20
			};

			// 弾丸をブラウザに描写 （枠外に隠している）
			bullet.element = $('<img src="/images/bullet.png" class="bullet" />')
				.attr('data-user-id', user.userId);
			$('body').append(bullet.element);
			
			// 弾丸をマップに登録
			_bulletMap[data.userId] = bullet;
			
			// ページロード時点でのHPを設定
			user.hp     = data.data.hp;
			user.damage = data.data.damage;
			user.firstflg = true;

		// 常時更新時
		} else {
			var user = _userMap[data.userId];
		}
		
		// マップの機体情報を更新
		user.x      = data.data.x;
		user.y      = data.data.y;
		user.rotate = data.data.rotate;
		user.v      = data.data.v;
		
		// ブラウザの描写を修正
		updateCss(user);
		
	});

	/*** サーバーの、弾丸生成イベント「socket.broadcast.json.emit()」を監視 ***/
	_socket.on('bullet-create',function(data) {
		var bullet = _bulletMap[data.userId];
		if(bullet !== undefined){
			bullet.x = data.data.x;
			bullet.y = data.data.y;
			bullet.rotate = data.data.rotate;
			bullet.v = data.data.v;
		}
	});

	/*** サーバーの、弾丸消滅イベント「socket.broadcast.json.emit()」を監視 ***/
	_socket.on('bullet-delete', function(data) {
		var bullet = _bulletMap[data.userId];
		// 他機
		if(bullet != undefined) {
			bullet.x = -100;
			bullet.y = -100;
			bullet.v = 0;
			updateCss(bullet);
		// 自機
		} else {
			_bullet.x = -100;
			_bullet.y = -100;
			_bullet.v = 0;
			updateCss(_bullet);
		}
	});

	/*** サーバーの、HP表示減算イベントを監視 ***/
	_socket.on('disp-damage',function(data) {
		$('.player').each(function() {
			if($(this).data('userId') == data.userId) {
				var player = _userMap[data.userId];
				player.hp     -= data.power;
				player.damage += data.power;
				var width = player.damage+'px';
				$(this).children('.hp-area').children('.hp').animate({
					'width': width
				});
			}
		});
	});
		
	/*** サーバーの、切断イベント「socket.broadcast.json.emit()」を監視 ***/
	_socket.on('disconnect-user',function(data) {
		var user = _userMap[data.userId];
		if(user !== undefined){
			user.element.remove();
			delete _userMap[data.userId];
			var bullet = _bulletMap[data.userId];
			bullet.element.remove();
			delete _bulletMap[data.userId];
		}
		
	});

	/*** サーバーの、プレーヤーが撃墜されたお知らせイベント「socket.broadcast.json.emit()」を監視 ***/
	_socket.on('inform-otherUnitBroken', function(data) {

		console.log(data);
		$('body').prepend('<div id="message">' + data.data.username + ' が撃墜されたよ</div>');
		$('#message').animate({'top': '0'}).delay(2000).animate({'top': '-50px'}, function(){
			$(this).remove();
		});

	});


	/***********************************************/
	/*   メインプログラム (ページロード時に走査)   */
	/***********************************************/
	var _keyMap = [];

	_socket.emit('getMyUserId');

	// 自プレーヤーの座標位置
	var _player = {
		x       : Math.random() * 1000 | 0,
		y       : Math.random() * 500 | 0,
		v       : 0,
		rotate  : 0,
		element : $('#my-player'),
		myname  : $('#myname').html(),
		hp      : 60,
		damage  : 0
	};
	
	// 弾丸の座標位置
	var _bullet = {
		x       : -100,
		y       : -100,
		v       : 0,
		rotate  : 0,
		element : $('#my-bullet'),
		power   : 20
	};
	
	// 座標をアップデートする関数 (数値のみ)
	var updatePosition = function(unit) {
		unit.x += unit.v * Math.cos(unit.rotate * Math.PI / 180);
		unit.y += unit.v * Math.sin(unit.rotate * Math.PI / 180);
	};
	
	// 座標をアップデートする関数 (CSSを操作し、ブラウザ上の表示を変える)
	var updateCss = function(unit) {
		unit.element.css({
			left:      unit.x | 0 + 'px',
			top:       unit.y | 0 + 'px',
			transform: 'rotate(' + unit.rotate + 'deg)'
		});
		
		// 初回表示時のHPゲージを調整
		if(unit.firstflg) {
			var width = unit.damage+'px';
			unit.element.children('.hp-area').children('.hp').css({
				width: width
			});
			unit.firstflg = false;
		}
	};
	
	// メインループ (ひたすら呼び出されて回り続ける)
	var mainfunc = function() {

		// プレイヤーor弾丸の位置情報を修正
		// ループ中にキーボードが押されて、変数の値が変わって座標も変わる仕組み
		
		// キーボード「←」
		if(_keyMap[37] === true) _player.rotate -= 3;
		
		// キーボード「↑」
		if(_keyMap[38] === true) _player.v += 0.5;
		
		// キーボード「→」
		if(_keyMap[39] === true) _player.rotate += 3;
		
		// キーボード「↓」
		if(_keyMap[40] === true) _player.v -= 0.5;
		
		// キーボード「space」
		if(_keyMap[32] === true && _isSpaceKeyUp){
			_isSpaceKeyUp = false;
			_bullet.x = _player.x +20;
			_bullet.y = _player.y +20;
			_bullet.rotate = _player.rotate;
			_bullet.v = Math.max(_player.v + 3,3);
			
			// 【イベント発生】弾丸生成イベントを発生させ、サーバーに弾丸の位置情報を渡す
			_socket.emit('bullet-create', {
				x:      _bullet.x | 0,
				y:      _bullet.y | 0,
				rotate: _bullet.rotate | 0,
				v:      _bullet.v
			});
		}
		
		// スピード調整のようなもの（ブレーキ？）
		_player.v *= 0.95;
		
		// プレイヤーの座標をアップデートする (数値のみ)
		updatePosition(_player);
		
		// ウィンドウのサイズを取得
		var w_width  = $(window).width();
		var w_height = $(window).height();
		
		if(_player.x < -50){ _player.x = w_width;}
		if(_player.y < -50){ _player.y = w_height;}
		if(_player.x > w_width){_player.x = -50;}
		if(_player.y > w_height){_player.y = -50;}
		
		updatePosition(_bullet);
		
		// 自分以外の弾丸の座標判定
		for(var key in _bulletMap){

			var bullet = _bulletMap[key];
			updatePosition(bullet);
			updateCss(bullet);
			
			// 飛んでいる弾丸の座標がプレイヤーと被ったら、被弾判定
			if(_player.x < bullet.x &&
			   bullet.x <_player.x + 50 &&
			   _player.y < bullet.y &&
			   bullet.y <_player.y + 50) {
				
				// 被弾したプレイヤーの弾丸表示を消す
				bullet.x = -100;
				bullet.y = -100;
				bullet.v = 0;
				updateCss(bullet);
				
				// 【イベント発生】弾丸消滅イベントを発生させる
				_socket.emit('bullet-delete', bullet.userId);
				
				// 被弾したプレイヤーのHPを減算し、HP表示を減算する
				_player.hp     -= bullet.power;
				_player.damage += bullet.power;
				var width = _player.damage+'px';
				_player.element.children('.hp-area').children('.hp').animate({
					'width': width
				});

				// 【イベント発生】HP表示減算イベントを発生させる
				_socket.emit('disp-damage', bullet.power);
				
				if(_player.hp <= 0) {
					// 【イベント発生】プレーヤーが撃墜されたお知らせイベントを発生させる yamauchi
					_socket.emit('inform-otherUnitBroken', {username: _player.myname});
					location.href = '/gameover';
				}
			}
		}
		
		// プレイヤー・弾丸の座標をアップデートする (ブラウザ上の表示を変える)
		updateCss(_bullet);
		updateCss(_player);
		
		// 【イベント発生】プレイヤーの座標アップデートイベントを発生させ、サーバーにプレイヤーの位置情報を渡す
		_socket.emit('player-update', {
			x        : _player.x | 0,
			y        : _player.y | 0,
			rotate   : _player.rotate | 0,
			v        : _player.v,
			username : _player.myname,
			hp       : _player.hp,
			damage   : _player.damage
		});
		
		// mainfunc()を再帰的に呼び出す
		setTimeout(mainfunc, 30);
	};

	var _isSpaceKeyUp = true;

	// mainfunc()の初回起動
	setTimeout(mainfunc, 30);
	
	// キーボードのイベントハンドラを設定
	$(window).keydown(function(e) {
		_keyMap[e.keyCode] = true;
	});

	$(window).keyup(function(e) {
		if(e.keyCode === 32){
			_isSpaceKeyUp = true;
		}
		_keyMap[e.keyCode] = false;
	});

});