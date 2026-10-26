// Central RBAC definition: roles -> permissions.
// To add a role or permission, change only this file.

const PERMISSIONS = {
  USERS_READ: 'users:read',          // list users and their tasks
  TASKS_READ_ALL: 'tasks:read_all',  // see any user's tasks, counts
  TASKS_ASSIGN: 'tasks:assign',      // assign a task to any user
  ROLES_MANAGE: 'roles:manage'       // change another user's role
};

const ROLES = {
  user: [],
  admin: [
    PERMISSIONS.USERS_READ,
    PERMISSIONS.TASKS_READ_ALL,
    PERMISSIONS.TASKS_ASSIGN
  ],
  super_admin: Object.values(PERMISSIONS)
};

const isValidRole = (role) => Object.prototype.hasOwnProperty.call(ROLES, role);
const getPermissions = (role) => (isValidRole(role) ? ROLES[role] : []);
const hasPermission = (role, permission) => getPermissions(role).includes(permission);

module.exports = { PERMISSIONS, ROLES, isValidRole, getPermissions, hasPermission };
