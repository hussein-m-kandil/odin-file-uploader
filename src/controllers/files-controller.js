const path = require('node:path');
const { body, param, validationResult } = require('express-validator');
const { Prisma } = require('@prisma/client');
const { prismaClient } = require('../model/db.js');
const AppGenericError = require('../errors/app-generic-error.js');
const multer = require('multer');

let supabase;
try {
  supabase = require('@supabase/supabase-js').createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_ANON_KEY
  );
} catch (e) {
  console.error(e);
}

const MAX_FILE_SIZE_MB = Number(process.env.MAX_FILE_SIZE_MB) || 1;
const MAX_FILE_SIZE_B = MAX_FILE_SIZE_MB * 1024 * 1024;
const CREATE_TITLE = 'Create Folder';
const UPLOAD_TITLE = 'Upload File';
const STORAGE_ROOT_DIR = 'uploads';
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

const generateFormValidators = (uploadForm) => {
  const PREFIX = uploadForm ? 'File name' : 'Folder name';
  const validators = [];
  if (uploadForm) {
    validators.push((req, res, next) => {
      // Set name to the file name to be validated if not given a name
      if (!req.body.name && req.file) req.body.name = req.file.originalname;
      res.locals.formData = req.body;
      req.body.file = req.file;
      next();
    }, body('file').notEmpty().withMessage('A file to upload is required!'));
  }
  validators.push(
    body('name')
      .optional(uploadForm && { values: 'falsy' })
      .isLength({ min: MIN_LEN })
      .withMessage(`${PREFIX} must contain at least ${MIN_LEN} letters`)
      .isLength({ max: MAX_LEN })
      .withMessage(`${PREFIX} can contain at most ${MAX_LEN} letters`),
    (req, res, next) => {
      const validationErrors = validationResult(req);
      if (validationErrors.isEmpty()) return next();
      return res.render(FORM_VIEW, {
        validationErrors: validationErrors.mapped(),
      });
    }
  );
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
 * @param {boolean} metadataIncluded - Include file metadata (`false` by default)
 * @param {boolean} childrenIncluded - Include file children (`false` by default)
 * @param {boolean} parentIncluded - Include file parent (`false` by default)
 * @param {boolean} ownerIncluded - Include file owner (`false` by default)
 *
 * @returns {Prisma.$FilePayload}
 */
const getFileOrThrowError = async (
  req,
  metadataIncluded = false,
  childrenIncluded = false,
  parentIncluded = false,
  ownerIncluded = false
) => {
  try {
    const file = await prismaClient.file.findUnique({
      where: { id: req.params.id, ownerId: req.user.id },
      include: {
        children: childrenIncluded && { orderBy: { name: 'asc' } },
        metadata: metadataIncluded,
        parent: parentIncluded,
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

const renderFormAfterValidatingParentId = async (req, res, next) => {
  const parentId = req.params.id;
  if (parentId) {
    try {
      await getFileOrThrowError(req);
    } catch (err) {
      console.error(err);
      if (err instanceof AppGenericError) {
        if (err.statusCode >= 400 && err.statusCode < 500) {
          err.message = PARENT_NOT_FOUND_ERR_MSG;
        }
        return next(err);
      }
      return next(new AppGenericError(SERVER_ERR_MSG, 500));
    }
  }
  res.render(FORM_VIEW, { parentId });
};

const generateFormMiddlewares = (title) => {
  return [
    ...optionalFileIdValidators,
    (req, res, next) => {
      res.locals.title = title;
      next();
    },
    renderFormAfterValidatingParentId,
  ];
};

const redirectToParentOrRoot = (req, res, parentId) => {
  return res.redirect(parentId ? `${req.baseUrl}/${parentId}` : req.baseUrl);
};

const assertParentExist = async (req, res, next) => {
  try {
    if (req.params.id) await getFileOrThrowError(req);
    next();
  } catch (err) {
    if (err instanceof AppGenericError) {
      console.error(err);
      if (err.statusCode >= 400 && err.statusCode < 500) {
        err.message = PARENT_NOT_FOUND_ERR_MSG;
      }
    }
    next(err);
  }
};

const assertNameNotExist = async (req, res, next) => {
  try {
    await throwErrorIfFileNameExistInRoot(req.body.name, req.user.id);
    next();
  } catch (err) {
    next(err);
  }
};

const humanizeSizeUpToGBOnly = (size) => {
  const toFixed = (n) => Number.prototype.toFixed.call(n, 2);
  const UNITS = [
    ['GB', 1024 ** 3],
    ['MB', 1024 ** 2],
    ['KB', 1024],
  ];
  for (let i = 0; i < UNITS.length; i++) {
    const [unit, value] = UNITS[i];
    if (size >= value) {
      return `${toFixed(size / value)} ${unit}`;
    }
  }
  return `${size} bytes`;
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
        const file = await getFileOrThrowError(req, true, true);
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
        if (!file.isDir) {
          file.metadata.size = humanizeSizeUpToGBOnly(file.metadata.size);
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

  getUpload: generateFormMiddlewares(UPLOAD_TITLE),

  postUpload: [
    ...optionalFileIdValidators,
    (req, res, next) => {
      res.locals.parentId = req.params.id;
      res.locals.title = UPLOAD_TITLE;
      next();
    },
    multer({
      storage: multer.memoryStorage(),
      limits: {
        fileSize: MAX_FILE_SIZE_B,
        files: 1,
      },
    }).single('file'),
    (err, req, res, next) => {
      if (err instanceof multer.MulterError) {
        const msg =
          err.code === 'LIMIT_FILE_SIZE'
            ? `Too large file! File size cannot exceed ${MAX_FILE_SIZE_MB}MB`
            : err.message;
        return res.render(FORM_VIEW, {
          validationErrors: { file: { msg } },
        });
      }
      next(err);
    },
    ...generateFormValidators(true),
    assertParentExist,
    assertNameNotExist,
    async (req, res, next) => {
      try {
        const { file } = req.body;
        const { encoding, mimetype, size, buffer, originalname } = file;
        const fileExt = path.extname(originalname);
        const uniqueSuffix = `${Date.now()}_${Math.round(Math.random() * 1e9)}`;
        const uniqueFileName = `${req.user.id}_${uniqueSuffix}${fileExt}`;
        const filePath = `${STORAGE_ROOT_DIR}/${req.user.username}/${uniqueFileName}`;
        const { data, error } = await supabase.storage
          .from(process.env.SUPABASE_PROJECT_BUCKET)
          .upload(filePath, buffer, { contentType: mimetype });
        if (error) throw error;
        await prismaClient.file.create({
          data: {
            isDir: false,
            name: req.body.name,
            ownerId: req.user.id,
            parentId: req.params.id,
            metadata: {
              create: { encoding, mimetype, size, path: data.path },
            },
          },
        });
        redirectToParentOrRoot(req, res, req.params.id);
      } catch (err) {
        next(err);
      }
    },
    handleCreateOrUpdateError,
  ],

  getCreate: generateFormMiddlewares(CREATE_TITLE),

  postCreate: [
    ...optionalFileIdValidators,
    (req, res, next) => {
      res.locals.parentId = req.params.id;
      res.locals.title = CREATE_TITLE;
      res.locals.formData = req.body;
      next();
    },
    ...generateFormValidators(),
    assertParentExist,
    assertNameNotExist,
    async (req, res, next) => {
      try {
        const parentId = req.params.id;
        await prismaClient.file.create({
          data: {
            isDir: true,
            name: req.body.name,
            ownerId: req.user.id,
            parentId,
          },
        });
        redirectToParentOrRoot(req, res, parentId);
      } catch (err) {
        next(err);
      }
    },
    handleCreateOrUpdateError,
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
        redirectToParentOrRoot(req, res, parentId);
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
        const deletedFile = await prismaClient.file.delete({
          where: { id },
          include: { metadata: true },
        });
        if (!deletedFile.isDir) {
          const { error } = await supabase.storage
            .from(process.env.SUPABASE_PROJECT_BUCKET)
            .remove([deletedFile.metadata.path]);
          if (error) throw error;
        }
        redirectToParentOrRoot(req, res, parentId);
      } catch (err) {
        handleAppErrAndServerErr(err, req, res, next);
      }
    },
  ],
};
