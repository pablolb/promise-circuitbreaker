
REPORTER=dot

test: jshint

test:
	@NODE_ENV=test ./node_modules/.bin/mocha -u bdd -R $(REPORTER) test/*.js

jshint:
	@./node_modules/.bin/jshint **/*.js *.json

docs:
	@./node_modules/.bin/jsdoc -d doc README.md -t ./node_modules/ink-docstrap/template -c ./jsdoc.conf.json ./lib/*.js

.PHONY: test
