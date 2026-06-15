const validator = require('@app-core/validator');
const { throwAppError } = require('@app-core/errors');
const CreatorCard = require('@app/models/creator-card');
const crypto = require('crypto');
const { ulid } = require('ulid');

const createSpec = `root {
  title string<minLength:3|maxLength:100>
  description? string<maxLength:500>
  slug? string<minLength:5|maxLength:50|regex:^[a-zA-Z0-9_-]+$>
  creator_reference string<length:20>
  links[]? {
    title string<minLength:1|maxLength:100>
    url string<maxLength:200|regex:^https?://>
  }
  service_rates? {
    currency string(NGN|USD|GBP|GHS)
    rates[] {
      name string<minLength:3|maxLength:100>
      description? string<maxLength:250>
      amount number<min:1>
    }
  }
  status string(draft|published)
  access_type? string(public|private)
  access_code? string
}`;

const parsedCreateSpec = validator.parse(createSpec);

async function generateSlug(title) {
  let slug = title
    .toLowerCase()
    .replace(/\s+/g, '-')
    .replace(/[^a-z0-9_-]/g, '');

  if (slug.length < 5) {
    slug = `${slug}-${crypto.randomBytes(3).toString('hex')}`;
  }

  const exists = await CreatorCard.exists({ slug });
  if (exists) {
    slug = `${slug}-${crypto.randomBytes(3).toString('hex')}`;
  }
  return slug;
}

async function create(serviceData) {
  const validatedData = validator.validate(serviceData, parsedCreateSpec);

  const isPrivate = validatedData.access_type === 'private';

  if (isPrivate) {
    if (!validatedData.access_code) {
      throwAppError('access_code is required when access_type is private', 'AC01');
    }
    if (!/^[a-zA-Z0-9]{6}$/.test(validatedData.access_code)) {
      throwAppError('access_code must be exactly 6 alphanumeric characters', 'AC01');
    }
  } else if (validatedData.access_code) {
    throwAppError('access_code can only be set on private cards', 'AC05');
  }

  let finalSlug = validatedData.slug;
  if (finalSlug) {
    const exists = await CreatorCard.exists({ slug: finalSlug });
    if (exists) {
      throwAppError('Slug is already taken', 'SL02');
    }
  } else {
    finalSlug = await generateSlug(validatedData.title);
  }

  const now = Date.now();
  const cardData = {
    ...validatedData,
    _id: ulid(),
    slug: finalSlug,
    access_type: validatedData.access_type || 'public',
    created: now,
    updated: now,
  };

  if (
    cardData.service_rates &&
    (!cardData.service_rates.rates || cardData.service_rates.rates.length === 0)
  ) {
    throwAppError(
      'service_rates.rates must be a non-empty array if service_rates is present',
      'VALIDATIONERR'
    );
  }

  const card = await CreatorCard.create(cardData);
  return card.toJSON();
}

module.exports = create;
