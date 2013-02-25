
/*
 * GET home page.
 */

exports.index = function(req, res){
  res.render('index');
};
exports.game = function(req, res){
  res.render('game', {'myname': req.param('username')});
};
exports.gameover = function(req, res){
	res.render('gameover');
};