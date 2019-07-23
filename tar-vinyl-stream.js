const path = require('path');
const BufferList = require('bl');
const Duplexify = require('duplexify');
const Mode = require('stat-mode');
const sink = require('lead');
const Stats = require('stats-ctor');
const TarExtract = require('tar-stream/extract');
const TarPack = require('tar-stream/pack');
const {PassThrough, Readable, Writable} = require('readable-stream');
const Vinyl = require('vinyl');

class Extract extends Readable {
	constructor(tarExtract, options) {
		super({objectMode: true});

		const cwd = (options && options.cwd) || process.cwd();
		const base = (options && options.base) || cwd;
		const buffer = !options || options.buffer !== false;

		tarExtract.on('entry', (header, stream, callback) => {
			const file = new Vinyl({
				cwd,
				base,
				path: path.join(base, header.name),
				stat: new Stats(header)
			});
			const mode = new Mode(file.stat);
			const ignore = onend => stream.once('end', onend).resume();
			const next = (err, contents) => {
				// Errors are delivered back to the writable `tarExtract` stream,
				// where it is emitted, caught by deplexify, and destroys both streams
				if (err) {
					return callback(err);
				}

				if (contents) {
					file.contents = contents;
				}

				this.push(file);
				callback(null);
			};

			switch (header.type) {
				case 'file':
					mode.isFile(true);

					if (buffer) {
						stream.pipe(new BufferList(next));
					} else {
						// This may be the stream's final destination, for example gulp-filter dropping it
						const contents = sink(new PassThrough());

						stream
							.once('error', next)
							.once('end', () => next(null, contents))
							.pipe(contents);
					}

					break;
				case 'directory':
					mode.isDirectory(true);
					ignore(next);
					break;
				case 'symlink':
					mode.isSymbolicLink(true);
					file.symlink = header.linkname;
					ignore(next);
					break;
				default:
					ignore(() => next(createTypeError('extract', header)));
					break;
			}
		});

		tarExtract.once('finish', () => this.push(null));
	}

	_read() {}
}

function extract(options) {
	const tarExtract = new TarExtract();

	return new Duplexify(tarExtract, new Extract(tarExtract, options), {
		readableObjectMode: true
	});
}

class Pack extends Writable {
	constructor(tarPack, options) {
		super({objectMode: true});

		options = options || {};

		this._tarPack = tarPack;
		this._umask = options.umask || process.umask();
		this._fileMode = options.fmode || 0o666;
		this._dirMode = options.dmode || 0o777;
		this._uid = options.uid || process.getuid();
		this._gid = options.gid || process.getgid();
		this._mtime = options.mtime || new Date();
	}

	_write(file, _, next) {
		const stat = file.stat || {};
		const header = {
			name: file.relative,
			type: 'file',
			mode: stat.mode,
			uid: stat.uid || this._uid,
			gid: stat.gid || this._gid,
			mtime: stat.mtime || this._mtime
		};
		const onfile = (err, buffer) => {
			if (err) {
				return next(err);
			}

			if (!header.mode) {
				header.mode = this._fileMode & (~this._umask);
			}

			header.size = buffer ? buffer.length : 0;

			this._tarPack.entry(header, buffer, next);
		};

		if (file.isBuffer()) {
			onfile(null, file.contents);
		} else if (file.isStream()) {
			// Buffer the stream because the byte count must be exact, but we
			// cannot know what transformations were applied to file.contents
			file.contents.pipe(new BufferList(onfile));
		} else if (file.isSymbolic()) {
			header.type = 'symlink';
			header.linkname = file.symlink;
			onfile(null, null);
		} else if (file.isDirectory()) {
			header.size = 0;
			header.type = 'directory';

			if (!header.mode) {
				header.mode = this._dirMode & (~this._umask);
			}

			this._tarPack.entry(header, next);
		} else {
			next(createTypeError('pack', header));
		}
	}

	_final(done) {
		this._tarPack.finalize();
		done();
	}
}

function pack(options) {
	const tarPack = new TarPack();

	return new Duplexify(new Pack(tarPack, options), tarPack, {
		writableObjectMode: true
	});
}

function createTypeError(methodName, header) {
	const err = new TypeError(`tar-vinyl-stream.${methodName}: unknown file type for "${header.name}"`);

	err.code = 'ETARTYPE';

	return err;
}

exports.Extract = Extract;
exports.extract = extract;
exports.Pack = Pack;
exports.pack = pack;
