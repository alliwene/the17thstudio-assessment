const { createHandler } = require('@app-core/server');
const deleteService = require('@app/services/creator-cards/delete');

module.exports = createHandler({
  path: '/:slug',
  method: 'delete',
  middlewares: [],
  async handler(rc, helpers) {
    const { slug } = rc.params;
    const creatorReference = rc.body.creator_reference;
    const response = await deleteService(slug, creatorReference);
    return {
      status: helpers.http_statuses.HTTP_200_OK,
      message: 'Creator Card Deleted Successfully.',
      data: response,
    };
  },
});
