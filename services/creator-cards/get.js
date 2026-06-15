const { throwAppError } = require('@app-core/errors');
const CreatorCard = require('@app/models/creator-card');

async function getCard(slug, accessCode) {
  const card = await CreatorCard.findOne({ slug });

  if (!card || card.deleted !== null) {
    throwAppError('Creator card not found', 'NF01');
  }

  if (card.status === 'draft') {
    throwAppError('Creator card not found', 'NF02');
  }

  if (card.access_type === 'private') {
    if (!accessCode) {
      throwAppError('This card is private. An access code is required', 'AC03');
    }
    if (card.access_code !== accessCode) {
      throwAppError('Invalid access code', 'AC04');
    }
  }

  const cardData = card.toJSON();
  delete cardData.access_code;

  return cardData;
}

module.exports = getCard;
