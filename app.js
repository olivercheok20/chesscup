var express = require('express');
var path = require('path');
var favicon = require('serve-favicon');
var logger = require('morgan');
var cookieParser = require('cookie-parser');
var bodyParser = require('body-parser');
var session = require('express-session');
var passport = require('passport');
var LocalStrategy = require('passport-local').Strategy;
var MySQLStore = require('express-mysql-session')(session);

var flash = require('connect-flash');
var Database = require('./routes/sql');



var app = express();
var engine = require('ejs-mate');

// view engine setup
app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'ejs');
app.engine('ejs', engine);

let db_pass = "3345";
let db_name = "chess";
if (process.env.NODE_ENV === "dev-linux") {
    db_pass = "ubuntu34";
}


var pool = new Database({
    host: 'localhost',
    user: 'root',
    password: db_pass,
    database: db_name,
    connectionLimit: 10,
    acquireTimeout: 1000
});


var sessionStore = new MySQLStore({}, pool.getConnection());


//app.use(favicon());
app.use(logger('dev'));
app.use(bodyParser.json());
app.use(bodyParser.urlencoded());
app.use(cookieParser());
app.use(express.static(path.join(__dirname, 'public')));


app.use(session({
    key: 'session_cookie_name',
    secret: 'session_cookie_secret',
    store: sessionStore,
    resave: false,
    saveUninitialized: false
}));
app.use(flash());



app.use(passport.initialize());
app.use(passport.session());

app.use(function(req, res, next) {
    res.locals.user = req.session.passport;
    next();
});


var getUser = function(email, password, cb) {
    pool.query("SELECT * FROM users WHERE email = ? AND password = ? LIMIT 1", [email, password])
        .then(function (rows) {
            if (rows.length > 0) {
                cb(null, rows[0]);
            } else {
                return cb(null, null);
            }
        }).catch(function (err) {
        console.log(err);
    });
};


passport.serializeUser(function(user, done) {
    let is_sbornik = false;

    done(null, {
        id : user.id,
        name : user.name,
        role : user.role,
        rating : user.rating,
        is_paid : user.is_paid,
        is_sbornik : is_sbornik,
        school_id : user.school_id
    });
});

passport.deserializeUser(function(user, done) {
    pool.query("SELECT * FROM users WHERE id = ? LIMIT 1", user.id)
        .then(function (rows) {
            done(null, user.id);
        }).catch(function (err) {
        console.log(err);
    });
});

passport.use("local-login",new LocalStrategy({
        usernameField: 'username',
        passwordField: 'password',
        passReqToCallBack: true
    },
    function(username, password, done) {
        // return done(null, false, {message: 'Pas d\'utilisateur avec ce login.'});
        getUser(username, password, function(err, user) {
            if (err)
                return done(err);
            if (!user)
                return done(null, false, {message: 'Введенные данные некорректны. Проверьте логин и пароль.'});
            /*if (!user.validPassword(password))
             return done(null, false, {message: 'Oops! Mauvais password.'});*/


            return done(null, user);
        });

    }
));


var routes = require('./routes/index')(app, passport, pool);
var users = require('./routes/users')(app, passport, pool);
var tournament = require('./routes/tournament')(app, passport, pool);

app.use('/', routes);
app.use('/users', users);
app.use('/tournament', tournament);

/// catch 404 and forwarding to error handler
app.use(function(req, res, next) {
    var err = new Error('Not Found');
    err.status = 404;
    next(err);
});

/// error handlers

// development error handler
// will print stacktrace
if (app.get('env') === 'development') {
    app.use(function(err, req, res, next) {
        res.status(err.status || 500);
        res.render('error', {
            message: err.message,
            error: err
        });
    });
}

// production error handler
// no stacktraces leaked to user
app.use(function(err, req, res, next) {
    res.status(err.status || 500);
    res.render('error', {
        message: err.message,
        error: {}
    });
});


module.exports = app;
