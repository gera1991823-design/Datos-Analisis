// Only loaded by Playwright's request interception. Never served in production.
const timestamp = { toDate: () => new Date('2026-10-01T12:00:00Z'), toMillis: () => 1790856000000 };
const first = {
  createdAt: timestamp, updatedAt: timestamp, fecha: '01/10/2026', material: 'RE68316',
  cantidad: '2', centro: 'S004', sucurs: 'S004', sucursal_nombre: 'PAYSANDU',
  nombre: 'Operador prueba', responsable: 'Prueba', comentario: 'Registro de prueba',
  clasificacion: 'STKID', factura: '123456', division: 'AGRO', transporte: 'CAMION',
  carpeta: '00042_2026', dua: 'DUA-42', fecha_estimada: '2026-10-15', fecha_deposito: '2026-10-17',
  oc: '45001234', wis: 'SI', distribuido: 'NO', cierre: 'NO', cond: 'SI', confirmacion_llegada: 'NO',
  caja: 'C42', cantidadPack: '10', cantid: '2', descripcion: 'Repuesto de prueba',
  pedidoTrasla: 'TR42', horaCarga: '10:30', cumplido: 'NO', solicitud: 'MD42', necesidad: 'Stock',
  respuesta: 'Solicitar', fecha_respuesta: '2026-10-01', estado: 'Pendiente',
  monto_unitario: '100', monto_total: '200', nro_reclamo: 'R42', fecha_reclamo: '2026-10-01',
  respuesta_fabrica: '', observacion: 'Prueba', unidad: 'USD',
  attachments: [], packing: null, S001: '3', S004: '5'
};
const second = { ...first, material: 'AA58675', centro: 'S001', sucurs: 'S001',
  sucursal_nombre: 'MONTEVIDEO AGRO', factura: '654321', carpeta: '00043_2026',
  division: 'FORESTAL', oc: '45004321', cumplido: 'SI', wis: 'NO', cierre: 'SI' };
const data = new Map(['rows', 'reservas', 'solicitudes', 'stock_centro', 'reclamos']
  .map(name => [name, new Map([['fixture-1', { ...first }], ['fixture-2', { ...second }]])]));
data.set('notifications', new Map());
const listeners = [];
window.__writes = [];
window.__uploads = [];
window.__fixture = { data };
function snapshot(name) {
  const docs = [...(data.get(name) || new Map())].map(([id, row]) => ({ id, data: () => row, exists: () => true }));
  return { docs, size: docs.length, empty: !docs.length, forEach: cb => docs.forEach(cb), docChanges: () => [] };
}
function emit(name) { queueMicrotask(() => listeners.filter(l => l.name === name).forEach(l => l.cb(snapshot(name)))); }
function write(kind, target, row) {
  if (!data.has(target.name)) data.set(target.name, new Map());
  if (kind === 'delete') data.get(target.name).delete(target.id);
  else data.get(target.name).set(target.id, { ...(data.get(target.name).get(target.id) || {}), ...row });
  window.__writes.push({ kind, name: target.name, id: target.id, row });
  emit(target.name);
}
export const initializeApp = config => ({ config });
export const getFirestore = app => ({ app });
export const getAuth = () => ({});
export const signInAnonymously = async () => ({ user: { uid: 'fixture-user' } });
export const getStorage = () => ({});
export const collection = (_, name) => ({ name });
export const doc = (db, name, id) => typeof name === 'string' ? { name, id } : { name: db.name, id: `new-${Date.now()}` };
export const query = base => base;
export const orderBy = () => ({});
export const limit = () => ({});
export const serverTimestamp = () => timestamp;
export const onSnapshot = (target, cb) => { listeners.push({ name: target.name, cb }); queueMicrotask(() => cb(snapshot(target.name))); return () => {}; };
export const getDocs = async target => snapshot(target.name);
export const getDoc = async target => ({ exists: () => !!data.get(target.name)?.has(target.id), data: () => data.get(target.name)?.get(target.id) });
export const addDoc = async (target, row) => { const id = `new-${window.__writes.length}`; write('add', { ...target, id }, row); return { ...target, id }; };
export const updateDoc = async (target, row) => write('update', target, row);
export const setDoc = async (target, row) => write('set', target, row);
export const deleteDoc = async target => write('delete', target);
export const writeBatch = () => { const operations = []; return { set: (target, row) => operations.push(['set', target, row]), update: (target, row) => operations.push(['update', target, row]), delete: target => operations.push(['delete', target]), commit: async () => operations.forEach(o => write(...o)) }; };
export const ref = (_, path) => ({ path });
export const uploadBytesResumable = (target, file) => {
  window.__uploads.push({ path: target.path, name: file.name });
  const snapshot = { ref: target, bytesTransferred: file.size, totalBytes: file.size };
  return { snapshot, on: (_, progress, error, complete) => queueMicrotask(() => { progress(snapshot); complete(); }) };
};
export const getDownloadURL = async target => `https://fixture.invalid/${target.path}`;
export const deleteObject = async target => window.__uploads.push({ deleted: target.path });
