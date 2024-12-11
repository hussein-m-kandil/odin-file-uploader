const { body, validationResult } = require('express-validator');
const { prismaClient } = require('../model/db.js');
const passport = require('passport');
const bcrypt = require('bcryptjs');
const AppGenericError = require('../errors/app-generic-error.js');

const SALT = 10;
const MIN_LEN = 3;
const MAX_LEN = 50;
const PASS_MIN_LEN = 8;
const FULLNAME_MAX_LEN = 100;
const LOGIN_TITLE = 'Log In';
const SIGNUP_TITLE = 'Sign Up';
const USER_FORM_VIEW = 'user-form';
const UPDATE_TITLE = 'Update your information';

const genMinLenErrMsg = (prefix, min, suffix) => {
  return `${prefix} must have at least ${min} ${suffix || 'characters'}`;
};

const genMaxLenErrMsg = (prefix, max, suffix) => {
  return `${prefix} cannot have more than ${max} ${suffix || 'characters'}`;
};

const generateUserFormValidators = (signup) => {
  const isEqualPasswords = (_, { req }) => {
    const { password, password_confirm } = req.body;
    if (password !== password_confirm) {
      throw Error('Password confirmation does not match');
    }
    return true;
  };
  const optionalOpts = signup ? false : { values: 'falsy' };
  return [
    body('username')
      .isLength({ min: MIN_LEN })
      .withMessage(genMinLenErrMsg('A username', MIN_LEN))
      .isLength({ max: MAX_LEN })
      .withMessage(genMaxLenErrMsg('A username', MAX_LEN))
      .isAlphanumeric(undefined, { ignore: '._-' })
      .withMessage(
        'A username can contain dots, hyphens, underscores, letters, and numbers'
      ),
    body(['password', 'password_confirm'])
      .optional(optionalOpts)
      .isLength({ min: PASS_MIN_LEN })
      .withMessage(genMinLenErrMsg('A password', PASS_MIN_LEN))
      .isLength({ max: MAX_LEN })
      .withMessage(genMaxLenErrMsg('A password', MAX_LEN)),
    body(['password', 'password_confirm'])
      .optional(optionalOpts)
      .custom(isEqualPasswords),
    body('fullname')
      .isLength({ min: MIN_LEN })
      .withMessage(genMinLenErrMsg('A full name', MIN_LEN, 'letters'))
      .isLength({ max: FULLNAME_MAX_LEN })
      .withMessage(genMaxLenErrMsg('A full name', FULLNAME_MAX_LEN, 'letters'))
      .isAlpha(undefined, { ignore: '._ -/()[]~' })
      .withMessage('Not all special characters are allowed'),
    (req, res, next) => {
      const validationErrors = validationResult(req);
      if (!validationErrors.isEmpty()) {
        return res.status(400).render(USER_FORM_VIEW, {
          validationErrors: validationErrors.mapped(),
        });
      }
      next();
    },
  ];
};

const handleLogoutError = (error, next) => {
  console.log('This error has occurred in "req.logout"!\n', error);
  const appError = new AppGenericError(
    'Could not log you out! Try again later.',
    500
  );
  return next(appError);
};

module.exports = {
  getLogin: (req, res) => {
    res.render(USER_FORM_VIEW, { title: LOGIN_TITLE });
  },

  postLogin: (req, res, next) => {
    passport.authenticate('local', (error, user, info) => {
      // 4th arg 'status' represent errors occurred before executing the verifier
      // e.g. (..., info.message='Missing Credentials', status=400) => Empty username/password
      if (error) return next(error);
      if (!user) {
        return res
          .status(404)
          .render(USER_FORM_VIEW, { title: LOGIN_TITLE, error: info.message });
      }
      // Pass the user to req.login(user, next), otherwise, the session won't gen updated
      // https://github.com/jwalton/passport-api-docs?tab=readme-ov-file
      req.login(user, () => res.redirect('/'));
    })(req, res, next);
  },

  getLogout: (req, res, next) => {
    req.logout((error) => {
      if (error) {
        return handleLogoutError(error, next);
      }
      res.redirect('/');
    });
  },

  getSignup: (req, res) => {
    res.render(USER_FORM_VIEW, { title: SIGNUP_TITLE, fullForm: true });
  },

  postSignup: [
    (req, res, next) => {
      res.locals.title = SIGNUP_TITLE;
      res.locals.formData = req.body;
      res.locals.fullForm = true;
      next();
    },
    ...generateUserFormValidators(true),
    (req, res) => {
      bcrypt.hash(req.body.password, SALT, async (err, hashedPassword) => {
        try {
          if (err) throw err;
          const data = {
            fullname: req.body.fullname,
            username: req.body.username,
            password: hashedPassword,
          };
          const user = await prismaClient.user.create({ data });
          req.login(user, () => res.redirect('/'));
        } catch (error) {
          if (error.code === 'P2002') {
            res.locals.error = 'This username is already exists!';
            return res.status(409).render(USER_FORM_VIEW);
          }
          return res.status(500).render(USER_FORM_VIEW, {
            error: 'Sorry, we cannot sign you up! Try again later.',
          });
        }
      });
    },
  ],

  getUser: (req, res) => {
    res.render('user', { title: req.user.username });
  },

  getUpdate: (req, res) => {
    res.render(USER_FORM_VIEW, {
      title: UPDATE_TITLE,
      fullForm: true,
      formData: {
        username: req.user.username,
        fullname: req.user.fullname,
      },
    });
  },

  postUpdate: [
    (req, res, next) => {
      res.locals.title = UPDATE_TITLE;
      res.locals.formData = req.body;
      res.locals.fullForm = true;
      next();
    },
    ...generateUserFormValidators(false),
    (req, res, next) => {
      res.locals.error =
        'Sorry, we cannot commit your updates! Try again later.';
      if (!req.body.password) return next();
      bcrypt.hash(req.body.password, SALT, async (err, passwordHash) => {
        if (err) res.status(500).render(USER_FORM_VIEW);
        res.locals.passwordHash = passwordHash;
        next();
      });
    },
    (req, res) => {
      const { id } = req.user;
      const data = {
        username: req.body.username,
        fullname: req.body.fullname,
        password: res.locals.passwordHash,
      };
      prismaClient.user
        .update({ where: { id }, data })
        .then(() => res.redirect(req.baseUrl))
        .catch(() => res.status(500).render(USER_FORM_VIEW));
    },
  ],

  postDelete: (req, res, next) => {
    const id = req.user.id;
    req.logout((error) => {
      if (error) {
        return handleLogoutError(error, next);
      }
      prismaClient.user
        .delete({ where: { id } })
        .then(() => res.redirect('/'))
        .catch((error) => {
          console.log(error);
          const msg = 'Cannot delete your account! Try again later.';
          next(new AppGenericError(msg, 500));
        });
    });
  },
};
