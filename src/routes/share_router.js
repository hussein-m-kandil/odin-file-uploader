const { Router } = require('express');
const filesController = require('../controllers/files-controller.js');

const router = Router();

router.use((req, res, next) => {
  req._shareRoute = true;
  next();
});

router.get('/:id/download', filesController.getDownload);

router.get('/:id', filesController.getFile);

module.exports = router;
