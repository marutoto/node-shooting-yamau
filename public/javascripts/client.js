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
	
	// サーバーの、プレイヤーの座標アップデート「socket.broadcast.json.emit()」を監視
	_socket.on('player-update', function(data) {
		var user;
		if(_userMap[data.userId] === undefined) {
			
			console.log('create user ' + data.userId , data);

			user = {
				x:      0,
				y:      0,
				v:      0,
				rotate: 0,
				userId: data.userId
			};

			user.element = $('<span class="player"><img src="/images/unit.png" />' + data.data.username + '</span>')
				.attr('data-user-id', user.userId);
			$('body').append(user.element);
			_userMap[data.userId] = user;

			var bullet = {
				x:      -100,
				y:      -100,
				v:      0,
				rotate: 0,
				userId: data.userId
			};

			bullet.element = $('<img src="/images/bullet.png" class="bullet" />')
				.attr('data-user-id',user.userId);
			$('body').append(bullet.element);
			
			_bulletMap[data.userId] = bullet;
			
		} else {
			user = _userMap[data.userId];
		}
		user.x = data.data.x;
		user.y = data.data.y;
		user.rotate = data.data.rotate;
		user.v = data.data.v;
		updateCss(user);
	});

	// サーバーの、弾丸生成イベント「socket.broadcast.json.emit()」を監視
	_socket.on('bullet-create',function(data) {
		var bullet = _bulletMap[data.userId];
		if(bullet !== undefined){
			bullet.x = data.data.x;
			bullet.y = data.data.y;
			bullet.rotate = data.data.rotate;
			bullet.v = data.data.v;
		}
	});
	
	// サーバーの、切断イベント「socket.broadcast.json.emit()」を監視
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

	// サーバーの、プレーヤーが撃墜されたお知らせイベント「socket.broadcast.json.emit()」を監視
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
	
	// 自プレーヤーの座標位置
	var _player = {
		x:       Math.random() * 1000 | 0,
		y:       Math.random() * 500 | 0,
		v:       0,
		rotate:  0,
		element: $('#my-player'),
		myname: $('#myname').html()
	};
	
	// 弾丸の座標位置
	var _bullet = {
		x:       -100,
		y:       -100,
		v:       0,
		rotate:  0,
		element: $('#my-bullet')
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
			
			// 飛んでいる弾丸の座標がプレイヤーと被ったら、被弾したとしてgameover画面へ遷移する
			if(_player.x < bullet.x &&
			   bullet.x <_player.x + 50 &&
			   _player.y < bullet.y &&
			   bullet.y <_player.y + 50) {
				
				// 【イベント発生】プレーヤーが撃墜されたお知らせイベントを発生させる yamauchi
				_socket.emit('inform-otherUnitBroken', {username: _player.myname});
				location.href = '/gameover';
			}
		}
		
		// プレイヤー・弾丸の座標をアップデートする (ブラウザ上の表示を変える)
		updateCss(_bullet);
		updateCss(_player);
		
		// 【イベント発生】プレイヤーの座標アップデートイベントを発生させ、サーバーにプレイヤーの位置情報を渡す
		_socket.emit('player-update', {
			x:      _player.x | 0,
			y:      _player.y | 0,
			rotate: _player.rotate | 0,
			v:      _player.v,
			username: _player.myname
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