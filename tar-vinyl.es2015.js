import duplexer from 'duplexer2';
import {extract as TarExtract} from 'tar-stream';
import {Readable} from 'readable-stream';
import Vinyl from 'vinyl';


export class Extract extends Readable {
	constructor(tarExt) {
		super({objectMode: true});

		tarExt.on('entry', (header, contents, next) => {
			const v = new Vinyl({
				path: header.name,
				contents,
			});

			v.tarHeader = header;

			if (this.push(v)) next();
			else this.once('drain', next);
		});

		tarExt.once('finish', () => this.push(null));
	}

	_read() {
		// noop
	}
}

export function extract() {
	const tarExt = new TarExtract();
	return duplexer({readableObjectMode: true}, tarExt, new Extract(tarExt));
}
