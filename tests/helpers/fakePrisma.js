// In-memory stand-in for the Prisma client, used by the automated tests so they
// run without a database. It supports only the query features this app uses.

const DEFAULTS = {
  user: () => ({ role: 'user', lastLogin: null }),
  task: () => ({
    description: null,
    status: 'pending',
    dueDate: null,
    assignedById: null,
    dayBeforeSentAt: null,
    hourBeforeSentAt: null,
    lastOverdueSentAt: null
  })
};

const RELATIONS = {
  user: { tasks: { model: 'task', many: true, foreignKey: 'userId' } },
  task: {
    user: { model: 'user', many: false, localKey: 'userId' },
    assignedBy: { model: 'user', many: false, localKey: 'assignedById' }
  }
};

function createFakePrisma() {
  const db = { user: [], task: [] };
  const nextId = { user: 1, task: 1 };
  let clock = Date.UTC(2026, 0, 1); // increasing timestamps keep sort order predictable

  const tick = () => new Date((clock += 1000));
  const toTime = (v) => (v instanceof Date ? v.getTime() : v);

  // ---------- where ----------
  function matchesField(value, condition) {
    if (condition === null) return value === null || value === undefined;
    if (condition instanceof Date) return toTime(value) === condition.getTime();
    if (typeof condition !== 'object') return value === condition;

    const insensitive = condition.mode === 'insensitive';
    const norm = (v) => (insensitive && typeof v === 'string' ? v.toLowerCase() : v);

    if ('equals' in condition && norm(value) !== norm(condition.equals)) return false;
    if ('in' in condition && !condition.in.includes(value)) return false;
    if ('not' in condition) {
      if (condition.not === null ? value === null || value === undefined : toTime(value) === toTime(condition.not)) return false;
    }
    if ('contains' in condition) {
      if (typeof value !== 'string' || !norm(value).includes(norm(condition.contains))) return false;
    }
    return true;
  }

  function matches(row, where = {}) {
    return Object.entries(where).every(([key, condition]) => {
      if (key === 'OR') return condition.some((w) => matches(row, w));
      if (key === 'AND') return condition.every((w) => matches(row, w));
      return matchesField(row[key], condition);
    });
  }

  // ---------- orderBy / paging ----------
  function sortRows(rows, orderBy) {
    if (!orderBy) return rows;
    const rules = (Array.isArray(orderBy) ? orderBy : [orderBy]).map((rule) => {
      const [field, spec] = Object.entries(rule)[0];
      return typeof spec === 'string' ? { field, dir: spec, nulls: 'last' } : { field, dir: spec.sort, nulls: spec.nulls || 'last' };
    });
    return [...rows].sort((a, b) => {
      for (const { field, dir, nulls } of rules) {
        const x = toTime(a[field]);
        const y = toTime(b[field]);
        if (x === y) continue;
        if (x === null || x === undefined) return nulls === 'first' ? -1 : 1;
        if (y === null || y === undefined) return nulls === 'first' ? 1 : -1;
        const cmp = x < y ? -1 : 1;
        return dir === 'desc' ? -cmp : cmp;
      }
      return 0;
    });
  }

  function page(rows, { skip = 0, take } = {}) {
    return rows.slice(skip, take === undefined ? undefined : skip + take);
  }

  // ---------- select / include ----------
  function relationRows(model, row, name, args = {}) {
    const rel = RELATIONS[model][name];
    if (rel.many) {
      const related = db[rel.model].filter((r) => r[rel.foreignKey] === row.id && matches(r, args.where));
      return page(sortRows(related, args.orderBy), args).map((r) => shape(rel.model, r, args));
    }
    const related = db[rel.model].find((r) => r.id === row[rel.localKey]);
    return related ? shape(rel.model, related, args) : null;
  }

  function shape(model, row, { select, include } = {}) {
    if (select) {
      const out = {};
      for (const [key, value] of Object.entries(select)) {
        if (!value) continue;
        out[key] = RELATIONS[model][key] ? relationRows(model, row, key, value === true ? {} : value) : row[key];
      }
      return out;
    }
    const out = { ...row };
    for (const [key, value] of Object.entries(include || {})) {
      if (value) out[key] = relationRows(model, row, key, value === true ? {} : value);
    }
    return out;
  }

  // ---------- model API ----------
  function model(name) {
    const rows = () => db[name];

    const uniqueCheck = (data, ignoreId) => {
      if (name === 'user' && data.email !== undefined && rows().some((r) => r.email === data.email && r.id !== ignoreId)) {
        const error = new Error('Unique constraint failed on the fields: (`email`)');
        error.code = 'P2002';
        throw error;
      }
    };

    const insert = (data) => {
      uniqueCheck(data);
      const now = tick();
      const row = { id: nextId[name]++, ...DEFAULTS[name](), createdAt: now, updatedAt: now, ...data };
      rows().push(row);
      return row;
    };

    return {
      async findUnique({ where, ...args }) {
        const row = rows().find((r) => matches(r, where));
        return row ? shape(name, row, args) : null;
      },
      async findFirst({ where, orderBy, ...args } = {}) {
        const row = sortRows(rows().filter((r) => matches(r, where)), orderBy)[0];
        return row ? shape(name, row, args) : null;
      },
      async findMany({ where, orderBy, skip, take, ...args } = {}) {
        const found = sortRows(rows().filter((r) => matches(r, where)), orderBy);
        return page(found, { skip, take }).map((r) => shape(name, r, args));
      },
      async count({ where } = {}) {
        return rows().filter((r) => matches(r, where)).length;
      },
      async create({ data, ...args }) {
        return shape(name, insert(data), args);
      },
      async createMany({ data }) {
        data.forEach(insert);
        return { count: data.length };
      },
      async update({ where, data, ...args }) {
        const row = rows().find((r) => matches(r, where));
        if (!row) {
          const error = new Error('Record to update not found.');
          error.code = 'P2025';
          throw error;
        }
        uniqueCheck(data, row.id);
        Object.assign(row, data, { updatedAt: tick() });
        return shape(name, row, args);
      },
      async updateMany({ where, data }) {
        const found = rows().filter((r) => matches(r, where));
        found.forEach((row) => Object.assign(row, data, { updatedAt: tick() }));
        return { count: found.length };
      },
      async deleteMany({ where } = {}) {
        const keep = rows().filter((r) => !matches(r, where));
        const count = rows().length - keep.length;
        db[name] = keep;
        return { count };
      },
      async groupBy({ by, where }) {
        const groups = new Map();
        for (const row of rows().filter((r) => matches(r, where))) {
          const key = JSON.stringify(by.map((field) => row[field]));
          if (!groups.has(key)) {
            groups.set(key, { ...Object.fromEntries(by.map((field) => [field, row[field]])), _count: { _all: 0 } });
          }
          groups.get(key)._count._all += 1;
        }
        return [...groups.values()];
      }
    };
  }

  return {
    user: model('user'),
    task: model('task'),
    $transaction: (operations) => Promise.all(operations),
    $disconnect: async () => {},
    // Test-only helpers
    $reset() {
      db.user = [];
      db.task = [];
      nextId.user = 1;
      nextId.task = 1;
    },
    $rows: (name) => db[name]
  };
}

module.exports = createFakePrisma;
