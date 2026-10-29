// Small, dependency-free validation helpers.
// Each schema takes raw input and returns { value, errors }:
//   value  - cleaned data (trimmed, lower-cased, converted to numbers/dates)
//   errors - [{ field, message }], empty when the input is valid

const { isValidRole } = require('../config/roles');

const TASK_STATUSES = ['pending', 'completed'];
const TASK_SORT_FIELDS = ['createdAt', 'dueDate', 'title'];
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const LIMITS = {
  name: 100,
  email: 254,
  passwordMin: 8,
  passwordMax: 128,
  title: 200,
  description: 2000,
  search: 100,
  pageSizeMax: 100
};

// ---------- field checks ----------

function requiredString(input, field, errors, { max, min = 1, label = field } = {}) {
  if (typeof input !== 'string' || input.trim().length < min) {
    errors.push({ field, message: min > 1 ? `${label} must be at least ${min} characters` : `${label} is required` });
    return undefined;
  }
  const value = input.trim();
  if (max && value.length > max) {
    errors.push({ field, message: `${label} must be at most ${max} characters` });
  }
  return value;
}

function optionalText(input, field, errors, max) {
  if (input === undefined || input === null || input === '') return null;
  if (typeof input !== 'string') {
    errors.push({ field, message: `${field} must be a string` });
    return undefined;
  }
  const value = input.trim();
  if (value.length > max) errors.push({ field, message: `${field} must be at most ${max} characters` });
  return value || null;
}

function email(input, errors) {
  const value = requiredString(input, 'email', errors, { max: LIMITS.email, label: 'Email' });
  if (value === undefined) return undefined;
  if (!EMAIL_PATTERN.test(value)) errors.push({ field: 'email', message: 'Email is not valid' });
  return value.toLowerCase();
}

// Future date or null. Accepts ISO strings such as "2026-11-01T10:30:00.000Z".
function dueDate(input, errors) {
  if (input === undefined || input === null || input === '') return null;
  const date = new Date(input);
  if (typeof input !== 'string' || Number.isNaN(date.getTime())) {
    errors.push({ field: 'dueDate', message: 'Due date must be a valid date and time' });
    return undefined;
  }
  if (date.getTime() <= Date.now()) {
    errors.push({ field: 'dueDate', message: 'Due date must be in the future' });
  }
  return date;
}

function positiveInt(input, field, errors) {
  const n = Number(input);
  if (input === undefined || input === null || input === '' || !Number.isInteger(n) || n < 1) {
    errors.push({ field, message: `${field} must be a positive whole number` });
    return undefined;
  }
  return n;
}

// ---------- body schemas ----------

function signup(body) {
  const errors = [];
  const value = {
    name: requiredString(body.name, 'name', errors, { max: LIMITS.name, label: 'Name' }),
    email: email(body.email, errors),
    password: undefined
  };
  if (typeof body.password !== 'string' || body.password.length < LIMITS.passwordMin) {
    errors.push({ field: 'password', message: `Password must be at least ${LIMITS.passwordMin} characters` });
  } else if (body.password.length > LIMITS.passwordMax) {
    errors.push({ field: 'password', message: `Password must be at most ${LIMITS.passwordMax} characters` });
  } else if (!/[A-Za-z]/.test(body.password) || !/\d/.test(body.password)) {
    errors.push({ field: 'password', message: 'Password must contain at least one letter and one number' });
  } else {
    value.password = body.password;
  }
  return { value, errors };
}

// Login only checks that the fields are present, so existing accounts with older passwords still work.
function login(body) {
  const errors = [];
  const value = { email: email(body.email, errors), password: undefined };
  if (typeof body.password !== 'string' || body.password.length === 0) {
    errors.push({ field: 'password', message: 'Password is required' });
  } else if (body.password.length > LIMITS.passwordMax) {
    errors.push({ field: 'password', message: `Password must be at most ${LIMITS.passwordMax} characters` });
  } else {
    value.password = body.password;
  }
  return { value, errors };
}

function createTask(body) {
  const errors = [];
  const value = {
    title: requiredString(body.title, 'title', errors, { max: LIMITS.title, label: 'Title' }),
    description: optionalText(body.description, 'description', errors, LIMITS.description),
    dueDate: dueDate(body.dueDate, errors)
  };
  return { value, errors };
}

// Only these fields can be changed; anything else in the body is ignored.
function updateTask(body) {
  const errors = [];
  const value = {};
  if ('title' in body) value.title = requiredString(body.title, 'title', errors, { max: LIMITS.title, label: 'Title' });
  if ('description' in body) value.description = optionalText(body.description, 'description', errors, LIMITS.description);
  if ('status' in body) {
    if (!TASK_STATUSES.includes(body.status)) {
      errors.push({ field: 'status', message: `Status must be one of: ${TASK_STATUSES.join(', ')}` });
    } else {
      value.status = body.status;
    }
  }
  if ('dueDate' in body) value.dueDate = dueDate(body.dueDate, errors);

  if (errors.length === 0 && Object.keys(value).length === 0) {
    errors.push({ field: 'body', message: 'Nothing to update. Allowed fields: title, description, status, dueDate' });
  }
  return { value, errors };
}

function assignTask(body) {
  const { value, errors } = createTask(body);
  value.userId = positiveInt(body.userId, 'userId', errors);
  return { value, errors };
}

function assignTaskToAll(body) {
  const errors = [];
  const value = {
    title: requiredString(body.title, 'title', errors, { max: LIMITS.title, label: 'Title' }),
    description: optionalText(body.description, 'description', errors, LIMITS.description)
  };
  return { value, errors };
}

function updateRole(body) {
  const errors = [];
  if (!isValidRole(body.role)) errors.push({ field: 'role', message: 'Role must be one of: user, admin, super_admin' });
  return { value: { role: body.role }, errors };
}

// ---------- query schemas (pagination, filtering, sorting) ----------

function pagination(query, errors, defaultLimit = 10) {
  const page = query.page === undefined ? 1 : positiveInt(query.page, 'page', errors);
  let limit = query.limit === undefined ? defaultLimit : positiveInt(query.limit, 'limit', errors);
  if (limit > LIMITS.pageSizeMax) {
    errors.push({ field: 'limit', message: `limit must be at most ${LIMITS.pageSizeMax}` });
    limit = undefined;
  }
  return { page, limit };
}

function search(query, errors) {
  if (query.search === undefined || query.search === '') return undefined;
  if (typeof query.search !== 'string' || query.search.length > LIMITS.search) {
    errors.push({ field: 'search', message: `search must be at most ${LIMITS.search} characters` });
    return undefined;
  }
  return query.search.trim() || undefined;
}

function taskListQuery(query = {}) {
  const errors = [];
  const value = { ...pagination(query, errors), search: search(query, errors) };

  if (query.status !== undefined) {
    if (!TASK_STATUSES.includes(query.status)) {
      errors.push({ field: 'status', message: `status must be one of: ${TASK_STATUSES.join(', ')}` });
    } else {
      value.status = query.status;
    }
  }

  value.sortBy = query.sortBy === undefined ? 'createdAt' : query.sortBy;
  if (!TASK_SORT_FIELDS.includes(value.sortBy)) {
    errors.push({ field: 'sortBy', message: `sortBy must be one of: ${TASK_SORT_FIELDS.join(', ')}` });
  }
  value.order = query.order === undefined ? 'desc' : query.order;
  if (!['asc', 'desc'].includes(value.order)) {
    errors.push({ field: 'order', message: 'order must be asc or desc' });
  }

  if (query.userId !== undefined) value.userId = positiveInt(query.userId, 'userId', errors);
  return { value, errors };
}

function userListQuery(query = {}) {
  const errors = [];
  const value = { ...pagination(query, errors), search: search(query, errors) };
  if (query.role !== undefined) {
    if (!isValidRole(query.role)) errors.push({ field: 'role', message: 'role must be one of: user, admin, super_admin' });
    else value.role = query.role;
  }
  return { value, errors };
}

// ---------- middleware ----------

// validate(schema)          -> checks req.body and replaces it with the cleaned value
// validate(schema, 'query') -> checks req.query and stores the result in req.validatedQuery
function validate(schema, source = 'body') {
  return (req, res, next) => {
    const { value, errors } = schema(req[source] || {});
    if (errors.length > 0) {
      return res.status(400).json({ message: errors.map((e) => e.message).join('. '), errors });
    }
    if (source === 'body') req.body = value;
    else req.validatedQuery = value;
    next();
  };
}

// Checks that a route parameter (e.g. :id) is a positive whole number.
function validateIdParam(name) {
  return (req, res, next) => {
    const errors = [];
    positiveInt(req.params[name], name, errors);
    if (errors.length > 0) {
      return res.status(400).json({ message: errors[0].message, errors });
    }
    next();
  };
}

module.exports = {
  schemas: {
    signup,
    login,
    createTask,
    updateTask,
    assignTask,
    assignTaskToAll,
    updateRole,
    taskListQuery,
    userListQuery
  },
  validate,
  validateIdParam,
  TASK_STATUSES,
  LIMITS
};
