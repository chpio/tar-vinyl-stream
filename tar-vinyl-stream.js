const Duplexify = require('duplexify');
const TarExtract = require('tar-stream/extract');
const TarPack = require('tar-stream/pack');
const {Readable, Writable} = require('readable-stream');
const Vinyl = require('vinyl');

class Extract extends Readable {
	constructor(tarExt) {
		super({objectMode: true});

		// streaming is not supported by tar-stream
		// https://github.com/mafintosh/tar-stream/issues/50
		tarExt.on('entry', (header, contents, next) => {
			const bufs = [];
			contents
				.on('data', b => bufs.push(b))
				.once('end', () => {
					const v = new Vinyl({
						path: header.name,
						contents: Buffer.concat(bufs),
					});

					v.tarHeader = header;

					if (this.push(v)) next();
					else this.once('drain', next);
				});
		});

		tarExt.once('finish', () => this.push(null));
	}

	_read() {
		// noop
	}
}

function extract() {
	const tarExt = new TarExtract();

	return new Duplexify(tarExt, new Extract(tarExt), {
		readableObjectMode: true
	});
}

class Pack extends Writable {
	constructor(tarPak) {
		super({objectMode: true});

		this._tarPak = tarPak;

		this.once('finish', () => this._tarPak.finalize());
	}

	_write(v, _, cb) {
		const header = Object.assign({}, v.tarHeader || {}, {name: v.relative});

		if (v.isBuffer()) this._tarPak.entry(header, v.contents, cb);
		else if (v.isStream()) v.contents.pipe(this._tarPak.entry(header)).once('end', cb);
		else cb(new TypeError(`${v} is not a buffer or stream`));
	}
}

function pack() {
	const tarPak = new TarPack();

	return new Duplexify(new Pack(tarPak), tarPak, {
		writableObjectMode: true
	});
}

exports.Extract = Extract;
exports.extract = extract;
exports.Pack = Pack;
exports.pack = pack;
