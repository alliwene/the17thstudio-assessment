const { ModelSchema, SchemaTypes, DatabaseModel } = require('@app-core/mongoose');

const modelName = 'creator_cards';

const linkSchemaConfig = {
  title: { type: SchemaTypes.String, required: true },
  url: { type: SchemaTypes.String, required: true },
};

const serviceRateSchemaConfig = {
  name: { type: SchemaTypes.String, required: true },
  description: { type: SchemaTypes.String },
  amount: { type: SchemaTypes.Number, required: true },
};

const serviceRatesSchemaConfig = {
  currency: { type: SchemaTypes.String, required: true },
  rates: {
    type: [new ModelSchema(serviceRateSchemaConfig, { _id: false }).createDBSchema()],
    required: true,
  },
};

const schemaConfig = {
  _id: { type: SchemaTypes.ULID, required: true },
  title: { type: SchemaTypes.String, required: true },
  description: { type: SchemaTypes.String },
  slug: { type: SchemaTypes.String, required: true, unique: true, index: true },
  creator_reference: { type: SchemaTypes.String, required: true, index: true },
  links: {
    type: [new ModelSchema(linkSchemaConfig, { _id: false }).createDBSchema()],
    default: [],
  },
  service_rates: {
    type: new ModelSchema(serviceRatesSchemaConfig, { _id: false }).createDBSchema(),
  },
  status: { type: SchemaTypes.String, required: true },
  access_type: { type: SchemaTypes.String, default: 'public' },
  access_code: { type: SchemaTypes.String },
  created: { type: SchemaTypes.Number, required: true },
  updated: { type: SchemaTypes.Number, required: true },
  deleted: { type: SchemaTypes.Number, default: null },
};

const modelSchema = new ModelSchema(schemaConfig, {
  collection: modelName,
  toJSON: {
    transform: (doc, ret) => {
      const response = { ...ret };
      response.id = response._id;
      delete response._id;
      delete response.__v;
      return response;
    },
  },
});

module.exports = DatabaseModel.model(modelName, modelSchema);
