Liferay = window.Liferay || {};

(function($, _, Liferay) {
	var isNode = function(node) {
		return node && (node._node || node.jquery || node.nodeType);
	};

	var REGEX_METHOD_GET = /^get$/i;

	var STR_MULTIPART = 'multipart/form-data';

	Liferay.namespace = _.namespace;

	$.ajaxSetup(
		{
			data: {},
			type: 'POST'
		}
	);

	$.ajaxPrefilter(
		function(options) {
			if (options.crossDomain) {
				options.contents.script = false;
			}

			if (options.url) {
				options.url = Liferay.Util.getURLWithSessionId(options.url);
			}
		}
	);

	var jqueryInit = $.prototype.init;

	$.prototype.init = function(selector, context, root) {
		if (selector === '#') {
			selector = '';
		}

		return new jqueryInit(selector, context, root);
	};

	$(document).on(
		'show.bs.collapse',
		function(event) {
			var target = $(event.target);

			var ancestor = target.parents('.panel-group');

			if (target.hasClass('panel-collapse') && ancestor.length) {
				var openChildren = ancestor.find('.panel-collapse.in').not(target);

				if (openChildren.length && ancestor.find('[data-parent="#' + ancestor.attr('id') + '"]').length) {
					openChildren.removeClass('in');
				}
			}

			if (target.hasClass('in')) {
				target.addClass('show');
				target.removeClass('in');

				target.collapse('hide');

				return false;
			}
		}
	);

	/**
	 * OPTIONS
	 *
	 * Required
	 * service {string|object}: Either the service name, or an object with the keys as the service to call, and the value as the service configuration object.
	 *
	 * Optional
	 * data {object|node|string}: The data to send to the service. If the object passed is the ID of a form or a form element, the form fields will be serialized and used as the data.
	 * successCallback {function}: A function to execute when the server returns a response. It receives a JSON object as it's first parameter.
	 * exceptionCallback {function}: A function to execute when the response from the server contains a service exception. It receives a the exception message as it's first parameter.
	 */

	var Service = function() {
		var instance = this;

		var args = Service.parseInvokeArgs(arguments);

		return Service.invoke.apply(Service, args);
	};

	_.assign(
		Service,
		{
			URL_INVOKE: themeDisplay.getPathContext() + '/api/jsonws/invoke',

			bind: function() {
				var instance = this;

				var args = _.toArray(arguments);

				args.unshift(Liferay.Service, Liferay);

				return _.bind.apply(_, args);
			},

			parseInvokeArgs: function(args) {
				var instance = this;

				var payload = args[0];

				var ioConfig = instance.parseIOConfig(args);

				if (_.isString(payload)) {
					payload = instance.parseStringPayload(args);

					instance.parseIOFormConfig(ioConfig, args);

					var lastArg = args[args.length - 1];

					if (_.isObject(lastArg) && lastArg.method) {
						ioConfig.method = lastArg.method;
					}
				}

				return [payload, ioConfig];
			},

			parseIOConfig: function(args) {
				var instance = this;

				var payload = args[0];

				var ioConfig = payload.io || {};

				delete payload.io;

				if (!ioConfig.success) {
					var callbacks = _.filter(args, _.isFunction);

					var callbackException = callbacks[1];
					var callbackSuccess = callbacks[0];

					if (!callbackException) {
						callbackException = callbackSuccess;
					}

					ioConfig.complete = function(xhr) {
						var response = xhr.responseJSON;

						if ((response !== null) && !_.has(response, 'exception')) {
							if (callbackSuccess) {
								callbackSuccess.call(this, response);
							}
						}
						else if (callbackException) {
							var exception = response ? response.exception : 'The server returned an empty response';

							callbackException.call(this, exception, response);
						}
					};
				}

				if (!_.has(ioConfig, 'cache') && REGEX_METHOD_GET.test(ioConfig.type)) {
					ioConfig.cache = false;
				}

				if (Liferay.PropsValues.NTLM_AUTH_ENABLED && Liferay.Browser.isIe()) {
					ioConfig.type = 'GET';
				}

				return ioConfig;
			},

			parseIOFormConfig: function(ioConfig, args) {
				var instance = this;

				var form = args[1];

				if (isNode(form)) {
					ioConfig.form = form;

					if (ioConfig.form.enctype == STR_MULTIPART) {
						ioConfig.contentType = false;
						ioConfig.processData = false;
					}
				}
			},

			parseStringPayload: function(args) {
				var instance = this;

				var params = {};
				var payload = {};

				var config = args[1];

				if (!_.isFunction(config) && !isNode(config)) {
					params = config;
				}

				payload[args[0]] = params;

				return payload;
			}
		},
		true
	);

	Service.invoke = function(payload, ioConfig) {
		var instance = this;

		var cmd = JSON.stringify(payload);
		var p_auth = Liferay.authToken;

		_.defaults(
			ioConfig,
			{
				data: {
					cmd: cmd,
					p_auth: p_auth
				},
				dataType: 'JSON'
			}
		);

		if (ioConfig.form) {
			if (ioConfig.form.enctype == STR_MULTIPART && _.isFunction(window.FormData)) {
				ioConfig.data = new FormData(ioConfig.form);

				ioConfig.data.append('cmd', cmd);
				ioConfig.data.append('p_auth', p_auth);
			}
			else {
				_.forEach(
					$(ioConfig.form).serializeArray(),
					function(item, index) {
						ioConfig.data[item.name] = item.value;
					}
				);
			}

			delete ioConfig.form;
		}

		return $.ajax(
			instance.URL_INVOKE,
			ioConfig
		);
	};

	_.forEach(
		['get', 'delete', 'post', 'put', 'update'],
		function(item, index) {
			var methodName = item;

			if (item === 'delete') {
				methodName = 'del';
			}

			Service[methodName] = _.bindKeyRight(
				Liferay,
				'Service',
				{
					method: item
				}
			);
		}
	);

	Liferay.Service = Service;

	var componentPromiseWrappers = {};
	var components = {};
	var componentsFn = {};

	var _createPromiseWrapper = function(value) {
		var promiseWrapper;

		if (value) {
			promiseWrapper = {
				promise: Promise.resolve(value),
				resolve: function() {}
			};
		}
		else {
			var promiseResolve;
			var promise = new Promise(
				function(resolve) {
					promiseResolve = resolve;
				}
			);

			promiseWrapper = {
				promise: promise,
				resolve: promiseResolve
			};
		}

		return promiseWrapper;
	};

	Liferay.component = function(id, value) {
		var retVal;

		if (arguments.length === 1) {
			var component = components[id];

			if (component && _.isFunction(component)) {
				componentsFn[id] = component;

				component = component();

				components[id] = component;
			}

			retVal = component;
		}
		else {
			if (components[id] && value !== null) {
				delete componentPromiseWrappers[id];

				console.warn('Component with id "' + id + '" is being registered twice. This can lead to unexpected behaviour in the "Liferay.component" and "Liferay.componentReady" APIs, as well as in the "*:registered" events.');
			}

			retVal = (components[id] = value);

			if (value === null) {
				delete componentPromiseWrappers[id];
			}
			else {
				Liferay.fire(id + ':registered');

				var componentPromiseWrapper = componentPromiseWrappers[id];

				if (componentPromiseWrapper) {
					componentPromiseWrapper.resolve(value);
				}
				else {
					componentPromiseWrappers[id] = _createPromiseWrapper(value);
				}
			}
		}

		return retVal;
	};

	Liferay.componentReady = function() {
		var component;
		var componentPromise;

		if (arguments.length === 1) {
			component = arguments[0];
		}
		else {
			component = [];

			for (var i = 0; i < arguments.length; i++) {
				component[i] = arguments[i];
			}
		}

		if (Array.isArray(component)) {
			componentPromise = Promise.all(
				component.map(
					function(id) {
						return Liferay.componentReady(id);
					}
				)
			);
		}
		else {
			var componentPromiseWrapper = componentPromiseWrappers[component];

			if (!componentPromiseWrapper) {
				componentPromiseWrappers[component] = componentPromiseWrapper = _createPromiseWrapper();
			}

			componentPromise = componentPromiseWrapper.promise;
		}

		return componentPromise;
	};

	Liferay._components = components;
	Liferay._componentsFn = components;

	Liferay.Template = {
		PORTLET: '<div class="portlet"><div class="portlet-topper"><div class="portlet-title"></div></div><div class="portlet-content"></div><div class="forbidden-action"></div></div>'
	};
})(AUI.$, AUI._, Liferay);

(function(A, Liferay) {
	A.mix(
		A.namespace('config.io'),
		{
			method: 'POST',
			uriFormatter: function(value) {
				return Liferay.Util.getURLWithSessionId(value);
			}
		},
		true
	);
})(AUI(), Liferay);