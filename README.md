Task Manager – Full-Stack App
A full-stack task management app with JWT authentication, role-based access control (RBAC), due dates with email reminders, and a cloud PostgreSQL database.
Live demo: https://task-api-n64f.onrender.com/
> Hosted on Render's free plan, so the first load can take 30–60 seconds while the server wakes up.
Features
Tasks
Sign up and log in with JWT authentication; passwords hashed with bcrypt
Create, edit, complete and delete your own tasks, with an optional due date and time
Filter tasks: All / Pending / Completed; lists are always sorted newest first
Per-user privacy: users can only see and change their own tasks
Safe updates: only `title`, `description`, `status` and `dueDate` can be changed
Roles (RBAC)
Three roles: `user`, `admin`, `super_admin`, each with a fixed set of permissions
Admin panel: every user with their role, signup and last login time, and task stats (paginated)
Admins can assign tasks to any user (or to all users at once)
Super admins can change other users' roles from the admin panel
Email reminders
The assignee is emailed when a task is assigned, 24 hours before, 1 hour before, and daily once it's overdue
Sent through Gmail (Nodemailer); triggered by an external scheduler (cron-job.org)
Tech Stack
Layer	Technology
Backend	Node.js, Express 5
Database	PostgreSQL (Neon) with Prisma ORM
Auth	JSON Web Tokens, bcryptjs
Email	Nodemailer (Gmail SMTP)
Frontend	HTML, CSS, vanilla JavaScript
Hosting	Render, with cron-job.org for scheduled reminders
Testing	Postman collection
Project Structure
```
task-api/
├── config/
│   └── roles.js            # RBAC: roles and their permissions (single source of truth)
├── controllers/            # Business logic: tasks, users, cron
├── routes/                 # API routes (tasks, auth, cron)
├── middlewares/
│   ├── authMiddleware.js        # protect: verifies the JWT
│   └── permissionMiddleware.js  # requirePermission: checks the user's role
├── services/
│   ├── mailer.js           # Sends email through Gmail SMTP
│   ├── reminderEmails.js   # Email templates
│   └── reminderJob.js      # Decides and sends due/overdue reminders
├── prisma/                 # Database schema and migrations
├── frontend/               # Login, dashboard and admin pages
├── postman/                # Postman test collection
├── makeAdmin.js            # Script to set a user's role
├── seed.js                 # Script to create demo users
├── .env.example            # Required environment variables
└── server.js               # App entry point
```
Roles and Permissions
Role	Permissions	Can do
`user`	none	Manage their own tasks
`admin`	`users:read`, `tasks:read_all`, `tasks:assign`	View all users and tasks, assign tasks
`super_admin`	all of the above + `roles:manage`	Everything, including changing roles
Each route declares the permission it needs; `requirePermission` reads the user's role from the database on every request, so role changes apply immediately.
Nobody can change their own role, and the last super admin cannot be demoted.
To add a role, add one line to `config/roles.js` (and its name to the role dropdown in `frontend/admin.js`).
Creating the first super admin (needed once, because only a super admin can change roles). The user must have signed up first. Either:
```bash
node makeAdmin.js you@example.com super_admin    # role defaults to admin if omitted
```
or run this in the Neon SQL Editor:
```sql
UPDATE "User" SET role = 'super_admin' WHERE email = 'you@example.com';
```
After that, super admins manage all roles from the admin panel (or `PATCH /api/auth/users/:id/role`).
API Endpoints
Method	Endpoint	Access	Description
POST	`/api/auth/signup`	Public	Create an account
POST	`/api/auth/login`	Public	Log in; returns a token, role and permissions
GET	`/api/tasks`	Logged in	Your tasks, newest first
GET	`/api/tasks/:id`	Logged in	One of your tasks
POST	`/api/tasks`	Logged in	Create a task (optional `dueDate`, must be in the future)
PUT	`/api/tasks/:id`	Logged in	Update your task: only `title`, `description`, `status` (`pending`/`completed`), `dueDate`
DELETE	`/api/tasks/:id`	Logged in	Delete your task
GET	`/api/auth/users`	`users:read`	All users with roles and tasks (paginated)
PATCH	`/api/auth/users/:id/role`	`roles:manage`	Change a user's role, body `{ "role": "admin" }`
GET	`/api/tasks/all/with-users`	`tasks:read_all`	All users with their tasks
GET	`/api/tasks/all/count`	`tasks:read_all`	Total, pending and completed counts
GET	`/api/tasks/user/:userId`	`tasks:read_all`	One user's tasks (paginated)
POST	`/api/tasks/assign`	`tasks:assign`	Assign a task (optional `dueDate`) to a user; the assignee is emailed
POST	`/api/tasks/assign-all`	`tasks:assign`	Assign a task to every user (no due date or email)
GET	`/api/cron/send-reminders`	Secret key	Runs the reminder job (called by the scheduler)
Users who try to change another user's task get `404`; missing permissions return `403`.
Due-Date Email Reminders
Email	When
New task assigned	Right after an admin assigns the task (Reply-To is the admin)
Due in 24 hours	Once, 24 hours before the due time
Due in 1 hour	Once, 1 hour before the due time
Overdue	At the due time, then daily after 9:00 AM IST until completed
How it works: cron-job.org calls `/api/cron/send-reminders?key=<CRON_SECRET>` every 5 minutes. This wakes the Render server and runs `runReminders`, which checks every pending task's due date against the current time, sends the right email to the task owner's registered address, and records it on the task so it is never sent twice. Completed tasks get no reminders, and changing a due date restarts them. If sending fails, it is retried on the next run.
Run Locally
Clone and install:
```bash
   git clone https://github.com/diyaagarwall004-hue/task-api.git
   cd task-api
   npm install
   ```
Create a `.env` file (see `.env.example`):
```
   DATABASE_URL="your-postgresql-connection-string"
   JWT_SECRET="any-long-random-string"
   MAIL_USER="your.sender@gmail.com"     # optional: for emails
   MAIL_PASS="your-16-char-app-password" # Gmail App Password
   CRON_SECRET="another-long-random-string"
   ```
Without `MAIL_USER`/`MAIL_PASS`, emails are skipped and the app still works.
Set up the database:
```bash
   npx prisma migrate deploy
   ```
Start the server and open `http://localhost:5000`:
```bash
   npm run dev
   ```
To send reminders locally, open `http://localhost:5000/api/cron/send-reminders?key=<CRON_SECRET>`.
Deployment (Render)
Build command: `npm install && npx prisma generate && npx prisma migrate deploy` (applies new migrations on every deploy)
Start command: `npm start` (runs `node server.js`)
Environment variables: `DATABASE_URL`, `JWT_SECRET`, `MAIL_USER`, `MAIL_PASS`, `CRON_SECRET`
Scheduler: a cron-job.org job calling `https://task-api-n64f.onrender.com/api/cron/send-reminders?key=<CRON_SECRET>` every 5 minutes
Pushing to `main` deploys automatically.
Testing
Import `postman/task-api.postman_collection.json` into Postman, start the server, and run it with the Collection Runner (`baseUrl` defaults to `http://localhost:5000`). It creates two fresh users and checks:
Field whitelisting and ownership on task updates
Input validation and due dates
Newest-first sorting
RBAC: normal users are denied admin actions
The reminder endpoint rejects missing or wrong keys
Last run: 31 of 31 checks passed. Real emails were verified for task assignment and overdue reminders.
Security Notes
Secrets (`DATABASE_URL`, `JWT_SECRET`, `MAIL_PASS`, `CRON_SECRET`) live only in `.env` and Render's environment settings, never in the code.
The frontend only uses permissions to show or hide controls; the server checks every request.
User-entered text is escaped in emails and rendered as plain text in the frontend.
