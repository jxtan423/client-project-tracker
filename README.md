# Client Project Tracker

## Setup
## Pre-requisite
1) Ensure Docker, DBeaver, IDE (VSC, Cursor, TRAE, etc.) are up and running in your local laptop/PC [Example]
2) The step-by-step walkthrough is based on Windows

## Step-by-step walkthrough
### 1) Download the ZIP folder on GitHub and extract the ZIP folder
### 2) Setup for Docker:
- Open CMD, and point the directory to 'client-project-tracker-main'
  - i.e. C:\Users\XXX\YYY\client-project-tracker-main\client-project-tracker-main
- Type command, 'docker-compose -f docker-compose.yml up -d'

This is the expected outcome on terminal: \
<img width="826" height="155" alt="image" src="https://github.com/user-attachments/assets/b912f9a6-af2f-4aa7-b646-3856be43ab8f" />

This is the expected outcome on Docker container: \
<img width="1635" height="184" alt="image" src="https://github.com/user-attachments/assets/25a5237f-f4f9-41f6-a087-371b511552ce" />

### 3) Setup for database (DBeaver in this case)
- Click the icon at the top left corner (New database connection)
- Select PostgreSQL, and click 'Next'
- Please follow the credential as below:


  | Setting | Value |
  | --- | --- |
  | Host | `localhost` (or `127.0.0.1`) |
  | Port | `5432` |
  | Database | `client_project_tracker` |
  | Username | `tracker` |
  | Password |  |
- Leave the password field in blank
- Click 'Test Connection', and here's the outcome:
<img width="438" height="239" alt="image" src="https://github.com/user-attachments/assets/bf36cbec-8f03-4f47-b942-108d447e2a4c" />

- Click 'OK' to close the dialog, and click 'Finish' after that

This is the expected outcome on DBeaver:

<img width="1919" height="911" alt="image" src="https://github.com/user-attachments/assets/7569a53c-4bdf-4691-8f30-ebd7e5932b83" />


### 4) Run the SQL
- Open CMD, and point the directory to 'client-project-tracker-main'
  - i.e. C:\Users\XXX\YYY\client-project-tracker-main\client-project-tracker-main
- Type command, 'docker compose exec -T db psql -X -U tracker -d client_project_tracker -v ON_ERROR_STOP=1 < sql\init.sql'
This is the expected outcome on terminal:

<img width="322" height="276" alt="image" src="https://github.com/user-attachments/assets/3a5f11c6-1004-4f2e-9cbb-7b63bf4270ab" />

This is the expected outcome on DBeaver:
<img width="1485" height="637" alt="image" src="https://github.com/user-attachments/assets/df1a4ddf-943c-4efb-8ec1-1bc18f42b059" />

- No record for  `project_members`, `projects `, `tasks`.
- Three records for `schema_migration`.
- Four records for  `users`


### 5) Run Backend and frontend
- Open project in your IDE (VSC, Cursor, TRAE, etc.)
  - i.e. My directory is C:\Users\XXX\YYY\client-project-tracker-main\client-project-tracker-main
- Open two terminals
- For backend, the commands are:
  - cd backend
  - npm ci
  - npm run start:dev

This is the expected outcome:

<img width="1088" height="396" alt="image" src="https://github.com/user-attachments/assets/840fffec-87e2-4b71-856a-e70346475456" />


- For frontend, the commands are:
  - cd frontend
  - npm ci
  - npm start

This is the expected outcome:

<img width="762" height="543" alt="image" src="https://github.com/user-attachments/assets/686ad99b-ca58-4ae0-a87b-62f792970143" />


### 6) Webapp is ready 
Please open a browser (Chrome/Edge), and navigate to 'localhost:4200'. \

This is a cameo of how the webapp looks like:
<img width="1919" height="1024" alt="image" src="https://github.com/user-attachments/assets/c7309741-1400-4638-8879-40c0959eda42" />

There are four accounts. Here are the credentials to login: 
  | Username | Password |
  | --- | --- |
  | admin | admin |
  | user1 | user1 |
  | user2 | user2 |
  | user3 | user3 |


### 7) Testing (Later in the section)
- Make sure the dependencies are installed for both backend and frontend.
- Open CMD, and point the directory to 'client-project-tracker-main'
  - i.e. C:\Users\XXX\YYY\client-project-tracker-main\client-project-tracker-main

To test for Postgre connection:
- Type: 'docker compose exec -T db pg_isready -U tracker -d client_project_tracker'
- Expect an "Accepting Connections" message shows in the terminal

To test for backend:
- Type: 'npm --prefix backend test'
- There are unit and integration testing. Integration testing filename includes the "integration" word.
- There are 50 tests in total.

Here is the outcome:
<img width="1621" height="538" alt="image" src="https://github.com/user-attachments/assets/ce4995fc-ea95-4a89-99be-d36edc84ec61" />

To test for frontend:
- Type: 'npm --prefix frontend test'
- Unit testing only that includes input validation, permission, etc.
- There are 13 tests in total.

Here is the outcome:
<img width="1613" height="700" alt="image" src="https://github.com/user-attachments/assets/19b0950b-874d-4963-a38f-bb7d78182559" />

\

## The main design decisions you made and the trade-offs behind them
### Assumptions I made
#### Core
- List projects, each with its task count &rarr; A table that shows a list of projects with a task count column for each row.
- List the tasks in a project &rarr; A task screen alongside its table to show a list of tasks of a project.
- Mark a task complete &rarr; A checkbox column that tick the tasks and project once completion in the table.

#### Authentication and access control
- Users log in &rarr; A login page with username, password, and login button. Authentication performs behind the scenes and response a signed JWT that expires after 15 minutes back to the client. Client sends HTTP request with the JWT in the header all the time after login.
- A user who isn't a member gets a proper 403. Make sure the data isn't reachable some other way &rarr; A user who isn't a member of a particular project isn't able to view the project and its tasks on the screen.

### Main design on database
I have included five tables: `project_members`, `projects`, `schema_migrations`, `tasks`, `users`. \
\
The tables: `projects`, `tasks`, and `users` are understandable as they are quite straight forward. \
\
For `project_members`, this table is meant for access control to the project. The trade-off is adding one extra table and a membership checking code, but admin can add many users to a project rather than users cannot be added into a project.\
\
For `schema_migrations`, this table is meant for script tracking and apply database changes safely. The trade-off is adding an extra tracking table, but with a clear record of the database changes rather than carefully checks for every change even if the SQL script is re-runnable.

#### Main design on this webapp
An admin account &rarr; This role has the full access on everything, and able to add/remove users to/from the project. \
\
The trade-off is adding an extra role and code complexity to add/remove user to/from a project, but it is more structured and meaningful rather than creating a non-user friendly workflow (users cannot be added/removed to/from a project) or chaotic workflow (Everyone can add/remove anyone to/from a project). \
\
As the trade-offs suggest even though it adds additional complexity to the webapp, but it creates a more user-friendly webapp:
1) Delete a project deletes its tasks and memberships.
2) Checkbox is uninteractable once the project/task is  `COMPLETED `. User can always edit its status back to its incomplete status, to interact with the checkbox again.
3) Owner and admin are allowed to delete a project. But added members by the admin are not allowed to delete a project. All members and admin are allowed to delete a task.

For login, I chose to keep the JWT in its memory (`AuthSessionServie`, rather than saving it in the browser. \
\
As the trade-offs, user has to re-login after every refresh or 15 minutes (TTL), but in exchange, it keeps authentication simple and basic, as this project doesn't need complex login like "Remember Me"

## How I handle concurrent edits, and why I chose this approach
I utilised versioning to handle concurrent edits.
With versioning, each record has a version number, which the frontend retrieves alongside the record. When a user submits an update, the backend checks if the submitted version still matches with the version in the database. \
\
If it matches, the update succeeds and the version is incremented. \
If it doesn't match, the backend rejects the update with a conflict response.

The reason I chose this approach:
- Generally, users spend more time reading and editing project or task information, rather than submitting simultaneous update to the same record most of the time.
- I have considered other approach i.e. pessimistic locking, but it would cause an indefinite waiting time to read/modify the record (Not user friendly) and it introduces additional complexity, defeating the first reason above.
- With this approach, it provides a balance between user experience, data integrity, and implementation complexity.


## What I deprioritised and what I'd do next 
### I deprioritise assignee management on tasks --> Assignee remains unassigned

Reason:
- I focused more on functional and secure MVP, i.e. authentication, access control, project and task CRUD operations.
- This assignee management is a secondary enhancement on team collaboration but is not essential to the core and basic workflow of this project.

### I deprioritise filtering and pagination

Reason:
- Filtering and pagination aren't the core workflows, instead it is an icing on the cake under a limited development time.
- Without filtering and pagination, our users are still able to track the project and tasks as normal (It doesn't defeat the purpose of this 'Client Project Tracker').
- It doesn't necessary expose a massive issue like data integrity and consistency (Assuming this tracker is meant for a very small group of people only).

#### What I would do next
- Having a more structured user group, user role and user. This includes permission features on CRUD from the higher authority within the same group

Reason:
- To enhance security and stricter user permissions on both project and task, and also other new modules moving forward.

## AI usage
I was using Codex for development and testing on this client project tracker. 
- It was based on my idea and design during the requirements gathering and designing phase, by listing down the priorities, breaking down the priorities into smaller pieces for a clearer view and direction.
- With all those clear fragmented priorities, AI is able to build a solid foundation code structure rather than a chaotic and vague code structure in one go.

One thing I rejected the AI was the access control structure
- AI suggested: Every user can manage membership, where any member could remove others or grant others access to the project(s).

Reason for rejection:
- There is no authority structure, where it will be chaotic when there are 50+ users or more.

What I changed:
- Add an admin to have access over all projects and tasks, and able to grant or remove access a project to/from the user(s). Also, only the owner of the project (The user who created the project) and admin have the access to the project.
