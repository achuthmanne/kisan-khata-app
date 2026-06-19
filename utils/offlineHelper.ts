import NetInfo from '@react-native-community/netinfo';

export const executeOfflineSafeWrite = async <T>(writePromise: Promise<T>): Promise<T | void> => {
  const netState = await NetInfo.fetch();
  
  if (netState.isConnected === false || netState.isInternetReachable === false) {
    writePromise.catch((e) => console.log('Offline background write error:', e));
    return Promise.resolve();
  }

  return Promise.race([
    writePromise,
    new Promise<void>((_, reject) => setTimeout(() => reject(new Error('TIMEOUT')), 8000))
  ]).catch((e) => {
    if (e.message === 'TIMEOUT') {
      console.log('Write timed out, assuming queued offline');
      return Promise.resolve();
    }
    throw e;
  });
};

/**
 * Wraps a Firestore GET operation (DocumentReference or Query) to enforce cache read if offline.
 * This prevents infinite loading or long timeouts.
 */
export const executeOfflineSafeRead = async (query: any) => {
  const netState = await NetInfo.fetch();
  
  if (netState.isConnected === false || netState.isInternetReachable === false) {
    try {
      return await query.get({ source: 'cache' });
    } catch (e) {
      console.log('Cache read error:', e);
      throw e;
    }
  }

  try {
    const result = await Promise.race([
      query.get(),
      new Promise((_, reject) => setTimeout(() => reject(new Error('TIMEOUT')), 5000))
    ]);
    return result;
  } catch (e: any) {
    if (e.message === 'TIMEOUT' || e.code === 'firestore/unavailable') {
      console.log('Network read failed, falling back to cache');
      try {
         return await query.get({ source: 'cache' });
      } catch (cacheError) {
         throw cacheError;
      }
    }
    throw e;
  }
};

/**
 * Wraps a standard fetch() API call (like Weather or Translation) with a short timeout.
 * Prevents the app from hanging if the network is flaky.
 */
export const executeOfflineSafeFetch = async (url: string, options: any = {}) => {
  const netState = await NetInfo.fetch();
  
  if (netState.isConnected === false || netState.isInternetReachable === false) {
    throw new Error('OFFLINE');
  }

  return Promise.race([
    fetch(url, options),
    new Promise<Response>((_, reject) => setTimeout(() => reject(new Error('TIMEOUT')), 4000))
  ]);
};
