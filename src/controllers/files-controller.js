const { body, param, validationResult } = require('express-validator');
const { Prisma } = require('@prisma/client');
const { prismaClient } = require('../model/db.js');
const AppGenericError = require('../errors/app-generic-error.js');

const CREATE_TITLE = 'Create Folder';
const FORM_VIEW = 'file-form';
const MAX_LEN = 100;
const MIN_LEN = 1;
const FK_VIOLATION_CODE = 'P2003';
const UNIQUE_VIOLATION_CODE = 'P2002';
const FILE_NOT_FOUND_ERR_MSG = 'File Not Found!';
const PARENT_NOT_FOUND_ERR_MSG = 'Parent folder not found!';
const SERVER_ERR_MSG = 'Oops, something wrong! Try again later.';
const NAME_EXISTS_ERR_MSG = 'This name is already exists in the same folder!';

const generateRenameTitle = (fileName) => `Rename ${fileName}`;

const generateFormValidators = () => {
  const validators = [
    body('name')
      .isLength({ min: MIN_LEN })
      .withMessage(`A name must contain at least ${MIN_LEN} letters`)
      .isLength({ max: MAX_LEN })
      .withMessage(`A name can contain at most ${MAX_LEN} letters`),
  ];
  validators.push((req, res, next) => {
    const validationErrors = validationResult(req);
    if (validationErrors.isEmpty()) return next();
    return res.render(FORM_VIEW, {
      validationErrors: validationErrors.mapped(),
    });
  });
  return validators;
};

const optionalFileIdValidators = [
  param('id').optional().isUUID(),
  (req, res, next) => {
    if (validationResult(req).isEmpty()) return next();
    next(new AppGenericError('Invalid file!', 400));
  },
];

/**
 * Return a File object or response with 404 NOT FOUND
 *
 * @param {Express.Request} req - Express request object
 * @param {Express.Response} res - Express response object
 * @param {function} next - Express next-middle caller
 * @param {boolean} childrenIncluded - Include the file's children (`false` by default)
 * @param {boolean} parentIncluded - Include the file's parent (`false` by default)
 * @param {boolean} ownerIncluded - Include the file's owner (`false` by default)
 *
 * @returns {Prisma.$FilePayload}
 */
const getFileOrThrowError = async (
  req,
  childrenIncluded = false,
  parentIncluded = false,
  ownerIncluded = false
) => {
  try {
    const file = await prismaClient.file.findUnique({
      where: { id: req.params.id, ownerId: req.user.id },
      include: {
        parent: parentIncluded,
        children: childrenIncluded && { orderBy: { name: 'asc' } },
        owner: ownerIncluded,
      },
    });
    if (file) return file;
    throw new AppGenericError(FILE_NOT_FOUND_ERR_MSG, 404);
  } catch (e) {
    console.error(e);
    throw new AppGenericError(SERVER_ERR_MSG, 500);
  }
};

/**
 * Throw an unique constraint violation error if the given name exists
 * in the root level of the file system (i.e. parent directory is NULL),
 * because the unique constraint on the fields: (`file_name`, `parent_id`)'
 * won't sound if the parent is NULL which is always unique (i.d. NULL not equal NULL)!
 *
 * @param {string} name - File name
 * @param {string} ownerId - UUID of the owner
 *
 * @returns {void}
 */
const throwErrorIfFileNameExistInRoot = async (name, ownerId) => {
  const file = await prismaClient.file.findFirst({
    where: { name, ownerId, parentId: null },
  });
  if (file) {
    throw new Prisma.PrismaClientKnownRequestError(
      '\n\tUnique constraint failed on the fields: (`file_name`,`parent_id`)',
      {
        code: UNIQUE_VIOLATION_CODE,
        clientVersion: Prisma.prismaVersion.client,
        meta: { modelName: 'File', target: ['file_name', 'parent_id'] },
      }
    );
  }
};

const handleAppErrAndServerErr = (err, req, res, next) => {
  console.error(err);
  if (err instanceof AppGenericError) next(err);
  else next(new AppGenericError(SERVER_ERR_MSG, 500));
};

const handleCreateOrUpdateError = (err, req, res, next) => {
  console.error(err);
  if (err.code === FK_VIOLATION_CODE) {
    return next(new AppGenericError(PARENT_NOT_FOUND_ERR_MSG, 404));
  } else if (err.code === UNIQUE_VIOLATION_CODE) {
    return res.status(409).render(FORM_VIEW, { error: NAME_EXISTS_ERR_MSG });
  }
  return res.status(500).render(FORM_VIEW, { error: SERVER_ERR_MSG });
};

const redirectAfterCRUD = (req, res, parentId) => {
  return res.redirect(parentId ? `${req.baseUrl}/${parentId}` : req.baseUrl);
};

module.exports = {
  getRootFiles: [
    async (req, res, next) => {
      try {
        res.locals.files = await prismaClient.file.findMany({
          where: { parentId: null, ownerId: req.user.id },
          orderBy: { name: 'asc' },
        });
        next();
      } catch (e) {
        console.error(e);
        res.locals.error = 'Could not find any files!';
        res.statusCode = 500;
        next();
      }
    },
    (req, res) => {
      res.render('index', { title: `${req.user.username} files` });
    },
  ],

  getFile: [
    ...optionalFileIdValidators,
    async (req, res, next) => {
      try {
        // Get the file with its children or send 404 error
        const file = await getFileOrThrowError(req, true);
        if (file.parentId) {
          // Get the full parent chain if the parent's id is not `NULL`
          res.locals.parents = await prismaClient.$queryRaw`
            WITH RECURSIVE parents AS (
              SELECT files.*, 0 AS i
                FROM files
               WHERE file_id  = ${file.parentId}::UUID
                 AND owner_id = ${req.user.id}::INTEGER
               UNION
              SELECT files.*, i + 1
                FROM files, parents
               WHERE files.file_id = parents.parent_id
            )
            SELECT parent_id parentId, owner_id ownerId,
                   is_public isPublic, is_dir isDir,
                   file_name name, file_id id
              FROM parents
          ORDER BY i
              DESC
          `;
        }
        return res.render('index', {
          file,
          title: file.name,
          files: file.children,
        });
      } catch (err) {
        handleAppErrAndServerErr(err, req, res, next);
      }
    },
  ],

  getCreate: [
    ...optionalFileIdValidators,
    async (req, res, next) => {
      res.locals.title = CREATE_TITLE;
      const parentId = req.params.id;
      if (parentId) {
        try {
          await getFileOrThrowError(req);
          return res.render(FORM_VIEW, { parentId });
        } catch (err) {
          console.error(err);
          if (err instanceof AppGenericError) {
            if (err.statusCode >= 400 && err.statusCode < 500) {
              err.message = PARENT_NOT_FOUND_ERR_MSG;
            }
            next(err);
          } else next(new AppGenericError(SERVER_ERR_MSG, 500));
        }
      }
      res.render(FORM_VIEW);
    },
  ],

  postCreate: [
    ...optionalFileIdValidators,
    (req, res, next) => {
      res.locals.title = CREATE_TITLE;
      res.locals.formData = req.body;
      next();
    },
    ...generateFormValidators(),
    async (req, res, next) => {
      try {
        const { name } = req.body;
        const ownerId = req.user.id;
        const parentId = req.params.id;
        if (parentId) await getFileOrThrowError(req);
        else await throwErrorIfFileNameExistInRoot(name, ownerId);
        await prismaClient.file.create({
          data: { isDir: true, ownerId, parentId, name },
        });
        redirectAfterCRUD(req, res, parentId);
      } catch (err) {
        if (err instanceof AppGenericError) {
          console.error(err);
          if (err.statusCode >= 400 && err.statusCode < 500) {
            err.message = PARENT_NOT_FOUND_ERR_MSG;
          }
          next(err);
        } else handleCreateOrUpdateError(err, req, res, next);
      }
    },
  ],

  getRename: [
    ...optionalFileIdValidators,
    async (req, res, next) => {
      try {
        const { name, parentId } = await getFileOrThrowError(req);
        res.render(FORM_VIEW, {
          title: generateRenameTitle(name),
          formData: { name },
          parentId,
        });
      } catch (err) {
        handleAppErrAndServerErr(err, req, res, next);
      }
    },
  ],

  postRename: [
    ...optionalFileIdValidators,
    async (req, res, next) => {
      try {
        const { name, parentId } = await getFileOrThrowError(req);
        res.locals.title = generateRenameTitle(name);
        res.locals.formData = req.body;
        res.locals.parentId = parentId;
        next();
      } catch (err) {
        handleAppErrAndServerErr(err, req, res, next);
      }
    },
    ...generateFormValidators(),
    async (req, res, next) => {
      try {
        const ownerId = req.user.id;
        const { id } = req.params;
        const { name } = req.body;
        const { parentId } = res.locals;
        if (!parentId) await throwErrorIfFileNameExistInRoot(name, ownerId);
        await prismaClient.file.update({ where: { id }, data: { name } });
        redirectAfterCRUD(req, res, parentId);
      } catch (err) {
        handleCreateOrUpdateError(err, req, res, next);
      }
    },
  ],

  getDelete: [
    ...optionalFileIdValidators,
    async (req, res, next) => {
      try {
        const { name, parentId } = await getFileOrThrowError(req);
        res.render(FORM_VIEW, {
          title: `Delete ${name}`,
          parentId,
          name,
        });
      } catch (err) {
        handleAppErrAndServerErr(err, req, res, next);
      }
    },
  ],

  postDelete: [
    ...optionalFileIdValidators,
    async (req, res, next) => {
      try {
        const { id, parentId } = await getFileOrThrowError(req);
        await prismaClient.file.delete({ where: { id } });
        redirectAfterCRUD(req, res, parentId);
      } catch (err) {
        handleAppErrAndServerErr(err, req, res, next);
      }
    },
  ],
};
