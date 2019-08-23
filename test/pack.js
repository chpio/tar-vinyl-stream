import path from 'path';
import getStream from 'get-stream';
import {pack} from '..';
import {Transform, pipeline} from 'readable-stream';
import tarFs from 'tar-fs';
import test from 'ava';
import vfs from 'vinyl-fs';

const fixtures = path.join(__dirname, 'fixtures');

test('files', async t => {
	const cwd = path.join(fixtures, 'files');
	const src = vfs.src('{a,b}.txt', {cwd});
	const dest = pack({cwd});

	pipeline(src, dest, err => err && t.fail(err));

	const contents = await getStream.buffer(dest);
	const correct = await getStream.buffer(tarFs.pack(cwd, {
		umask: 0,
		ignore(name) {
			return /[ab]1\.txt$/.test(name);
		}
	}));

	for (const {chunk, value} of compareTarballChunks(correct, contents)) {
		t.true(value, chunk.toString());
	}
});

test('large', async t => {
	const cwd = path.join(fixtures, 'large');
	const src = vfs.src('*', {cwd});
	const dest = pack({cwd});

	pipeline(src, dest, err => err && t.fail(err));

	const contents = await getStream.buffer(dest);
	const correct = await getStream.buffer(tarFs.pack(cwd, {umask: 0}));

	for (const {chunk, value} of compareTarballChunks(correct, contents)) {
		t.true(value, chunk.toString());
	}
});

test('mixed', async t => {
	const cwd = path.join(fixtures, 'mixed');
	const src = vfs.src('**', {cwd, resolveSymlinks: false});
	const dest = pack({cwd});

	pipeline(src, dest, err => err && t.fail(err));

	const contents = await getStream.buffer(dest);
	const correct = await getStream.buffer(tarFs.pack(cwd, {umask: 0}));

	for (const {chunk, value} of compareTarballChunks(correct, contents)) {
		t.true(value, chunk.toString());
	}
});

test('nested', async t => {
	const cwd = path.join(fixtures, 'nested');
	const src = vfs.src('**', {cwd});
	const dest = pack({cwd});

	pipeline(src, dest, err => err && t.fail(err));

	const contents = await getStream.buffer(dest);
	const correct = await getStream.buffer(tarFs.pack(cwd, {umask: 0}));

	for (const {chunk, value} of compareTarballChunks(correct, contents)) {
		t.true(value, chunk.toString());
	}
});

test('symlinks', async t => {
	const cwd = path.join(fixtures, 'symlinks');
	const src = vfs.src('**', {cwd, resolveSymlinks: false});
	const dest = pack({cwd});

	pipeline(src, dest, err => err && t.fail(err));

	const contents = await getStream.buffer(dest);
	const correct = await getStream.buffer(tarFs.pack(cwd, {umask: 0}));

	for (const {chunk, value} of compareTarballChunks(correct, contents)) {
		t.true(value, chunk.toString());
	}
});

test('files (stream)', async t => {
	const cwd = path.join(fixtures, 'files');
	const src = vfs.src('{a,b}.txt', {cwd, buffer: false});
	const clone = new Transform({
		objectMode: true,
		transform(file, enc, next) {
			const copy = file.clone();

			copy.basename = file.stem + '1.txt';

			t.true(file.isStream(), 'expected file to be a stream');
			t.true(/[ab]1\.txt$/.test(copy.path), 'copy filename is wrong');

			// Important: the virtual file, "copy", must have the same mtime as the real file
			// to achive this, ensure that "a.txt" & "a1.txt" have exactly the same mtime on disk
			this.push(file.clone());
			this.push(copy);
			next(null);
		}
	});
	const dest = pack({cwd});

	pipeline(src, clone, dest, err => err && t.fail(err));

	const contents = await getStream.buffer(dest);
	const correct = await getStream.buffer(tarFs.pack(cwd, {umask: 0}));

	for (const {chunk, value} of compareTarballChunks(correct, contents)) {
		t.true(value, chunk.toString());
	}
});

function * compareTarballChunks(correct, testing) {
	// The correct archive may be longer because it has directories that are not part of the assertion
	yield {chunk: correct, value: testing.length <= correct.length};

	for (let i = 0; i < testing.length; i += 512) {
		const chunk = testing.slice(i, i + 512);

		// Position of this result does not matter, just that the chunk exists in the correct archive
		yield {chunk, value: correct.includes(chunk)};
	}
}
