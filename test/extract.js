import fs from 'fs';
import path from 'path';
import util from 'util';
import {extract} from '..';
import getStream from 'get-stream';
import {pipeline} from 'readable-stream';
import test from 'ava';

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
