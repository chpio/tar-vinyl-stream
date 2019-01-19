const Duplexify = require('duplexify');
const TarExtract = require('tar-stream/extract');
const TarPack = require('tar-stream/pack');
const {Readable, Writable} = require('readable-stream');
const Vinyl = require('vinyl');

class Extract extends Readable {
	constructor(tarExtract) {
		super({objectMode: true});

		// streaming is not supported by tar-stream
		// https://github.com/mafintosh/tar-stream/issues/50
		tarExtract.on('entry', (header, contents, next) => {
			const bufs = [];

			contents
				.on('data', b => bufs.push(b))
				.once('end', () => {
					const file = new Vinyl({
						path: header.name,
						contents: Buffer.concat(bufs),
					});

					file.tarHeader = header;

					if (this.push(file)) {
						next();
					} else {
						this.once('drain', next);
					}
				});
		});

		tarExtract.once('finish', () => this.push(null));
	}

	_read() {
		// noop
	}
}

function extract() {
	const tarExtract = new TarExtract();

	return new Duplexify(tarExtract, new Extract(tarExtract), {
		readableObjectMode: true
	});
}

class Pack extends Writable {
	constructor(tarPack) {
		super({objectMode: true});

		this._tarPak = tarPack;

		this.once('finish', () => this._tarPak.finalize());
	}

	_write(file, _, next) {
		const header = Object.assign({}, file.tarHeader || {}, {name: file.relative});

		if (file.isBuffer()) {
			this._tarPak.entry(header, file.contents, next);
		} else if (file.isStream()) {
			file.contents.pipe(this._tarPak.entry(header)).once('end', next);
		} else {
			next(new TypeError(`${file} is not a buffer or stream`));
		}
	}
}

function pack() {
	const tarPack = new TarPack();

	return new Duplexify(new Pack(tarPack), tarPack, {
		writableObjectMode: true
	});
}

exports.Extract = Extract;
exports.extract = extract;
exports.Pack = Pack;
exports.pack = pack;
