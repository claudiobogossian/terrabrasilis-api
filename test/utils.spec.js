const utils = require('../src/utils')
const assert = require('assert')
const path = require('path')
const fs = require('fs')
const sinon = require('sinon')
const axios = require('axios')

const layerMetadata = require('./fixtures/layer-config-example.json')
const xmlCapabilitiesFixture = fs.readFileSync(path.join(__dirname, 'fixtures/capabilities-example.xml'), 'utf-8')

describe('UTILS', () => {
  let sandbox
  beforeEach(() => sandbox = sinon.createSandbox())
  afterEach(() => sandbox.restore())

  describe('capabilities config: ', () => {
    it('.configureUrlWorkspace', () => {
      const result = utils.configureUrlWorkspace(layerMetadata)
      assert.equal(1, 1)
    })

    it('.parseXML', () => {
      const xmlCapabilitiesFixture = fs.readFileSync(path.join(__dirname, 'fixtures/capabilities-example.xml'), 'utf-8')
      const result = utils.parseXML(xmlCapabilitiesFixture)
      assert.equal(result._declaration._attributes.version, '1.0')
    })

    it('.getBounds', async () => {
      const resolved = new Promise((resolve) => resolve(xmlCapabilitiesFixture))
      sandbox.stub(axios, 'get').returns(resolved)
      const result = await utils.getBounds(layerMetadata)
      assert.deepEqual(result, [
        ['-16.2779683090209', '-73.8538648282111'],
        ['5.20548191938395', '-44.0']
      ])
    })

    it('.splitBounds', () => {
      const boundingBoxExample = {
        EX_GeographicBoundingBox: {
          westBoundLongitude: {
            _text: '-73.9909438636055'
          },
          eastBoundLongitude: {
            _text: '-43.0169133104806'
          },
          southBoundLatitude: {
            _text: '-16.290519038121'
          },
          northBoundLatitude: {
            _text: '5.27215639335258'
          }
        }
      }

      const result = utils.splitBounds(boundingBoxExample)
      assert.deepEqual(result, [
        ['-16.290519038121', '-73.9909438636055'],
        ['5.27215639335258', '-43.0169133104806']
      ])
    })
  })
})
