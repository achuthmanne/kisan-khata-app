import { create } from 'zustand';
import firestore from '@react-native-firebase/firestore';

interface AppState {
  mestris: any[];
  fields: any[];
  completedFields: any[];
  lands: any[];
  vehicles: any[];
  owners: any[];
  reminders: any[];
  schemes: any[];
  
  // NEW GLOBAL ROOT COLLECTIONS
  expenses: any[];
  sales: any[];
  locker: any[];
  notifications: any[];
  machines: any[];

  // NESTED COLLECTIONS (LAZY LOADED)
  ownerEntries: Record<string, any[]>;
  vehicleFarmers: Record<string, any[]>;
  vehicleDrivers: Record<string, any[]>;
  driverMonthlyWorks: Record<string, any[]>;
  driverWorks: Record<string, any[]>;
  driverCycles: Record<string, any[]>;
  farmerWorks: Record<string, any[]>;
  mestriAttendance: Record<string, any[]>;
  mestriPayments: Record<string, any[]>;
  
  isInitializing: boolean;
  initListeners: (phone: string, session: string) => void;
  clearStore: () => void;

  // INITIALIZERS FOR NESTED COLLECTIONS
  initOwnerEntriesListener: (vehicleId: string, phone: string, session: string) => void;
  initVehicleFarmersListener: (vehicleId: string, phone: string, session: string) => void;
  initVehicleDriversListener: (vehicleId: string, phone: string, session: string) => void;
  initDriverMonthlyWorksListener: (vehicleId: string, driverId: string, phone: string, session: string) => void;
  initDriverWorksListener: (vehicleId: string, driverId: string, phone: string, session: string) => void;
  initDriverCyclesListener: (vehicleId: string, driverId: string, phone: string, session: string) => void;
  initFarmerWorksListener: (vehicleId: string, farmerId: string, phone: string, session: string) => void;
  initMestriAttendanceListener: (mestriId: string, phone: string, session: string) => void;
  initMestriPaymentsListener: (mestriId: string, phone: string, session: string) => void;

  unsubOwnerEntries: (id: string) => void;
  unsubVehicleFarmers: (id: string) => void;
  unsubVehicleDrivers: (id: string) => void;
  unsubDriverMonthlyWorks: (id: string) => void;
  unsubDriverWorks: (id: string) => void;
  unsubDriverCycles: (id: string) => void;
  unsubFarmerWorks: (id: string) => void;
  unsubMestriAttendance: (id: string) => void;
  unsubMestriPayments: (id: string) => void;
}

// ROOT UNSUBS
let unsubMestris: (() => void) | null = null;
let unsubFields: (() => void) | null = null;
let unsubLands: (() => void) | null = null;
let unsubVehicles: (() => void) | null = null;
let unsubOwners: (() => void) | null = null;
let unsubReminders: (() => void) | null = null;
let unsubExpenses: (() => void) | null = null;
let unsubSales: (() => void) | null = null;
let unsubLocker: (() => void) | null = null;
let unsubNotifications: (() => void) | null = null;
let unsubMachines: (() => void) | null = null;

// NESTED UNSUBS
const unsubOwnerEntries: Record<string, () => void> = {};
const unsubVehicleFarmers: Record<string, () => void> = {};
const unsubVehicleDrivers: Record<string, () => void> = {};
const unsubDriverMonthlyWorks: Record<string, () => void> = {};
const unsubDriverWorks: Record<string, () => void> = {};
const unsubDriverCycles: Record<string, () => void> = {};
const unsubFarmerWorks: Record<string, () => void> = {};
const unsubMestriAttendance: Record<string, () => void> = {};
const unsubMestriPayments: Record<string, () => void> = {};

export const useStore = create<AppState>((set, get) => ({
  mestris: [],
  fields: [],
  completedFields: [],
  lands: [],
  vehicles: [],
  owners: [],
  reminders: [],
  schemes: [],
  
  expenses: [],
  sales: [],
  locker: [],
  notifications: [],
  machines: [],

  ownerEntries: {},
  vehicleFarmers: {},
  vehicleDrivers: {},
  driverMonthlyWorks: {},
  driverWorks: {},
  driverCycles: {},
  farmerWorks: {},
  mestriAttendance: {},
  mestriPayments: {},

  isInitializing: false,

  clearStore: () => {
    if (unsubMestris) { unsubMestris(); unsubMestris = null; }
    if (unsubFields) { unsubFields(); unsubFields = null; }
    if (unsubLands) { unsubLands(); unsubLands = null; }
    if (unsubVehicles) { unsubVehicles(); unsubVehicles = null; }
    if (unsubOwners) { unsubOwners(); unsubOwners = null; }
    if (unsubReminders) { unsubReminders(); unsubReminders = null; }
    if (unsubExpenses) { unsubExpenses(); unsubExpenses = null; }
    if (unsubSales) { unsubSales(); unsubSales = null; }
    if (unsubLocker) { unsubLocker(); unsubLocker = null; }
    if (unsubNotifications) { unsubNotifications(); unsubNotifications = null; }
    if (unsubMachines) { unsubMachines(); unsubMachines = null; }

    Object.values(unsubOwnerEntries).forEach(unsub => unsub());
    Object.keys(unsubOwnerEntries).forEach(k => delete unsubOwnerEntries[k]);

    Object.values(unsubVehicleFarmers).forEach(unsub => unsub());
    Object.keys(unsubVehicleFarmers).forEach(k => delete unsubVehicleFarmers[k]);

    Object.values(unsubVehicleDrivers).forEach(unsub => unsub());
    Object.keys(unsubVehicleDrivers).forEach(k => delete unsubVehicleDrivers[k]);

    Object.values(unsubDriverMonthlyWorks).forEach(unsub => unsub());
    Object.keys(unsubDriverMonthlyWorks).forEach(k => delete unsubDriverMonthlyWorks[k]);

    Object.values(unsubDriverWorks).forEach(unsub => unsub());
    Object.keys(unsubDriverWorks).forEach(k => delete unsubDriverWorks[k]);

    Object.values(unsubDriverCycles).forEach(unsub => unsub());
    Object.keys(unsubDriverCycles).forEach(k => delete unsubDriverCycles[k]);

    Object.values(unsubFarmerWorks).forEach(unsub => unsub());
    Object.keys(unsubFarmerWorks).forEach(k => delete unsubFarmerWorks[k]);

    Object.values(unsubMestriAttendance).forEach(unsub => unsub());
    Object.keys(unsubMestriAttendance).forEach(k => delete unsubMestriAttendance[k]);

    Object.values(unsubMestriPayments).forEach(unsub => unsub());
    Object.keys(unsubMestriPayments).forEach(k => delete unsubMestriPayments[k]);

    set({ 
      mestris: [], fields: [], completedFields: [], lands: [], 
      vehicles: [], owners: [], reminders: [], schemes: [], 
      expenses: [], sales: [], locker: [], notifications: [], machines: [],
      ownerEntries: {}, vehicleFarmers: {}, vehicleDrivers: {}, driverMonthlyWorks: {}, driverWorks: {}, driverCycles: {}, farmerWorks: {}, mestriAttendance: {}, mestriPayments: {},
      isInitializing: false 
    });
  },

  initListeners: async (phone: string, session: string) => {
    // Prevent duplicate root listeners
    if (unsubMestris || unsubFields || unsubLands) return;

    set({ isInitializing: true });

    try {
      // 1. Mestri Listener
      unsubMestris = firestore()
        .collection("users").doc(phone).collection("mestris")
        .where("session", "==", session)
        .where("createdAt", "!=", null)
        .orderBy("createdAt", "desc")
        .onSnapshot((snap) => {
          if (snap) {
            set({ mestris: snap.docs.map(d => ({ id: d.id, ...d.data() })) });
          } else set({ mestris: [] });
        }, err => console.log("Mestri err", err));

      // 2. Lands Listener
      unsubLands = firestore()
        .collection("users").doc(phone).collection("lands")
        .where("session", "==", session)
        .onSnapshot((snap) => {
          if (snap) {
            const list = snap.docs.map(d => ({ id: d.id, ...d.data() }));
            list.sort((a: any, b: any) => {
               const tA = a.createdAt?.toMillis ? a.createdAt.toMillis() : 0;
               const tB = b.createdAt?.toMillis ? b.createdAt.toMillis() : 0;
               return tB - tA;
            });
            set({ lands: list });
          } else set({ lands: [] });
        }, err => console.log("Lands err", err));

      // 3. Fields Listener
      unsubFields = firestore()
        .collection("users").doc(phone).collection("fields")
        .where("session", "==", session)
        .onSnapshot((snap) => {
          if (snap) {
            const activeList: any[] = [];
            const completedList: any[] = [];
            snap.docs.forEach(doc => {
              const item = { id: doc.id, ...doc.data() as any };
              if (item.status === "completed") completedList.push(item);
              else activeList.push(item);
            });
            const sortFn = (a: any, b: any) => {
               const tA = a.createdAt?.toMillis ? a.createdAt.toMillis() : 0;
               const tB = b.createdAt?.toMillis ? b.createdAt.toMillis() : 0;
               return tB - tA;
            };
            activeList.sort(sortFn);
            completedList.sort(sortFn);
            set({ fields: activeList, completedFields: completedList });
          } else set({ fields: [], completedFields: [] });
        }, err => console.log("Fields err", err));

      // 4. Vehicles Listener
      unsubVehicles = firestore()
        .collection("users").doc(phone).collection("vehicles")
        .where("session", "==", session)
        .orderBy("createdAt", "desc")
        .onSnapshot((snap) => {
          if (snap) set({ vehicles: snap.docs.map(d => ({ id: d.id, ...d.data() })) });
          else set({ vehicles: [] });
        }, err => console.log("Vehicles err", err));

      // 5. Owners Listener
      unsubOwners = firestore()
        .collection("users").doc(phone).collection("owners")
        .where("session", "==", session)
        .onSnapshot((snap) => {
          if (snap) {
            const list = snap.docs.map(d => ({ id: d.id, ...d.data() }));
            list.sort((a: any, b: any) => {
               const tA = a.createdAt?.toMillis ? a.createdAt.toMillis() : 0;
               const tB = b.createdAt?.toMillis ? b.createdAt.toMillis() : 0;
               return tB - tA;
            });
            set({ owners: list });
          } else set({ owners: [] });
        }, err => console.log("Owners err", err));

      // 6. Reminders Listener
      unsubReminders = firestore()
        .collection("users").doc(phone).collection("reminders")
        .onSnapshot((snap) => {
          if (snap) {
            const list = snap.docs.map(d => ({ id: d.id, ...d.data() }));
            list.sort((a: any, b: any) => {
               const dateA = new Date(a.date).getTime();
               const dateB = new Date(b.date).getTime();
               return dateA - dateB; 
            });
            set({ reminders: list });
          } else set({ reminders: [] });
        }, err => console.log("Reminders err", err));

      // 7. Schemes Fetch
      firestore().collection("schemes").where("isActive", "==", true).get()
        .then(snap => {
           if (!snap.empty) {
             const list = snap.docs.map(d => ({ id: d.id, ...d.data() }));
             list.sort((a: any, b: any) => {
               const tA = a.createdAt?.toMillis ? a.createdAt.toMillis() : 0;
               const tB = b.createdAt?.toMillis ? b.createdAt.toMillis() : 0;
               return tB - tA;
             });
             set({ schemes: list });
           }
        }).catch(e => console.log("Schemes err", e));

      // 8. Expenses Listener
      unsubExpenses = firestore()
        .collection("users").doc(phone).collection("expenses")
        .where("session", "==", session)
        .onSnapshot((snap) => {
          if (snap) {
            const list = snap.docs.map(d => ({ id: d.id, ...d.data() }));
            list.sort((a: any, b: any) => {
               const tA = a.createdAt?.toMillis ? a.createdAt.toMillis() : 0;
               const tB = b.createdAt?.toMillis ? b.createdAt.toMillis() : 0;
               return tB - tA;
            });
            set({ expenses: list });
          } else set({ expenses: [] });
        }, err => console.log("Expenses err", err));

      // 9. Sales Listener
      unsubSales = firestore()
        .collection("users").doc(phone).collection("sales")
        .where("session", "==", session)
        .onSnapshot((snap) => {
          if (snap) {
            const list = snap.docs.map(d => ({ id: d.id, ...d.data() }));
            list.sort((a: any, b: any) => {
               const tA = a.createdAt?.toMillis ? a.createdAt.toMillis() : 0;
               const tB = b.createdAt?.toMillis ? b.createdAt.toMillis() : 0;
               return tB - tA;
            });
            set({ sales: list });
          } else set({ sales: [] });
        }, err => console.log("Sales err", err));

      // 10. Machines Listener (Global root collection, not subcollection)
      unsubMachines = firestore()
        .collection("machines")
        .where("userId", "==", phone)
        .onSnapshot((snap) => {
          if (snap) {
            const list = snap.docs.map(d => ({ id: d.id, ...d.data() }));
            list.sort((a: any, b: any) => {
               const tA = a.createdAt?.toMillis ? a.createdAt.toMillis() : 0;
               const tB = b.createdAt?.toMillis ? b.createdAt.toMillis() : 0;
               return tB - tA;
            });
            set({ machines: list });
          } else set({ machines: [] });
        }, err => console.log("Machines err", err));


      // 10. Locker Listener
      unsubLocker = firestore()
        .collection("users").doc(phone).collection("locker")
        .onSnapshot((snap) => {
          if (snap) {
            const list = snap.docs.map(d => ({ id: d.id, ...d.data() }));
            list.sort((a: any, b: any) => {
               const tA = a.createdAt?.toMillis ? a.createdAt.toMillis() : 0;
               const tB = b.createdAt?.toMillis ? b.createdAt.toMillis() : 0;
               return tB - tA;
            });
            set({ locker: list });
          } else set({ locker: [] });
        }, err => console.log("Locker err", err));

      // 11. Notifications Listener
      unsubNotifications = firestore()
        .collection("users").doc(phone).collection("notifications")
        .onSnapshot((snap) => {
          if (snap) {
            const list = snap.docs.map(d => ({ id: d.id, ...d.data() }));
            list.sort((a: any, b: any) => {
               const tA = a.createdAt?.toMillis ? a.createdAt.toMillis() : 0;
               const tB = b.createdAt?.toMillis ? b.createdAt.toMillis() : 0;
               return tB - tA;
            });
            set({ notifications: list });
          } else set({ notifications: [] });
        }, err => console.log("Notifications err", err));

    } catch (e) {
      console.log("Global init error:", e);
    } finally {
      set({ isInitializing: false });
    }
  },

  // ------------------------------------------------------------------
  // LAZY INITIALIZERS FOR NESTED COLLECTIONS
  // ------------------------------------------------------------------

  initOwnerEntriesListener: (ownerId: string, phone: string, session: string) => {
    if (unsubOwnerEntries[ownerId]) return; // Already listening
    unsubOwnerEntries[ownerId] = firestore()
      .collection("users").doc(phone).collection("owners").doc(ownerId).collection("entries")
      .where("session", "==", session)
      .onSnapshot((snap) => {
        if (snap) {
          const list = snap.docs.map(d => ({ id: d.id, ...d.data() }));
          list.sort((a: any, b: any) => {
             const tA = a.date?.toMillis ? a.date.toMillis() : (a.createdAt?.toMillis ? a.createdAt.toMillis() : 0);
             const tB = b.date?.toMillis ? b.date.toMillis() : (b.createdAt?.toMillis ? b.createdAt.toMillis() : 0);
             return tB - tA;
          });
          set((state) => ({ ownerEntries: { ...state.ownerEntries, [ownerId]: list } }));
        }
      }, err => console.log("Owner entries err", err));
  },

  unsubOwnerEntries: (ownerId: string) => {
    if (unsubOwnerEntries[ownerId]) {
      unsubOwnerEntries[ownerId]();
      delete unsubOwnerEntries[ownerId];
      // Optionally clear data when unsubscribing to free memory
      // set(state => { const copy = {...state.ownerEntries}; delete copy[ownerId]; return {ownerEntries: copy}; });
    }
  },

  initVehicleFarmersListener: (vehicleId: string, phone: string, session: string) => {
    if (unsubVehicleFarmers[vehicleId]) return;
    unsubVehicleFarmers[vehicleId] = firestore()
      .collection("users").doc(phone).collection("vehicles").doc(vehicleId).collection("farmers")
      .where("session", "==", session)
      .onSnapshot((snap) => {
        if (snap) {
          const list = snap.docs.map(d => ({ id: d.id, ...d.data() }));
          list.sort((a: any, b: any) => {
             const tA = a.createdAt?.toMillis ? a.createdAt.toMillis() : 0;
             const tB = b.createdAt?.toMillis ? b.createdAt.toMillis() : 0;
             return tB - tA;
          });
          set((state) => ({ vehicleFarmers: { ...state.vehicleFarmers, [vehicleId]: list } }));
        }
      }, err => console.log("Vehicle farmers err", err));
  },

  unsubVehicleFarmers: (vehicleId: string) => {
    if (unsubVehicleFarmers[vehicleId]) {
      unsubVehicleFarmers[vehicleId]();
      delete unsubVehicleFarmers[vehicleId];
    }
  },

  initVehicleDriversListener: (vehicleId: string, phone: string, session: string) => {
    if (unsubVehicleDrivers[vehicleId]) return;
    unsubVehicleDrivers[vehicleId] = firestore()
      .collection("users").doc(phone).collection("vehicles").doc(vehicleId).collection("drivers")
      .where("session", "==", session)
      .onSnapshot((snap) => {
        if (snap) {
          const list = snap.docs.map(d => ({ id: d.id, ...d.data() }));
          list.sort((a: any, b: any) => {
             const tA = a.createdAt?.toMillis ? a.createdAt.toMillis() : 0;
             const tB = b.createdAt?.toMillis ? b.createdAt.toMillis() : 0;
             return tB - tA;
          });
          set((state) => ({ vehicleDrivers: { ...state.vehicleDrivers, [vehicleId]: list } }));
        }
      }, err => console.log("Vehicle drivers err", err));
  },

  unsubVehicleDrivers: (vehicleId: string) => {
    if (unsubVehicleDrivers[vehicleId]) {
      unsubVehicleDrivers[vehicleId]();
      delete unsubVehicleDrivers[vehicleId];
    }
  },

  initDriverMonthlyWorksListener: (vehicleId: string, driverId: string, phone: string, session: string) => {
    const key = `${vehicleId}_${driverId}`;
    if (unsubDriverMonthlyWorks[key]) return;
    unsubDriverMonthlyWorks[key] = firestore()
      .collection("users").doc(phone).collection("vehicles").doc(vehicleId).collection("drivers").doc(driverId).collection("monthly")
      .where("session", "==", session)
      .onSnapshot((snap) => {
        if (snap) {
          const list = snap.docs.map(d => ({ id: d.id, ...d.data() }));
          list.sort((a: any, b: any) => {
             const tA = a.createdAt?.toMillis ? a.createdAt.toMillis() : 0;
             const tB = b.createdAt?.toMillis ? b.createdAt.toMillis() : 0;
             return tB - tA;
          });
          set((state) => ({ driverMonthlyWorks: { ...state.driverMonthlyWorks, [key]: list } }));
        }
      }, err => console.log("Driver monthly works err", err));
  },

  unsubDriverMonthlyWorks: (key: string) => {
    if (unsubDriverMonthlyWorks[key]) {
      unsubDriverMonthlyWorks[key]();
      delete unsubDriverMonthlyWorks[key];
    }
  },

  initDriverWorksListener: (vehicleId: string, driverId: string, phone: string, session: string) => {
    const key = `${vehicleId}_${driverId}`;
    if (unsubDriverWorks[key]) return;
    unsubDriverWorks[key] = firestore()
      .collection("users").doc(phone).collection("vehicles").doc(vehicleId).collection("drivers").doc(driverId).collection("entries")
      .where("session", "==", session)
      .onSnapshot((snap) => {
        if (snap) {
          const list = snap.docs.map(d => ({ id: d.id, ...d.data() }));
          list.sort((a: any, b: any) => {
             const tA = a.createdAt?.toMillis ? a.createdAt.toMillis() : 0;
             const tB = b.createdAt?.toMillis ? b.createdAt.toMillis() : 0;
             return tB - tA;
          });
          set((state) => ({ driverWorks: { ...state.driverWorks, [key]: list } }));
        }
      }, err => console.log("Driver works err", err));
  },

  unsubDriverWorks: (key: string) => {
    if (unsubDriverWorks[key]) {
      unsubDriverWorks[key]();
      delete unsubDriverWorks[key];
    }
  },

  initDriverCyclesListener: (vehicleId: string, driverId: string, phone: string, session: string) => {
    const key = `${vehicleId}_${driverId}`;
    if (unsubDriverCycles[key]) return;
    unsubDriverCycles[key] = firestore()
      .collection("users").doc(phone).collection("vehicles").doc(vehicleId).collection("drivers").doc(driverId).collection("cycles")
      .where("session", "==", session)
      .onSnapshot((snap) => {
        if (snap) {
          const list = snap.docs.map(d => ({ id: d.id, ...d.data() }));
          list.sort((a: any, b: any) => {
             const tA = a.startDateRaw ? new Date(a.startDateRaw).getTime() : 0;
             const tB = b.startDateRaw ? new Date(b.startDateRaw).getTime() : 0;
             return tB - tA; // newest first
          });
          set((state) => ({ driverCycles: { ...state.driverCycles, [key]: list } }));
        }
      }, err => console.log("Driver cycles err", err));
  },

  unsubDriverCycles: (key: string) => {
    if (unsubDriverCycles[key]) {
      unsubDriverCycles[key]();
      delete unsubDriverCycles[key];
    }
  },

  initFarmerWorksListener: (vehicleId: string, farmerId: string, phone: string, session: string) => {
    const key = `${vehicleId}_${farmerId}`;
    if (unsubFarmerWorks[key]) return;
    unsubFarmerWorks[key] = firestore()
      .collection("users").doc(phone).collection("vehicles").doc(vehicleId).collection("works").doc(farmerId).collection("entries")
      .where("session", "==", session)
      .onSnapshot((snap) => {
        if (snap) {
          const list = snap.docs.map(d => ({ id: d.id, ...d.data() }));
          list.sort((a: any, b: any) => {
             const tA = a.createdAt?.toMillis ? a.createdAt.toMillis() : 0;
             const tB = b.createdAt?.toMillis ? b.createdAt.toMillis() : 0;
             return tB - tA;
          });
          set((state) => ({ farmerWorks: { ...state.farmerWorks, [key]: list } }));
        }
      }, err => console.log("Farmer works err", err));
  },

  unsubFarmerWorks: (key: string) => {
    if (unsubFarmerWorks[key]) {
      unsubFarmerWorks[key]();
      delete unsubFarmerWorks[key];
    }
  },

  initMestriAttendanceListener: (mestriId: string, phone: string, session: string) => {
    const key = mestriId;
    if (unsubMestriAttendance[key]) return;
    unsubMestriAttendance[key] = firestore()
      .collection("users").doc(phone).collection("mestris").doc(mestriId).collection("attendance")
      .where("session", "==", session)
      .onSnapshot((snap) => {
        if (snap) {
          const list = snap.docs.map(d => ({ id: d.id, ...d.data() }));
          // Order by createdAt desc locally
          list.sort((a: any, b: any) => {
             const timeA = a.createdAt?.toMillis() || 0;
             const timeB = b.createdAt?.toMillis() || 0;
             return timeB - timeA;
          });
          set((state) => ({ mestriAttendance: { ...state.mestriAttendance, [key]: list } }));
        }
      }, err => console.log("Mestri attendance err", err));
  },

  unsubMestriAttendance: (key: string) => {
    if (unsubMestriAttendance[key]) {
      unsubMestriAttendance[key]();
      delete unsubMestriAttendance[key];
    }
  },

  initMestriPaymentsListener: (mestriId: string, phone: string, session: string) => {
    const key = mestriId;
    if (unsubMestriPayments[key]) return;
    // We only need session matching because mestriId is inside the document in payments
    // Actually wait, mestriId in DB structure:
    // Is it nested under mestris? 
    // `users/{phone}/payments` where mestriId == mestriId.
    unsubMestriPayments[key] = firestore()
      .collection("users").doc(phone).collection("payments")
      .where("mestriId", "==", mestriId)
      .where("session", "==", session)
      .onSnapshot((snap) => {
        if (snap) {
          const list = snap.docs.map(d => ({ id: d.id, ...d.data() }));
          list.sort((a: any, b: any) => {
             const timeA = a.createdAt?.toMillis() || 0;
             const timeB = b.createdAt?.toMillis() || 0;
             return timeB - timeA;
          });
          set((state) => ({ mestriPayments: { ...state.mestriPayments, [key]: list } }));
        }
      }, err => console.log("Mestri payments err", err));
  },

  unsubMestriPayments: (key: string) => {
    if (unsubMestriPayments[key]) {
      unsubMestriPayments[key]();
      delete unsubMestriPayments[key];
    }
  }
}));
