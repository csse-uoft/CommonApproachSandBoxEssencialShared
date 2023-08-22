const {createGraphDBModel, Types} = require("graphdb-utils");
const {GDBMeasureModel} = require("./measure");

const GDBCodeModel = createGraphDBModel({
  definedBy: {type: () => require('./organization').GDBOrganizationModel, internalKey: 'cids:definedBy'},
  specification: {type: String, internalKey: 'cids:hasSpecification'},
  identifier: {type: String, internalKey: 'cids:hasIdentification'},
  name: {type: String, internalKey: 'cids:hasName'},
  description: {type: String, internalKey: 'schema:hasDescription'},
  codeValue: {type: String, internalKey: 'schema:codeValue'},
  iso72Value: {type: GDBMeasureModel, internalKey: 'iso21972:value'}
}, {
  rdfTypes: ['cids:Code'], name: 'code'
});

module.exports = {
  GDBCodeModel
}