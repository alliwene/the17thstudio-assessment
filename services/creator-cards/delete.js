const validator = require('@app-core/validator');
const { throwAppError } = require('@app-core/errors');
const CreatorCard = require('@app/models/creator-card');

const deleteSpec = `root {
  slug string
  creator_reference string<length:20>
}`;

const parsedDeleteSpec = validator.parse(deleteSpec);

async function deleteCard(serviceData) {
  const validatedData = validator.validate(serviceData, parsedDeleteSpec);

  const card = await CreatorCard.findOne({ slug: validatedData.slug });

  if (!card || card.deleted !== null) {
    throwAppError('Creator card not found', 'NF01');
  }

  card.deleted = Date.now();
  await card.save();

  return card.toJSON();
}

module.exports = deleteCard;
