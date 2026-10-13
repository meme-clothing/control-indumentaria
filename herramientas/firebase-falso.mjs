/* --------------------------------------------------------------------------
   SDK de Firebase falso, solo para las pruebas.

   Implementa lo justo que usa la aplicación: autenticación con correo y
   contraseña, y los documentos de Firestore con consultas por rango y lotes
   de escritura. Guarda todo en memoria.

   No reemplaza probar contra el emulador de Firebase antes de publicar: las
   Security Rules no se evalúan acá.
   -------------------------------------------------------------------------- */

export function crearFirebaseFalso(){
  const cuentas = new Map();      // correo -> { uid, correo, clave, deshabilitada }
  const base = new Map();         // 'coleccion/id' -> objeto
  const instancias = new Map();   // nombre -> app
  const sesiones = new Map();     // nombre de app -> uid
  const oyentes = new Map();      // nombre de app -> [callback]
  let contador = 0;
  const cuenta = { lecturas: 0, escrituras: 0, borrados: 0 };

  const error = codigo => Object.assign(new Error(codigo), { code: codigo });

  /* Firestore acepta rutas de largo variable: collection(db, 'negocios', id,
     'productos') es una subcolección. El falso tiene que hacer lo mismo, si no
     las pruebas de separación por negocio pasan sin probar nada. */
  const rutaColeccion = segs => {
    if (segs.length % 2 === 0)
      throw new Error('ruta de colección con cantidad par de segmentos: ' + segs.join('/'));
    return segs.join('/');
  };
  const rutaDocumento = segs => {
    if (segs.length % 2 !== 0)
      throw new Error('ruta de documento con cantidad impar de segmentos: ' + segs.join('/'));
    return segs.join('/');
  };

  function avisarOyentes(nombreApp){
    const uid = sesiones.get(nombreApp) || null;
    const u = uid ? [...cuentas.values()].find(c => c.uid === uid) : null;
    (oyentes.get(nombreApp) || []).forEach(cb =>
      cb(u ? { uid: u.uid, email: u.correo } : null));
  }

  const apps = {
    initializeApp(config, nombre = '[DEFAULT]'){
      const app = { name: nombre, options: config };
      instancias.set(nombre, app);
      return app;
    },
    getApps: () => [...instancias.values()],
    async deleteApp(app){
      instancias.delete(app.name);
      sesiones.delete(app.name);
      oyentes.delete(app.name);
    }
  };

  const auth = {
    getAuth(app){
      const nombre = app ? app.name : '[DEFAULT]';
      return {
        _app: nombre,
        get currentUser(){
          const uid = sesiones.get(nombre);
          if (!uid) return null;
          const c = [...cuentas.values()].find(x => x.uid === uid);
          return c ? { uid: c.uid, email: c.correo } : null;
        }
      };
    },

    async signInWithEmailAndPassword(a, correo, clave_){
      const c = cuentas.get(correo);
      if (!c) throw error('auth/user-not-found');
      if (c.deshabilitada) throw error('auth/user-disabled');
      if (c.clave !== clave_) throw error('auth/wrong-password');
      sesiones.set(a._app, c.uid);
      avisarOyentes(a._app);
      return { user: { uid: c.uid, email: correo } };
    },

    async createUserWithEmailAndPassword(a, correo, clave_){
      if (cuentas.has(correo)) throw error('auth/email-already-in-use');
      if (String(clave_).length < 6) throw error('auth/weak-password');
      const uid = 'uid' + (++contador);
      cuentas.set(correo, { uid, correo, clave: clave_ });
      sesiones.set(a._app, uid);
      avisarOyentes(a._app);
      return { user: { uid, email: correo } };
    },

    async signOut(a){ sesiones.delete(a._app); avisarOyentes(a._app); },

    onAuthStateChanged(a, cb){
      const lista = oyentes.get(a._app) || [];
      lista.push(cb);
      oyentes.set(a._app, lista);
      const uid = sesiones.get(a._app);
      const c = uid ? [...cuentas.values()].find(x => x.uid === uid) : null;
      queueMicrotask(() => cb(c ? { uid: c.uid, email: c.correo } : null));
      return () => oyentes.set(a._app, (oyentes.get(a._app) || []).filter(f => f !== cb));
    },

    EmailAuthProvider: {
      credential: (correo, clave_) => ({ correo, clave: clave_ })
    },

    async reauthenticateWithCredential(usuario, cred){
      const c = cuentas.get(cred.correo);
      if (!c || c.clave !== cred.clave) throw error('auth/wrong-password');
      return { user: usuario };
    },

    async updatePassword(usuario, nueva){
      const c = [...cuentas.values()].find(x => x.uid === usuario.uid);
      if (!c) throw error('auth/user-not-found');
      if (String(nueva).length < 6) throw error('auth/weak-password');
      c.clave = nueva;
    }
  };

  const db = {
    getFirestore: () => ({ _db: true }),
    async enableIndexedDbPersistence(){ /* sin efecto */ },

    doc: (_d, ...segs) => {
      const ruta = rutaDocumento(segs);
      const corte = ruta.lastIndexOf('/');
      return { _col: ruta.slice(0, corte), _id: ruta.slice(corte + 1), _ruta: ruta };
    },
    collection: (_d, ...segs) => ({ _col: rutaColeccion(segs) }),

    query: (ref, ...filtros) => ({ ...ref, _filtros: filtros }),
    where: (campo, op, valor) => ({ campo, op, valor }),

    async getDoc(ref){
      cuenta.lecturas++;
      const v = base.get(ref._ruta || `${ref._col}/${ref._id}`);
      return {
        id: ref._id,
        exists: () => v !== undefined,
        data: () => (v === undefined ? undefined : JSON.parse(JSON.stringify(v)))
      };
    },

    async getDocs(ref){
      const filtros = ref._filtros || [];
      const salida = [];
      for (const [k, v] of base){
        const corte = k.lastIndexOf('/');
        const col = k.slice(0, corte), id = k.slice(corte + 1);
        if (col !== ref._col) continue;
        const pasa = filtros.every(f => {
          const x = v[f.campo];
          if (f.op === '>=') return x >= f.valor;
          if (f.op === '<')  return x <  f.valor;
          if (f.op === '<=') return x <= f.valor;
          if (f.op === '>')  return x >  f.valor;
          return x === f.valor;
        });
        if (pasa) salida.push({ id, data: () => JSON.parse(JSON.stringify(v)) });
      }
      cuenta.lecturas += salida.length;
      return { forEach: f => salida.forEach(f), size: salida.length, docs: salida };
    },

    async setDoc(ref, contenido){
      cuenta.escrituras++;
      base.set(ref._ruta || `${ref._col}/${ref._id}`, JSON.parse(JSON.stringify(contenido)));
    },

    writeBatch(){
      const ops = [];
      return {
        set(ref, contenido){ ops.push(['set', ref, contenido]); },
        delete(ref){ ops.push(['del', ref]); },
        async commit(){
          if (ops.length > 500) throw new Error('lote de más de 500 operaciones');
          ops.forEach(([tipo, ref, contenido]) => {
            const ruta = ref._ruta || `${ref._col}/${ref._id}`;
            if (tipo === 'set'){
              cuenta.escrituras++;
              base.set(ruta, JSON.parse(JSON.stringify(contenido)));
            } else {
              cuenta.borrados++;
              base.delete(ruta);
            }
          });
          ops.length = 0;
        }
      };
    }
  };

  return {
    sdk: { apps, auth, db },
    /* utilidades para las pruebas */
    cuentas, base, cuenta,
    sembrarCuenta(correo, clave_, uid){
      const id = uid || ('uid' + (++contador));
      cuentas.set(correo, { uid: id, correo, clave: clave_ });
      return id;
    },
    poner(col, id, obj){ base.set(`${col}/${id}`, JSON.parse(JSON.stringify(obj))); },
    leer(col, id){ return base.get(`${col}/${id}`); },
    contar(col){ return [...base.keys()].filter(k => k.startsWith(col + '/')).length; },
    reiniciarContador(){ cuenta.lecturas = 0; cuenta.escrituras = 0; cuenta.borrados = 0; }
  };
}
