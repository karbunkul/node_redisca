const assert = require('assert');
const debug = require('debug')('module:redisca/entity');

const TYPE_OBJECT = 0;
const TYPE_STRING = 1;
const TYPE_NUMBER = 2;
const TYPE_BOOLEAN = 3;

const buildKey = (entityId, namespace, params) => {
  const args = Object.keys(params)
    .sort()
    .map(name => `${name}=${params[name]}`);
  return `${namespace}:${entityId}:${args.join(',')}`;
};

const pack = data => {
  switch (typeof data) {
    case 'object':
      return { type: TYPE_OBJECT, value: JSON.stringify(data) };
    case 'boolean':
      return { type: TYPE_BOOLEAN, value: data };
    case 'number':
      return { type: TYPE_NUMBER, value: data };
    default:
      return { type: TYPE_STRING, value: data };
  }
};

const unpack = data => {
  const { type, value } = data || {};
  const intType = parseInt(type);
  switch (intType) {
    case TYPE_NUMBER:
      return [parseInt(value), intType];
    case TYPE_OBJECT:
      return [JSON.parse(value), intType];
    case TYPE_BOOLEAN: {
      return [value, TYPE_BOOLEAN];
    }
    default:
      return [value, intType];
  }
};

class Entity {
  constructor(options) {
    const { entityId, params, ttl, handler = undefined, client, namespace } =
    options || {};
    // validate entityId
    assert(
      typeof entityId === 'string' && entityId.trim() !== '',
      'entityId must be string'
    );
    this.entityId = entityId;

    // validate ttl
    if (ttl) assert(typeof ttl === 'number' && ttl >= 0, 'ttl must be number');
    this.ttl = ttl || 0;

    // validate handler
    if (handler)
      assert(typeof handler === 'function', 'handler must be function');
    this.handler = handler || null;

    // validate client
    assert(
      client && client.constructor.name === 'RedisClient',
      'client must be instance of RedisClient'
    );
    this.client = client;
    //TODO add assert params
    this.params = params;

    // build key
    this.key = buildKey(entityId, namespace, params || {});
    this.entityPattern = `${namespace}:${entityId}*`;
    debug(`entityId ${entityId}: key ${this.key}`);
  }

  get TYPE_OBJECT() {
    return TYPE_OBJECT;
  }

  get TYPE_BOOLEAN() {
    return TYPE_BOOLEAN;
  }

  get TYPE_STRING() {
    return TYPE_STRING;
  }

  get TYPE_NUMBER() {
    return TYPE_NUMBER;
  }

  async get() {
    return new Promise((resolve, reject) => {
      this.client.hgetall(this.key, async (err, data) => {
        if (err) reject(err);
        if (data === null && this.handler) {
          debug('get data from handler');
          const handlerResponse = this.handler(this.params);
          if (handlerResponse instanceof Promise) {
            const response = await handlerResponse;
            if (response) this.set(response);
            resolve(unpack(pack(response)));
          } else {
            if (handlerResponse !== undefined || handlerResponse !== null) this.set(handlerResponse);
            resolve(unpack(pack(handlerResponse)));
          }
        }
        debug(`get(${this.key}): hit from redis`);
        resolve(unpack(data));
      });
    });
  }

  set(data) {
    const { type, value } = pack(data);
    return new Promise((resolve, reject) => {
      this.client.hmset(this.key, 'type', type, 'value', value, (err, ok) => {
        if (err) reject(err);
        if (this.ttl > 0) this.client.expire(this.key, this.ttl);
        resolve(ok === 'OK');
      });
    });
  }

  del() {
    return new Promise((resolve, reject) => {
      this.client.del(this.key, (err, ok) => {
        if (err) reject(err);
        resolve(ok === 'OK');
      });
    });
  }

  clear() {
    const { promisify } = require('util');
    const delAsync = promisify(this.client.del).bind(this.client);
    return new Promise((resolve, reject) => {
      this.client.keys(this.entityPattern, async (err, data) => {
        if (err) reject(err);
        const res = await Promise.all(data.map(delAsync));
        resolve(res.length === 0);
      });
    });
  }
}

module.exports = options => new Entity(options);
