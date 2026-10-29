# Task Manager – Full-Stack App

A full-stack task management app with JWT authentication, role-based access control (RBAC), input validation, rate limiting, due dates with email reminders, and a PostgreSQL database.

**Live demo:** https://task-api-n64f.onrender.com/

> Hosted on Render's free plan, so the first load can take 30–60 seconds while the server wakes up.

## Features

**Tasks**
- Sign up and log in with JWT authentication; passwords hashed with bcrypt
- Create, edit, complete and delete your own tasks, with an optional due date and time
- Server-side pagination, filtering (status, search) and sorting (created date, due date, title)
- Per-user privacy: users can only see and change their own tasks
- Safe updates: only `title`, `description`, `status` and `dueDate` can be changed

**Roles (RBAC)**
- Three roles: `user`, `admin`, `super_admin`, each with a fixed set of permissions
- Admin panel: users with their role, task totals and recent tasks (paginated, filterable)
- Admins can assign tasks to any user (or to all users at once)
- Super admins can change other users' roles from the admin panel

**Email reminders**
- The assignee is emailed when a task is assigned, 24 hours before, 1 hour before, and daily once it's overdue
- Sent through Gmail (Nodemailer); triggered by an external scheduler (cron-job.org)

**Security and reliability**
- Input validation on every auth and task endpoint, with clear field errors
- Rate limiting on login and sign-up
- Security headers (Helmet) and CORS restricted to approved origins
- Required environment variables are checked at startup
- Central error handling with consistent JSON errors
- Automated tests (`npm test`)

## Tech Stack

| Layer | Technology |
|---|---|
| Backend | Node.js (18+), Express 5 |
| Database | PostgreSQL (Neon) with Prisma ORM |
| Auth | JSON Web Tokens, bcryptjs |
| Security | Helmet, express-rate-limit, CORS |
| Email | Nodemailer (Gmail SMTP) |
| Frontend | HTML, CSS, vanilla JavaScript |
| Testing | Node.js test runner, Supertest, Postman |
| Hosting | Render, with cron-job.org for scheduled reminders |

## Project Structure

```
task-api/
├── app.js                  # Builds the Express app (middleware, routes, error handling)
├── server.js               # Entry point: checks env variables, starts the server
├── config/
│   ├── env.js              # Required/optional environment variable checks
│   └── roles.js            # RBAC: roles and their permissions
├── lib/
│   └── prisma.js           # The single shared Prisma client
├── routes/                 # API routes (tasks, auth, cron)
├── controllers/            # Request handlers: tasks, users, cron
├── middlewares/
│   ├── authMiddleware.js        # protect: verifies the JWT
│   ├── permissionMiddleware.js  # requirePermission: checks the user's role
│   ├── rateLimiters.js          # login and sign-up rate limits
│   └── errorHandler.js          # 404 for unknown API routes, central error handler
├── utils/
│   └── validation.js       # Validation rules for bodies, ids and list queries
├── services/               # Email sending, email templates, reminder job
├── prisma/                 # Database schema and migrations
├── frontend/               # Login, dashboard and admin pages
├── tests/                  # Automated tests (npm test)
├── postman/                # Postman collection for manual/API testing
├── makeAdmin.js            # Script to set a user's role
├── seed.js                 # Script to create demo users
└── .env.example            # Environment variables
```

## Roles and Permissions

| Role | Permissions | Can do |
|---|---|---|
| `user` | none | Manage their own tasks |
| `admin` | `users:read`, `tasks:read_all`, `tasks:assign` | View all users and tasks, assign tasks |
| `super_admin` | all of the above + `roles:manage` | Everything, including changing roles |

- Each route declares the permission it needs; `requirePermission` reads the user's role from the database on every request, so role changes apply immediately.
- Nobody can change their own role, and the last super admin cannot be demoted.
- To add a role, add it to `config/roles.js`, the `Role` enum in `prisma/schema.prisma`, and the role dropdown in `frontend/admin.js`.

**Creating the first super admin** (needed once, because only a super admin can change roles). The user must have signed up first. Either:

```bash
node makeAdmin.js you@example.com super_admin    # role defaults to admin if omitted
```

or run this in the Neon SQL Editor:

```sql
UPDATE "User" SET role = 'super_admin' WHERE email = 'you@example.com';
```

After that, super admins manage roles from the admin panel (or `PATCH /api/auth/users/:id/role`).

## API

All endpoints return JSON. Protected endpoints need `Authorization: Bearer <token>`.

| Method | Endpoint | Access | Description |
|---|---|---|---|
| POST | `/api/auth/signup` | Public (rate limited) | Create an account |
| POST | `/api/auth/login` | Public (rate limited) | Log in; returns a token, role and permissions |
| GET | `/api/tasks` | Logged in | Your tasks (paginated, filterable, sortable) |
| GET | `/api/tasks/:id` | Logged in | One of your tasks |
| POST | `/api/tasks` | Logged in | Create a task |
| PUT | `/api/tasks/:id` | Logged in | Update your task: only `title`, `description`, `status`, `dueDate` |
| DELETE | `/api/tasks/:id` | Logged in | Delete your task |
| GET | `/api/auth/users` | `users:read` | Users with role, task totals and 5 most recent tasks |
| PATCH | `/api/auth/users/:id/role` | `roles:manage` | Change a user's role, body `{ "role": "admin" }` |
| GET | `/api/tasks/all/with-users` | `tasks:read_all` | All tasks with their owners |
| GET | `/api/tasks/all/count` | `tasks:read_all` | Total, pending and completed counts |
| GET | `/api/tasks/user/:userId` | `tasks:read_all` | One user's tasks |
| POST | `/api/tasks/assign` | `tasks:assign` | Assign a task (optional `dueDate`); the assignee is emailed |
| POST | `/api/tasks/assign-all` | `tasks:assign` | Assign a task to every user |
| GET | `/api/cron/send-reminders` | Secret key | Runs the reminder job (called by the scheduler) |

**List query parameters** (task lists): `page` (default 1), `limit` (default 10, max 100), `status` (`pending`/`completed`), `search` (title or description), `sortBy` (`createdAt`, `dueDate`, `title`), `order` (`asc`/`desc`), and `userId` on the admin task list. The user list accepts `page`, `limit`, `role` and `search`.

List responses look like:

```json
{ "tasks": [ ... ], "pagination": { "page": 1, "limit": 10, "total": 23, "totalPages": 3 } }
```

**Validation rules**

| Field | Rule |
|---|---|
| `name` | Required, up to 100 characters |
| `email` | Valid email, up to 254 characters, stored in lower case |
| `password` (sign-up) | 8–128 characters, at least one letter and one number |
| `title` | Required, up to 200 characters |
| `description` | Optional, up to 2000 characters |
| `status` | `pending` or `completed` |
| `dueDate` | Optional ISO date-time in the future |

**Errors** use one format:

```json
{ "message": "Email is not valid", "errors": [{ "field": "email", "message": "Email is not valid" }] }
```

| Status | Meaning |
|---|---|
| 400 | Invalid input or malformed JSON |
| 401 | Missing/invalid token, or wrong email/password |
| 403 | Your role doesn't have the required permission |
| 404 | Not found (including other users' tasks) |
| 409 | Email already registered |
| 429 | Too many login or sign-up attempts |
| 500 | Unexpected server error |

## Due-Date Email Reminders

| Email | When |
|---|---|
| New task assigned | Right after an admin assigns the task (Reply-To is the admin) |
| Due in 24 hours | Once, 24 hours before the due time |
| Due in 1 hour | Once, 1 hour before the due time |
| Overdue | At the due time, then daily after 9:00 AM IST until completed |

cron-job.org calls `/api/cron/send-reminders?key=<CRON_SECRET>` every 5 minutes. This wakes the server and runs the reminder job, which checks every pending task's due date, sends the right email to the task owner, and records it so it is never sent twice. Completed tasks get no reminders, changing a due date restarts them, and failed emails are retried on the next run.

## Run Locally

1. Clone and install:
   ```bash
   git clone https://github.com/diyaagarwall004-hue/task-api.git
   cd task-api
   npm install
   ```
2. Copy `.env.example` to `.env` and fill it in. `DATABASE_URL` and `JWT_SECRET` are required; the server stops with a clear message if they are missing (and warns if `JWT_SECRET` is shorter than 16 characters). The rest are optional.
3. Apply the database migrations:
   ```bash
   npx prisma migrate deploy
   npx prisma generate
   ```
4. Start the server and open `http://localhost:5000`:
   ```bash
   npm run dev
   ```
5. Optional: `npm run seed` creates 30 demo users (password `password123`).

## Environment Variables

| Variable | Required | Purpose |
|---|---|---|
| `DATABASE_URL` | Yes | PostgreSQL connection string |
| `JWT_SECRET` | Yes | Signs login tokens (use 16+ random characters) |
| `CORS_ORIGINS` | No | Comma-separated origins allowed to call the API cross-origin |
| `MAIL_USER`, `MAIL_PASS` | No | Gmail address and App Password for emails |
| `CRON_SECRET` | No | Key for the reminder endpoint (disabled without it) |
| `LOGIN_RATE_LIMIT` | No | Login attempts per IP per 15 minutes (default 10) |
| `SIGNUP_RATE_LIMIT` | No | Sign-ups per IP per hour (default 5) |
| `PORT` | No | Server port (default 5000) |

## Testing

**Automated tests**

```bash
npm test
```

The tests use Node's built-in test runner and Supertest, with an in-memory stand-in for the database, so they need no database or `.env`. They cover:

- Authentication: sign-up, login, tokens, duplicate emails
- Task CRUD, ownership and the update field whitelist
- Pagination, filtering and sorting
- Permissions: normal users vs admins vs super admins, role changes
- Validation, security headers, CORS, rate limiting, error responses
- Environment checks and reminder timing

**Postman**

Import `postman/task-api.postman_collection.json`, start the server, and run it with the Collection Runner (`baseUrl` defaults to `http://localhost:5000`). It runs against the real database. Login and sign-up are rate limited, so wait or raise the limits in `.env` before running it many times in a row.

## Deployment (Render)

- **Build command:** `npm install && npx prisma generate && npx prisma migrate deploy` (applies new migrations on every deploy)
- **Start command:** `npm start`
- **Environment variables:** see the table above
- **Scheduler:** a cron-job.org job calling `https://task-api-n64f.onrender.com/api/cron/send-reminders?key=<CRON_SECRET>` every 5 minutes

Pushing to `main` deploys automatically.

## Security Notes

- Secrets live only in `.env` and Render's environment settings, never in the code.
- The frontend only uses permissions to show or hide controls; the server checks every request.
- Login returns the same error for an unknown email and a wrong password, so accounts can't be discovered.
- User-entered text is escaped in emails and rendered as plain text in the frontend.
