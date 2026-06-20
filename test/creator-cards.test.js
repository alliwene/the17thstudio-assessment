const { expect } = require('chai');

process.env.PINO_LOG_LEVEL = 'silent';

const createMockServer = require('@app-core/mock-server');
const CreatorCard = require('@app/models/creator-card');

const creatorReference = 'crt_8f2k1m9x4p7w3q5z';
const alternateCreatorReference = 'crt_a1b2c3d4e5f6g7h8';

const server = createMockServer(['endpoints/creator-cards'], {
  pathPrefix: '/creator-cards',
});

const storedCards = new Map();
const originalModelMethods = {};

function basePayload(overrides = {}) {
  return {
    title: 'George Cooks',
    description: 'Weekly cooking podcast',
    slug: 'george-cooks',
    creator_reference: creatorReference,
    links: [{ title: 'YouTube', url: 'https://youtube.com/@georgecooks' }],
    service_rates: {
      currency: 'NGN',
      rates: [{ name: 'IG Story Post', description: 'One story mention', amount: 5000000 }],
    },
    status: 'published',
    ...overrides,
  };
}

function createCardDocument(data) {
  const document = new CreatorCard(data);

  document.save = async function save() {
    storedCards.set(this.slug, this);
    return this;
  };

  return document;
}

function expectSuccess(response, statusCode = 200) {
  expect(response.statusCode).to.equal(statusCode);
  expect(response.data.status).to.equal('success');
  expect(response.data.message).to.be.a('string').and.not.equal('');
  return response.data.data;
}

function expectError(response, statusCode, code) {
  expect(response.statusCode).to.equal(statusCode);
  expect(response.data.status).to.equal('error');
  expect(response.data.message).to.be.a('string').and.not.equal('');
  expect(response.data.code).to.equal(code);
}

async function postCreatorCard(payload) {
  return server.post('/creator-cards', { body: payload });
}

async function getCreatorCard(slug, accessCode) {
  const query = accessCode ? `?access_code=${accessCode}` : '';
  return server.get(`/creator-cards/${slug}${query}`);
}

async function deleteCreatorCard(slug, body = { creator_reference: creatorReference }) {
  return server.delete(`/creator-cards/${slug}`, { body });
}

describe('Creator Cards API', () => {
  before(() => {
    ['exists', 'create', 'findOne'].forEach((method) => {
      originalModelMethods[method] = CreatorCard[method];
    });

    CreatorCard.exists = async ({ slug }) => {
      const card = storedCards.get(slug);
      return card ? { _id: card._id } : null;
    };

    CreatorCard.create = async (data) => {
      if (storedCards.has(data.slug)) {
        const error = new Error('Duplicate slug');
        error.code = 11000;
        error.keyPattern = { slug: 1 };
        throw error;
      }

      const card = createCardDocument(data);
      const validationError = card.validateSync();
      if (validationError) throw validationError;

      storedCards.set(card.slug, card);
      return card;
    };

    CreatorCard.findOne = async ({ slug }) => storedCards.get(slug) || null;
  });

  after(() => {
    Object.entries(originalModelMethods).forEach(([method, implementation]) => {
      CreatorCard[method] = implementation;
    });
  });

  beforeEach(() => {
    storedCards.clear();
  });

  it('creates a full public card with id serialization and default public access', async () => {
    const data = expectSuccess(await postCreatorCard(basePayload({ access_type: undefined })));

    expect(data).to.include({
      title: 'George Cooks',
      slug: 'george-cooks',
      creator_reference: creatorReference,
      access_type: 'public',
      access_code: null,
      deleted: null,
    });
    expect(data.id).to.be.a('string').and.have.length(26);
    expect(data).to.not.have.property('_id');
    expect(data.links[0]).to.deep.equal({
      title: 'YouTube',
      url: 'https://youtube.com/@georgecooks',
    });
    expect(data.service_rates.rates[0].amount).to.equal(5000000);
  });

  it('auto-generates slugs from title and keeps generated slugs within limits', async () => {
    const generated = expectSuccess(
      await postCreatorCard(
        basePayload({
          title: 'Ada Designs Things',
          slug: undefined,
          creator_reference: alternateCreatorReference,
        })
      )
    );
    expect(generated.slug).to.equal('ada-designs-things');

    storedCards.clear();
    const longSlug = expectSuccess(
      await postCreatorCard(
        basePayload({
          title: 'This Title Is Deliberately Longer Than Fifty Characters For Slug Generation',
          slug: undefined,
        })
      )
    );
    expect(longSlug.slug).to.have.length.at.most(50);
  });

  it('creates private cards and returns the access code only from creation/deletion responses', async () => {
    const privateCard = expectSuccess(
      await postCreatorCard(
        basePayload({
          title: 'VIP Rate Card',
          slug: 'vip-rate-card',
          access_type: 'private',
          access_code: 'A1B2C3',
        })
      )
    );

    expect(privateCard.access_code).to.equal('A1B2C3');

    const retrieved = expectSuccess(await getCreatorCard('vip-rate-card', 'A1B2C3'));
    expect(retrieved.access_type).to.equal('private');
    expect(retrieved).to.not.have.property('access_code');

    const deleted = expectSuccess(await deleteCreatorCard('vip-rate-card'));
    expect(deleted.access_code).to.equal('A1B2C3');
    expect(deleted.deleted).to.be.a('number');
  });

  it('retrieves public published cards without leaking access_code', async () => {
    await postCreatorCard(basePayload());

    const data = expectSuccess(await getCreatorCard('george-cooks'));

    expect(data.slug).to.equal('george-cooks');
    expect(data.id).to.be.a('string').and.have.length(26);
    expect(data).to.not.have.property('_id');
    expect(data).to.not.have.property('access_code');
  });

  it('deletes a card and prevents future public retrieval', async () => {
    await postCreatorCard(basePayload());

    const deleted = expectSuccess(await deleteCreatorCard('george-cooks'));
    expect(deleted.slug).to.equal('george-cooks');
    expect(deleted.deleted).to.be.a('number');

    expectError(await getCreatorCard('george-cooks'), 404, 'NF01');
  });

  it('returns the specified custom errors for create business rules', async () => {
    await postCreatorCard(basePayload());

    expectError(await postCreatorCard(basePayload({ title: 'Another George' })), 400, 'SL02');
    expectError(
      await postCreatorCard(
        basePayload({ slug: 'secret-card', access_type: 'private', access_code: undefined })
      ),
      400,
      'AC01'
    );
    expectError(
      await postCreatorCard(
        basePayload({ slug: 'public-card', access_type: 'public', access_code: 'A1B2C3' })
      ),
      400,
      'AC05'
    );
  });

  it('returns HTTP 400 for field validation failures', async () => {
    const invalidStatus = await postCreatorCard(
      basePayload({ slug: 'bad-status', status: 'archived' })
    );
    const invalidSlug = await postCreatorCard(basePayload({ slug: 'bad slug' }));
    const invalidUrl = await postCreatorCard(
      basePayload({ slug: 'bad-url', links: [{ title: 'Bad', url: 'ftp://example.com' }] })
    );
    const decimalAmount = await postCreatorCard(
      basePayload({
        slug: 'decimal-amount',
        service_rates: {
          currency: 'NGN',
          rates: [{ name: 'IG Story Post', description: 'One story mention', amount: 1.5 }],
        },
      })
    );
    const missingRateDescription = await postCreatorCard(
      basePayload({
        slug: 'missing-rate-description',
        service_rates: {
          currency: 'NGN',
          rates: [{ name: 'IG Story Post', amount: 5000000 }],
        },
      })
    );

    [invalidStatus, invalidSlug, invalidUrl, decimalAmount, missingRateDescription].forEach(
      (response) => {
        expect(response.statusCode).to.equal(400);
        expect(response.data.status).to.equal('error');
        expect(response.data.message).to.be.a('string').and.not.equal('');
      }
    );
  });

  it('applies public retrieval access rules in the required order', async () => {
    expectError(await getCreatorCard('does-not-exist-123'), 404, 'NF01');

    await postCreatorCard(basePayload({ slug: 'my-draft-card', status: 'draft' }));
    expectError(await getCreatorCard('my-draft-card'), 404, 'NF02');

    await postCreatorCard(
      basePayload({
        slug: 'vip-rate-card',
        access_type: 'private',
        access_code: 'A1B2C3',
      })
    );
    expectError(await getCreatorCard('vip-rate-card'), 403, 'AC03');
    expectError(await getCreatorCard('vip-rate-card', 'WRONG1'), 403, 'AC04');
  });

  it('returns NF01 when deleting missing or already-deleted cards', async () => {
    expectError(
      await deleteCreatorCard('does-not-exist-123', {
        creator_reference: alternateCreatorReference,
      }),
      404,
      'NF01'
    );

    await postCreatorCard(basePayload());
    expectSuccess(await deleteCreatorCard('george-cooks'));
    expectError(await deleteCreatorCard('george-cooks'), 404, 'NF01');
  });

  it('validates delete creator_reference as a string of exactly 20 characters', async () => {
    await postCreatorCard(basePayload());

    const response = await deleteCreatorCard('george-cooks', {
      creator_reference: { length: 20 },
    });

    expect(response.statusCode).to.equal(400);
    expect(response.data.status).to.equal('error');
  });
});
