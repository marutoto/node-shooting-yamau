// TODO: 「var a = b | c」表記は、左側がfalseだったら右側を代入するの略記か調べる

jQuery(function($) {

	"use strict";
	
	// socket.ioにアクセスしてオブジェクトを取得
	var _socket = io.connect('http://'+location.host+'/');
	
	// 他プレイヤーの座標情報を、key(userId)を基に保持する変数
	var _userMap = {};
	
	// 他弾の座標情報を、key(userId)を基に保持する変数
	var _bulletMap = {};
	
	// キーボードマップ
	var _keyMap = [];

	// 自プレーヤー初期値
	var my_player = {
		x       : Math.random() * 1000 | 0,
		y       : Math.random() * 500 | 0,
		v       : 0,
		rotate  : 0,
		element : $('#my-player'),
		myname  : $('#myname').html(),
		hp      : 60,
		damage  : 0
	};
	
	// 自弾初期値
	var my_bullets = [];
	/*
	var _bullets = 
		x       : -100,
		y       : -100,
		v       : 0,
		rotate  : 0,
		element : $('#my-bullets'),
		power   : 20
	};
	*/
	
	var bullet_num = 0;



	/**************************/
	/*   各ハンドラを設定   */
	/**************************/
	
	/*** サーバーの、プレイヤー情報の座標アップデート「socket.broadcast.json.emit()」を監視 ***/
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
			var elem_html;
			elem_html  = '<span class="player">';
			elem_html += '<img src="/images/unit.png" />';
			elem_html += '<div class="user-info">';
			elem_html += '<div>'+data.data.username+'</div>';
			elem_html += '<div class="hp-area"><div class="hp"></div></div>';
			elem_html += '</div>';
			elem_html += '</span>';
			user.element = $(elem_html).attr('data-user-id', user.userId);
			$('body').append(user.element);
			
			// 機体をマップに登録
			_userMap[data.userId] = user;

			/* 弾丸情報 */
			// 初期化
			/*var bullet = {
				x      : -100,
				y      : -100,
				v      : 0,
				rotate : 0,
				power  : 20,
				userId : data.userId
			};*/

			// 弾丸をブラウザに描写 （枠外に隠している）
			
			/*
			bullet.element = $('<img src="/images/bullet.png" class="bullet" />')
				.attr('data-user-id', user.userId);
			$('body').append(bullet.element);
			*/
			user.element.after('<span class="bullets" data-user-id="' + user.userId + '"></span>');
			
			// 枠外にある弾丸をマップに登録
			//////////_bulletMap[data.userId] = bullets;
			_bulletMap[data.userId] = [];

			// ページロード時点でのHPを設定
			user.hp     = data.data.hp;
			user.damage = data.data.damage;
			user.firstflg = true;

		// 常時更新時
		} else {
			var user = _userMap[data.userId];
		}

		// □他プレイヤーの座標データを更新する
		user.x      = data.data.x;
		user.y      = data.data.y;
		user.rotate = data.data.rotate;
		user.v      = data.data.v;
		
		// □他プレイヤーのブラウザ表示を更新する
		updateCss(user);
		
	});

	/*** サーバーの、弾丸生成イベント「socket.broadcast.json.emit()」を監視 ***/
	_socket.on('bullet-create',function(data) {

		var bullets = _bulletMap[data.userId];
		if(bullets !== undefined){
			
			var elem_html = '<img src="/images/bullet.png" class="bullet ' + data.data.number + '" />';
			
			var bullet = {
				x       : data.data.x,
				y       : data.data.y,
				rotate  : data.data.rotate,
				v       : data.data.v,
				power   : 20,
				element : $(elem_html),
				number  : data.data.number,
				userId  : data.userId
			}	
			_bulletMap[data.userId].push(bullet);

			$('span.bullets[data-user-id="'+data.userId+'"]').append(elem_html);
		}
	});

	/*** サーバーの、着弾した弾丸の消滅イベント「socket.broadcast.json.emit()」を監視 ***/
	// TODO:data.data.numberが要る
	_socket.on('bullet-delete', function(data) {
		var bullet = _bulletMap[data.userId];
		// 他弾
		if(bullet != undefined) {
			bullet.x = -100;
			bullet.y = -100;
			bullet.v = 0;
			updateCss(bullet);
		// 自弾
		} else {
			my_bullet.x = -100;
			my_bullet.y = -100;
			my_bullet.v = 0;
			updateCss(my_bullet);
		}
	});

	/*** サーバーの、許容数より溢れた弾丸の消滅イベント「socket.broadcast.json.emit()」を監視 ***/
	_socket.on('overflow-bullet-delete', function(data) {
		var bullet = _bulletMap[data.userId];
		if(bullet != undefined) {
			_bulletMap[data.userId].splice(0,1);
			bullet.first().remove();
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
				$(this).children('.user-info').children('.hp-area').children('.hp').animate({
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
			//bullet.element.remove();
			delete _bulletMap[data.userId];
		}
		
	});

	/*** サーバーの、プレーヤーが撃墜されたお知らせイベント「socket.broadcast.json.emit()」を監視 ***/
	_socket.on('inform-otherUnitBroken', function(data) {

		$('body').prepend('<div id="message">' + data.data.username + ' が撃墜されたよ</div>');
		$('#message').animate({'top': '0'}).delay(2000).animate({'top': '-50px'}, function(){
			$(this).remove();
		});

	});


	/***********************************************/
	/*   メインプログラム (ページロード時に走査)   */
	/***********************************************/

	// 座標を更新する関数
	var updatePosition = function(unit) {
		unit.x += unit.v * Math.cos(unit.rotate * Math.PI / 180);
		unit.y += unit.v * Math.sin(unit.rotate * Math.PI / 180);
	};
	
	// CSSを操作し、ブラウザ上の表示を更新する関数
	var updateCss = function(unit) {
		//console.log(unit);
		unit.element.css({
			left      : unit.x | 0 + 'px',
			top       : unit.y | 0 + 'px',
			transform : 'rotate(' + unit.rotate + 'deg)'
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
		if(_keyMap[37] === true) my_player.rotate -= 3;
		
		// キーボード「↑」
		if(_keyMap[38] === true) my_player.v += 0.5;
		
		// キーボード「→」
		if(_keyMap[39] === true) my_player.rotate += 3;
		
		// キーボード「↓」
		if(_keyMap[40] === true) my_player.v -= 0.5;
		
		// キーボード「space」
		if(_keyMap[32] === true && _isSpaceKeyUp) {
			_isSpaceKeyUp = false;
			
			bullet_num++;
			
			// 自弾を生成
			$('#my-bullets').append('<img src="/images/bullet.png" class="bullet ' + bullet_num + '" />');
			
			// 5発を超えたら若い弾丸を消す
			if(bullet_num > 5) {
				var delete_bullet = my_bullets[0];
				my_bullets.splice(0,1);
				$('#my-bullets .bullet').first().remove();
				
				// 【イベント発生】弾丸消滅イベントを発生させる
				_socket.emit('overflow-bullet-delete');
			}
		
			var create_bullet = {
				x       : -100,
				y       : -100,
				v       : 0,
				rotate  : 0,
				element : $('#my-bullets .bullet.'+bullet_num),
				power   : 20,
				number  : bullet_num
			};
			create_bullet.x      = my_player.x + 20;
			create_bullet.y      = my_player.y + 20;
			create_bullet.rotate = my_player.rotate;
			create_bullet.v      = Math.max(my_player.v + 3, 3);
			
			// 【イベント発生】弾丸生成イベントを発生させ、サーバーに弾丸の位置情報を渡す
			_socket.emit('bullet-create', {
				x      : create_bullet.x | 0,
				y      : create_bullet.y | 0,
				rotate : create_bullet.rotate | 0,
				v      : create_bullet.v,
				power  : 20,
				number : bullet_num
			});
		
			my_bullets.push(create_bullet);
		}
		
		// スピード調整のようなもの（ブレーキ？）
		my_player.v *= 0.95;
		
		// ○自プレーヤーの座標データを更新する
		updatePosition(my_player);
		
		// ウィンドウのサイズを取得
		var w_width  = $(window).width();
		var w_height = $(window).height();
		
		if(my_player.x < -50)      my_player.x = w_width;
		if(my_player.y < -50)      my_player.y = w_height;
		if(my_player.x > w_width)  my_player.x = -50;
		if(my_player.y > w_height) my_player.y = -50;
		
		// ○自弾の座標データを更新する
		for(var i=0 ; i<my_bullets.length ; i++) {
			updatePosition(my_bullets[i]);
		}
		
		// 他弾を1つずつ調べるループ ＆ 被弾判定
		// 他プレイヤーループ
		for(var userId in _bulletMap){
			
			var bullets = _bulletMap[userId];
			
			
			//////////////ここ！CSSあたってない、classがおかしい？
			console.log(bullets);
			// 他弾ループ
			/*
			for(var number in bullets) {
				
				console.log(bullets[number]);
				
				// □他弾の座標データを更新する
				updatePosition(bullets[number]);
				
				// □他弾のブラウザ表示を更新する
				updateCss(bullets[number]);exit;
				
				// 飛んでいる弾丸の座標がプレイヤーと被ったら、被弾判定
				if(my_player.x < bullets[number].x         &&
				   bullets[number].x    < my_player.x + 50 &&
				   my_player.y < bullets[number].y         &&
				   bullets[number].y    < my_player.y + 50   ) {
					
					// 被弾したプレイヤーの弾丸表示を消す
					//bullets[number].x = -100;
					//bullets[number].y = -100;
					//bullets[number].v = 0;
					//updateCss(bullets[number]);
					
					// 【イベント発生】弾丸消滅イベントを発生させる
					_socket.emit('bullet-delete', bullets[number].userId);
					
					// 被弾したプレイヤーのHPを減算し、HP表示を減算する
					my_player.hp     -= bullets[number].power;
					my_player.damage += bullets[number].power;
					var width = my_player.damage + 'px';
					my_player.element.children('.user-info').children('.hp-area').children('.hp').animate({
						'width': width
					});
	
					// 【イベント発生】HP表示減算イベントを発生させる
					_socket.emit('disp-damage', bullets[number].power);
					
					if(_player.hp <= 0) {
						// 【イベント発生】プレーヤーが撃墜されたお知らせイベントを発生させる yamauchi
						_socket.emit('inform-otherUnitBroken', {username: my_player.myname});
						location.href = '/gameover';
					}
				}
			}
			*/
		}
		
		// ○自弾のブラウザ表示を更新する
		for(var i=0 ; i<my_bullets.length ; i++) {
			updateCss(my_bullets[i]);
		}


		// 【イベント発生】プレイヤーの座標アップデートイベントを発生させ、サーバーにプレイヤーの位置情報を渡す
		_socket.emit('player-update', {
			x        : my_player.x | 0,
			y        : my_player.y | 0,
			rotate   : my_player.rotate | 0,
			v        : my_player.v,
			username : my_player.myname,
			hp       : my_player.hp,
			damage   : my_player.damage
		});
	
		// ○自プレーヤーのブラウザ表示を更新する
		updateCss(my_player);
		
		
		
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