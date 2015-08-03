(function(module) {
	"use strict";

	var User = module.parent.require('./user'),
		db = module.parent.require('./database'),
		meta = module.parent.require('./meta'),
		passport = module.parent.require('passport'),
		nconf = module.parent.require('nconf'),
		QQStrategy = require('passport-qq').Strategy;

	var constants = Object.freeze({
		'name': "QQ",
		'admin': {
			'icon': 'fa-qq',
			'route': '/plugins/sso-qq'
		}
	});

	var QQ = {};

	QQ.getStrategy = function(strategies, callback) {
		meta.settings.get('sso-qq', function (err, settings) {
			if (!err && settings.id && settings.secret) {
				passport.use(new QQStrategy({
					clientID: settings.id,
					clientSecret: settings.secret,
					callbackURL: nconf.get('url') + '/auth/qq/callback'
				}, function (token, tokenSecret, profile, done) {
					console.log(profile);
					var email = '';
					if (profile.emails && profile.emails.length) {
						email = profile.emails[0].value
					}
					var picture = profile.avatarUrl;
					if (profile._json.avatar_large) {
						picture = profile._json.avatar_large;
					}
					QQ.login(profile.id, profile.username, email, picture, function (err, user) {
						if (err) {
							return done(err);
						}
						done(null, user);
					});
				}));

				strategies.push({
					name: 'qq',
					url: '/auth/qq',
					callbackURL: '/auth/qq/callback',
					icon: constants.admin.icon,
					scope: 'user:email'
				});
			}

			callback(null, strategies);
		});
	};

	QQ.login = function(qqID, username, email, picture, callback) {
		if (!email) {
			email = username + '@users.noreply.qq.com';
		}

		QQ.getUidByQQID(qqID, function(err, uid) {
			if (err) {
				return callback(err);
			}

			if (uid) {
				// Existing User
				callback(null, {
					uid: uid
				});
			} else {
				// New User
				var success = function(uid) {
					User.setUserField(uid, 'qqid', qqID);
					User.setUserField(uid, 'picture', picture);
					User.setUserField(uid, 'gravatarpicture', picture);
					User.setUserField(uid, 'uploadedpicture', picture);
					db.setObjectField('qqid:uid', qqID, uid);
					callback(null, {
						uid: uid
					});
				};

				User.getUidByEmail(email, function(err, uid) {
					if (!uid) {
						User.create({username: username, email: email, picture:picture, uploadedpicture:picture}, function(err, uid) {
							if (err !== null) {
								callback(err);
							} else {
								success(uid);
							}
						});
					} else {
						success(uid); // Existing account -- merge
					}
				});
			}
		});
	};

	QQ.getUidByQQID = function(qqID, callback) {
		db.getObjectField('qqid:uid', qqID, function(err, uid) {
			if (err) {
				callback(err);
			} else {
				callback(null, uid);
			}
		});
	};

	QQ.addMenuItem = function(custom_header, callback) {
		custom_header.authentication.push({
			"route": constants.admin.route,
			"icon": constants.admin.icon,
			"name": constants.name
		});

		callback(null, custom_header);
	};

	QQ.init = function(params, callback) {
		function renderAdmin(req, res) {
			res.render('admin/plugins/sso-qq', {});
		}

		params.router.get('/admin/plugins/sso-qq', params.middleware.admin.buildHeader, renderAdmin);
		params.router.get('/api/admin/plugins/sso-qq', renderAdmin);

		callback();
	};

	module.exports = QQ;
}(module));
