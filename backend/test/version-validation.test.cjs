const { test } = require('node:test');
const assert = require('node:assert/strict');
const { ProjectBodyPipe } = require('../dist/projects/project.dto');
const { TaskBodyPipe } = require('../dist/tasks/task.dto');

for (const [label, Pipe, fields] of [
  ['project', ProjectBodyPipe, { name: 'Changed' }],
  ['task', TaskBodyPipe, { title: 'Changed' }],
]) {
  test(`${label} edits require a numeric positive version and at least one editable field`, () => {
    const pipe = new Pipe(true);
    for (const version of [undefined, null, 0, -1, 1.5, '1', true, 2147483648]) {
      assert.throws(() => pipe.transform({ ...fields, version }), error =>
        error.getStatus() === 400 && !!error.getResponse().errors.version);
    }
    assert.throws(() => pipe.transform({ version: 1 }), error => error.getStatus() === 400);
    assert.deepEqual(pipe.transform({ ...fields, version: 1 }), { ...fields, version: 1 });
  });
}
