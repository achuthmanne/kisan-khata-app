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

import AsyncStorage from '@react-native-async-storage/async-storage';

/**
 * Wraps a Firestore GET operation (DocumentReference or Query) to enforce cache read if offline.
 * Implements a bulletproof AsyncStorage secondary cache for crucial single documents (like user profiles)
 * to prevent offline loading crashes when Firestore's SDK cache misses.
 */
export const executeOfflineSafeRead = async (query: any, fastCache: boolean = false, noBackgroundSync: boolean = false) => {
  const netState = await NetInfo.fetch();
  
  const getFallback = async () => {
    // Only apply fallback caching for specific user docs
    if (query.path && query.path.startsWith("users/")) {
      try {
        const fallbackData = await AsyncStorage.getItem(`FALLBACK_${query.path}`);
        if (fallbackData) {
          console.log(`[Offline Fallback] Restored document from AsyncStorage: ${query.path}`);
          return {
            id: query.id,
            data: () => JSON.parse(fallbackData),
            exists: true
          };
        }
      } catch (e) {
        console.log('AsyncStorage fallback error:', e);
      }
    }
    return null;
  };

  // 🔥 0-Second Delay Stale-While-Revalidate (Fast Cache)
  if (fastCache) {
    try {
      const cacheSnap = await query.get({ source: 'cache' });
      // If we got valid data from cache, return immediately (0 ms delay)
      if (cacheSnap && (cacheSnap.exists || (cacheSnap.docs && cacheSnap.docs.length > 0))) {
        // Silently sync with server in background to update Firebase SQLite cache for next time
        if (!noBackgroundSync && netState.isConnected && netState.isInternetReachable !== false) {
          query.get({ source: 'server' }).then((result: any) => {
             if (query.path && query.path.startsWith("users/") && result && result.exists && result.data) {
                AsyncStorage.setItem(`FALLBACK_${query.path}`, JSON.stringify(result.data())).catch(()=>{});
             }
          }).catch(() => {});
        }
        return cacheSnap;
      }
    } catch (e) {
      // Cache empty or failed, fall through to regular fetch
    }
  }

  if (netState.isConnected === false || netState.isInternetReachable === false) {
    try {
      return await query.get({ source: 'cache' });
    } catch (e) {
      console.log('Cache read error:', e);
      const fallback = await getFallback();
      if (fallback) return fallback;
      throw e;
    }
  }

  try {
    const result = await Promise.race([
      query.get(),
      new Promise((_, reject) => setTimeout(() => reject(new Error('TIMEOUT')), 5000))
    ]);
    
    // Transparently save to fallback cache when online
    if (query.path && query.path.startsWith("users/") && result && result.exists && result.data) {
      try {
        await AsyncStorage.setItem(`FALLBACK_${query.path}`, JSON.stringify(result.data()));
      } catch (e) {
        console.log('Error caching fallback:', e);
      }
    }
    
    return result;
  } catch (e: any) {
    if (e.message === 'TIMEOUT' || e.code === 'firestore/unavailable') {
      console.log('Network read failed, falling back to cache');
      try {
         return await query.get({ source: 'cache' });
      } catch (cacheError) {
         const fallback = await getFallback();
         if (fallback) return fallback;
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
