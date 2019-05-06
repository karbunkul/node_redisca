const redis = require('redis');
const redisca = require('../index')();

const client = redis.createClient();
const namespace = 'redisca-test';
const entityId = 'test-entity';

describe('init', () => {
  test('namespace is required and must be string', () => {
    expect(() => redisca.init()).toThrow('namespace must be string');
    expect(() => redisca.init({ namespace: 1 })).toThrow(
      'namespace must be string'
    );
    expect(() => redisca.init({ namespace: true })).toThrow(
      'namespace must be string'
    );
    expect(() => redisca.init({ namespace: () => null })).toThrow(
      'namespace must be string'
    );
  });

  test('disableCache is optional, but must be boolean', () => {
    expect(() => redisca.init({ namespace, disableCache: 1 })).toThrow(
      'disableCache must be boolean'
    );

    expect(() => redisca.init({ namespace, disableCache: 'true' })).toThrow(
      'disableCache must be boolean'
    );

    expect(() => redisca.init({ namespace, disableCache: {} })).toThrow(
      'disableCache must be boolean'
    );

    expect(() => redisca.init({ namespace, disableCache: () => null })).toThrow(
      'disableCache must be boolean'
    );
  });

  test('client is required and must be instance of RedisClient', () => {
    expect(() => redisca.init({ namespace, disableCache: false })).toThrow(
      'client must be instance of RedisClient'
    );
    expect(() =>
      redisca.init({ namespace, disableCache: false, client: 1 })
    ).toThrow('client must be instance of RedisClient');

    expect(() =>
      redisca.init({ namespace, disableCache: false, client: '1' })
    ).toThrow('client must be instance of RedisClient');

    expect(() =>
      redisca.init({ namespace, disableCache: false, client: true })
    ).toThrow('client must be instance of RedisClient');

    expect(() =>
      redisca.init({ namespace, disableCache: false, client: () => null })
    ).toThrow('client must be instance of RedisClient');

    expect(() =>
      redisca.init({ namespace, disableCache: false, client: true })
    ).toThrow('client must be instance of RedisClient');
  });
});

describe('create entity', () => {
  test('not init', () => {
    expect(() => redisca.entity()).toThrow(
      'redisca is not init, run init() fix it.'
    );
    // init
    redisca.init({
      client,
      namespace: 'redisca-entity-test',
      params: { userId: 1 }
    });
  });

  test('entityId is required', () => {
    expect(() => redisca.entity()).toThrow('entityId must be string');
    expect(() => redisca.entity({ entityId: 1 })).toThrow(
      'entityId must be string'
    );
  });

  test('validate ttl option', () => {
    expect(() => redisca.entity({ entityId, ttl: '10' })).toThrow(
      'ttl must be number'
    );
    expect(() => redisca.entity({ entityId, ttl: -10 })).toThrow(
      'ttl must be number'
    );
  });

  test('validate handler option', () => {
    expect(() => redisca.entity({ entityId, handler: { foo: 'bar' } })).toThrow(
      'handler must be function'
    );

    expect(() => redisca.entity({ entityId, handler: 1 })).toThrow(
      'handler must be function'
    );

    expect(() => redisca.entity({ entityId, handler: '1' })).toThrow(
      'handler must be function'
    );

    expect(() => redisca.entity({ entityId, handler: true })).toThrow(
      'handler must be function'
    );

    expect(
      redisca.entity({
        entityId: 'entityId',
        handler: ({ userId }) => {
          return userId;
        }
      }).constructor.name === 'Entity'
    ).toBe(true);
  });

  describe('entity get', () => {
    test('without handler, should be return null', async () => {
      const entity = redisca.entity({ entityId });
      const [value, type] = await entity.get();
      expect(value).toBe(undefined);
      expect(type).toBe(NaN);
    });

    test('with handler, should be return number', async () => {
      const handler = ({ userId }) => userId;
      const entity = redisca.entity({
        entityId,
        handler,
        params: { userId: 105368 }
      });
      await entity.clear();
      const [value, type] = await entity.get();
      expect(value).toBe(105368);
      expect(type).toBe(entity.TYPE_NUMBER);
    });

    test('with handler, should be return string', async () => {
      const handler = ({ userId }) => String(userId);
      const entity = redisca.entity({
        entityId,
        handler,
        params: { userId: 105369 }
      });
      await entity.clear();
      const [value, type] = await entity.get();
      expect(value).toBe('105369');
      expect(type).toBe(entity.TYPE_STRING);
    });

    test('with handler, should be return boolean', async () => {
      const handler = ({ userId }) => !!userId;
      const entity = redisca.entity({
        entityId,
        handler,
        params: { userId: 105370 }
      });
      await entity.clear();
      const [value, type] = await entity.get();
      expect(value).toBe(true);
      expect(type).toBe(entity.TYPE_BOOLEAN);
    });

    test('with handler, should be return object', async () => {
      const handler = ({ userId }) => ({ userId });
      const entity = redisca.entity({
        entityId,
        handler,
        params: { userId: 105370 }
      });
      await entity.clear();
      const [value, type] = await entity.get();
      expect(value).toEqual({ userId: 105370 });
      expect(type).toBe(entity.TYPE_OBJECT);
    });

    test('with handler as promise, should be return boolean', async () => {
      const handler = ({ userId }) => Promise.resolve(!!userId);
      const entity = redisca.entity({
        entityId,
        handler,
        params: { userId: 105370 }
      });
      await entity.clear();
      const [value, type] = await entity.get();
      expect(value).toBe(true);
      expect(type).toBe(entity.TYPE_BOOLEAN);
    });
  });

  test('entity set', async () => {
    const entity = redisca.entity({ entityId });
    await entity.set(1234);

    const [value] = await entity.get();
    expect(value).toBe(1234);
  });

  test('entity del', async () => {
    const entity = redisca.entity({ entityId });
    await entity.set(1234);

    const [value] = await entity.get();
    expect(value).toBe(1234);

    await entity.del();

    const [valueAfterClear] = await entity.get();
    expect(valueAfterClear).toBe(undefined);
  });

  test('entity clear', async () => {
    const entity = redisca.entity({ entityId });
    await entity.set(1234);
    const [value] = await entity.get();
    expect(value).toBe(1234);
    await entity.clear();
    const [valueAfterClear] = await entity.get();
    expect(valueAfterClear).toBe(undefined);
  });
});
