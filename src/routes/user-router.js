const { Router } = require('express');
const userController = require('../controllers/user-controller.js');

const router = Router();

const LOGIN_ROUTE = '/login';

const verifyUserAuthentication = (req, res, next) => {
  if (req.isAuthenticated()) return next();
  res.redirect(`${req.baseUrl}${LOGIN_ROUTE}`);
};

router
  .route(LOGIN_ROUTE)
  .get(userController.getLogin)
  .post(userController.postLogin);

router
  .route('/signup')
  .get(userController.getSignup)
  .post(userController.postSignup);

router.use(verifyUserAuthentication);

router.get('/', userController.getUser);

router.get('/logout', userController.getLogout);

router
  .route('/update')
  .get(userController.getUpdate)
  .post(userController.postUpdate);

router.post('/delete', userController.postDelete);

module.exports = router;
