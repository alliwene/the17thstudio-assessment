const { createHandler } = require('@app-core/server');
const getService = require('@app/services/creator-cards/get');

module.exports = createHandler({
  path: '/:slug',
  method: 'get',
  middlewares: [],
  async handler(rc, helpers) {
    const { slug } = rc.params;
    const accessCode = rc.query.access_code;
    const response = await getService(slug, accessCode);
    return {
      status: helpers.http_statuses.HTTP_200_OK,
      message: 'Creator Card Retrieved Successfully.',
      data: response,
    };
  },
});
