const { Router } = require('express');
const userController = require('../controllers/user-controller.js');

const router = Router();

const LOGIN_ROUTE = '/login';

const validateAuthentication = (req, res, next) => {
  if (req.isAuthenticated()) return next();
  res.redirect(`${req.baseUrl}${LOGIN_ROUTE}`);
};

router.get('/', validateAuthentication, userController.getUser);

router
  .route(LOGIN_ROUTE)
  .get(userController.getLogin)
  .post(userController.postLogin);

router
  .route('/signup')
  .get(userController.getSignup)
  .post(userController.postSignup);

router.get('/logout', validateAuthentication, userController.getLogout);

router
  .route('/update')
  .get(validateAuthentication, userController.getUpdate)
  .post(validateAuthentication, userController.postUpdate);

router.post('/delete', validateAuthentication, userController.postDelete);

module.exports = router;
