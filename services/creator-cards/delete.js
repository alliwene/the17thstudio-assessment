const { throwAppError } = require('@app-core/errors');
const CreatorCard = require('@app/models/creator-card');

async function deleteCard(slug, creatorReference) {
  if (!creatorReference || creatorReference.length !== 20) {
    throwAppError(
      'creator_reference is required and must be exactly 20 characters',
      'VALIDATIONERR'
    );
  }

  const card = await CreatorCard.findOne({ slug });

  if (!card || card.deleted !== null) {
    throwAppError('Creator card not found', 'NF01');
  }

  card.deleted = Date.now();
  await card.save();

  return card.toJSON();
}

module.exports = deleteCard;
