const { Router } = require('express');
const userController = require('../controllers/user-controller.js');

const router = Router();

router.get('/', userController.getUser);

router
  .route('/login')
  .get(userController.getLogin)
  .post(userController.postLogin);

router
  .route('/signup')
  .get(userController.getSignup)
  .post(userController.postSignup);

router.get('/logout', userController.getLogout);

// TODO: Add routes for updating/deleting user account

module.exports = router;
