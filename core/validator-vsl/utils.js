// const { processQualifiers, processPossibleValues } = require('./utils');
function processQualifiers(qualifiers) {
  let processedQualifiers;
  if (qualifiers) {
    processedQualifiers = {};
    const qualifierTokens = qualifiers.split('|');
    qualifierTokens.forEach((qt) => {
      const [qtKey, qtValue] = qt.split(':');
      processedQualifiers[qtKey] = {
        value: qtValue,
      };
    });
  }
  return processedQualifiers;
}

function objectToQt(obj) {
  let qt = '';
  const keys = Object.keys(obj);
  for (let i = 0; i < keys.length; i += 1) {
    const qtKey = keys[i];
    const qtValue = obj[qtKey];
    qt += `${qtKey}:${qtValue}`;
    if (i < keys.length - 1) qt += '|';
  }
  return qt;
}

function processPossibleValues(values = '') {
  let processedValues;
  if (values) {
    processedValues = values.split('|');
  }
  return processedValues;
}

module.exports = {
  processQualifiers,
  processPossibleValues,
};
