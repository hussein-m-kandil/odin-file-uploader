const { PrismaSessionStore } = require('@quixo3/prisma-session-store');
const { prismaClient } = require('../model/db.js');
const expressSession = require('express-session');
const PassportLocalStrategy = require('passport-local').Strategy;
const passport = require('passport');
const bcrypt = require('bcryptjs');

function authenticate(app) {
  passport.serializeUser(({ id }, done) => done(null, id));

  passport.deserializeUser((id, done) => {
    prismaClient.user
      .findUnique({ where: { id } })
      .then((user) => {
        if (!user) {
          return done(null, false, { message: 'Invalid member!' });
        }
        done(null, user);
      })
      .catch(done);
  });

  passport.use(
    new PassportLocalStrategy(
      {
        usernameField: 'username',
        passwordField: 'password',
      },
      (username, password, done) => {
        prismaClient.user
          .findUnique({ where: { username: username } })
          .then((user) => {
            const message = 'Incorrect username or password';
            if (!user) {
              return done(null, false, { message });
            }
            bcrypt.compare(password, user.password, (err, match) => {
              if (err) return done(err);
              if (!match) {
                return done(null, false, { message });
              }
              return done(null, user);
            });
          })
          .catch(done);
      }
    )
  );

  app.use(
    expressSession({
      store: new PrismaSessionStore(prismaClient, {
        checkPeriod: 2 * 60 * 1000,
        dbRecordIdIsSessionId: true,
        dbRecordIdFunction: undefined,
      }),
      secret: process.env.SESSION_SECRET,
      saveUninitialized: Boolean(process.env.SESSION_SAVE_NOT_INIT),
      resave: Boolean(process.env.SESSION_RESAVE),
      cookie: {
        sameSite: process.env.SESSION_COOKIE_SAME_SITE,
        httpOnly: Boolean(process.env.SESSION_COOKIE_HTTP_ONLY),
        secure: Boolean(process.env.SESSION_COOKIE_SECURE),
        maxAge: 24 * 60 * 60 * 1000,
      },
    })
  );

  app.use(passport.session());
}

module.exports = authenticate;
