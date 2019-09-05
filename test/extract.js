import fs from 'fs';
import path from 'path';
import util from 'util';
import getStream from 'get-stream';
import {Transform, pipeline} from 'readable-stream';
import vfs from 'vinyl-fs';
import test from 'ava';
import {extract} from '..';

const fixtures = path.join(__dirname, 'fixtures');
const readFile = util.promisify(fs.readFile);
const readlink = util.promisify(fs.readlink);
const lstat = util.promisify(fs.lstat);

test('files-bare', async t => {
	const src = fs.createReadStream(path.join(fixtures, 'tarballs', 'files-bare.tar'));
	const dest = extract();

	pipeline(src, dest, err => err && t.fail(err));

	const files = await getStream.array(dest);
	const contents = await Promise.all(files.map(file => readFile(path.join(fixtures, 'files', file.basename))));

	for (let i = 0; i < files.length; i++) {
		const file = files[i];
		const buffer = contents[i];

		t.deepEqual(file.contents, buffer);
	}
});

test('files', async t => {
	const src = fs.createReadStream(path.join(fixtures, 'tarballs', 'files.tar'));
	const dest = extract();

	pipeline(src, dest, err => err && t.fail(err));

	const files = await getStream.array(dest);
	const contents = await Promise.all(files.map(file => {
		if (file.isDirectory()) {
			return null;
		}

		return readFile(path.join(fixtures, file.relative));
	}));

	for (let i = 0; i < files.length; i++) {
		const file = files[i];
		const buffer = contents[i];

		if (buffer === null) {
			t.true(file.isDirectory());
			continue;
		}

		t.deepEqual(file.contents, buffer);
	}
});

test('large', async t => {
	const src = fs.createReadStream(path.join(fixtures, 'tarballs', 'large.tar'));
	const dest = extract();

	pipeline(src, dest, err => err && t.fail(err));

	const files = await getStream.array(dest);
	const contents = await Promise.all(files.map(file => {
		if (file.isDirectory()) {
			return null;
		}

		return readFile(path.join(fixtures, file.relative));
	}));

	for (let i = 0; i < files.length; i++) {
		const file = files[i];
		const buffer = contents[i];

		if (buffer === null) {
			t.true(file.isDirectory());
			continue;
		}

		t.deepEqual(file.contents, buffer);
	}
});

test('mixed', async t => {
	const src = fs.createReadStream(path.join(fixtures, 'tarballs', 'mixed.tar'));
	const dest = extract();

	pipeline(src, dest, err => err && t.fail(err));

	const files = await getStream.array(dest);
	const stats = await Promise.all(files.map(file => lstat(path.join(fixtures, file.relative))));

	for (let i = 0; i < files.length; i++) {
		const file = files[i];
		const stat = stats[i];

		t.is(file.isDirectory(), stat.isDirectory());
		t.is(file.isSymbolic(), stat.isSymbolicLink());
		t.is(file.isBuffer() || file.isStream(), stat.isFile());
	}
});

test('nested', async t => {
	const src = fs.createReadStream(path.join(fixtures, 'tarballs', 'nested.tar'));
	const dest = extract();

	pipeline(src, dest, err => err && t.fail(err));

	const files = await getStream.array(dest);
	const contents = await Promise.all(files.map(file => {
		if (file.isDirectory()) {
			return null;
		}

		return readFile(path.join(fixtures, file.relative));
	}));

	for (let i = 0; i < files.length; i++) {
		const file = files[i];
		const buffer = contents[i];

		if (buffer === null) {
			t.true(file.isDirectory());
			continue;
		}

		t.deepEqual(file.contents, buffer);
	}
});

test('symlinks', async t => {
	const src = fs.createReadStream(path.join(fixtures, 'tarballs', 'symlinks.tar'));
	const dest = extract();

	pipeline(src, dest, err => err && t.fail(err));

	const files = await getStream.array(dest);
	const symlinks = await Promise.all(files.map(file => {
		if (file.isSymbolic()) {
			return readlink(path.join(fixtures, file.relative));
		}

		return null;
	}));

	for (let i = 0; i < files.length; i++) {
		const file = files[i];
		const symlink = symlinks[i];

		t.is(file.isSymbolic() ? file.symlink : null, symlink);
	}
});

test('stream', async t => {
	const src = fs.createReadStream(path.join(fixtures, 'tarballs', 'stream.tar'));
	const stream = extract({buffer: false});
	const modify = new Transform({
		objectMode: true,
		transform(file, enc, next) {
			if (/[ab]\.txt$/.test(file.path)) {
				next(null, file);
			} else {
				next(null);
			}
		}
	});
	const dest = vfs.dest('/tmp/debug');

	pipeline(src, stream, modify, dest, err => err && t.fail(err));

	const files = await getStream.array(dest);

	t.is(files.length, 2, 'wrong number of files extracted');

	for (const file of files) {
		t.false(file.isBuffer(), 'file is a buffer');
	}
});

test('multi-chunk', async t => {
	const src = fs.createReadStream(path.join(fixtures, 'tarballs', 'multi-chunk.tar'));
	const stream = extract({buffer: false});
	const modify = new Transform({
		objectMode: true,
		transform(file, enc, next) {
			const n = parseInt(file.stem, 10);

			// Invalidate the size, vfs.dest is expected to set this value
			file.stat.size = 0;

			if (n % 2 === 0) {
				next(null, file);
			} else {
				next(null);
			}
		}
	});
	const dest = vfs.dest('/tmp/debug');

	pipeline(src, stream, modify, dest, err => err && t.fail(err));

	const files = await getStream.array(dest);

	t.is(files.length, 2, 'wrong number of files extracted');

	for (const file of files) {
		t.true(file.isStream(), 'file is a buffer');
		// eslint-disable-next-line eqeqeq
		t.true(file.stat.size == file.stem, 'file size is set');
	}
});
