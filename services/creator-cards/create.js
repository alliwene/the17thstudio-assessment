const validator = require('@app-core/validator');
const { throwAppError } = require('@app-core/errors');
const CreatorCard = require('@app/models/creator-card');
const crypto = require('crypto');
const { ulid } = require('ulid');

const SLUG_MAX_LENGTH = 50;
const SLUG_SUFFIX_LENGTH = 6;
const SLUG_SUFFIX_SEPARATOR_LENGTH = 1;
const SLUG_PATTERN = /^[a-zA-Z0-9_-]+$/;
const ACCESS_CODE_PATTERN = /^[a-zA-Z0-9]{6}$/;
const LINK_URL_PATTERN = /^https?:\/\//;
const MAX_SLUG_GENERATION_ATTEMPTS = 10;

const createSpec = `root {
  title string<minLength:3|maxLength:100>
  description? string<maxLength:500>
  slug? string<minLength:5|maxLength:50>
  creator_reference string<length:20>
  links[]? {
    title string<minLength:1|maxLength:100>
    url string<maxLength:200>
  }
  service_rates? {
    currency string(NGN|USD|GBP|GHS)
    rates[] {
      name string<minLength:3|maxLength:100>
      description string<maxLength:250>
      amount number<min:1>
    }
  }
  status string(draft|published)
  access_type? string(public|private)
  access_code? string
}`;

const parsedCreateSpec = validator.parse(createSpec);

function createSlugSuffix() {
  return crypto.randomBytes(3).toString('hex');
}

function appendSlugSuffix(slug) {
  const baseMaxLength = SLUG_MAX_LENGTH - SLUG_SUFFIX_SEPARATOR_LENGTH - SLUG_SUFFIX_LENGTH;
  const baseSlug = slug.slice(0, baseMaxLength);

  return `${baseSlug}-${createSlugSuffix()}`;
}

function createBaseSlug(title) {
  return title
    .toLowerCase()
    .replace(/\s+/g, '-')
    .replace(/[^a-z0-9_-]/g, '')
    .slice(0, SLUG_MAX_LENGTH);
}

async function isSlugTaken(slug) {
  const exists = await CreatorCard.exists({ slug });

  return !!exists;
}

async function generateSlug(title) {
  const baseSlug = createBaseSlug(title);
  let slug = baseSlug;

  if (slug.length >= 5 && !(await isSlugTaken(slug))) {
    return slug;
  }

  for (let attempt = 0; attempt < MAX_SLUG_GENERATION_ATTEMPTS; attempt++) {
    slug = appendSlugSuffix(baseSlug);

    // The next candidate depends on the previous uniqueness result.
    // eslint-disable-next-line no-await-in-loop
    if (!(await isSlugTaken(slug))) {
      return slug;
    }
  }

  throwAppError('Unable to generate a unique slug', 'SL02');
}

function validateProvidedSlug(slug) {
  if (slug && !SLUG_PATTERN.test(slug)) {
    throwAppError(
      'slug can only contain letters, numbers, hyphens and underscores',
      'VALIDATIONERR'
    );
  }
}

function validateLinks(links = []) {
  links.forEach((link) => {
    if (!LINK_URL_PATTERN.test(link.url)) {
      throwAppError('links.url must start with http:// or https://', 'VALIDATIONERR');
    }
  });
}

function validateServiceRates(serviceRates) {
  if (!serviceRates) return;

  if (!serviceRates.rates || serviceRates.rates.length === 0) {
    throwAppError(
      'service_rates.rates must be a non-empty array if service_rates is present',
      'VALIDATIONERR'
    );
  }

  serviceRates.rates.forEach((rate) => {
    if (!Number.isInteger(rate.amount)) {
      throwAppError('service_rates.rates.amount must be a positive integer', 'VALIDATIONERR');
    }
  });
}

function isDuplicateSlugError(error) {
  return (
    error &&
    (error.code === 11000 || error.code === '11000') &&
    (!error.keyPattern || error.keyPattern.slug)
  );
}

async function create(serviceData) {
  const validatedData = validator.validate(serviceData, parsedCreateSpec);

  const isPrivate = validatedData.access_type === 'private';

  if (isPrivate) {
    if (!validatedData.access_code) {
      throwAppError('access_code is required when access_type is private', 'AC01');
    }
    if (!ACCESS_CODE_PATTERN.test(validatedData.access_code)) {
      throwAppError('access_code must be exactly 6 alphanumeric characters', 'AC01');
    }
  } else if (validatedData.access_code) {
    throwAppError('access_code can only be set on private cards', 'AC05');
  }

  validateProvidedSlug(validatedData.slug);
  validateLinks(validatedData.links);
  validateServiceRates(validatedData.service_rates);

  let finalSlug = validatedData.slug;
  if (finalSlug) {
    if (await isSlugTaken(finalSlug)) {
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
    access_code: validatedData.access_code || null,
    created: now,
    updated: now,
  };

  let card;
  try {
    card = await CreatorCard.create(cardData);
  } catch (error) {
    if (isDuplicateSlugError(error)) {
      throwAppError('Slug is already taken', 'SL02');
    }

    throw error;
  }

  return card.toJSON();
}

module.exports = create;
