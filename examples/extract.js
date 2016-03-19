const extract = require('../tar-vinyl').extract;
const fs = require('fs');
const gulp = require('gulp');
const filter = require('through2-filter');

fs.createReadStream(`${__dirname}/test.tar`)
	.pipe(extract())
	// allow just files & directories
	.pipe(filter.obj(f => ['file', 'directory'].indexOf(f.tarHeader.type) !== -1))
	.pipe(gulp.dest('./dest'));
