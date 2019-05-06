const events = require('events');
const assert = require('assert');
const debug = require('debug')('module:redisca');

const createEntity = require('./entity');

let isInit = false;
let redisClient = null;
let moduleNamespace;
let instance;

const validateIsInitWarning = () => {
  assert(isInit, 'redisca is not init, run init() fix it.');
};

class Redisca extends events.EventEmitter {
  constructor() {
    super();
    if (typeof instance === 'object') return instance;
    debug('create instance');
    instance = this;
    return this;
  }

  // noinspection JSMethodCanBeStatic
  init(options) {
    const { namespace, client, disableCache } = options || {};
    if (disableCache !== undefined) {
      assert(typeof disableCache === 'boolean', 'disableCache must be boolean');
      debug('cache is disabled, ttl 1 second');
    }
    this.disableCache = disableCache || false;
    assert(
      namespace && typeof namespace === 'string' && namespace.trim() !== '',
      'namespace must be string'
    );
    assert(
      client && client.constructor.name === 'RedisClient',
      'client must be instance of RedisClient'
    );
    redisClient = client;
    moduleNamespace = namespace;
    isInit = true;
  }

  // noinspection JSMethodCanBeStatic
  entity(options) {
    validateIsInitWarning();
    let { ttl } = options || {};
    if (this.disableCache) ttl = 1;
    return createEntity({
      ...options,
      client: redisClient,
      ttl,
      namespace: moduleNamespace
    });
  }
}

module.exports = () => {
  return new Redisca();
};
