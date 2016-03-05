var JMake = require('../jmake');
var crypto = require('crypto');

var compiler = 'g++';
var build_path = 'build/';
var target = 'helloworld';

var flags = new JMake.Stream('-std=c++11', '-stdlib=libc++');
var sources = new JMake.Stream(JMake.glob('src/**/*.cpp'));
var libs = new JMake.Stream();

var objs = sources.map(function(source, objs)
{
	var unique = compiler + '\0' + source;
	var build_to = build_path + crypto.createHash('md5').update(unique).digest('hex');

	objs.open();

	var args = [flags, '-M', '-MG', '-MM', '-MT', '_', source];
	var deps = JMake.spawn(compiler, args).map(function(output, deps)
	{
		if (output.substr(0, 2) === '_:') {output = output.substr(2);}
		var parts = output.replace(/[\\]/g, ' ').trim().split(/\s+/g);
		deps.push(parts);
	});

	JMake.needs_rebuild(build_to, deps, function()
	{
		var args = [flags, '-c', source, '-o', build_to];
		JMake.spawn(compiler, args).map(function()
		{
			objs.push(build_to);
		}).on_close(objs.close);
	}, function()
	{
		objs.push(build_to);
		objs.close();
	});
});

var args = [flags, '-dM', '-E', sources];
JMake.spawn(compiler, args).map(function(output)
{
	var params = JMake.extract_params(output, /^\s*\#define JMAKE_(\w+)_(\w+)\s*$/gmi, {'link': []});
	new JMake.Stream(params.link).unique().map(function(lib)
	{
		libs.push('-l' + lib);
	});
}).block(libs);

JMake.needs_rebuild(target, objs, function()
{
	var args = [flags, objs, '-o', target, libs];
	JMake.spawn(compiler, args);
});
