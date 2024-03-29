
jQuery(function($) {

	var dev_flg = false;
	if(!dev_flg) {
		// ゲームウィンドウにフォーカスさせる
		$('body').focus(function() {
			//$('#my-player').css({'display': 'block'});
			//$('#my-player').animate({'opacity': '1'}, 'fast');
		});
	
		$('body').focus();
	
    // ↓ なんでこれ必要やったんやろ？(202311)
		// ウィンドウから離れるとゲームオーバー
		// $('body').blur(function() {
    //
		// 	_socket.emit('unit-escape');
    //
		// 	$('#my-player').animate({'opacity': '0'}, 'slow', function() {
    //
		// 		// 【イベント発生】プレーヤーが撃墜されたお知らせイベントを発生させる
		// 		var message = my_player.myname + 'がゲームを終了したよ';
		// 		_socket.emit('inform-otherUnitBroken', {message: message});
		// 		location.href = '/gameover';
    //
		// 	});
		// });
	}
	
	// ゲーム説明文表示
	var game_explain;
	game_explain  = '<p><b>操作説明</b><br />';
	game_explain += '『↑』『↓』 ： 前後移動<br />';
	game_explain += '『←』『→』 ： 左右回転<br />';
	game_explain += '『space』 ： 発射！！</p><br />';
	game_explain += '<p class="caution">!!! COUTION !!!<br />';
	game_explain += '一度画面から離れるとゲームオーバーです</p>';
	$('#playing-area').prepend('<div class="message explain">' + game_explain + '</div>');
		$('.message.explain').animate({'top': '0'}).delay(6000).animate({'top': '-140px'}, function(){
			$(this).remove();
		});
	
	
	/************/
	/* 初期設定 */
	/************/
	"use strict";
	
	// 定数宣言
	const PLAYER_HP           = 100;
	const PLAYER_HP_LENGTH    = $('#my-player .hp-area').width();
	const BULLET_LIMIT        = 10;
	const BULLET_POWER        = 10;
	const PLAYING_AREA_WIDTH  = $('#playing-area').width();
	const PLAYING_AREA_HEIGHT = $('#playing-area').height();
	
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
		x       : Math.random() * (PLAYING_AREA_WIDTH - 50),
		y       : Math.random() * (PLAYING_AREA_HEIGHT - 50),
		v       : 0,
		rotate  : 0,
		element : $('#my-player'),
		myname  : $('#myname').html(),
		hp      : PLAYER_HP,
		damage  : 0
	};

	// 自弾初期値
	var my_bullets = [];

	// 自弾発射数
	var bullet_num = 0;


	/**************************/
	/*   各ハンドラを設定   */
	/**************************/
	
	/*** サーバーの、プレイヤー情報の座標アップデート「socket.broadcast.json.emit()」を監視 ***/
	_socket.on('player-update', function(data) {

		// userMapに機体(他機)が登録されていない場合
		if(_userMap[data.userId] === undefined) {
			
			console.log('自分以外の機体 : userId ' + data.userId + ' - ' + data.data.username , data);
			
			/* 他プレイヤー情報 */
			// 初期化
			var user = {
				x      : 0,
				y      : 0,
				v      : 0,
				rotate : 0,
				userId : data.userId,
				hp     : PLAYER_HP,
				damage : 0
			};

			// ブラウザに描写
			var elem_html;
			elem_html  = '<span class="player">';
			elem_html += '<img src="/images/unit.png" />';
			elem_html += '<div class="user-info">';
			elem_html += '<div>'+data.data.username+'</div>';
			elem_html += '<div class="hp-area"><div class="hp"></div></div>';
			elem_html += '</div>';
			elem_html += '</span>';
			user.element = $(elem_html).attr('data-user-id', user.userId);
			$('#playing-area').append(user.element);
			
			// マップに登録
			_userMap[data.userId] = user;


			/* 他プレイヤー弾丸格納エリア情報 */
			// ブラウザに描写
			user.element.after('<span class="bullets" data-user-id="' + user.userId + '"></span>');
			
			// マップに登録
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
	_socket.on('bullet-create', function(data) {

		var bullets = _bulletMap[data.userId];
		if(bullets !== undefined){
			
			var elem_html = '<img src="/images/bullet.png" class="bullet ' + data.data.number + '" />';
			$('span.bullets[data-user-id="'+data.userId+'"]').append(elem_html);
			
			var bullet = {
				x       : data.data.x,
				y       : data.data.y,
				v       : data.data.v,
				rotate  : data.data.rotate,
				element : $('span.bullets[data-user-id="' + data.userId + '"] .bullet.' + data.data.number),
				power   : BULLET_POWER,
				number  : data.data.number,
				userId  : data.userId
			};
			
			_bulletMap[data.userId][data.data.number] = bullet;
			
			var bullet_cnt = Object.keys(_bulletMap[data.userId]).length;

			// 弾丸制限数を超えたら若い弾丸を消す
			if(bullet_cnt > BULLET_LIMIT) {
				
				_bulletMap[data.userId].splice(0, 1);
				$('span.bullets[data-user-id="'+data.userId+'"] .bullet').first().remove();
				
			}
		}
	});

	/*** サーバーの、着弾した弾丸の消滅イベント「socket.broadcast.json.emit()」を監視 ***/
	_socket.on('bullet-delete', function(data) {

		var bullets = _bulletMap[data.data.userId];
		
		// 他プレイヤーの弾丸表示
		if(bullets != undefined) {
			
			$('span.bullets[data-user-id="' + data.data.userId + '"] .bullet.' + data.data.number).remove();
			
			_bulletMap[data.data.userId].splice(data.data.number, 1);
			
		// 撃って当てたプレイヤーの弾丸表示
		} else {
			
			$('#my-bullets .bullet.' + data.data.number).remove();
			my_bullets.splice(data.data.number, 1);
		}
	});

	/*** サーバーの、HP表示減算イベントを監視 ***/
	_socket.on('disp-damage', function(data) {
		$('.player').each(function() {
			if($(this).data('userId') == data.userId) {
				var player = _userMap[data.userId];
				player.hp     -= data.power;
				player.damage += data.power;
				
				// 減少表示量を計算する
				var decrement = calcHpLengthDecrement(player.damage);
				$(this).children('.user-info').children('.hp-area').children('.hp').animate({
					'width': decrement + 'px'
				});
			}
		});
	});
		
	/*** サーバーの、切断イベント「socket.broadcast.json.emit()」を監視 ***/
	_socket.on('disconnect-user', function(data) {
		var user = _userMap[data.userId];
		if(user !== undefined){
			
			$('span.bullets[data-user-id="' + data.userId + '"]').remove();
			delete _userMap[data.userId];
			
			$('span.player[data-user-id="' + data.userId + '"]').remove();
			delete _bulletMap[data.userId];
			
		}
		
	});

	/*** サーバーの、プレーヤーの接続が切れたお知らせイベント「socket.broadcast.json.emit()」を監視 ***/
	_socket.on('inform-otherUnitBroken', function(data) {

		$('#playing-area').prepend('<div class="message info">' + data.data.message + '</div>');
		$('.message.info').animate({'top': '0'}).delay(2000).animate({'top': '-50px'}, function(){
			$(this).remove();
		});

	});


	_socket.on('unit-escape', function(data) {

		$('span.player[data-user-id="' + data.userId + '"]').animate({'opacity': '0'}, 'slow');

	});


	/***********************************************/
	/*   メインプログラム (ページロード時に走査)   */
	/***********************************************/

	/*** 座標を更新する関数 ***/
	var updatePosition = function(unit) {
		unit.x += unit.v * Math.cos(unit.rotate * Math.PI / 180);
		unit.y += unit.v * Math.sin(unit.rotate * Math.PI / 180);
	};
	
	/*** CSSを操作し、ブラウザ上の表示を更新する関数 ***/
	var updateCss = function(unit) {
		
		unit.element.css({
			left      : unit.x | 0 + 'px',
			top       : unit.y | 0 + 'px',
			transform : 'rotate(' + unit.rotate + 'deg)'
		});
		
		// 初回表示時のHPゲージを調整
		if(unit.firstflg) {
			var decrement = calcHpLengthDecrement(unit.damage);
			unit.element.children('.user-info').children('.hp-area').children('.hp').css({
				width: decrement + 'px'
			});
			unit.firstflg = false;
		}
	};
	
	/*** HPゲージの減少量を計算する ***/
	var calcHpLengthDecrement = function(player_damage) {
		return (PLAYER_HP_LENGTH * player_damage) / PLAYER_HP;
	}
	
	/*** メインループ (ひたすら呼び出されて回り続ける) ***/
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
			
			var create_bullet = {
				x       : -100,
				y       : -100,
				v       : 0,
				rotate  : 0,
				element : $('#my-bullets .bullet.' + bullet_num),
				power   : BULLET_POWER,
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
				power  : BULLET_POWER,
				number : bullet_num
			});

			my_bullets[bullet_num] = create_bullet;
			
			var bullet_cnt = Object.keys(my_bullets).length;
			
			// 弾丸制限を超えたら若い弾丸を消す
			if(bullet_cnt > BULLET_LIMIT) {
				
				my_bullets.splice(0, 1);
				$('#my-bullets .bullet').first().remove();
				
			}
		}
		
		// スピード調整のようなもの（ブレーキ？）
		my_player.v *= 0.95;
		
		// ○自プレーヤーの座標データを更新する
		updatePosition(my_player);
		
		// 画面外に出た時のプレイヤー位置を調整する
		if(my_player.x < -60)                      my_player.x = PLAYING_AREA_WIDTH + 10;
		if(my_player.y < -60)                      my_player.y = PLAYING_AREA_HEIGHT + 10;
		if(my_player.x > PLAYING_AREA_WIDTH + 10)  my_player.x = -60;
		if(my_player.y > PLAYING_AREA_HEIGHT + 10) my_player.y = -60;

		// ○自弾の座標データを更新する
		for(var i in my_bullets) {
			updatePosition(my_bullets[i]);
		}
		
		// 他弾を1つずつ調べるループ ＆ 被弾判定
		// 他プレイヤーループ
		for(var userId in _bulletMap){
			
			var bullets = _bulletMap[userId];
			
			// 他弾ループ
			for(var i in bullets) {
				
				// □他弾の座標データを更新する
				updatePosition(bullets[i]);
				
				// □他弾のブラウザ表示を更新する
				updateCss(bullets[i]);
				
				// 飛んでいる弾丸の座標が自プレイヤーと被ったら、被弾判定
				if(my_player.x  < bullets[i].x && bullets[i].x < my_player.x + 50 &&
				   my_player.y  < bullets[i].y && bullets[i].y < my_player.y + 50) {
					
					// 被弾した弾丸の表示を消す
					bullets[i].element.remove();
					
					// 【イベント発生】弾丸消滅イベントを発生させる
					_socket.emit('bullet-delete', {
						number  : bullets[i].number,
						userId  : bullets[i].userId
					});
					
					// 自プレイヤーのHPを減算し、HP表示を減算する
					my_player.hp     -= bullets[i].power;
					my_player.damage += bullets[i].power;
					
					var decrement = calcHpLengthDecrement(my_player.damage);
					my_player.element.children('.user-info').children('.hp-area').children('.hp').animate({
						'width': decrement + 'px'
					});

					// 【イベント発生】HP表示減算イベントを発生させる
					_socket.emit('disp-damage', bullets[i].power);

					// HPが0以下になった場合
					if(my_player.hp <= 0) {
						// 【イベント発生】プレーヤーが撃墜されたお知らせイベントを発生させる
						var message = my_player.myname + 'が撃墜されたよ'
						_socket.emit('inform-otherUnitBroken', {message: message});
						location.href = '/gameover';
					}
					
					// 弾丸マップ更新
					_bulletMap[userId].splice(i, 1);
					
					continue;
				}
				
				// 飛んでいる弾丸がプレイングエリアから出れば、弾丸を消す
				if(bullets[i].x < 0 || PLAYING_AREA_WIDTH  < bullets[i].x ||
				   bullets[i].y < 0 || PLAYING_AREA_HEIGHT < bullets[i].y) {

					bullets[i].element.remove();
					_bulletMap[userId].splice(i, 1);
				}
			}
		}

		// ○自弾のブラウザ表示を更新する
		for(var i in my_bullets) {
			
			updateCss(my_bullets[i]);
			
			// 飛んでいる弾丸がプレイングエリアから出れば、弾丸を消す
			if(my_bullets[i].x < 0 || PLAYING_AREA_WIDTH  < my_bullets[i].x ||
			   my_bullets[i].y < 0 || PLAYING_AREA_HEIGHT < my_bullets[i].y) {
				
				// 弾丸マップ更新
				my_bullets[i].element.remove();
				my_bullets.splice(i, 1);
				
			}
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

	/*** mainfunc()の初回起動 ***/
	setTimeout(mainfunc, 30);
	
	/*** キーボードのイベントハンドラを設定 ***/
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
