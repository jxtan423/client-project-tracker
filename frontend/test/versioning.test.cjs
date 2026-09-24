const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');
const rxjs = require('rxjs');

// Exercise the real service/page methods without a browser or Angular rendering.
// Angular lifecycle and HTTP transport are replaced by small test doubles.
class HttpErrorResponse {
  constructor(values) { Object.assign(this, values); }
}
function state(value) {
  const read = () => value;
  read.set = next => { value = next; };
  return read;
}
const angular = {
  Component: () => target => target,
  Injectable: () => target => target,
  InjectionToken: class {},
  ChangeDetectionStrategy: { OnPush: 0 },
};
let errors;
function load(relative) {
  const file = path.join(__dirname, '../src/app', relative);
  const compiled = ts.transpileModule(fs.readFileSync(file, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, experimentalDecorators: true },
  }).outputText;
  const module = { exports: {} };
  const dependencies = name => {
    if (name === '@angular/core') return angular;
    if (name === '@angular/common/http') return { HttpErrorResponse };
    if (name === '@angular/core/rxjs-interop') return { takeUntilDestroyed: () => stream => stream };
    if (name === 'rxjs') return rxjs;
    if (name.endsWith('/api-error')) return errors;
    return {};
  };
  new Function('require', 'module', 'exports', compiled)(dependencies, module, module.exports);
  return module.exports;
}
errors = load('core/api-error.ts');
const { ProjectApiService } = load('core/project-api.service.ts');
const { TaskApiService } = load('core/task-api.service.ts');
const { ProjectsPageComponent } = load('projects/pages/projects-page.component.ts');
const { TasksPageComponent } = load('tasks/pages/tasks-page.component.ts');
const conflict = () => new HttpErrorResponse({ status: 409, error: { code: 'VERSION_CONFLICT', message: 'This record changed. Refresh and try again.' } });

test('project and task HTTP requests send the captured version for updates and deletes', () => {
  const calls = [];
  const http = Object.fromEntries(['patch', 'delete'].map(method => [method, (...args) => {
    calls.push([method, ...args]);
    return rxjs.of(null);
  }]));
  const projects = Object.assign(Object.create(ProjectApiService.prototype), { http, url: '/projects' });
  const tasks = Object.assign(Object.create(TaskApiService.prototype), { http, base: '' });
  projects.update(2, 7, { name: 'New name' });
  projects.delete(2, 7);
  tasks.update(2, 4, 9, { status: 'completed' });
  tasks.delete(2, 4, 9);
  assert.deepEqual(calls, [
    ['patch', '/projects/2', { name: 'New name', version: 7 }],
    ['delete', '/projects/2', { params: { version: 7 } }],
    ['patch', '/projects/2/tasks/4', { status: 'completed', version: 9 }],
    ['delete', '/projects/2/tasks/4', { params: { version: 9 } }],
  ]);
});

function projectPage() {
  const record = { id: 2, version: 7, name: 'Original', canDelete: true };
  const requests = [];
  let refreshes = 0;
  const page = Object.assign(Object.create(ProjectsPageComponent.prototype), {
    editingProject: state(record), formOpen: state(true), saving: state(false),
    saveError: state(''), fieldErrors: state({}), completingProject: state(record),
    completing: state(false), completeError: state(''), deletingProject: state(record),
    deleting: state(false), deleteError: state(''),
    toast: { error() {}, success() {} }, refresh: () => { refreshes++; },
    api: Object.fromEntries(['update', 'delete'].map(method => [method, (...args) => {
      requests.push([method, ...args]);
      return rxjs.throwError(conflict);
    }])),
  });
  return { page, record, requests, refreshes: () => refreshes };
}

test('project edit conflict preserves editing snapshot and open form, refreshes once without retrying', () => {
  const { page, record, requests, refreshes } = projectPage();
  const input = { name: 'Unsaved changes' };
  page.saveProject(input);
  assert.equal(page.editingProject(), record);
  assert.equal(page.editingProject().version, 7);
  assert.equal(page.formOpen(), true);
  assert.equal(page.saving(), false);
  assert.equal(page.saveError(), errors.EDIT_CONFLICT_MESSAGE);
  assert.deepEqual(requests, [['update', 2, 7, input]]);
  assert.equal(refreshes(), 1);
});

test('project completion and deletion conflicts close confirmations and refresh', () => {
  for (const [method, dialog, request] of [
    ['completeProject', 'completingProject', ['update', 2, 7, { status: 'completed' }]],
    ['deleteProject', 'deletingProject', ['delete', 2, 7]],
  ]) {
    const { page, requests, refreshes } = projectPage();
    page[method]();
    assert.equal(page[dialog](), null);
    assert.deepEqual(requests, [request]);
    assert.equal(refreshes(), 1);
  }
});

function taskPage(mode) {
  const record = { id: 4, version: 9, title: 'Original' };
  const requests = [];
  let refreshes = 0;
  const page = Object.assign(Object.create(TasksPageComponent.prototype), {
    project: state({ id: 2 }), editing: state(record), formOpen: state(mode === 'edit'),
    completing: state(mode === 'complete' ? record : null),
    deleting: state(mode === 'delete' ? record : null), busy: state(false), dialogError: state(''),
    toast: { error() {}, success() {} }, reload: { next: () => { refreshes++; } },
    api: Object.fromEntries(['update', 'delete'].map(method => [method, (...args) => {
      requests.push([method, ...args]);
      return rxjs.throwError(conflict);
    }])),
  });
  return { page, record, requests, refreshes: () => refreshes };
}

test('task edit conflict preserves editing snapshot and open form, refreshes once without retrying', () => {
  const { page, record, requests, refreshes } = taskPage('edit');
  const input = { title: 'Unsaved changes' };
  page.save(input);
  assert.equal(page.editing(), record);
  assert.equal(page.editing().version, 9);
  assert.equal(page.formOpen(), true);
  assert.equal(page.busy(), false);
  assert.equal(page.dialogError(), errors.EDIT_CONFLICT_MESSAGE);
  assert.deepEqual(requests, [['update', 2, 4, 9, input]]);
  assert.equal(refreshes(), 1);
});

test('task completion and deletion conflicts close confirmations and refresh', () => {
  for (const mode of ['complete', 'delete']) {
    const { page, record, requests, refreshes } = taskPage(mode);
    if (mode === 'complete') page.completeTask();
    else page.remove(record);
    assert.equal(page.completing(), null);
    assert.equal(page.deleting(), null);
    assert.equal(page.busy(), false);
    assert.deepEqual(requests, [mode === 'complete'
      ? ['update', 2, 4, 9, { status: 'completed' }]
      : ['delete', 2, 4, 9]]);
    assert.equal(refreshes(), 1);
  }
});

test('only version conflicts trigger concurrency recovery, not other 409 business rules', () => {
  assert.equal(errors.isVersionConflict(conflict()), true);
  assert.equal(errors.isVersionConflict(new HttpErrorResponse({ status: 409, error: { message: 'Tasks remain incomplete.' } })), false);
  assert.equal(errors.isVersionConflict(new HttpErrorResponse({ status: 403, error: { code: 'VERSION_CONFLICT' } })), false);
  assert.equal(errors.isVersionConflict(null), false);
});
