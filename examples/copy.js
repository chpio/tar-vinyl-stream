const extract = require('../tar-vinyl-stream').extract;
const pack = require('../tar-vinyl-stream').pack;
const fs = require('fs');
const debug = require('gulp-debug');

fs.createReadStream(`${__dirname}/test.tar`)
	.pipe(extract())
	.pipe(debug())
	.pipe(pack())
	.pipe(fs.createWriteStream(`${__dirname}/test2.tar`));
