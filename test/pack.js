import fs from 'fs';
import path from 'path';
import getStream from 'get-stream';
import {pack} from '..';
import {pipeline} from 'readable-stream';
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
	const correct = await getStream.buffer(tarFs.pack(cwd));

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
	const correct = await getStream.buffer(tarFs.pack(cwd));

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

	fs.writeFile('/tmp/vinyl.tar', contents, err => err && t.fail(err));
	fs.writeFile('/tmp/fs.tar', correct, err => err && t.fail(err));

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

function * compareTarballChunks(correct, testing) {
	// The correct archive may be longer because it has directories that are not part of the assertion
	yield {chunk: correct, value: testing.length <= correct.length};

	for (let i = 0; i < testing.length; i += 512) {
		const chunk = testing.slice(i, i + 512);

		// Position of this result does not matter, just that the chunk exists in the correct archive
		yield {chunk, value: correct.includes(chunk)};
	}
}
