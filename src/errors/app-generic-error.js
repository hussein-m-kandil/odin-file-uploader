class AppGenericError extends Error {
  constructor(message, statusCode = 500) {
    super(message || 'Oops, something wrong!');
    this.statusCode = statusCode;
    this.name = AppGenericError.name;
  }
}

module.exports = AppGenericError;
