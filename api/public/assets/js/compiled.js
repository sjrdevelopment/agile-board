(function () {/**
 * @license almond 0.3.1 Copyright (c) 2011-2014, The Dojo Foundation All Rights Reserved.
 * Available via the MIT or new BSD license.
 * see: http://github.com/jrburke/almond for details
 */
//Going sloppy to avoid 'use strict' string cost, but strict practices should
//be followed.
/*jslint sloppy: true */
/*global setTimeout: false */

var requirejs, require, define;
(function (undef) {
    var main, req, makeMap, handlers,
        defined = {},
        waiting = {},
        config = {},
        defining = {},
        hasOwn = Object.prototype.hasOwnProperty,
        aps = [].slice,
        jsSuffixRegExp = /\.js$/;

    function hasProp(obj, prop) {
        return hasOwn.call(obj, prop);
    }

    /**
     * Given a relative module name, like ./something, normalize it to
     * a real name that can be mapped to a path.
     * @param {String} name the relative name
     * @param {String} baseName a real name that the name arg is relative
     * to.
     * @returns {String} normalized name
     */
    function normalize(name, baseName) {
        var nameParts, nameSegment, mapValue, foundMap, lastIndex,
            foundI, foundStarMap, starI, i, j, part,
            baseParts = baseName && baseName.split("/"),
            map = config.map,
            starMap = (map && map['*']) || {};

        //Adjust any relative paths.
        if (name && name.charAt(0) === ".") {
            //If have a base name, try to normalize against it,
            //otherwise, assume it is a top-level require that will
            //be relative to baseUrl in the end.
            if (baseName) {
                name = name.split('/');
                lastIndex = name.length - 1;

                // Node .js allowance:
                if (config.nodeIdCompat && jsSuffixRegExp.test(name[lastIndex])) {
                    name[lastIndex] = name[lastIndex].replace(jsSuffixRegExp, '');
                }

                //Lop off the last part of baseParts, so that . matches the
                //"directory" and not name of the baseName's module. For instance,
                //baseName of "one/two/three", maps to "one/two/three.js", but we
                //want the directory, "one/two" for this normalization.
                name = baseParts.slice(0, baseParts.length - 1).concat(name);

                //start trimDots
                for (i = 0; i < name.length; i += 1) {
                    part = name[i];
                    if (part === ".") {
                        name.splice(i, 1);
                        i -= 1;
                    } else if (part === "..") {
                        if (i === 1 && (name[2] === '..' || name[0] === '..')) {
                            //End of the line. Keep at least one non-dot
                            //path segment at the front so it can be mapped
                            //correctly to disk. Otherwise, there is likely
                            //no path mapping for a path starting with '..'.
                            //This can still fail, but catches the most reasonable
                            //uses of ..
                            break;
                        } else if (i > 0) {
                            name.splice(i - 1, 2);
                            i -= 2;
                        }
                    }
                }
                //end trimDots

                name = name.join("/");
            } else if (name.indexOf('./') === 0) {
                // No baseName, so this is ID is resolved relative
                // to baseUrl, pull off the leading dot.
                name = name.substring(2);
            }
        }

        //Apply map config if available.
        if ((baseParts || starMap) && map) {
            nameParts = name.split('/');

            for (i = nameParts.length; i > 0; i -= 1) {
                nameSegment = nameParts.slice(0, i).join("/");

                if (baseParts) {
                    //Find the longest baseName segment match in the config.
                    //So, do joins on the biggest to smallest lengths of baseParts.
                    for (j = baseParts.length; j > 0; j -= 1) {
                        mapValue = map[baseParts.slice(0, j).join('/')];

                        //baseName segment has  config, find if it has one for
                        //this name.
                        if (mapValue) {
                            mapValue = mapValue[nameSegment];
                            if (mapValue) {
                                //Match, update name to the new value.
                                foundMap = mapValue;
                                foundI = i;
                                break;
                            }
                        }
                    }
                }

                if (foundMap) {
                    break;
                }

                //Check for a star map match, but just hold on to it,
                //if there is a shorter segment match later in a matching
                //config, then favor over this star map.
                if (!foundStarMap && starMap && starMap[nameSegment]) {
                    foundStarMap = starMap[nameSegment];
                    starI = i;
                }
            }

            if (!foundMap && foundStarMap) {
                foundMap = foundStarMap;
                foundI = starI;
            }

            if (foundMap) {
                nameParts.splice(0, foundI, foundMap);
                name = nameParts.join('/');
            }
        }

        return name;
    }

    function makeRequire(relName, forceSync) {
        return function () {
            //A version of a require function that passes a moduleName
            //value for items that may need to
            //look up paths relative to the moduleName
            var args = aps.call(arguments, 0);

            //If first arg is not require('string'), and there is only
            //one arg, it is the array form without a callback. Insert
            //a null so that the following concat is correct.
            if (typeof args[0] !== 'string' && args.length === 1) {
                args.push(null);
            }
            return req.apply(undef, args.concat([relName, forceSync]));
        };
    }

    function makeNormalize(relName) {
        return function (name) {
            return normalize(name, relName);
        };
    }

    function makeLoad(depName) {
        return function (value) {
            defined[depName] = value;
        };
    }

    function callDep(name) {
        if (hasProp(waiting, name)) {
            var args = waiting[name];
            delete waiting[name];
            defining[name] = true;
            main.apply(undef, args);
        }

        if (!hasProp(defined, name) && !hasProp(defining, name)) {
            throw new Error('No ' + name);
        }
        return defined[name];
    }

    //Turns a plugin!resource to [plugin, resource]
    //with the plugin being undefined if the name
    //did not have a plugin prefix.
    function splitPrefix(name) {
        var prefix,
            index = name ? name.indexOf('!') : -1;
        if (index > -1) {
            prefix = name.substring(0, index);
            name = name.substring(index + 1, name.length);
        }
        return [prefix, name];
    }

    /**
     * Makes a name map, normalizing the name, and using a plugin
     * for normalization if necessary. Grabs a ref to plugin
     * too, as an optimization.
     */
    makeMap = function (name, relName) {
        var plugin,
            parts = splitPrefix(name),
            prefix = parts[0];

        name = parts[1];

        if (prefix) {
            prefix = normalize(prefix, relName);
            plugin = callDep(prefix);
        }

        //Normalize according
        if (prefix) {
            if (plugin && plugin.normalize) {
                name = plugin.normalize(name, makeNormalize(relName));
            } else {
                name = normalize(name, relName);
            }
        } else {
            name = normalize(name, relName);
            parts = splitPrefix(name);
            prefix = parts[0];
            name = parts[1];
            if (prefix) {
                plugin = callDep(prefix);
            }
        }

        //Using ridiculous property names for space reasons
        return {
            f: prefix ? prefix + '!' + name : name, //fullName
            n: name,
            pr: prefix,
            p: plugin
        };
    };

    function makeConfig(name) {
        return function () {
            return (config && config.config && config.config[name]) || {};
        };
    }

    handlers = {
        require: function (name) {
            return makeRequire(name);
        },
        exports: function (name) {
            var e = defined[name];
            if (typeof e !== 'undefined') {
                return e;
            } else {
                return (defined[name] = {});
            }
        },
        module: function (name) {
            return {
                id: name,
                uri: '',
                exports: defined[name],
                config: makeConfig(name)
            };
        }
    };

    main = function (name, deps, callback, relName) {
        var cjsModule, depName, ret, map, i,
            args = [],
            callbackType = typeof callback,
            usingExports;

        //Use name if no relName
        relName = relName || name;

        //Call the callback to define the module, if necessary.
        if (callbackType === 'undefined' || callbackType === 'function') {
            //Pull out the defined dependencies and pass the ordered
            //values to the callback.
            //Default to [require, exports, module] if no deps
            deps = !deps.length && callback.length ? ['require', 'exports', 'module'] : deps;
            for (i = 0; i < deps.length; i += 1) {
                map = makeMap(deps[i], relName);
                depName = map.f;

                //Fast path CommonJS standard dependencies.
                if (depName === "require") {
                    args[i] = handlers.require(name);
                } else if (depName === "exports") {
                    //CommonJS module spec 1.1
                    args[i] = handlers.exports(name);
                    usingExports = true;
                } else if (depName === "module") {
                    //CommonJS module spec 1.1
                    cjsModule = args[i] = handlers.module(name);
                } else if (hasProp(defined, depName) ||
                           hasProp(waiting, depName) ||
                           hasProp(defining, depName)) {
                    args[i] = callDep(depName);
                } else if (map.p) {
                    map.p.load(map.n, makeRequire(relName, true), makeLoad(depName), {});
                    args[i] = defined[depName];
                } else {
                    throw new Error(name + ' missing ' + depName);
                }
            }

            ret = callback ? callback.apply(defined[name], args) : undefined;

            if (name) {
                //If setting exports via "module" is in play,
                //favor that over return value and exports. After that,
                //favor a non-undefined return value over exports use.
                if (cjsModule && cjsModule.exports !== undef &&
                        cjsModule.exports !== defined[name]) {
                    defined[name] = cjsModule.exports;
                } else if (ret !== undef || !usingExports) {
                    //Use the return value from the function.
                    defined[name] = ret;
                }
            }
        } else if (name) {
            //May just be an object definition for the module. Only
            //worry about defining if have a module name.
            defined[name] = callback;
        }
    };

    requirejs = require = req = function (deps, callback, relName, forceSync, alt) {
        if (typeof deps === "string") {
            if (handlers[deps]) {
                //callback in this case is really relName
                return handlers[deps](callback);
            }
            //Just return the module wanted. In this scenario, the
            //deps arg is the module name, and second arg (if passed)
            //is just the relName.
            //Normalize module name, if it contains . or ..
            return callDep(makeMap(deps, callback).f);
        } else if (!deps.splice) {
            //deps is a config object, not an array.
            config = deps;
            if (config.deps) {
                req(config.deps, config.callback);
            }
            if (!callback) {
                return;
            }

            if (callback.splice) {
                //callback is an array, which means it is a dependency list.
                //Adjust args if there are dependencies
                deps = callback;
                callback = relName;
                relName = null;
            } else {
                deps = undef;
            }
        }

        //Support require(['a'])
        callback = callback || function () {};

        //If relName is a function, it is an errback handler,
        //so remove it.
        if (typeof relName === 'function') {
            relName = forceSync;
            forceSync = alt;
        }

        //Simulate async callback;
        if (forceSync) {
            main(undef, deps, callback, relName);
        } else {
            //Using a non-zero value because of concern for what old browsers
            //do, and latest browsers "upgrade" to 4 if lower value is used:
            //http://www.whatwg.org/specs/web-apps/current-work/multipage/timers.html#dom-windowtimers-settimeout:
            //If want a value immediately, use require('id') instead -- something
            //that works in almond on the global level, but not guaranteed and
            //unlikely to work in other AMD implementations.
            setTimeout(function () {
                main(undef, deps, callback, relName);
            }, 4);
        }

        return req;
    };

    /**
     * Just drops the config on the floor, but returns req in case
     * the config return value is used.
     */
    req.config = function (cfg) {
        return req(cfg);
    };

    /**
     * Expose module registry for debugging and tooling
     */
    requirejs._defined = defined;

    define = function (name, deps, callback) {
        if (typeof name !== 'string') {
            throw new Error('See almond README: incorrect module build, no module name');
        }

        //This module may not have dependencies
        if (!deps.splice) {
            //deps is not an array, so probably means
            //an object literal or factory function for
            //the value. Adjust args.
            callback = deps;
            deps = [];
        }

        if (!hasProp(defined, name) && !hasProp(waiting, name)) {
            waiting[name] = [name, deps, callback];
        }
    };

    define.amd = {
        jQuery: true
    };
}());

define("../bower_components/almond/almond", function(){});

/*! jQuery v2.1.4 | (c) 2005, 2015 jQuery Foundation, Inc. | jquery.org/license */
!function(a,b){"object"==typeof module&&"object"==typeof module.exports?module.exports=a.document?b(a,!0):function(a){if(!a.document)throw new Error("jQuery requires a window with a document");return b(a)}:b(a)}("undefined"!=typeof window?window:this,function(a,b){var c=[],d=c.slice,e=c.concat,f=c.push,g=c.indexOf,h={},i=h.toString,j=h.hasOwnProperty,k={},l=a.document,m="2.1.4",n=function(a,b){return new n.fn.init(a,b)},o=/^[\s\uFEFF\xA0]+|[\s\uFEFF\xA0]+$/g,p=/^-ms-/,q=/-([\da-z])/gi,r=function(a,b){return b.toUpperCase()};n.fn=n.prototype={jquery:m,constructor:n,selector:"",length:0,toArray:function(){return d.call(this)},get:function(a){return null!=a?0>a?this[a+this.length]:this[a]:d.call(this)},pushStack:function(a){var b=n.merge(this.constructor(),a);return b.prevObject=this,b.context=this.context,b},each:function(a,b){return n.each(this,a,b)},map:function(a){return this.pushStack(n.map(this,function(b,c){return a.call(b,c,b)}))},slice:function(){return this.pushStack(d.apply(this,arguments))},first:function(){return this.eq(0)},last:function(){return this.eq(-1)},eq:function(a){var b=this.length,c=+a+(0>a?b:0);return this.pushStack(c>=0&&b>c?[this[c]]:[])},end:function(){return this.prevObject||this.constructor(null)},push:f,sort:c.sort,splice:c.splice},n.extend=n.fn.extend=function(){var a,b,c,d,e,f,g=arguments[0]||{},h=1,i=arguments.length,j=!1;for("boolean"==typeof g&&(j=g,g=arguments[h]||{},h++),"object"==typeof g||n.isFunction(g)||(g={}),h===i&&(g=this,h--);i>h;h++)if(null!=(a=arguments[h]))for(b in a)c=g[b],d=a[b],g!==d&&(j&&d&&(n.isPlainObject(d)||(e=n.isArray(d)))?(e?(e=!1,f=c&&n.isArray(c)?c:[]):f=c&&n.isPlainObject(c)?c:{},g[b]=n.extend(j,f,d)):void 0!==d&&(g[b]=d));return g},n.extend({expando:"jQuery"+(m+Math.random()).replace(/\D/g,""),isReady:!0,error:function(a){throw new Error(a)},noop:function(){},isFunction:function(a){return"function"===n.type(a)},isArray:Array.isArray,isWindow:function(a){return null!=a&&a===a.window},isNumeric:function(a){return!n.isArray(a)&&a-parseFloat(a)+1>=0},isPlainObject:function(a){return"object"!==n.type(a)||a.nodeType||n.isWindow(a)?!1:a.constructor&&!j.call(a.constructor.prototype,"isPrototypeOf")?!1:!0},isEmptyObject:function(a){var b;for(b in a)return!1;return!0},type:function(a){return null==a?a+"":"object"==typeof a||"function"==typeof a?h[i.call(a)]||"object":typeof a},globalEval:function(a){var b,c=eval;a=n.trim(a),a&&(1===a.indexOf("use strict")?(b=l.createElement("script"),b.text=a,l.head.appendChild(b).parentNode.removeChild(b)):c(a))},camelCase:function(a){return a.replace(p,"ms-").replace(q,r)},nodeName:function(a,b){return a.nodeName&&a.nodeName.toLowerCase()===b.toLowerCase()},each:function(a,b,c){var d,e=0,f=a.length,g=s(a);if(c){if(g){for(;f>e;e++)if(d=b.apply(a[e],c),d===!1)break}else for(e in a)if(d=b.apply(a[e],c),d===!1)break}else if(g){for(;f>e;e++)if(d=b.call(a[e],e,a[e]),d===!1)break}else for(e in a)if(d=b.call(a[e],e,a[e]),d===!1)break;return a},trim:function(a){return null==a?"":(a+"").replace(o,"")},makeArray:function(a,b){var c=b||[];return null!=a&&(s(Object(a))?n.merge(c,"string"==typeof a?[a]:a):f.call(c,a)),c},inArray:function(a,b,c){return null==b?-1:g.call(b,a,c)},merge:function(a,b){for(var c=+b.length,d=0,e=a.length;c>d;d++)a[e++]=b[d];return a.length=e,a},grep:function(a,b,c){for(var d,e=[],f=0,g=a.length,h=!c;g>f;f++)d=!b(a[f],f),d!==h&&e.push(a[f]);return e},map:function(a,b,c){var d,f=0,g=a.length,h=s(a),i=[];if(h)for(;g>f;f++)d=b(a[f],f,c),null!=d&&i.push(d);else for(f in a)d=b(a[f],f,c),null!=d&&i.push(d);return e.apply([],i)},guid:1,proxy:function(a,b){var c,e,f;return"string"==typeof b&&(c=a[b],b=a,a=c),n.isFunction(a)?(e=d.call(arguments,2),f=function(){return a.apply(b||this,e.concat(d.call(arguments)))},f.guid=a.guid=a.guid||n.guid++,f):void 0},now:Date.now,support:k}),n.each("Boolean Number String Function Array Date RegExp Object Error".split(" "),function(a,b){h["[object "+b+"]"]=b.toLowerCase()});function s(a){var b="length"in a&&a.length,c=n.type(a);return"function"===c||n.isWindow(a)?!1:1===a.nodeType&&b?!0:"array"===c||0===b||"number"==typeof b&&b>0&&b-1 in a}var t=function(a){var b,c,d,e,f,g,h,i,j,k,l,m,n,o,p,q,r,s,t,u="sizzle"+1*new Date,v=a.document,w=0,x=0,y=ha(),z=ha(),A=ha(),B=function(a,b){return a===b&&(l=!0),0},C=1<<31,D={}.hasOwnProperty,E=[],F=E.pop,G=E.push,H=E.push,I=E.slice,J=function(a,b){for(var c=0,d=a.length;d>c;c++)if(a[c]===b)return c;return-1},K="checked|selected|async|autofocus|autoplay|controls|defer|disabled|hidden|ismap|loop|multiple|open|readonly|required|scoped",L="[\\x20\\t\\r\\n\\f]",M="(?:\\\\.|[\\w-]|[^\\x00-\\xa0])+",N=M.replace("w","w#"),O="\\["+L+"*("+M+")(?:"+L+"*([*^$|!~]?=)"+L+"*(?:'((?:\\\\.|[^\\\\'])*)'|\"((?:\\\\.|[^\\\\\"])*)\"|("+N+"))|)"+L+"*\\]",P=":("+M+")(?:\\((('((?:\\\\.|[^\\\\'])*)'|\"((?:\\\\.|[^\\\\\"])*)\")|((?:\\\\.|[^\\\\()[\\]]|"+O+")*)|.*)\\)|)",Q=new RegExp(L+"+","g"),R=new RegExp("^"+L+"+|((?:^|[^\\\\])(?:\\\\.)*)"+L+"+$","g"),S=new RegExp("^"+L+"*,"+L+"*"),T=new RegExp("^"+L+"*([>+~]|"+L+")"+L+"*"),U=new RegExp("="+L+"*([^\\]'\"]*?)"+L+"*\\]","g"),V=new RegExp(P),W=new RegExp("^"+N+"$"),X={ID:new RegExp("^#("+M+")"),CLASS:new RegExp("^\\.("+M+")"),TAG:new RegExp("^("+M.replace("w","w*")+")"),ATTR:new RegExp("^"+O),PSEUDO:new RegExp("^"+P),CHILD:new RegExp("^:(only|first|last|nth|nth-last)-(child|of-type)(?:\\("+L+"*(even|odd|(([+-]|)(\\d*)n|)"+L+"*(?:([+-]|)"+L+"*(\\d+)|))"+L+"*\\)|)","i"),bool:new RegExp("^(?:"+K+")$","i"),needsContext:new RegExp("^"+L+"*[>+~]|:(even|odd|eq|gt|lt|nth|first|last)(?:\\("+L+"*((?:-\\d)?\\d*)"+L+"*\\)|)(?=[^-]|$)","i")},Y=/^(?:input|select|textarea|button)$/i,Z=/^h\d$/i,$=/^[^{]+\{\s*\[native \w/,_=/^(?:#([\w-]+)|(\w+)|\.([\w-]+))$/,aa=/[+~]/,ba=/'|\\/g,ca=new RegExp("\\\\([\\da-f]{1,6}"+L+"?|("+L+")|.)","ig"),da=function(a,b,c){var d="0x"+b-65536;return d!==d||c?b:0>d?String.fromCharCode(d+65536):String.fromCharCode(d>>10|55296,1023&d|56320)},ea=function(){m()};try{H.apply(E=I.call(v.childNodes),v.childNodes),E[v.childNodes.length].nodeType}catch(fa){H={apply:E.length?function(a,b){G.apply(a,I.call(b))}:function(a,b){var c=a.length,d=0;while(a[c++]=b[d++]);a.length=c-1}}}function ga(a,b,d,e){var f,h,j,k,l,o,r,s,w,x;if((b?b.ownerDocument||b:v)!==n&&m(b),b=b||n,d=d||[],k=b.nodeType,"string"!=typeof a||!a||1!==k&&9!==k&&11!==k)return d;if(!e&&p){if(11!==k&&(f=_.exec(a)))if(j=f[1]){if(9===k){if(h=b.getElementById(j),!h||!h.parentNode)return d;if(h.id===j)return d.push(h),d}else if(b.ownerDocument&&(h=b.ownerDocument.getElementById(j))&&t(b,h)&&h.id===j)return d.push(h),d}else{if(f[2])return H.apply(d,b.getElementsByTagName(a)),d;if((j=f[3])&&c.getElementsByClassName)return H.apply(d,b.getElementsByClassName(j)),d}if(c.qsa&&(!q||!q.test(a))){if(s=r=u,w=b,x=1!==k&&a,1===k&&"object"!==b.nodeName.toLowerCase()){o=g(a),(r=b.getAttribute("id"))?s=r.replace(ba,"\\$&"):b.setAttribute("id",s),s="[id='"+s+"'] ",l=o.length;while(l--)o[l]=s+ra(o[l]);w=aa.test(a)&&pa(b.parentNode)||b,x=o.join(",")}if(x)try{return H.apply(d,w.querySelectorAll(x)),d}catch(y){}finally{r||b.removeAttribute("id")}}}return i(a.replace(R,"$1"),b,d,e)}function ha(){var a=[];function b(c,e){return a.push(c+" ")>d.cacheLength&&delete b[a.shift()],b[c+" "]=e}return b}function ia(a){return a[u]=!0,a}function ja(a){var b=n.createElement("div");try{return!!a(b)}catch(c){return!1}finally{b.parentNode&&b.parentNode.removeChild(b),b=null}}function ka(a,b){var c=a.split("|"),e=a.length;while(e--)d.attrHandle[c[e]]=b}function la(a,b){var c=b&&a,d=c&&1===a.nodeType&&1===b.nodeType&&(~b.sourceIndex||C)-(~a.sourceIndex||C);if(d)return d;if(c)while(c=c.nextSibling)if(c===b)return-1;return a?1:-1}function ma(a){return function(b){var c=b.nodeName.toLowerCase();return"input"===c&&b.type===a}}function na(a){return function(b){var c=b.nodeName.toLowerCase();return("input"===c||"button"===c)&&b.type===a}}function oa(a){return ia(function(b){return b=+b,ia(function(c,d){var e,f=a([],c.length,b),g=f.length;while(g--)c[e=f[g]]&&(c[e]=!(d[e]=c[e]))})})}function pa(a){return a&&"undefined"!=typeof a.getElementsByTagName&&a}c=ga.support={},f=ga.isXML=function(a){var b=a&&(a.ownerDocument||a).documentElement;return b?"HTML"!==b.nodeName:!1},m=ga.setDocument=function(a){var b,e,g=a?a.ownerDocument||a:v;return g!==n&&9===g.nodeType&&g.documentElement?(n=g,o=g.documentElement,e=g.defaultView,e&&e!==e.top&&(e.addEventListener?e.addEventListener("unload",ea,!1):e.attachEvent&&e.attachEvent("onunload",ea)),p=!f(g),c.attributes=ja(function(a){return a.className="i",!a.getAttribute("className")}),c.getElementsByTagName=ja(function(a){return a.appendChild(g.createComment("")),!a.getElementsByTagName("*").length}),c.getElementsByClassName=$.test(g.getElementsByClassName),c.getById=ja(function(a){return o.appendChild(a).id=u,!g.getElementsByName||!g.getElementsByName(u).length}),c.getById?(d.find.ID=function(a,b){if("undefined"!=typeof b.getElementById&&p){var c=b.getElementById(a);return c&&c.parentNode?[c]:[]}},d.filter.ID=function(a){var b=a.replace(ca,da);return function(a){return a.getAttribute("id")===b}}):(delete d.find.ID,d.filter.ID=function(a){var b=a.replace(ca,da);return function(a){var c="undefined"!=typeof a.getAttributeNode&&a.getAttributeNode("id");return c&&c.value===b}}),d.find.TAG=c.getElementsByTagName?function(a,b){return"undefined"!=typeof b.getElementsByTagName?b.getElementsByTagName(a):c.qsa?b.querySelectorAll(a):void 0}:function(a,b){var c,d=[],e=0,f=b.getElementsByTagName(a);if("*"===a){while(c=f[e++])1===c.nodeType&&d.push(c);return d}return f},d.find.CLASS=c.getElementsByClassName&&function(a,b){return p?b.getElementsByClassName(a):void 0},r=[],q=[],(c.qsa=$.test(g.querySelectorAll))&&(ja(function(a){o.appendChild(a).innerHTML="<a id='"+u+"'></a><select id='"+u+"-\f]' msallowcapture=''><option selected=''></option></select>",a.querySelectorAll("[msallowcapture^='']").length&&q.push("[*^$]="+L+"*(?:''|\"\")"),a.querySelectorAll("[selected]").length||q.push("\\["+L+"*(?:value|"+K+")"),a.querySelectorAll("[id~="+u+"-]").length||q.push("~="),a.querySelectorAll(":checked").length||q.push(":checked"),a.querySelectorAll("a#"+u+"+*").length||q.push(".#.+[+~]")}),ja(function(a){var b=g.createElement("input");b.setAttribute("type","hidden"),a.appendChild(b).setAttribute("name","D"),a.querySelectorAll("[name=d]").length&&q.push("name"+L+"*[*^$|!~]?="),a.querySelectorAll(":enabled").length||q.push(":enabled",":disabled"),a.querySelectorAll("*,:x"),q.push(",.*:")})),(c.matchesSelector=$.test(s=o.matches||o.webkitMatchesSelector||o.mozMatchesSelector||o.oMatchesSelector||o.msMatchesSelector))&&ja(function(a){c.disconnectedMatch=s.call(a,"div"),s.call(a,"[s!='']:x"),r.push("!=",P)}),q=q.length&&new RegExp(q.join("|")),r=r.length&&new RegExp(r.join("|")),b=$.test(o.compareDocumentPosition),t=b||$.test(o.contains)?function(a,b){var c=9===a.nodeType?a.documentElement:a,d=b&&b.parentNode;return a===d||!(!d||1!==d.nodeType||!(c.contains?c.contains(d):a.compareDocumentPosition&&16&a.compareDocumentPosition(d)))}:function(a,b){if(b)while(b=b.parentNode)if(b===a)return!0;return!1},B=b?function(a,b){if(a===b)return l=!0,0;var d=!a.compareDocumentPosition-!b.compareDocumentPosition;return d?d:(d=(a.ownerDocument||a)===(b.ownerDocument||b)?a.compareDocumentPosition(b):1,1&d||!c.sortDetached&&b.compareDocumentPosition(a)===d?a===g||a.ownerDocument===v&&t(v,a)?-1:b===g||b.ownerDocument===v&&t(v,b)?1:k?J(k,a)-J(k,b):0:4&d?-1:1)}:function(a,b){if(a===b)return l=!0,0;var c,d=0,e=a.parentNode,f=b.parentNode,h=[a],i=[b];if(!e||!f)return a===g?-1:b===g?1:e?-1:f?1:k?J(k,a)-J(k,b):0;if(e===f)return la(a,b);c=a;while(c=c.parentNode)h.unshift(c);c=b;while(c=c.parentNode)i.unshift(c);while(h[d]===i[d])d++;return d?la(h[d],i[d]):h[d]===v?-1:i[d]===v?1:0},g):n},ga.matches=function(a,b){return ga(a,null,null,b)},ga.matchesSelector=function(a,b){if((a.ownerDocument||a)!==n&&m(a),b=b.replace(U,"='$1']"),!(!c.matchesSelector||!p||r&&r.test(b)||q&&q.test(b)))try{var d=s.call(a,b);if(d||c.disconnectedMatch||a.document&&11!==a.document.nodeType)return d}catch(e){}return ga(b,n,null,[a]).length>0},ga.contains=function(a,b){return(a.ownerDocument||a)!==n&&m(a),t(a,b)},ga.attr=function(a,b){(a.ownerDocument||a)!==n&&m(a);var e=d.attrHandle[b.toLowerCase()],f=e&&D.call(d.attrHandle,b.toLowerCase())?e(a,b,!p):void 0;return void 0!==f?f:c.attributes||!p?a.getAttribute(b):(f=a.getAttributeNode(b))&&f.specified?f.value:null},ga.error=function(a){throw new Error("Syntax error, unrecognized expression: "+a)},ga.uniqueSort=function(a){var b,d=[],e=0,f=0;if(l=!c.detectDuplicates,k=!c.sortStable&&a.slice(0),a.sort(B),l){while(b=a[f++])b===a[f]&&(e=d.push(f));while(e--)a.splice(d[e],1)}return k=null,a},e=ga.getText=function(a){var b,c="",d=0,f=a.nodeType;if(f){if(1===f||9===f||11===f){if("string"==typeof a.textContent)return a.textContent;for(a=a.firstChild;a;a=a.nextSibling)c+=e(a)}else if(3===f||4===f)return a.nodeValue}else while(b=a[d++])c+=e(b);return c},d=ga.selectors={cacheLength:50,createPseudo:ia,match:X,attrHandle:{},find:{},relative:{">":{dir:"parentNode",first:!0}," ":{dir:"parentNode"},"+":{dir:"previousSibling",first:!0},"~":{dir:"previousSibling"}},preFilter:{ATTR:function(a){return a[1]=a[1].replace(ca,da),a[3]=(a[3]||a[4]||a[5]||"").replace(ca,da),"~="===a[2]&&(a[3]=" "+a[3]+" "),a.slice(0,4)},CHILD:function(a){return a[1]=a[1].toLowerCase(),"nth"===a[1].slice(0,3)?(a[3]||ga.error(a[0]),a[4]=+(a[4]?a[5]+(a[6]||1):2*("even"===a[3]||"odd"===a[3])),a[5]=+(a[7]+a[8]||"odd"===a[3])):a[3]&&ga.error(a[0]),a},PSEUDO:function(a){var b,c=!a[6]&&a[2];return X.CHILD.test(a[0])?null:(a[3]?a[2]=a[4]||a[5]||"":c&&V.test(c)&&(b=g(c,!0))&&(b=c.indexOf(")",c.length-b)-c.length)&&(a[0]=a[0].slice(0,b),a[2]=c.slice(0,b)),a.slice(0,3))}},filter:{TAG:function(a){var b=a.replace(ca,da).toLowerCase();return"*"===a?function(){return!0}:function(a){return a.nodeName&&a.nodeName.toLowerCase()===b}},CLASS:function(a){var b=y[a+" "];return b||(b=new RegExp("(^|"+L+")"+a+"("+L+"|$)"))&&y(a,function(a){return b.test("string"==typeof a.className&&a.className||"undefined"!=typeof a.getAttribute&&a.getAttribute("class")||"")})},ATTR:function(a,b,c){return function(d){var e=ga.attr(d,a);return null==e?"!="===b:b?(e+="","="===b?e===c:"!="===b?e!==c:"^="===b?c&&0===e.indexOf(c):"*="===b?c&&e.indexOf(c)>-1:"$="===b?c&&e.slice(-c.length)===c:"~="===b?(" "+e.replace(Q," ")+" ").indexOf(c)>-1:"|="===b?e===c||e.slice(0,c.length+1)===c+"-":!1):!0}},CHILD:function(a,b,c,d,e){var f="nth"!==a.slice(0,3),g="last"!==a.slice(-4),h="of-type"===b;return 1===d&&0===e?function(a){return!!a.parentNode}:function(b,c,i){var j,k,l,m,n,o,p=f!==g?"nextSibling":"previousSibling",q=b.parentNode,r=h&&b.nodeName.toLowerCase(),s=!i&&!h;if(q){if(f){while(p){l=b;while(l=l[p])if(h?l.nodeName.toLowerCase()===r:1===l.nodeType)return!1;o=p="only"===a&&!o&&"nextSibling"}return!0}if(o=[g?q.firstChild:q.lastChild],g&&s){k=q[u]||(q[u]={}),j=k[a]||[],n=j[0]===w&&j[1],m=j[0]===w&&j[2],l=n&&q.childNodes[n];while(l=++n&&l&&l[p]||(m=n=0)||o.pop())if(1===l.nodeType&&++m&&l===b){k[a]=[w,n,m];break}}else if(s&&(j=(b[u]||(b[u]={}))[a])&&j[0]===w)m=j[1];else while(l=++n&&l&&l[p]||(m=n=0)||o.pop())if((h?l.nodeName.toLowerCase()===r:1===l.nodeType)&&++m&&(s&&((l[u]||(l[u]={}))[a]=[w,m]),l===b))break;return m-=e,m===d||m%d===0&&m/d>=0}}},PSEUDO:function(a,b){var c,e=d.pseudos[a]||d.setFilters[a.toLowerCase()]||ga.error("unsupported pseudo: "+a);return e[u]?e(b):e.length>1?(c=[a,a,"",b],d.setFilters.hasOwnProperty(a.toLowerCase())?ia(function(a,c){var d,f=e(a,b),g=f.length;while(g--)d=J(a,f[g]),a[d]=!(c[d]=f[g])}):function(a){return e(a,0,c)}):e}},pseudos:{not:ia(function(a){var b=[],c=[],d=h(a.replace(R,"$1"));return d[u]?ia(function(a,b,c,e){var f,g=d(a,null,e,[]),h=a.length;while(h--)(f=g[h])&&(a[h]=!(b[h]=f))}):function(a,e,f){return b[0]=a,d(b,null,f,c),b[0]=null,!c.pop()}}),has:ia(function(a){return function(b){return ga(a,b).length>0}}),contains:ia(function(a){return a=a.replace(ca,da),function(b){return(b.textContent||b.innerText||e(b)).indexOf(a)>-1}}),lang:ia(function(a){return W.test(a||"")||ga.error("unsupported lang: "+a),a=a.replace(ca,da).toLowerCase(),function(b){var c;do if(c=p?b.lang:b.getAttribute("xml:lang")||b.getAttribute("lang"))return c=c.toLowerCase(),c===a||0===c.indexOf(a+"-");while((b=b.parentNode)&&1===b.nodeType);return!1}}),target:function(b){var c=a.location&&a.location.hash;return c&&c.slice(1)===b.id},root:function(a){return a===o},focus:function(a){return a===n.activeElement&&(!n.hasFocus||n.hasFocus())&&!!(a.type||a.href||~a.tabIndex)},enabled:function(a){return a.disabled===!1},disabled:function(a){return a.disabled===!0},checked:function(a){var b=a.nodeName.toLowerCase();return"input"===b&&!!a.checked||"option"===b&&!!a.selected},selected:function(a){return a.parentNode&&a.parentNode.selectedIndex,a.selected===!0},empty:function(a){for(a=a.firstChild;a;a=a.nextSibling)if(a.nodeType<6)return!1;return!0},parent:function(a){return!d.pseudos.empty(a)},header:function(a){return Z.test(a.nodeName)},input:function(a){return Y.test(a.nodeName)},button:function(a){var b=a.nodeName.toLowerCase();return"input"===b&&"button"===a.type||"button"===b},text:function(a){var b;return"input"===a.nodeName.toLowerCase()&&"text"===a.type&&(null==(b=a.getAttribute("type"))||"text"===b.toLowerCase())},first:oa(function(){return[0]}),last:oa(function(a,b){return[b-1]}),eq:oa(function(a,b,c){return[0>c?c+b:c]}),even:oa(function(a,b){for(var c=0;b>c;c+=2)a.push(c);return a}),odd:oa(function(a,b){for(var c=1;b>c;c+=2)a.push(c);return a}),lt:oa(function(a,b,c){for(var d=0>c?c+b:c;--d>=0;)a.push(d);return a}),gt:oa(function(a,b,c){for(var d=0>c?c+b:c;++d<b;)a.push(d);return a})}},d.pseudos.nth=d.pseudos.eq;for(b in{radio:!0,checkbox:!0,file:!0,password:!0,image:!0})d.pseudos[b]=ma(b);for(b in{submit:!0,reset:!0})d.pseudos[b]=na(b);function qa(){}qa.prototype=d.filters=d.pseudos,d.setFilters=new qa,g=ga.tokenize=function(a,b){var c,e,f,g,h,i,j,k=z[a+" "];if(k)return b?0:k.slice(0);h=a,i=[],j=d.preFilter;while(h){(!c||(e=S.exec(h)))&&(e&&(h=h.slice(e[0].length)||h),i.push(f=[])),c=!1,(e=T.exec(h))&&(c=e.shift(),f.push({value:c,type:e[0].replace(R," ")}),h=h.slice(c.length));for(g in d.filter)!(e=X[g].exec(h))||j[g]&&!(e=j[g](e))||(c=e.shift(),f.push({value:c,type:g,matches:e}),h=h.slice(c.length));if(!c)break}return b?h.length:h?ga.error(a):z(a,i).slice(0)};function ra(a){for(var b=0,c=a.length,d="";c>b;b++)d+=a[b].value;return d}function sa(a,b,c){var d=b.dir,e=c&&"parentNode"===d,f=x++;return b.first?function(b,c,f){while(b=b[d])if(1===b.nodeType||e)return a(b,c,f)}:function(b,c,g){var h,i,j=[w,f];if(g){while(b=b[d])if((1===b.nodeType||e)&&a(b,c,g))return!0}else while(b=b[d])if(1===b.nodeType||e){if(i=b[u]||(b[u]={}),(h=i[d])&&h[0]===w&&h[1]===f)return j[2]=h[2];if(i[d]=j,j[2]=a(b,c,g))return!0}}}function ta(a){return a.length>1?function(b,c,d){var e=a.length;while(e--)if(!a[e](b,c,d))return!1;return!0}:a[0]}function ua(a,b,c){for(var d=0,e=b.length;e>d;d++)ga(a,b[d],c);return c}function va(a,b,c,d,e){for(var f,g=[],h=0,i=a.length,j=null!=b;i>h;h++)(f=a[h])&&(!c||c(f,d,e))&&(g.push(f),j&&b.push(h));return g}function wa(a,b,c,d,e,f){return d&&!d[u]&&(d=wa(d)),e&&!e[u]&&(e=wa(e,f)),ia(function(f,g,h,i){var j,k,l,m=[],n=[],o=g.length,p=f||ua(b||"*",h.nodeType?[h]:h,[]),q=!a||!f&&b?p:va(p,m,a,h,i),r=c?e||(f?a:o||d)?[]:g:q;if(c&&c(q,r,h,i),d){j=va(r,n),d(j,[],h,i),k=j.length;while(k--)(l=j[k])&&(r[n[k]]=!(q[n[k]]=l))}if(f){if(e||a){if(e){j=[],k=r.length;while(k--)(l=r[k])&&j.push(q[k]=l);e(null,r=[],j,i)}k=r.length;while(k--)(l=r[k])&&(j=e?J(f,l):m[k])>-1&&(f[j]=!(g[j]=l))}}else r=va(r===g?r.splice(o,r.length):r),e?e(null,g,r,i):H.apply(g,r)})}function xa(a){for(var b,c,e,f=a.length,g=d.relative[a[0].type],h=g||d.relative[" "],i=g?1:0,k=sa(function(a){return a===b},h,!0),l=sa(function(a){return J(b,a)>-1},h,!0),m=[function(a,c,d){var e=!g&&(d||c!==j)||((b=c).nodeType?k(a,c,d):l(a,c,d));return b=null,e}];f>i;i++)if(c=d.relative[a[i].type])m=[sa(ta(m),c)];else{if(c=d.filter[a[i].type].apply(null,a[i].matches),c[u]){for(e=++i;f>e;e++)if(d.relative[a[e].type])break;return wa(i>1&&ta(m),i>1&&ra(a.slice(0,i-1).concat({value:" "===a[i-2].type?"*":""})).replace(R,"$1"),c,e>i&&xa(a.slice(i,e)),f>e&&xa(a=a.slice(e)),f>e&&ra(a))}m.push(c)}return ta(m)}function ya(a,b){var c=b.length>0,e=a.length>0,f=function(f,g,h,i,k){var l,m,o,p=0,q="0",r=f&&[],s=[],t=j,u=f||e&&d.find.TAG("*",k),v=w+=null==t?1:Math.random()||.1,x=u.length;for(k&&(j=g!==n&&g);q!==x&&null!=(l=u[q]);q++){if(e&&l){m=0;while(o=a[m++])if(o(l,g,h)){i.push(l);break}k&&(w=v)}c&&((l=!o&&l)&&p--,f&&r.push(l))}if(p+=q,c&&q!==p){m=0;while(o=b[m++])o(r,s,g,h);if(f){if(p>0)while(q--)r[q]||s[q]||(s[q]=F.call(i));s=va(s)}H.apply(i,s),k&&!f&&s.length>0&&p+b.length>1&&ga.uniqueSort(i)}return k&&(w=v,j=t),r};return c?ia(f):f}return h=ga.compile=function(a,b){var c,d=[],e=[],f=A[a+" "];if(!f){b||(b=g(a)),c=b.length;while(c--)f=xa(b[c]),f[u]?d.push(f):e.push(f);f=A(a,ya(e,d)),f.selector=a}return f},i=ga.select=function(a,b,e,f){var i,j,k,l,m,n="function"==typeof a&&a,o=!f&&g(a=n.selector||a);if(e=e||[],1===o.length){if(j=o[0]=o[0].slice(0),j.length>2&&"ID"===(k=j[0]).type&&c.getById&&9===b.nodeType&&p&&d.relative[j[1].type]){if(b=(d.find.ID(k.matches[0].replace(ca,da),b)||[])[0],!b)return e;n&&(b=b.parentNode),a=a.slice(j.shift().value.length)}i=X.needsContext.test(a)?0:j.length;while(i--){if(k=j[i],d.relative[l=k.type])break;if((m=d.find[l])&&(f=m(k.matches[0].replace(ca,da),aa.test(j[0].type)&&pa(b.parentNode)||b))){if(j.splice(i,1),a=f.length&&ra(j),!a)return H.apply(e,f),e;break}}}return(n||h(a,o))(f,b,!p,e,aa.test(a)&&pa(b.parentNode)||b),e},c.sortStable=u.split("").sort(B).join("")===u,c.detectDuplicates=!!l,m(),c.sortDetached=ja(function(a){return 1&a.compareDocumentPosition(n.createElement("div"))}),ja(function(a){return a.innerHTML="<a href='#'></a>","#"===a.firstChild.getAttribute("href")})||ka("type|href|height|width",function(a,b,c){return c?void 0:a.getAttribute(b,"type"===b.toLowerCase()?1:2)}),c.attributes&&ja(function(a){return a.innerHTML="<input/>",a.firstChild.setAttribute("value",""),""===a.firstChild.getAttribute("value")})||ka("value",function(a,b,c){return c||"input"!==a.nodeName.toLowerCase()?void 0:a.defaultValue}),ja(function(a){return null==a.getAttribute("disabled")})||ka(K,function(a,b,c){var d;return c?void 0:a[b]===!0?b.toLowerCase():(d=a.getAttributeNode(b))&&d.specified?d.value:null}),ga}(a);n.find=t,n.expr=t.selectors,n.expr[":"]=n.expr.pseudos,n.unique=t.uniqueSort,n.text=t.getText,n.isXMLDoc=t.isXML,n.contains=t.contains;var u=n.expr.match.needsContext,v=/^<(\w+)\s*\/?>(?:<\/\1>|)$/,w=/^.[^:#\[\.,]*$/;function x(a,b,c){if(n.isFunction(b))return n.grep(a,function(a,d){return!!b.call(a,d,a)!==c});if(b.nodeType)return n.grep(a,function(a){return a===b!==c});if("string"==typeof b){if(w.test(b))return n.filter(b,a,c);b=n.filter(b,a)}return n.grep(a,function(a){return g.call(b,a)>=0!==c})}n.filter=function(a,b,c){var d=b[0];return c&&(a=":not("+a+")"),1===b.length&&1===d.nodeType?n.find.matchesSelector(d,a)?[d]:[]:n.find.matches(a,n.grep(b,function(a){return 1===a.nodeType}))},n.fn.extend({find:function(a){var b,c=this.length,d=[],e=this;if("string"!=typeof a)return this.pushStack(n(a).filter(function(){for(b=0;c>b;b++)if(n.contains(e[b],this))return!0}));for(b=0;c>b;b++)n.find(a,e[b],d);return d=this.pushStack(c>1?n.unique(d):d),d.selector=this.selector?this.selector+" "+a:a,d},filter:function(a){return this.pushStack(x(this,a||[],!1))},not:function(a){return this.pushStack(x(this,a||[],!0))},is:function(a){return!!x(this,"string"==typeof a&&u.test(a)?n(a):a||[],!1).length}});var y,z=/^(?:\s*(<[\w\W]+>)[^>]*|#([\w-]*))$/,A=n.fn.init=function(a,b){var c,d;if(!a)return this;if("string"==typeof a){if(c="<"===a[0]&&">"===a[a.length-1]&&a.length>=3?[null,a,null]:z.exec(a),!c||!c[1]&&b)return!b||b.jquery?(b||y).find(a):this.constructor(b).find(a);if(c[1]){if(b=b instanceof n?b[0]:b,n.merge(this,n.parseHTML(c[1],b&&b.nodeType?b.ownerDocument||b:l,!0)),v.test(c[1])&&n.isPlainObject(b))for(c in b)n.isFunction(this[c])?this[c](b[c]):this.attr(c,b[c]);return this}return d=l.getElementById(c[2]),d&&d.parentNode&&(this.length=1,this[0]=d),this.context=l,this.selector=a,this}return a.nodeType?(this.context=this[0]=a,this.length=1,this):n.isFunction(a)?"undefined"!=typeof y.ready?y.ready(a):a(n):(void 0!==a.selector&&(this.selector=a.selector,this.context=a.context),n.makeArray(a,this))};A.prototype=n.fn,y=n(l);var B=/^(?:parents|prev(?:Until|All))/,C={children:!0,contents:!0,next:!0,prev:!0};n.extend({dir:function(a,b,c){var d=[],e=void 0!==c;while((a=a[b])&&9!==a.nodeType)if(1===a.nodeType){if(e&&n(a).is(c))break;d.push(a)}return d},sibling:function(a,b){for(var c=[];a;a=a.nextSibling)1===a.nodeType&&a!==b&&c.push(a);return c}}),n.fn.extend({has:function(a){var b=n(a,this),c=b.length;return this.filter(function(){for(var a=0;c>a;a++)if(n.contains(this,b[a]))return!0})},closest:function(a,b){for(var c,d=0,e=this.length,f=[],g=u.test(a)||"string"!=typeof a?n(a,b||this.context):0;e>d;d++)for(c=this[d];c&&c!==b;c=c.parentNode)if(c.nodeType<11&&(g?g.index(c)>-1:1===c.nodeType&&n.find.matchesSelector(c,a))){f.push(c);break}return this.pushStack(f.length>1?n.unique(f):f)},index:function(a){return a?"string"==typeof a?g.call(n(a),this[0]):g.call(this,a.jquery?a[0]:a):this[0]&&this[0].parentNode?this.first().prevAll().length:-1},add:function(a,b){return this.pushStack(n.unique(n.merge(this.get(),n(a,b))))},addBack:function(a){return this.add(null==a?this.prevObject:this.prevObject.filter(a))}});function D(a,b){while((a=a[b])&&1!==a.nodeType);return a}n.each({parent:function(a){var b=a.parentNode;return b&&11!==b.nodeType?b:null},parents:function(a){return n.dir(a,"parentNode")},parentsUntil:function(a,b,c){return n.dir(a,"parentNode",c)},next:function(a){return D(a,"nextSibling")},prev:function(a){return D(a,"previousSibling")},nextAll:function(a){return n.dir(a,"nextSibling")},prevAll:function(a){return n.dir(a,"previousSibling")},nextUntil:function(a,b,c){return n.dir(a,"nextSibling",c)},prevUntil:function(a,b,c){return n.dir(a,"previousSibling",c)},siblings:function(a){return n.sibling((a.parentNode||{}).firstChild,a)},children:function(a){return n.sibling(a.firstChild)},contents:function(a){return a.contentDocument||n.merge([],a.childNodes)}},function(a,b){n.fn[a]=function(c,d){var e=n.map(this,b,c);return"Until"!==a.slice(-5)&&(d=c),d&&"string"==typeof d&&(e=n.filter(d,e)),this.length>1&&(C[a]||n.unique(e),B.test(a)&&e.reverse()),this.pushStack(e)}});var E=/\S+/g,F={};function G(a){var b=F[a]={};return n.each(a.match(E)||[],function(a,c){b[c]=!0}),b}n.Callbacks=function(a){a="string"==typeof a?F[a]||G(a):n.extend({},a);var b,c,d,e,f,g,h=[],i=!a.once&&[],j=function(l){for(b=a.memory&&l,c=!0,g=e||0,e=0,f=h.length,d=!0;h&&f>g;g++)if(h[g].apply(l[0],l[1])===!1&&a.stopOnFalse){b=!1;break}d=!1,h&&(i?i.length&&j(i.shift()):b?h=[]:k.disable())},k={add:function(){if(h){var c=h.length;!function g(b){n.each(b,function(b,c){var d=n.type(c);"function"===d?a.unique&&k.has(c)||h.push(c):c&&c.length&&"string"!==d&&g(c)})}(arguments),d?f=h.length:b&&(e=c,j(b))}return this},remove:function(){return h&&n.each(arguments,function(a,b){var c;while((c=n.inArray(b,h,c))>-1)h.splice(c,1),d&&(f>=c&&f--,g>=c&&g--)}),this},has:function(a){return a?n.inArray(a,h)>-1:!(!h||!h.length)},empty:function(){return h=[],f=0,this},disable:function(){return h=i=b=void 0,this},disabled:function(){return!h},lock:function(){return i=void 0,b||k.disable(),this},locked:function(){return!i},fireWith:function(a,b){return!h||c&&!i||(b=b||[],b=[a,b.slice?b.slice():b],d?i.push(b):j(b)),this},fire:function(){return k.fireWith(this,arguments),this},fired:function(){return!!c}};return k},n.extend({Deferred:function(a){var b=[["resolve","done",n.Callbacks("once memory"),"resolved"],["reject","fail",n.Callbacks("once memory"),"rejected"],["notify","progress",n.Callbacks("memory")]],c="pending",d={state:function(){return c},always:function(){return e.done(arguments).fail(arguments),this},then:function(){var a=arguments;return n.Deferred(function(c){n.each(b,function(b,f){var g=n.isFunction(a[b])&&a[b];e[f[1]](function(){var a=g&&g.apply(this,arguments);a&&n.isFunction(a.promise)?a.promise().done(c.resolve).fail(c.reject).progress(c.notify):c[f[0]+"With"](this===d?c.promise():this,g?[a]:arguments)})}),a=null}).promise()},promise:function(a){return null!=a?n.extend(a,d):d}},e={};return d.pipe=d.then,n.each(b,function(a,f){var g=f[2],h=f[3];d[f[1]]=g.add,h&&g.add(function(){c=h},b[1^a][2].disable,b[2][2].lock),e[f[0]]=function(){return e[f[0]+"With"](this===e?d:this,arguments),this},e[f[0]+"With"]=g.fireWith}),d.promise(e),a&&a.call(e,e),e},when:function(a){var b=0,c=d.call(arguments),e=c.length,f=1!==e||a&&n.isFunction(a.promise)?e:0,g=1===f?a:n.Deferred(),h=function(a,b,c){return function(e){b[a]=this,c[a]=arguments.length>1?d.call(arguments):e,c===i?g.notifyWith(b,c):--f||g.resolveWith(b,c)}},i,j,k;if(e>1)for(i=new Array(e),j=new Array(e),k=new Array(e);e>b;b++)c[b]&&n.isFunction(c[b].promise)?c[b].promise().done(h(b,k,c)).fail(g.reject).progress(h(b,j,i)):--f;return f||g.resolveWith(k,c),g.promise()}});var H;n.fn.ready=function(a){return n.ready.promise().done(a),this},n.extend({isReady:!1,readyWait:1,holdReady:function(a){a?n.readyWait++:n.ready(!0)},ready:function(a){(a===!0?--n.readyWait:n.isReady)||(n.isReady=!0,a!==!0&&--n.readyWait>0||(H.resolveWith(l,[n]),n.fn.triggerHandler&&(n(l).triggerHandler("ready"),n(l).off("ready"))))}});function I(){l.removeEventListener("DOMContentLoaded",I,!1),a.removeEventListener("load",I,!1),n.ready()}n.ready.promise=function(b){return H||(H=n.Deferred(),"complete"===l.readyState?setTimeout(n.ready):(l.addEventListener("DOMContentLoaded",I,!1),a.addEventListener("load",I,!1))),H.promise(b)},n.ready.promise();var J=n.access=function(a,b,c,d,e,f,g){var h=0,i=a.length,j=null==c;if("object"===n.type(c)){e=!0;for(h in c)n.access(a,b,h,c[h],!0,f,g)}else if(void 0!==d&&(e=!0,n.isFunction(d)||(g=!0),j&&(g?(b.call(a,d),b=null):(j=b,b=function(a,b,c){return j.call(n(a),c)})),b))for(;i>h;h++)b(a[h],c,g?d:d.call(a[h],h,b(a[h],c)));return e?a:j?b.call(a):i?b(a[0],c):f};n.acceptData=function(a){return 1===a.nodeType||9===a.nodeType||!+a.nodeType};function K(){Object.defineProperty(this.cache={},0,{get:function(){return{}}}),this.expando=n.expando+K.uid++}K.uid=1,K.accepts=n.acceptData,K.prototype={key:function(a){if(!K.accepts(a))return 0;var b={},c=a[this.expando];if(!c){c=K.uid++;try{b[this.expando]={value:c},Object.defineProperties(a,b)}catch(d){b[this.expando]=c,n.extend(a,b)}}return this.cache[c]||(this.cache[c]={}),c},set:function(a,b,c){var d,e=this.key(a),f=this.cache[e];if("string"==typeof b)f[b]=c;else if(n.isEmptyObject(f))n.extend(this.cache[e],b);else for(d in b)f[d]=b[d];return f},get:function(a,b){var c=this.cache[this.key(a)];return void 0===b?c:c[b]},access:function(a,b,c){var d;return void 0===b||b&&"string"==typeof b&&void 0===c?(d=this.get(a,b),void 0!==d?d:this.get(a,n.camelCase(b))):(this.set(a,b,c),void 0!==c?c:b)},remove:function(a,b){var c,d,e,f=this.key(a),g=this.cache[f];if(void 0===b)this.cache[f]={};else{n.isArray(b)?d=b.concat(b.map(n.camelCase)):(e=n.camelCase(b),b in g?d=[b,e]:(d=e,d=d in g?[d]:d.match(E)||[])),c=d.length;while(c--)delete g[d[c]]}},hasData:function(a){return!n.isEmptyObject(this.cache[a[this.expando]]||{})},discard:function(a){a[this.expando]&&delete this.cache[a[this.expando]]}};var L=new K,M=new K,N=/^(?:\{[\w\W]*\}|\[[\w\W]*\])$/,O=/([A-Z])/g;function P(a,b,c){var d;if(void 0===c&&1===a.nodeType)if(d="data-"+b.replace(O,"-$1").toLowerCase(),c=a.getAttribute(d),"string"==typeof c){try{c="true"===c?!0:"false"===c?!1:"null"===c?null:+c+""===c?+c:N.test(c)?n.parseJSON(c):c}catch(e){}M.set(a,b,c)}else c=void 0;return c}n.extend({hasData:function(a){return M.hasData(a)||L.hasData(a)},data:function(a,b,c){
return M.access(a,b,c)},removeData:function(a,b){M.remove(a,b)},_data:function(a,b,c){return L.access(a,b,c)},_removeData:function(a,b){L.remove(a,b)}}),n.fn.extend({data:function(a,b){var c,d,e,f=this[0],g=f&&f.attributes;if(void 0===a){if(this.length&&(e=M.get(f),1===f.nodeType&&!L.get(f,"hasDataAttrs"))){c=g.length;while(c--)g[c]&&(d=g[c].name,0===d.indexOf("data-")&&(d=n.camelCase(d.slice(5)),P(f,d,e[d])));L.set(f,"hasDataAttrs",!0)}return e}return"object"==typeof a?this.each(function(){M.set(this,a)}):J(this,function(b){var c,d=n.camelCase(a);if(f&&void 0===b){if(c=M.get(f,a),void 0!==c)return c;if(c=M.get(f,d),void 0!==c)return c;if(c=P(f,d,void 0),void 0!==c)return c}else this.each(function(){var c=M.get(this,d);M.set(this,d,b),-1!==a.indexOf("-")&&void 0!==c&&M.set(this,a,b)})},null,b,arguments.length>1,null,!0)},removeData:function(a){return this.each(function(){M.remove(this,a)})}}),n.extend({queue:function(a,b,c){var d;return a?(b=(b||"fx")+"queue",d=L.get(a,b),c&&(!d||n.isArray(c)?d=L.access(a,b,n.makeArray(c)):d.push(c)),d||[]):void 0},dequeue:function(a,b){b=b||"fx";var c=n.queue(a,b),d=c.length,e=c.shift(),f=n._queueHooks(a,b),g=function(){n.dequeue(a,b)};"inprogress"===e&&(e=c.shift(),d--),e&&("fx"===b&&c.unshift("inprogress"),delete f.stop,e.call(a,g,f)),!d&&f&&f.empty.fire()},_queueHooks:function(a,b){var c=b+"queueHooks";return L.get(a,c)||L.access(a,c,{empty:n.Callbacks("once memory").add(function(){L.remove(a,[b+"queue",c])})})}}),n.fn.extend({queue:function(a,b){var c=2;return"string"!=typeof a&&(b=a,a="fx",c--),arguments.length<c?n.queue(this[0],a):void 0===b?this:this.each(function(){var c=n.queue(this,a,b);n._queueHooks(this,a),"fx"===a&&"inprogress"!==c[0]&&n.dequeue(this,a)})},dequeue:function(a){return this.each(function(){n.dequeue(this,a)})},clearQueue:function(a){return this.queue(a||"fx",[])},promise:function(a,b){var c,d=1,e=n.Deferred(),f=this,g=this.length,h=function(){--d||e.resolveWith(f,[f])};"string"!=typeof a&&(b=a,a=void 0),a=a||"fx";while(g--)c=L.get(f[g],a+"queueHooks"),c&&c.empty&&(d++,c.empty.add(h));return h(),e.promise(b)}});var Q=/[+-]?(?:\d*\.|)\d+(?:[eE][+-]?\d+|)/.source,R=["Top","Right","Bottom","Left"],S=function(a,b){return a=b||a,"none"===n.css(a,"display")||!n.contains(a.ownerDocument,a)},T=/^(?:checkbox|radio)$/i;!function(){var a=l.createDocumentFragment(),b=a.appendChild(l.createElement("div")),c=l.createElement("input");c.setAttribute("type","radio"),c.setAttribute("checked","checked"),c.setAttribute("name","t"),b.appendChild(c),k.checkClone=b.cloneNode(!0).cloneNode(!0).lastChild.checked,b.innerHTML="<textarea>x</textarea>",k.noCloneChecked=!!b.cloneNode(!0).lastChild.defaultValue}();var U="undefined";k.focusinBubbles="onfocusin"in a;var V=/^key/,W=/^(?:mouse|pointer|contextmenu)|click/,X=/^(?:focusinfocus|focusoutblur)$/,Y=/^([^.]*)(?:\.(.+)|)$/;function Z(){return!0}function $(){return!1}function _(){try{return l.activeElement}catch(a){}}n.event={global:{},add:function(a,b,c,d,e){var f,g,h,i,j,k,l,m,o,p,q,r=L.get(a);if(r){c.handler&&(f=c,c=f.handler,e=f.selector),c.guid||(c.guid=n.guid++),(i=r.events)||(i=r.events={}),(g=r.handle)||(g=r.handle=function(b){return typeof n!==U&&n.event.triggered!==b.type?n.event.dispatch.apply(a,arguments):void 0}),b=(b||"").match(E)||[""],j=b.length;while(j--)h=Y.exec(b[j])||[],o=q=h[1],p=(h[2]||"").split(".").sort(),o&&(l=n.event.special[o]||{},o=(e?l.delegateType:l.bindType)||o,l=n.event.special[o]||{},k=n.extend({type:o,origType:q,data:d,handler:c,guid:c.guid,selector:e,needsContext:e&&n.expr.match.needsContext.test(e),namespace:p.join(".")},f),(m=i[o])||(m=i[o]=[],m.delegateCount=0,l.setup&&l.setup.call(a,d,p,g)!==!1||a.addEventListener&&a.addEventListener(o,g,!1)),l.add&&(l.add.call(a,k),k.handler.guid||(k.handler.guid=c.guid)),e?m.splice(m.delegateCount++,0,k):m.push(k),n.event.global[o]=!0)}},remove:function(a,b,c,d,e){var f,g,h,i,j,k,l,m,o,p,q,r=L.hasData(a)&&L.get(a);if(r&&(i=r.events)){b=(b||"").match(E)||[""],j=b.length;while(j--)if(h=Y.exec(b[j])||[],o=q=h[1],p=(h[2]||"").split(".").sort(),o){l=n.event.special[o]||{},o=(d?l.delegateType:l.bindType)||o,m=i[o]||[],h=h[2]&&new RegExp("(^|\\.)"+p.join("\\.(?:.*\\.|)")+"(\\.|$)"),g=f=m.length;while(f--)k=m[f],!e&&q!==k.origType||c&&c.guid!==k.guid||h&&!h.test(k.namespace)||d&&d!==k.selector&&("**"!==d||!k.selector)||(m.splice(f,1),k.selector&&m.delegateCount--,l.remove&&l.remove.call(a,k));g&&!m.length&&(l.teardown&&l.teardown.call(a,p,r.handle)!==!1||n.removeEvent(a,o,r.handle),delete i[o])}else for(o in i)n.event.remove(a,o+b[j],c,d,!0);n.isEmptyObject(i)&&(delete r.handle,L.remove(a,"events"))}},trigger:function(b,c,d,e){var f,g,h,i,k,m,o,p=[d||l],q=j.call(b,"type")?b.type:b,r=j.call(b,"namespace")?b.namespace.split("."):[];if(g=h=d=d||l,3!==d.nodeType&&8!==d.nodeType&&!X.test(q+n.event.triggered)&&(q.indexOf(".")>=0&&(r=q.split("."),q=r.shift(),r.sort()),k=q.indexOf(":")<0&&"on"+q,b=b[n.expando]?b:new n.Event(q,"object"==typeof b&&b),b.isTrigger=e?2:3,b.namespace=r.join("."),b.namespace_re=b.namespace?new RegExp("(^|\\.)"+r.join("\\.(?:.*\\.|)")+"(\\.|$)"):null,b.result=void 0,b.target||(b.target=d),c=null==c?[b]:n.makeArray(c,[b]),o=n.event.special[q]||{},e||!o.trigger||o.trigger.apply(d,c)!==!1)){if(!e&&!o.noBubble&&!n.isWindow(d)){for(i=o.delegateType||q,X.test(i+q)||(g=g.parentNode);g;g=g.parentNode)p.push(g),h=g;h===(d.ownerDocument||l)&&p.push(h.defaultView||h.parentWindow||a)}f=0;while((g=p[f++])&&!b.isPropagationStopped())b.type=f>1?i:o.bindType||q,m=(L.get(g,"events")||{})[b.type]&&L.get(g,"handle"),m&&m.apply(g,c),m=k&&g[k],m&&m.apply&&n.acceptData(g)&&(b.result=m.apply(g,c),b.result===!1&&b.preventDefault());return b.type=q,e||b.isDefaultPrevented()||o._default&&o._default.apply(p.pop(),c)!==!1||!n.acceptData(d)||k&&n.isFunction(d[q])&&!n.isWindow(d)&&(h=d[k],h&&(d[k]=null),n.event.triggered=q,d[q](),n.event.triggered=void 0,h&&(d[k]=h)),b.result}},dispatch:function(a){a=n.event.fix(a);var b,c,e,f,g,h=[],i=d.call(arguments),j=(L.get(this,"events")||{})[a.type]||[],k=n.event.special[a.type]||{};if(i[0]=a,a.delegateTarget=this,!k.preDispatch||k.preDispatch.call(this,a)!==!1){h=n.event.handlers.call(this,a,j),b=0;while((f=h[b++])&&!a.isPropagationStopped()){a.currentTarget=f.elem,c=0;while((g=f.handlers[c++])&&!a.isImmediatePropagationStopped())(!a.namespace_re||a.namespace_re.test(g.namespace))&&(a.handleObj=g,a.data=g.data,e=((n.event.special[g.origType]||{}).handle||g.handler).apply(f.elem,i),void 0!==e&&(a.result=e)===!1&&(a.preventDefault(),a.stopPropagation()))}return k.postDispatch&&k.postDispatch.call(this,a),a.result}},handlers:function(a,b){var c,d,e,f,g=[],h=b.delegateCount,i=a.target;if(h&&i.nodeType&&(!a.button||"click"!==a.type))for(;i!==this;i=i.parentNode||this)if(i.disabled!==!0||"click"!==a.type){for(d=[],c=0;h>c;c++)f=b[c],e=f.selector+" ",void 0===d[e]&&(d[e]=f.needsContext?n(e,this).index(i)>=0:n.find(e,this,null,[i]).length),d[e]&&d.push(f);d.length&&g.push({elem:i,handlers:d})}return h<b.length&&g.push({elem:this,handlers:b.slice(h)}),g},props:"altKey bubbles cancelable ctrlKey currentTarget eventPhase metaKey relatedTarget shiftKey target timeStamp view which".split(" "),fixHooks:{},keyHooks:{props:"char charCode key keyCode".split(" "),filter:function(a,b){return null==a.which&&(a.which=null!=b.charCode?b.charCode:b.keyCode),a}},mouseHooks:{props:"button buttons clientX clientY offsetX offsetY pageX pageY screenX screenY toElement".split(" "),filter:function(a,b){var c,d,e,f=b.button;return null==a.pageX&&null!=b.clientX&&(c=a.target.ownerDocument||l,d=c.documentElement,e=c.body,a.pageX=b.clientX+(d&&d.scrollLeft||e&&e.scrollLeft||0)-(d&&d.clientLeft||e&&e.clientLeft||0),a.pageY=b.clientY+(d&&d.scrollTop||e&&e.scrollTop||0)-(d&&d.clientTop||e&&e.clientTop||0)),a.which||void 0===f||(a.which=1&f?1:2&f?3:4&f?2:0),a}},fix:function(a){if(a[n.expando])return a;var b,c,d,e=a.type,f=a,g=this.fixHooks[e];g||(this.fixHooks[e]=g=W.test(e)?this.mouseHooks:V.test(e)?this.keyHooks:{}),d=g.props?this.props.concat(g.props):this.props,a=new n.Event(f),b=d.length;while(b--)c=d[b],a[c]=f[c];return a.target||(a.target=l),3===a.target.nodeType&&(a.target=a.target.parentNode),g.filter?g.filter(a,f):a},special:{load:{noBubble:!0},focus:{trigger:function(){return this!==_()&&this.focus?(this.focus(),!1):void 0},delegateType:"focusin"},blur:{trigger:function(){return this===_()&&this.blur?(this.blur(),!1):void 0},delegateType:"focusout"},click:{trigger:function(){return"checkbox"===this.type&&this.click&&n.nodeName(this,"input")?(this.click(),!1):void 0},_default:function(a){return n.nodeName(a.target,"a")}},beforeunload:{postDispatch:function(a){void 0!==a.result&&a.originalEvent&&(a.originalEvent.returnValue=a.result)}}},simulate:function(a,b,c,d){var e=n.extend(new n.Event,c,{type:a,isSimulated:!0,originalEvent:{}});d?n.event.trigger(e,null,b):n.event.dispatch.call(b,e),e.isDefaultPrevented()&&c.preventDefault()}},n.removeEvent=function(a,b,c){a.removeEventListener&&a.removeEventListener(b,c,!1)},n.Event=function(a,b){return this instanceof n.Event?(a&&a.type?(this.originalEvent=a,this.type=a.type,this.isDefaultPrevented=a.defaultPrevented||void 0===a.defaultPrevented&&a.returnValue===!1?Z:$):this.type=a,b&&n.extend(this,b),this.timeStamp=a&&a.timeStamp||n.now(),void(this[n.expando]=!0)):new n.Event(a,b)},n.Event.prototype={isDefaultPrevented:$,isPropagationStopped:$,isImmediatePropagationStopped:$,preventDefault:function(){var a=this.originalEvent;this.isDefaultPrevented=Z,a&&a.preventDefault&&a.preventDefault()},stopPropagation:function(){var a=this.originalEvent;this.isPropagationStopped=Z,a&&a.stopPropagation&&a.stopPropagation()},stopImmediatePropagation:function(){var a=this.originalEvent;this.isImmediatePropagationStopped=Z,a&&a.stopImmediatePropagation&&a.stopImmediatePropagation(),this.stopPropagation()}},n.each({mouseenter:"mouseover",mouseleave:"mouseout",pointerenter:"pointerover",pointerleave:"pointerout"},function(a,b){n.event.special[a]={delegateType:b,bindType:b,handle:function(a){var c,d=this,e=a.relatedTarget,f=a.handleObj;return(!e||e!==d&&!n.contains(d,e))&&(a.type=f.origType,c=f.handler.apply(this,arguments),a.type=b),c}}}),k.focusinBubbles||n.each({focus:"focusin",blur:"focusout"},function(a,b){var c=function(a){n.event.simulate(b,a.target,n.event.fix(a),!0)};n.event.special[b]={setup:function(){var d=this.ownerDocument||this,e=L.access(d,b);e||d.addEventListener(a,c,!0),L.access(d,b,(e||0)+1)},teardown:function(){var d=this.ownerDocument||this,e=L.access(d,b)-1;e?L.access(d,b,e):(d.removeEventListener(a,c,!0),L.remove(d,b))}}}),n.fn.extend({on:function(a,b,c,d,e){var f,g;if("object"==typeof a){"string"!=typeof b&&(c=c||b,b=void 0);for(g in a)this.on(g,b,c,a[g],e);return this}if(null==c&&null==d?(d=b,c=b=void 0):null==d&&("string"==typeof b?(d=c,c=void 0):(d=c,c=b,b=void 0)),d===!1)d=$;else if(!d)return this;return 1===e&&(f=d,d=function(a){return n().off(a),f.apply(this,arguments)},d.guid=f.guid||(f.guid=n.guid++)),this.each(function(){n.event.add(this,a,d,c,b)})},one:function(a,b,c,d){return this.on(a,b,c,d,1)},off:function(a,b,c){var d,e;if(a&&a.preventDefault&&a.handleObj)return d=a.handleObj,n(a.delegateTarget).off(d.namespace?d.origType+"."+d.namespace:d.origType,d.selector,d.handler),this;if("object"==typeof a){for(e in a)this.off(e,b,a[e]);return this}return(b===!1||"function"==typeof b)&&(c=b,b=void 0),c===!1&&(c=$),this.each(function(){n.event.remove(this,a,c,b)})},trigger:function(a,b){return this.each(function(){n.event.trigger(a,b,this)})},triggerHandler:function(a,b){var c=this[0];return c?n.event.trigger(a,b,c,!0):void 0}});var aa=/<(?!area|br|col|embed|hr|img|input|link|meta|param)(([\w:]+)[^>]*)\/>/gi,ba=/<([\w:]+)/,ca=/<|&#?\w+;/,da=/<(?:script|style|link)/i,ea=/checked\s*(?:[^=]|=\s*.checked.)/i,fa=/^$|\/(?:java|ecma)script/i,ga=/^true\/(.*)/,ha=/^\s*<!(?:\[CDATA\[|--)|(?:\]\]|--)>\s*$/g,ia={option:[1,"<select multiple='multiple'>","</select>"],thead:[1,"<table>","</table>"],col:[2,"<table><colgroup>","</colgroup></table>"],tr:[2,"<table><tbody>","</tbody></table>"],td:[3,"<table><tbody><tr>","</tr></tbody></table>"],_default:[0,"",""]};ia.optgroup=ia.option,ia.tbody=ia.tfoot=ia.colgroup=ia.caption=ia.thead,ia.th=ia.td;function ja(a,b){return n.nodeName(a,"table")&&n.nodeName(11!==b.nodeType?b:b.firstChild,"tr")?a.getElementsByTagName("tbody")[0]||a.appendChild(a.ownerDocument.createElement("tbody")):a}function ka(a){return a.type=(null!==a.getAttribute("type"))+"/"+a.type,a}function la(a){var b=ga.exec(a.type);return b?a.type=b[1]:a.removeAttribute("type"),a}function ma(a,b){for(var c=0,d=a.length;d>c;c++)L.set(a[c],"globalEval",!b||L.get(b[c],"globalEval"))}function na(a,b){var c,d,e,f,g,h,i,j;if(1===b.nodeType){if(L.hasData(a)&&(f=L.access(a),g=L.set(b,f),j=f.events)){delete g.handle,g.events={};for(e in j)for(c=0,d=j[e].length;d>c;c++)n.event.add(b,e,j[e][c])}M.hasData(a)&&(h=M.access(a),i=n.extend({},h),M.set(b,i))}}function oa(a,b){var c=a.getElementsByTagName?a.getElementsByTagName(b||"*"):a.querySelectorAll?a.querySelectorAll(b||"*"):[];return void 0===b||b&&n.nodeName(a,b)?n.merge([a],c):c}function pa(a,b){var c=b.nodeName.toLowerCase();"input"===c&&T.test(a.type)?b.checked=a.checked:("input"===c||"textarea"===c)&&(b.defaultValue=a.defaultValue)}n.extend({clone:function(a,b,c){var d,e,f,g,h=a.cloneNode(!0),i=n.contains(a.ownerDocument,a);if(!(k.noCloneChecked||1!==a.nodeType&&11!==a.nodeType||n.isXMLDoc(a)))for(g=oa(h),f=oa(a),d=0,e=f.length;e>d;d++)pa(f[d],g[d]);if(b)if(c)for(f=f||oa(a),g=g||oa(h),d=0,e=f.length;e>d;d++)na(f[d],g[d]);else na(a,h);return g=oa(h,"script"),g.length>0&&ma(g,!i&&oa(a,"script")),h},buildFragment:function(a,b,c,d){for(var e,f,g,h,i,j,k=b.createDocumentFragment(),l=[],m=0,o=a.length;o>m;m++)if(e=a[m],e||0===e)if("object"===n.type(e))n.merge(l,e.nodeType?[e]:e);else if(ca.test(e)){f=f||k.appendChild(b.createElement("div")),g=(ba.exec(e)||["",""])[1].toLowerCase(),h=ia[g]||ia._default,f.innerHTML=h[1]+e.replace(aa,"<$1></$2>")+h[2],j=h[0];while(j--)f=f.lastChild;n.merge(l,f.childNodes),f=k.firstChild,f.textContent=""}else l.push(b.createTextNode(e));k.textContent="",m=0;while(e=l[m++])if((!d||-1===n.inArray(e,d))&&(i=n.contains(e.ownerDocument,e),f=oa(k.appendChild(e),"script"),i&&ma(f),c)){j=0;while(e=f[j++])fa.test(e.type||"")&&c.push(e)}return k},cleanData:function(a){for(var b,c,d,e,f=n.event.special,g=0;void 0!==(c=a[g]);g++){if(n.acceptData(c)&&(e=c[L.expando],e&&(b=L.cache[e]))){if(b.events)for(d in b.events)f[d]?n.event.remove(c,d):n.removeEvent(c,d,b.handle);L.cache[e]&&delete L.cache[e]}delete M.cache[c[M.expando]]}}}),n.fn.extend({text:function(a){return J(this,function(a){return void 0===a?n.text(this):this.empty().each(function(){(1===this.nodeType||11===this.nodeType||9===this.nodeType)&&(this.textContent=a)})},null,a,arguments.length)},append:function(){return this.domManip(arguments,function(a){if(1===this.nodeType||11===this.nodeType||9===this.nodeType){var b=ja(this,a);b.appendChild(a)}})},prepend:function(){return this.domManip(arguments,function(a){if(1===this.nodeType||11===this.nodeType||9===this.nodeType){var b=ja(this,a);b.insertBefore(a,b.firstChild)}})},before:function(){return this.domManip(arguments,function(a){this.parentNode&&this.parentNode.insertBefore(a,this)})},after:function(){return this.domManip(arguments,function(a){this.parentNode&&this.parentNode.insertBefore(a,this.nextSibling)})},remove:function(a,b){for(var c,d=a?n.filter(a,this):this,e=0;null!=(c=d[e]);e++)b||1!==c.nodeType||n.cleanData(oa(c)),c.parentNode&&(b&&n.contains(c.ownerDocument,c)&&ma(oa(c,"script")),c.parentNode.removeChild(c));return this},empty:function(){for(var a,b=0;null!=(a=this[b]);b++)1===a.nodeType&&(n.cleanData(oa(a,!1)),a.textContent="");return this},clone:function(a,b){return a=null==a?!1:a,b=null==b?a:b,this.map(function(){return n.clone(this,a,b)})},html:function(a){return J(this,function(a){var b=this[0]||{},c=0,d=this.length;if(void 0===a&&1===b.nodeType)return b.innerHTML;if("string"==typeof a&&!da.test(a)&&!ia[(ba.exec(a)||["",""])[1].toLowerCase()]){a=a.replace(aa,"<$1></$2>");try{for(;d>c;c++)b=this[c]||{},1===b.nodeType&&(n.cleanData(oa(b,!1)),b.innerHTML=a);b=0}catch(e){}}b&&this.empty().append(a)},null,a,arguments.length)},replaceWith:function(){var a=arguments[0];return this.domManip(arguments,function(b){a=this.parentNode,n.cleanData(oa(this)),a&&a.replaceChild(b,this)}),a&&(a.length||a.nodeType)?this:this.remove()},detach:function(a){return this.remove(a,!0)},domManip:function(a,b){a=e.apply([],a);var c,d,f,g,h,i,j=0,l=this.length,m=this,o=l-1,p=a[0],q=n.isFunction(p);if(q||l>1&&"string"==typeof p&&!k.checkClone&&ea.test(p))return this.each(function(c){var d=m.eq(c);q&&(a[0]=p.call(this,c,d.html())),d.domManip(a,b)});if(l&&(c=n.buildFragment(a,this[0].ownerDocument,!1,this),d=c.firstChild,1===c.childNodes.length&&(c=d),d)){for(f=n.map(oa(c,"script"),ka),g=f.length;l>j;j++)h=c,j!==o&&(h=n.clone(h,!0,!0),g&&n.merge(f,oa(h,"script"))),b.call(this[j],h,j);if(g)for(i=f[f.length-1].ownerDocument,n.map(f,la),j=0;g>j;j++)h=f[j],fa.test(h.type||"")&&!L.access(h,"globalEval")&&n.contains(i,h)&&(h.src?n._evalUrl&&n._evalUrl(h.src):n.globalEval(h.textContent.replace(ha,"")))}return this}}),n.each({appendTo:"append",prependTo:"prepend",insertBefore:"before",insertAfter:"after",replaceAll:"replaceWith"},function(a,b){n.fn[a]=function(a){for(var c,d=[],e=n(a),g=e.length-1,h=0;g>=h;h++)c=h===g?this:this.clone(!0),n(e[h])[b](c),f.apply(d,c.get());return this.pushStack(d)}});var qa,ra={};function sa(b,c){var d,e=n(c.createElement(b)).appendTo(c.body),f=a.getDefaultComputedStyle&&(d=a.getDefaultComputedStyle(e[0]))?d.display:n.css(e[0],"display");return e.detach(),f}function ta(a){var b=l,c=ra[a];return c||(c=sa(a,b),"none"!==c&&c||(qa=(qa||n("<iframe frameborder='0' width='0' height='0'/>")).appendTo(b.documentElement),b=qa[0].contentDocument,b.write(),b.close(),c=sa(a,b),qa.detach()),ra[a]=c),c}var ua=/^margin/,va=new RegExp("^("+Q+")(?!px)[a-z%]+$","i"),wa=function(b){return b.ownerDocument.defaultView.opener?b.ownerDocument.defaultView.getComputedStyle(b,null):a.getComputedStyle(b,null)};function xa(a,b,c){var d,e,f,g,h=a.style;return c=c||wa(a),c&&(g=c.getPropertyValue(b)||c[b]),c&&(""!==g||n.contains(a.ownerDocument,a)||(g=n.style(a,b)),va.test(g)&&ua.test(b)&&(d=h.width,e=h.minWidth,f=h.maxWidth,h.minWidth=h.maxWidth=h.width=g,g=c.width,h.width=d,h.minWidth=e,h.maxWidth=f)),void 0!==g?g+"":g}function ya(a,b){return{get:function(){return a()?void delete this.get:(this.get=b).apply(this,arguments)}}}!function(){var b,c,d=l.documentElement,e=l.createElement("div"),f=l.createElement("div");if(f.style){f.style.backgroundClip="content-box",f.cloneNode(!0).style.backgroundClip="",k.clearCloneStyle="content-box"===f.style.backgroundClip,e.style.cssText="border:0;width:0;height:0;top:0;left:-9999px;margin-top:1px;position:absolute",e.appendChild(f);function g(){f.style.cssText="-webkit-box-sizing:border-box;-moz-box-sizing:border-box;box-sizing:border-box;display:block;margin-top:1%;top:1%;border:1px;padding:1px;width:4px;position:absolute",f.innerHTML="",d.appendChild(e);var g=a.getComputedStyle(f,null);b="1%"!==g.top,c="4px"===g.width,d.removeChild(e)}a.getComputedStyle&&n.extend(k,{pixelPosition:function(){return g(),b},boxSizingReliable:function(){return null==c&&g(),c},reliableMarginRight:function(){var b,c=f.appendChild(l.createElement("div"));return c.style.cssText=f.style.cssText="-webkit-box-sizing:content-box;-moz-box-sizing:content-box;box-sizing:content-box;display:block;margin:0;border:0;padding:0",c.style.marginRight=c.style.width="0",f.style.width="1px",d.appendChild(e),b=!parseFloat(a.getComputedStyle(c,null).marginRight),d.removeChild(e),f.removeChild(c),b}})}}(),n.swap=function(a,b,c,d){var e,f,g={};for(f in b)g[f]=a.style[f],a.style[f]=b[f];e=c.apply(a,d||[]);for(f in b)a.style[f]=g[f];return e};var za=/^(none|table(?!-c[ea]).+)/,Aa=new RegExp("^("+Q+")(.*)$","i"),Ba=new RegExp("^([+-])=("+Q+")","i"),Ca={position:"absolute",visibility:"hidden",display:"block"},Da={letterSpacing:"0",fontWeight:"400"},Ea=["Webkit","O","Moz","ms"];function Fa(a,b){if(b in a)return b;var c=b[0].toUpperCase()+b.slice(1),d=b,e=Ea.length;while(e--)if(b=Ea[e]+c,b in a)return b;return d}function Ga(a,b,c){var d=Aa.exec(b);return d?Math.max(0,d[1]-(c||0))+(d[2]||"px"):b}function Ha(a,b,c,d,e){for(var f=c===(d?"border":"content")?4:"width"===b?1:0,g=0;4>f;f+=2)"margin"===c&&(g+=n.css(a,c+R[f],!0,e)),d?("content"===c&&(g-=n.css(a,"padding"+R[f],!0,e)),"margin"!==c&&(g-=n.css(a,"border"+R[f]+"Width",!0,e))):(g+=n.css(a,"padding"+R[f],!0,e),"padding"!==c&&(g+=n.css(a,"border"+R[f]+"Width",!0,e)));return g}function Ia(a,b,c){var d=!0,e="width"===b?a.offsetWidth:a.offsetHeight,f=wa(a),g="border-box"===n.css(a,"boxSizing",!1,f);if(0>=e||null==e){if(e=xa(a,b,f),(0>e||null==e)&&(e=a.style[b]),va.test(e))return e;d=g&&(k.boxSizingReliable()||e===a.style[b]),e=parseFloat(e)||0}return e+Ha(a,b,c||(g?"border":"content"),d,f)+"px"}function Ja(a,b){for(var c,d,e,f=[],g=0,h=a.length;h>g;g++)d=a[g],d.style&&(f[g]=L.get(d,"olddisplay"),c=d.style.display,b?(f[g]||"none"!==c||(d.style.display=""),""===d.style.display&&S(d)&&(f[g]=L.access(d,"olddisplay",ta(d.nodeName)))):(e=S(d),"none"===c&&e||L.set(d,"olddisplay",e?c:n.css(d,"display"))));for(g=0;h>g;g++)d=a[g],d.style&&(b&&"none"!==d.style.display&&""!==d.style.display||(d.style.display=b?f[g]||"":"none"));return a}n.extend({cssHooks:{opacity:{get:function(a,b){if(b){var c=xa(a,"opacity");return""===c?"1":c}}}},cssNumber:{columnCount:!0,fillOpacity:!0,flexGrow:!0,flexShrink:!0,fontWeight:!0,lineHeight:!0,opacity:!0,order:!0,orphans:!0,widows:!0,zIndex:!0,zoom:!0},cssProps:{"float":"cssFloat"},style:function(a,b,c,d){if(a&&3!==a.nodeType&&8!==a.nodeType&&a.style){var e,f,g,h=n.camelCase(b),i=a.style;return b=n.cssProps[h]||(n.cssProps[h]=Fa(i,h)),g=n.cssHooks[b]||n.cssHooks[h],void 0===c?g&&"get"in g&&void 0!==(e=g.get(a,!1,d))?e:i[b]:(f=typeof c,"string"===f&&(e=Ba.exec(c))&&(c=(e[1]+1)*e[2]+parseFloat(n.css(a,b)),f="number"),null!=c&&c===c&&("number"!==f||n.cssNumber[h]||(c+="px"),k.clearCloneStyle||""!==c||0!==b.indexOf("background")||(i[b]="inherit"),g&&"set"in g&&void 0===(c=g.set(a,c,d))||(i[b]=c)),void 0)}},css:function(a,b,c,d){var e,f,g,h=n.camelCase(b);return b=n.cssProps[h]||(n.cssProps[h]=Fa(a.style,h)),g=n.cssHooks[b]||n.cssHooks[h],g&&"get"in g&&(e=g.get(a,!0,c)),void 0===e&&(e=xa(a,b,d)),"normal"===e&&b in Da&&(e=Da[b]),""===c||c?(f=parseFloat(e),c===!0||n.isNumeric(f)?f||0:e):e}}),n.each(["height","width"],function(a,b){n.cssHooks[b]={get:function(a,c,d){return c?za.test(n.css(a,"display"))&&0===a.offsetWidth?n.swap(a,Ca,function(){return Ia(a,b,d)}):Ia(a,b,d):void 0},set:function(a,c,d){var e=d&&wa(a);return Ga(a,c,d?Ha(a,b,d,"border-box"===n.css(a,"boxSizing",!1,e),e):0)}}}),n.cssHooks.marginRight=ya(k.reliableMarginRight,function(a,b){return b?n.swap(a,{display:"inline-block"},xa,[a,"marginRight"]):void 0}),n.each({margin:"",padding:"",border:"Width"},function(a,b){n.cssHooks[a+b]={expand:function(c){for(var d=0,e={},f="string"==typeof c?c.split(" "):[c];4>d;d++)e[a+R[d]+b]=f[d]||f[d-2]||f[0];return e}},ua.test(a)||(n.cssHooks[a+b].set=Ga)}),n.fn.extend({css:function(a,b){return J(this,function(a,b,c){var d,e,f={},g=0;if(n.isArray(b)){for(d=wa(a),e=b.length;e>g;g++)f[b[g]]=n.css(a,b[g],!1,d);return f}return void 0!==c?n.style(a,b,c):n.css(a,b)},a,b,arguments.length>1)},show:function(){return Ja(this,!0)},hide:function(){return Ja(this)},toggle:function(a){return"boolean"==typeof a?a?this.show():this.hide():this.each(function(){S(this)?n(this).show():n(this).hide()})}});function Ka(a,b,c,d,e){return new Ka.prototype.init(a,b,c,d,e)}n.Tween=Ka,Ka.prototype={constructor:Ka,init:function(a,b,c,d,e,f){this.elem=a,this.prop=c,this.easing=e||"swing",this.options=b,this.start=this.now=this.cur(),this.end=d,this.unit=f||(n.cssNumber[c]?"":"px")},cur:function(){var a=Ka.propHooks[this.prop];return a&&a.get?a.get(this):Ka.propHooks._default.get(this)},run:function(a){var b,c=Ka.propHooks[this.prop];return this.options.duration?this.pos=b=n.easing[this.easing](a,this.options.duration*a,0,1,this.options.duration):this.pos=b=a,this.now=(this.end-this.start)*b+this.start,this.options.step&&this.options.step.call(this.elem,this.now,this),c&&c.set?c.set(this):Ka.propHooks._default.set(this),this}},Ka.prototype.init.prototype=Ka.prototype,Ka.propHooks={_default:{get:function(a){var b;return null==a.elem[a.prop]||a.elem.style&&null!=a.elem.style[a.prop]?(b=n.css(a.elem,a.prop,""),b&&"auto"!==b?b:0):a.elem[a.prop]},set:function(a){n.fx.step[a.prop]?n.fx.step[a.prop](a):a.elem.style&&(null!=a.elem.style[n.cssProps[a.prop]]||n.cssHooks[a.prop])?n.style(a.elem,a.prop,a.now+a.unit):a.elem[a.prop]=a.now}}},Ka.propHooks.scrollTop=Ka.propHooks.scrollLeft={set:function(a){a.elem.nodeType&&a.elem.parentNode&&(a.elem[a.prop]=a.now)}},n.easing={linear:function(a){return a},swing:function(a){return.5-Math.cos(a*Math.PI)/2}},n.fx=Ka.prototype.init,n.fx.step={};var La,Ma,Na=/^(?:toggle|show|hide)$/,Oa=new RegExp("^(?:([+-])=|)("+Q+")([a-z%]*)$","i"),Pa=/queueHooks$/,Qa=[Va],Ra={"*":[function(a,b){var c=this.createTween(a,b),d=c.cur(),e=Oa.exec(b),f=e&&e[3]||(n.cssNumber[a]?"":"px"),g=(n.cssNumber[a]||"px"!==f&&+d)&&Oa.exec(n.css(c.elem,a)),h=1,i=20;if(g&&g[3]!==f){f=f||g[3],e=e||[],g=+d||1;do h=h||".5",g/=h,n.style(c.elem,a,g+f);while(h!==(h=c.cur()/d)&&1!==h&&--i)}return e&&(g=c.start=+g||+d||0,c.unit=f,c.end=e[1]?g+(e[1]+1)*e[2]:+e[2]),c}]};function Sa(){return setTimeout(function(){La=void 0}),La=n.now()}function Ta(a,b){var c,d=0,e={height:a};for(b=b?1:0;4>d;d+=2-b)c=R[d],e["margin"+c]=e["padding"+c]=a;return b&&(e.opacity=e.width=a),e}function Ua(a,b,c){for(var d,e=(Ra[b]||[]).concat(Ra["*"]),f=0,g=e.length;g>f;f++)if(d=e[f].call(c,b,a))return d}function Va(a,b,c){var d,e,f,g,h,i,j,k,l=this,m={},o=a.style,p=a.nodeType&&S(a),q=L.get(a,"fxshow");c.queue||(h=n._queueHooks(a,"fx"),null==h.unqueued&&(h.unqueued=0,i=h.empty.fire,h.empty.fire=function(){h.unqueued||i()}),h.unqueued++,l.always(function(){l.always(function(){h.unqueued--,n.queue(a,"fx").length||h.empty.fire()})})),1===a.nodeType&&("height"in b||"width"in b)&&(c.overflow=[o.overflow,o.overflowX,o.overflowY],j=n.css(a,"display"),k="none"===j?L.get(a,"olddisplay")||ta(a.nodeName):j,"inline"===k&&"none"===n.css(a,"float")&&(o.display="inline-block")),c.overflow&&(o.overflow="hidden",l.always(function(){o.overflow=c.overflow[0],o.overflowX=c.overflow[1],o.overflowY=c.overflow[2]}));for(d in b)if(e=b[d],Na.exec(e)){if(delete b[d],f=f||"toggle"===e,e===(p?"hide":"show")){if("show"!==e||!q||void 0===q[d])continue;p=!0}m[d]=q&&q[d]||n.style(a,d)}else j=void 0;if(n.isEmptyObject(m))"inline"===("none"===j?ta(a.nodeName):j)&&(o.display=j);else{q?"hidden"in q&&(p=q.hidden):q=L.access(a,"fxshow",{}),f&&(q.hidden=!p),p?n(a).show():l.done(function(){n(a).hide()}),l.done(function(){var b;L.remove(a,"fxshow");for(b in m)n.style(a,b,m[b])});for(d in m)g=Ua(p?q[d]:0,d,l),d in q||(q[d]=g.start,p&&(g.end=g.start,g.start="width"===d||"height"===d?1:0))}}function Wa(a,b){var c,d,e,f,g;for(c in a)if(d=n.camelCase(c),e=b[d],f=a[c],n.isArray(f)&&(e=f[1],f=a[c]=f[0]),c!==d&&(a[d]=f,delete a[c]),g=n.cssHooks[d],g&&"expand"in g){f=g.expand(f),delete a[d];for(c in f)c in a||(a[c]=f[c],b[c]=e)}else b[d]=e}function Xa(a,b,c){var d,e,f=0,g=Qa.length,h=n.Deferred().always(function(){delete i.elem}),i=function(){if(e)return!1;for(var b=La||Sa(),c=Math.max(0,j.startTime+j.duration-b),d=c/j.duration||0,f=1-d,g=0,i=j.tweens.length;i>g;g++)j.tweens[g].run(f);return h.notifyWith(a,[j,f,c]),1>f&&i?c:(h.resolveWith(a,[j]),!1)},j=h.promise({elem:a,props:n.extend({},b),opts:n.extend(!0,{specialEasing:{}},c),originalProperties:b,originalOptions:c,startTime:La||Sa(),duration:c.duration,tweens:[],createTween:function(b,c){var d=n.Tween(a,j.opts,b,c,j.opts.specialEasing[b]||j.opts.easing);return j.tweens.push(d),d},stop:function(b){var c=0,d=b?j.tweens.length:0;if(e)return this;for(e=!0;d>c;c++)j.tweens[c].run(1);return b?h.resolveWith(a,[j,b]):h.rejectWith(a,[j,b]),this}}),k=j.props;for(Wa(k,j.opts.specialEasing);g>f;f++)if(d=Qa[f].call(j,a,k,j.opts))return d;return n.map(k,Ua,j),n.isFunction(j.opts.start)&&j.opts.start.call(a,j),n.fx.timer(n.extend(i,{elem:a,anim:j,queue:j.opts.queue})),j.progress(j.opts.progress).done(j.opts.done,j.opts.complete).fail(j.opts.fail).always(j.opts.always)}n.Animation=n.extend(Xa,{tweener:function(a,b){n.isFunction(a)?(b=a,a=["*"]):a=a.split(" ");for(var c,d=0,e=a.length;e>d;d++)c=a[d],Ra[c]=Ra[c]||[],Ra[c].unshift(b)},prefilter:function(a,b){b?Qa.unshift(a):Qa.push(a)}}),n.speed=function(a,b,c){var d=a&&"object"==typeof a?n.extend({},a):{complete:c||!c&&b||n.isFunction(a)&&a,duration:a,easing:c&&b||b&&!n.isFunction(b)&&b};return d.duration=n.fx.off?0:"number"==typeof d.duration?d.duration:d.duration in n.fx.speeds?n.fx.speeds[d.duration]:n.fx.speeds._default,(null==d.queue||d.queue===!0)&&(d.queue="fx"),d.old=d.complete,d.complete=function(){n.isFunction(d.old)&&d.old.call(this),d.queue&&n.dequeue(this,d.queue)},d},n.fn.extend({fadeTo:function(a,b,c,d){return this.filter(S).css("opacity",0).show().end().animate({opacity:b},a,c,d)},animate:function(a,b,c,d){var e=n.isEmptyObject(a),f=n.speed(b,c,d),g=function(){var b=Xa(this,n.extend({},a),f);(e||L.get(this,"finish"))&&b.stop(!0)};return g.finish=g,e||f.queue===!1?this.each(g):this.queue(f.queue,g)},stop:function(a,b,c){var d=function(a){var b=a.stop;delete a.stop,b(c)};return"string"!=typeof a&&(c=b,b=a,a=void 0),b&&a!==!1&&this.queue(a||"fx",[]),this.each(function(){var b=!0,e=null!=a&&a+"queueHooks",f=n.timers,g=L.get(this);if(e)g[e]&&g[e].stop&&d(g[e]);else for(e in g)g[e]&&g[e].stop&&Pa.test(e)&&d(g[e]);for(e=f.length;e--;)f[e].elem!==this||null!=a&&f[e].queue!==a||(f[e].anim.stop(c),b=!1,f.splice(e,1));(b||!c)&&n.dequeue(this,a)})},finish:function(a){return a!==!1&&(a=a||"fx"),this.each(function(){var b,c=L.get(this),d=c[a+"queue"],e=c[a+"queueHooks"],f=n.timers,g=d?d.length:0;for(c.finish=!0,n.queue(this,a,[]),e&&e.stop&&e.stop.call(this,!0),b=f.length;b--;)f[b].elem===this&&f[b].queue===a&&(f[b].anim.stop(!0),f.splice(b,1));for(b=0;g>b;b++)d[b]&&d[b].finish&&d[b].finish.call(this);delete c.finish})}}),n.each(["toggle","show","hide"],function(a,b){var c=n.fn[b];n.fn[b]=function(a,d,e){return null==a||"boolean"==typeof a?c.apply(this,arguments):this.animate(Ta(b,!0),a,d,e)}}),n.each({slideDown:Ta("show"),slideUp:Ta("hide"),slideToggle:Ta("toggle"),fadeIn:{opacity:"show"},fadeOut:{opacity:"hide"},fadeToggle:{opacity:"toggle"}},function(a,b){n.fn[a]=function(a,c,d){return this.animate(b,a,c,d)}}),n.timers=[],n.fx.tick=function(){var a,b=0,c=n.timers;for(La=n.now();b<c.length;b++)a=c[b],a()||c[b]!==a||c.splice(b--,1);c.length||n.fx.stop(),La=void 0},n.fx.timer=function(a){n.timers.push(a),a()?n.fx.start():n.timers.pop()},n.fx.interval=13,n.fx.start=function(){Ma||(Ma=setInterval(n.fx.tick,n.fx.interval))},n.fx.stop=function(){clearInterval(Ma),Ma=null},n.fx.speeds={slow:600,fast:200,_default:400},n.fn.delay=function(a,b){return a=n.fx?n.fx.speeds[a]||a:a,b=b||"fx",this.queue(b,function(b,c){var d=setTimeout(b,a);c.stop=function(){clearTimeout(d)}})},function(){var a=l.createElement("input"),b=l.createElement("select"),c=b.appendChild(l.createElement("option"));a.type="checkbox",k.checkOn=""!==a.value,k.optSelected=c.selected,b.disabled=!0,k.optDisabled=!c.disabled,a=l.createElement("input"),a.value="t",a.type="radio",k.radioValue="t"===a.value}();var Ya,Za,$a=n.expr.attrHandle;n.fn.extend({attr:function(a,b){return J(this,n.attr,a,b,arguments.length>1)},removeAttr:function(a){return this.each(function(){n.removeAttr(this,a)})}}),n.extend({attr:function(a,b,c){var d,e,f=a.nodeType;if(a&&3!==f&&8!==f&&2!==f)return typeof a.getAttribute===U?n.prop(a,b,c):(1===f&&n.isXMLDoc(a)||(b=b.toLowerCase(),d=n.attrHooks[b]||(n.expr.match.bool.test(b)?Za:Ya)),
void 0===c?d&&"get"in d&&null!==(e=d.get(a,b))?e:(e=n.find.attr(a,b),null==e?void 0:e):null!==c?d&&"set"in d&&void 0!==(e=d.set(a,c,b))?e:(a.setAttribute(b,c+""),c):void n.removeAttr(a,b))},removeAttr:function(a,b){var c,d,e=0,f=b&&b.match(E);if(f&&1===a.nodeType)while(c=f[e++])d=n.propFix[c]||c,n.expr.match.bool.test(c)&&(a[d]=!1),a.removeAttribute(c)},attrHooks:{type:{set:function(a,b){if(!k.radioValue&&"radio"===b&&n.nodeName(a,"input")){var c=a.value;return a.setAttribute("type",b),c&&(a.value=c),b}}}}}),Za={set:function(a,b,c){return b===!1?n.removeAttr(a,c):a.setAttribute(c,c),c}},n.each(n.expr.match.bool.source.match(/\w+/g),function(a,b){var c=$a[b]||n.find.attr;$a[b]=function(a,b,d){var e,f;return d||(f=$a[b],$a[b]=e,e=null!=c(a,b,d)?b.toLowerCase():null,$a[b]=f),e}});var _a=/^(?:input|select|textarea|button)$/i;n.fn.extend({prop:function(a,b){return J(this,n.prop,a,b,arguments.length>1)},removeProp:function(a){return this.each(function(){delete this[n.propFix[a]||a]})}}),n.extend({propFix:{"for":"htmlFor","class":"className"},prop:function(a,b,c){var d,e,f,g=a.nodeType;if(a&&3!==g&&8!==g&&2!==g)return f=1!==g||!n.isXMLDoc(a),f&&(b=n.propFix[b]||b,e=n.propHooks[b]),void 0!==c?e&&"set"in e&&void 0!==(d=e.set(a,c,b))?d:a[b]=c:e&&"get"in e&&null!==(d=e.get(a,b))?d:a[b]},propHooks:{tabIndex:{get:function(a){return a.hasAttribute("tabindex")||_a.test(a.nodeName)||a.href?a.tabIndex:-1}}}}),k.optSelected||(n.propHooks.selected={get:function(a){var b=a.parentNode;return b&&b.parentNode&&b.parentNode.selectedIndex,null}}),n.each(["tabIndex","readOnly","maxLength","cellSpacing","cellPadding","rowSpan","colSpan","useMap","frameBorder","contentEditable"],function(){n.propFix[this.toLowerCase()]=this});var ab=/[\t\r\n\f]/g;n.fn.extend({addClass:function(a){var b,c,d,e,f,g,h="string"==typeof a&&a,i=0,j=this.length;if(n.isFunction(a))return this.each(function(b){n(this).addClass(a.call(this,b,this.className))});if(h)for(b=(a||"").match(E)||[];j>i;i++)if(c=this[i],d=1===c.nodeType&&(c.className?(" "+c.className+" ").replace(ab," "):" ")){f=0;while(e=b[f++])d.indexOf(" "+e+" ")<0&&(d+=e+" ");g=n.trim(d),c.className!==g&&(c.className=g)}return this},removeClass:function(a){var b,c,d,e,f,g,h=0===arguments.length||"string"==typeof a&&a,i=0,j=this.length;if(n.isFunction(a))return this.each(function(b){n(this).removeClass(a.call(this,b,this.className))});if(h)for(b=(a||"").match(E)||[];j>i;i++)if(c=this[i],d=1===c.nodeType&&(c.className?(" "+c.className+" ").replace(ab," "):"")){f=0;while(e=b[f++])while(d.indexOf(" "+e+" ")>=0)d=d.replace(" "+e+" "," ");g=a?n.trim(d):"",c.className!==g&&(c.className=g)}return this},toggleClass:function(a,b){var c=typeof a;return"boolean"==typeof b&&"string"===c?b?this.addClass(a):this.removeClass(a):this.each(n.isFunction(a)?function(c){n(this).toggleClass(a.call(this,c,this.className,b),b)}:function(){if("string"===c){var b,d=0,e=n(this),f=a.match(E)||[];while(b=f[d++])e.hasClass(b)?e.removeClass(b):e.addClass(b)}else(c===U||"boolean"===c)&&(this.className&&L.set(this,"__className__",this.className),this.className=this.className||a===!1?"":L.get(this,"__className__")||"")})},hasClass:function(a){for(var b=" "+a+" ",c=0,d=this.length;d>c;c++)if(1===this[c].nodeType&&(" "+this[c].className+" ").replace(ab," ").indexOf(b)>=0)return!0;return!1}});var bb=/\r/g;n.fn.extend({val:function(a){var b,c,d,e=this[0];{if(arguments.length)return d=n.isFunction(a),this.each(function(c){var e;1===this.nodeType&&(e=d?a.call(this,c,n(this).val()):a,null==e?e="":"number"==typeof e?e+="":n.isArray(e)&&(e=n.map(e,function(a){return null==a?"":a+""})),b=n.valHooks[this.type]||n.valHooks[this.nodeName.toLowerCase()],b&&"set"in b&&void 0!==b.set(this,e,"value")||(this.value=e))});if(e)return b=n.valHooks[e.type]||n.valHooks[e.nodeName.toLowerCase()],b&&"get"in b&&void 0!==(c=b.get(e,"value"))?c:(c=e.value,"string"==typeof c?c.replace(bb,""):null==c?"":c)}}}),n.extend({valHooks:{option:{get:function(a){var b=n.find.attr(a,"value");return null!=b?b:n.trim(n.text(a))}},select:{get:function(a){for(var b,c,d=a.options,e=a.selectedIndex,f="select-one"===a.type||0>e,g=f?null:[],h=f?e+1:d.length,i=0>e?h:f?e:0;h>i;i++)if(c=d[i],!(!c.selected&&i!==e||(k.optDisabled?c.disabled:null!==c.getAttribute("disabled"))||c.parentNode.disabled&&n.nodeName(c.parentNode,"optgroup"))){if(b=n(c).val(),f)return b;g.push(b)}return g},set:function(a,b){var c,d,e=a.options,f=n.makeArray(b),g=e.length;while(g--)d=e[g],(d.selected=n.inArray(d.value,f)>=0)&&(c=!0);return c||(a.selectedIndex=-1),f}}}}),n.each(["radio","checkbox"],function(){n.valHooks[this]={set:function(a,b){return n.isArray(b)?a.checked=n.inArray(n(a).val(),b)>=0:void 0}},k.checkOn||(n.valHooks[this].get=function(a){return null===a.getAttribute("value")?"on":a.value})}),n.each("blur focus focusin focusout load resize scroll unload click dblclick mousedown mouseup mousemove mouseover mouseout mouseenter mouseleave change select submit keydown keypress keyup error contextmenu".split(" "),function(a,b){n.fn[b]=function(a,c){return arguments.length>0?this.on(b,null,a,c):this.trigger(b)}}),n.fn.extend({hover:function(a,b){return this.mouseenter(a).mouseleave(b||a)},bind:function(a,b,c){return this.on(a,null,b,c)},unbind:function(a,b){return this.off(a,null,b)},delegate:function(a,b,c,d){return this.on(b,a,c,d)},undelegate:function(a,b,c){return 1===arguments.length?this.off(a,"**"):this.off(b,a||"**",c)}});var cb=n.now(),db=/\?/;n.parseJSON=function(a){return JSON.parse(a+"")},n.parseXML=function(a){var b,c;if(!a||"string"!=typeof a)return null;try{c=new DOMParser,b=c.parseFromString(a,"text/xml")}catch(d){b=void 0}return(!b||b.getElementsByTagName("parsererror").length)&&n.error("Invalid XML: "+a),b};var eb=/#.*$/,fb=/([?&])_=[^&]*/,gb=/^(.*?):[ \t]*([^\r\n]*)$/gm,hb=/^(?:about|app|app-storage|.+-extension|file|res|widget):$/,ib=/^(?:GET|HEAD)$/,jb=/^\/\//,kb=/^([\w.+-]+:)(?:\/\/(?:[^\/?#]*@|)([^\/?#:]*)(?::(\d+)|)|)/,lb={},mb={},nb="*/".concat("*"),ob=a.location.href,pb=kb.exec(ob.toLowerCase())||[];function qb(a){return function(b,c){"string"!=typeof b&&(c=b,b="*");var d,e=0,f=b.toLowerCase().match(E)||[];if(n.isFunction(c))while(d=f[e++])"+"===d[0]?(d=d.slice(1)||"*",(a[d]=a[d]||[]).unshift(c)):(a[d]=a[d]||[]).push(c)}}function rb(a,b,c,d){var e={},f=a===mb;function g(h){var i;return e[h]=!0,n.each(a[h]||[],function(a,h){var j=h(b,c,d);return"string"!=typeof j||f||e[j]?f?!(i=j):void 0:(b.dataTypes.unshift(j),g(j),!1)}),i}return g(b.dataTypes[0])||!e["*"]&&g("*")}function sb(a,b){var c,d,e=n.ajaxSettings.flatOptions||{};for(c in b)void 0!==b[c]&&((e[c]?a:d||(d={}))[c]=b[c]);return d&&n.extend(!0,a,d),a}function tb(a,b,c){var d,e,f,g,h=a.contents,i=a.dataTypes;while("*"===i[0])i.shift(),void 0===d&&(d=a.mimeType||b.getResponseHeader("Content-Type"));if(d)for(e in h)if(h[e]&&h[e].test(d)){i.unshift(e);break}if(i[0]in c)f=i[0];else{for(e in c){if(!i[0]||a.converters[e+" "+i[0]]){f=e;break}g||(g=e)}f=f||g}return f?(f!==i[0]&&i.unshift(f),c[f]):void 0}function ub(a,b,c,d){var e,f,g,h,i,j={},k=a.dataTypes.slice();if(k[1])for(g in a.converters)j[g.toLowerCase()]=a.converters[g];f=k.shift();while(f)if(a.responseFields[f]&&(c[a.responseFields[f]]=b),!i&&d&&a.dataFilter&&(b=a.dataFilter(b,a.dataType)),i=f,f=k.shift())if("*"===f)f=i;else if("*"!==i&&i!==f){if(g=j[i+" "+f]||j["* "+f],!g)for(e in j)if(h=e.split(" "),h[1]===f&&(g=j[i+" "+h[0]]||j["* "+h[0]])){g===!0?g=j[e]:j[e]!==!0&&(f=h[0],k.unshift(h[1]));break}if(g!==!0)if(g&&a["throws"])b=g(b);else try{b=g(b)}catch(l){return{state:"parsererror",error:g?l:"No conversion from "+i+" to "+f}}}return{state:"success",data:b}}n.extend({active:0,lastModified:{},etag:{},ajaxSettings:{url:ob,type:"GET",isLocal:hb.test(pb[1]),global:!0,processData:!0,async:!0,contentType:"application/x-www-form-urlencoded; charset=UTF-8",accepts:{"*":nb,text:"text/plain",html:"text/html",xml:"application/xml, text/xml",json:"application/json, text/javascript"},contents:{xml:/xml/,html:/html/,json:/json/},responseFields:{xml:"responseXML",text:"responseText",json:"responseJSON"},converters:{"* text":String,"text html":!0,"text json":n.parseJSON,"text xml":n.parseXML},flatOptions:{url:!0,context:!0}},ajaxSetup:function(a,b){return b?sb(sb(a,n.ajaxSettings),b):sb(n.ajaxSettings,a)},ajaxPrefilter:qb(lb),ajaxTransport:qb(mb),ajax:function(a,b){"object"==typeof a&&(b=a,a=void 0),b=b||{};var c,d,e,f,g,h,i,j,k=n.ajaxSetup({},b),l=k.context||k,m=k.context&&(l.nodeType||l.jquery)?n(l):n.event,o=n.Deferred(),p=n.Callbacks("once memory"),q=k.statusCode||{},r={},s={},t=0,u="canceled",v={readyState:0,getResponseHeader:function(a){var b;if(2===t){if(!f){f={};while(b=gb.exec(e))f[b[1].toLowerCase()]=b[2]}b=f[a.toLowerCase()]}return null==b?null:b},getAllResponseHeaders:function(){return 2===t?e:null},setRequestHeader:function(a,b){var c=a.toLowerCase();return t||(a=s[c]=s[c]||a,r[a]=b),this},overrideMimeType:function(a){return t||(k.mimeType=a),this},statusCode:function(a){var b;if(a)if(2>t)for(b in a)q[b]=[q[b],a[b]];else v.always(a[v.status]);return this},abort:function(a){var b=a||u;return c&&c.abort(b),x(0,b),this}};if(o.promise(v).complete=p.add,v.success=v.done,v.error=v.fail,k.url=((a||k.url||ob)+"").replace(eb,"").replace(jb,pb[1]+"//"),k.type=b.method||b.type||k.method||k.type,k.dataTypes=n.trim(k.dataType||"*").toLowerCase().match(E)||[""],null==k.crossDomain&&(h=kb.exec(k.url.toLowerCase()),k.crossDomain=!(!h||h[1]===pb[1]&&h[2]===pb[2]&&(h[3]||("http:"===h[1]?"80":"443"))===(pb[3]||("http:"===pb[1]?"80":"443")))),k.data&&k.processData&&"string"!=typeof k.data&&(k.data=n.param(k.data,k.traditional)),rb(lb,k,b,v),2===t)return v;i=n.event&&k.global,i&&0===n.active++&&n.event.trigger("ajaxStart"),k.type=k.type.toUpperCase(),k.hasContent=!ib.test(k.type),d=k.url,k.hasContent||(k.data&&(d=k.url+=(db.test(d)?"&":"?")+k.data,delete k.data),k.cache===!1&&(k.url=fb.test(d)?d.replace(fb,"$1_="+cb++):d+(db.test(d)?"&":"?")+"_="+cb++)),k.ifModified&&(n.lastModified[d]&&v.setRequestHeader("If-Modified-Since",n.lastModified[d]),n.etag[d]&&v.setRequestHeader("If-None-Match",n.etag[d])),(k.data&&k.hasContent&&k.contentType!==!1||b.contentType)&&v.setRequestHeader("Content-Type",k.contentType),v.setRequestHeader("Accept",k.dataTypes[0]&&k.accepts[k.dataTypes[0]]?k.accepts[k.dataTypes[0]]+("*"!==k.dataTypes[0]?", "+nb+"; q=0.01":""):k.accepts["*"]);for(j in k.headers)v.setRequestHeader(j,k.headers[j]);if(k.beforeSend&&(k.beforeSend.call(l,v,k)===!1||2===t))return v.abort();u="abort";for(j in{success:1,error:1,complete:1})v[j](k[j]);if(c=rb(mb,k,b,v)){v.readyState=1,i&&m.trigger("ajaxSend",[v,k]),k.async&&k.timeout>0&&(g=setTimeout(function(){v.abort("timeout")},k.timeout));try{t=1,c.send(r,x)}catch(w){if(!(2>t))throw w;x(-1,w)}}else x(-1,"No Transport");function x(a,b,f,h){var j,r,s,u,w,x=b;2!==t&&(t=2,g&&clearTimeout(g),c=void 0,e=h||"",v.readyState=a>0?4:0,j=a>=200&&300>a||304===a,f&&(u=tb(k,v,f)),u=ub(k,u,v,j),j?(k.ifModified&&(w=v.getResponseHeader("Last-Modified"),w&&(n.lastModified[d]=w),w=v.getResponseHeader("etag"),w&&(n.etag[d]=w)),204===a||"HEAD"===k.type?x="nocontent":304===a?x="notmodified":(x=u.state,r=u.data,s=u.error,j=!s)):(s=x,(a||!x)&&(x="error",0>a&&(a=0))),v.status=a,v.statusText=(b||x)+"",j?o.resolveWith(l,[r,x,v]):o.rejectWith(l,[v,x,s]),v.statusCode(q),q=void 0,i&&m.trigger(j?"ajaxSuccess":"ajaxError",[v,k,j?r:s]),p.fireWith(l,[v,x]),i&&(m.trigger("ajaxComplete",[v,k]),--n.active||n.event.trigger("ajaxStop")))}return v},getJSON:function(a,b,c){return n.get(a,b,c,"json")},getScript:function(a,b){return n.get(a,void 0,b,"script")}}),n.each(["get","post"],function(a,b){n[b]=function(a,c,d,e){return n.isFunction(c)&&(e=e||d,d=c,c=void 0),n.ajax({url:a,type:b,dataType:e,data:c,success:d})}}),n._evalUrl=function(a){return n.ajax({url:a,type:"GET",dataType:"script",async:!1,global:!1,"throws":!0})},n.fn.extend({wrapAll:function(a){var b;return n.isFunction(a)?this.each(function(b){n(this).wrapAll(a.call(this,b))}):(this[0]&&(b=n(a,this[0].ownerDocument).eq(0).clone(!0),this[0].parentNode&&b.insertBefore(this[0]),b.map(function(){var a=this;while(a.firstElementChild)a=a.firstElementChild;return a}).append(this)),this)},wrapInner:function(a){return this.each(n.isFunction(a)?function(b){n(this).wrapInner(a.call(this,b))}:function(){var b=n(this),c=b.contents();c.length?c.wrapAll(a):b.append(a)})},wrap:function(a){var b=n.isFunction(a);return this.each(function(c){n(this).wrapAll(b?a.call(this,c):a)})},unwrap:function(){return this.parent().each(function(){n.nodeName(this,"body")||n(this).replaceWith(this.childNodes)}).end()}}),n.expr.filters.hidden=function(a){return a.offsetWidth<=0&&a.offsetHeight<=0},n.expr.filters.visible=function(a){return!n.expr.filters.hidden(a)};var vb=/%20/g,wb=/\[\]$/,xb=/\r?\n/g,yb=/^(?:submit|button|image|reset|file)$/i,zb=/^(?:input|select|textarea|keygen)/i;function Ab(a,b,c,d){var e;if(n.isArray(b))n.each(b,function(b,e){c||wb.test(a)?d(a,e):Ab(a+"["+("object"==typeof e?b:"")+"]",e,c,d)});else if(c||"object"!==n.type(b))d(a,b);else for(e in b)Ab(a+"["+e+"]",b[e],c,d)}n.param=function(a,b){var c,d=[],e=function(a,b){b=n.isFunction(b)?b():null==b?"":b,d[d.length]=encodeURIComponent(a)+"="+encodeURIComponent(b)};if(void 0===b&&(b=n.ajaxSettings&&n.ajaxSettings.traditional),n.isArray(a)||a.jquery&&!n.isPlainObject(a))n.each(a,function(){e(this.name,this.value)});else for(c in a)Ab(c,a[c],b,e);return d.join("&").replace(vb,"+")},n.fn.extend({serialize:function(){return n.param(this.serializeArray())},serializeArray:function(){return this.map(function(){var a=n.prop(this,"elements");return a?n.makeArray(a):this}).filter(function(){var a=this.type;return this.name&&!n(this).is(":disabled")&&zb.test(this.nodeName)&&!yb.test(a)&&(this.checked||!T.test(a))}).map(function(a,b){var c=n(this).val();return null==c?null:n.isArray(c)?n.map(c,function(a){return{name:b.name,value:a.replace(xb,"\r\n")}}):{name:b.name,value:c.replace(xb,"\r\n")}}).get()}}),n.ajaxSettings.xhr=function(){try{return new XMLHttpRequest}catch(a){}};var Bb=0,Cb={},Db={0:200,1223:204},Eb=n.ajaxSettings.xhr();a.attachEvent&&a.attachEvent("onunload",function(){for(var a in Cb)Cb[a]()}),k.cors=!!Eb&&"withCredentials"in Eb,k.ajax=Eb=!!Eb,n.ajaxTransport(function(a){var b;return k.cors||Eb&&!a.crossDomain?{send:function(c,d){var e,f=a.xhr(),g=++Bb;if(f.open(a.type,a.url,a.async,a.username,a.password),a.xhrFields)for(e in a.xhrFields)f[e]=a.xhrFields[e];a.mimeType&&f.overrideMimeType&&f.overrideMimeType(a.mimeType),a.crossDomain||c["X-Requested-With"]||(c["X-Requested-With"]="XMLHttpRequest");for(e in c)f.setRequestHeader(e,c[e]);b=function(a){return function(){b&&(delete Cb[g],b=f.onload=f.onerror=null,"abort"===a?f.abort():"error"===a?d(f.status,f.statusText):d(Db[f.status]||f.status,f.statusText,"string"==typeof f.responseText?{text:f.responseText}:void 0,f.getAllResponseHeaders()))}},f.onload=b(),f.onerror=b("error"),b=Cb[g]=b("abort");try{f.send(a.hasContent&&a.data||null)}catch(h){if(b)throw h}},abort:function(){b&&b()}}:void 0}),n.ajaxSetup({accepts:{script:"text/javascript, application/javascript, application/ecmascript, application/x-ecmascript"},contents:{script:/(?:java|ecma)script/},converters:{"text script":function(a){return n.globalEval(a),a}}}),n.ajaxPrefilter("script",function(a){void 0===a.cache&&(a.cache=!1),a.crossDomain&&(a.type="GET")}),n.ajaxTransport("script",function(a){if(a.crossDomain){var b,c;return{send:function(d,e){b=n("<script>").prop({async:!0,charset:a.scriptCharset,src:a.url}).on("load error",c=function(a){b.remove(),c=null,a&&e("error"===a.type?404:200,a.type)}),l.head.appendChild(b[0])},abort:function(){c&&c()}}}});var Fb=[],Gb=/(=)\?(?=&|$)|\?\?/;n.ajaxSetup({jsonp:"callback",jsonpCallback:function(){var a=Fb.pop()||n.expando+"_"+cb++;return this[a]=!0,a}}),n.ajaxPrefilter("json jsonp",function(b,c,d){var e,f,g,h=b.jsonp!==!1&&(Gb.test(b.url)?"url":"string"==typeof b.data&&!(b.contentType||"").indexOf("application/x-www-form-urlencoded")&&Gb.test(b.data)&&"data");return h||"jsonp"===b.dataTypes[0]?(e=b.jsonpCallback=n.isFunction(b.jsonpCallback)?b.jsonpCallback():b.jsonpCallback,h?b[h]=b[h].replace(Gb,"$1"+e):b.jsonp!==!1&&(b.url+=(db.test(b.url)?"&":"?")+b.jsonp+"="+e),b.converters["script json"]=function(){return g||n.error(e+" was not called"),g[0]},b.dataTypes[0]="json",f=a[e],a[e]=function(){g=arguments},d.always(function(){a[e]=f,b[e]&&(b.jsonpCallback=c.jsonpCallback,Fb.push(e)),g&&n.isFunction(f)&&f(g[0]),g=f=void 0}),"script"):void 0}),n.parseHTML=function(a,b,c){if(!a||"string"!=typeof a)return null;"boolean"==typeof b&&(c=b,b=!1),b=b||l;var d=v.exec(a),e=!c&&[];return d?[b.createElement(d[1])]:(d=n.buildFragment([a],b,e),e&&e.length&&n(e).remove(),n.merge([],d.childNodes))};var Hb=n.fn.load;n.fn.load=function(a,b,c){if("string"!=typeof a&&Hb)return Hb.apply(this,arguments);var d,e,f,g=this,h=a.indexOf(" ");return h>=0&&(d=n.trim(a.slice(h)),a=a.slice(0,h)),n.isFunction(b)?(c=b,b=void 0):b&&"object"==typeof b&&(e="POST"),g.length>0&&n.ajax({url:a,type:e,dataType:"html",data:b}).done(function(a){f=arguments,g.html(d?n("<div>").append(n.parseHTML(a)).find(d):a)}).complete(c&&function(a,b){g.each(c,f||[a.responseText,b,a])}),this},n.each(["ajaxStart","ajaxStop","ajaxComplete","ajaxError","ajaxSuccess","ajaxSend"],function(a,b){n.fn[b]=function(a){return this.on(b,a)}}),n.expr.filters.animated=function(a){return n.grep(n.timers,function(b){return a===b.elem}).length};var Ib=a.document.documentElement;function Jb(a){return n.isWindow(a)?a:9===a.nodeType&&a.defaultView}n.offset={setOffset:function(a,b,c){var d,e,f,g,h,i,j,k=n.css(a,"position"),l=n(a),m={};"static"===k&&(a.style.position="relative"),h=l.offset(),f=n.css(a,"top"),i=n.css(a,"left"),j=("absolute"===k||"fixed"===k)&&(f+i).indexOf("auto")>-1,j?(d=l.position(),g=d.top,e=d.left):(g=parseFloat(f)||0,e=parseFloat(i)||0),n.isFunction(b)&&(b=b.call(a,c,h)),null!=b.top&&(m.top=b.top-h.top+g),null!=b.left&&(m.left=b.left-h.left+e),"using"in b?b.using.call(a,m):l.css(m)}},n.fn.extend({offset:function(a){if(arguments.length)return void 0===a?this:this.each(function(b){n.offset.setOffset(this,a,b)});var b,c,d=this[0],e={top:0,left:0},f=d&&d.ownerDocument;if(f)return b=f.documentElement,n.contains(b,d)?(typeof d.getBoundingClientRect!==U&&(e=d.getBoundingClientRect()),c=Jb(f),{top:e.top+c.pageYOffset-b.clientTop,left:e.left+c.pageXOffset-b.clientLeft}):e},position:function(){if(this[0]){var a,b,c=this[0],d={top:0,left:0};return"fixed"===n.css(c,"position")?b=c.getBoundingClientRect():(a=this.offsetParent(),b=this.offset(),n.nodeName(a[0],"html")||(d=a.offset()),d.top+=n.css(a[0],"borderTopWidth",!0),d.left+=n.css(a[0],"borderLeftWidth",!0)),{top:b.top-d.top-n.css(c,"marginTop",!0),left:b.left-d.left-n.css(c,"marginLeft",!0)}}},offsetParent:function(){return this.map(function(){var a=this.offsetParent||Ib;while(a&&!n.nodeName(a,"html")&&"static"===n.css(a,"position"))a=a.offsetParent;return a||Ib})}}),n.each({scrollLeft:"pageXOffset",scrollTop:"pageYOffset"},function(b,c){var d="pageYOffset"===c;n.fn[b]=function(e){return J(this,function(b,e,f){var g=Jb(b);return void 0===f?g?g[c]:b[e]:void(g?g.scrollTo(d?a.pageXOffset:f,d?f:a.pageYOffset):b[e]=f)},b,e,arguments.length,null)}}),n.each(["top","left"],function(a,b){n.cssHooks[b]=ya(k.pixelPosition,function(a,c){return c?(c=xa(a,b),va.test(c)?n(a).position()[b]+"px":c):void 0})}),n.each({Height:"height",Width:"width"},function(a,b){n.each({padding:"inner"+a,content:b,"":"outer"+a},function(c,d){n.fn[d]=function(d,e){var f=arguments.length&&(c||"boolean"!=typeof d),g=c||(d===!0||e===!0?"margin":"border");return J(this,function(b,c,d){var e;return n.isWindow(b)?b.document.documentElement["client"+a]:9===b.nodeType?(e=b.documentElement,Math.max(b.body["scroll"+a],e["scroll"+a],b.body["offset"+a],e["offset"+a],e["client"+a])):void 0===d?n.css(b,c,g):n.style(b,c,d,g)},b,f?d:void 0,f,null)}})}),n.fn.size=function(){return this.length},n.fn.andSelf=n.fn.addBack,"function"==typeof define&&define.amd&&define("jquery",[],function(){return n});var Kb=a.jQuery,Lb=a.$;return n.noConflict=function(b){return a.$===n&&(a.$=Lb),b&&a.jQuery===n&&(a.jQuery=Kb),n},typeof b===U&&(a.jQuery=a.$=n),n});
//# sourceMappingURL=jquery.min.map;
//     Underscore.js 1.8.3
//     http://underscorejs.org
//     (c) 2009-2015 Jeremy Ashkenas, DocumentCloud and Investigative Reporters & Editors
//     Underscore may be freely distributed under the MIT license.
(function(){function n(n){function t(t,r,e,u,i,o){for(;i>=0&&o>i;i+=n){var a=u?u[i]:i;e=r(e,t[a],a,t)}return e}return function(r,e,u,i){e=b(e,i,4);var o=!k(r)&&m.keys(r),a=(o||r).length,c=n>0?0:a-1;return arguments.length<3&&(u=r[o?o[c]:c],c+=n),t(r,e,u,o,c,a)}}function t(n){return function(t,r,e){r=x(r,e);for(var u=O(t),i=n>0?0:u-1;i>=0&&u>i;i+=n)if(r(t[i],i,t))return i;return-1}}function r(n,t,r){return function(e,u,i){var o=0,a=O(e);if("number"==typeof i)n>0?o=i>=0?i:Math.max(i+a,o):a=i>=0?Math.min(i+1,a):i+a+1;else if(r&&i&&a)return i=r(e,u),e[i]===u?i:-1;if(u!==u)return i=t(l.call(e,o,a),m.isNaN),i>=0?i+o:-1;for(i=n>0?o:a-1;i>=0&&a>i;i+=n)if(e[i]===u)return i;return-1}}function e(n,t){var r=I.length,e=n.constructor,u=m.isFunction(e)&&e.prototype||a,i="constructor";for(m.has(n,i)&&!m.contains(t,i)&&t.push(i);r--;)i=I[r],i in n&&n[i]!==u[i]&&!m.contains(t,i)&&t.push(i)}var u=this,i=u._,o=Array.prototype,a=Object.prototype,c=Function.prototype,f=o.push,l=o.slice,s=a.toString,p=a.hasOwnProperty,h=Array.isArray,v=Object.keys,g=c.bind,y=Object.create,d=function(){},m=function(n){return n instanceof m?n:this instanceof m?void(this._wrapped=n):new m(n)};"undefined"!=typeof exports?("undefined"!=typeof module&&module.exports&&(exports=module.exports=m),exports._=m):u._=m,m.VERSION="1.8.3";var b=function(n,t,r){if(t===void 0)return n;switch(null==r?3:r){case 1:return function(r){return n.call(t,r)};case 2:return function(r,e){return n.call(t,r,e)};case 3:return function(r,e,u){return n.call(t,r,e,u)};case 4:return function(r,e,u,i){return n.call(t,r,e,u,i)}}return function(){return n.apply(t,arguments)}},x=function(n,t,r){return null==n?m.identity:m.isFunction(n)?b(n,t,r):m.isObject(n)?m.matcher(n):m.property(n)};m.iteratee=function(n,t){return x(n,t,1/0)};var _=function(n,t){return function(r){var e=arguments.length;if(2>e||null==r)return r;for(var u=1;e>u;u++)for(var i=arguments[u],o=n(i),a=o.length,c=0;a>c;c++){var f=o[c];t&&r[f]!==void 0||(r[f]=i[f])}return r}},j=function(n){if(!m.isObject(n))return{};if(y)return y(n);d.prototype=n;var t=new d;return d.prototype=null,t},w=function(n){return function(t){return null==t?void 0:t[n]}},A=Math.pow(2,53)-1,O=w("length"),k=function(n){var t=O(n);return"number"==typeof t&&t>=0&&A>=t};m.each=m.forEach=function(n,t,r){t=b(t,r);var e,u;if(k(n))for(e=0,u=n.length;u>e;e++)t(n[e],e,n);else{var i=m.keys(n);for(e=0,u=i.length;u>e;e++)t(n[i[e]],i[e],n)}return n},m.map=m.collect=function(n,t,r){t=x(t,r);for(var e=!k(n)&&m.keys(n),u=(e||n).length,i=Array(u),o=0;u>o;o++){var a=e?e[o]:o;i[o]=t(n[a],a,n)}return i},m.reduce=m.foldl=m.inject=n(1),m.reduceRight=m.foldr=n(-1),m.find=m.detect=function(n,t,r){var e;return e=k(n)?m.findIndex(n,t,r):m.findKey(n,t,r),e!==void 0&&e!==-1?n[e]:void 0},m.filter=m.select=function(n,t,r){var e=[];return t=x(t,r),m.each(n,function(n,r,u){t(n,r,u)&&e.push(n)}),e},m.reject=function(n,t,r){return m.filter(n,m.negate(x(t)),r)},m.every=m.all=function(n,t,r){t=x(t,r);for(var e=!k(n)&&m.keys(n),u=(e||n).length,i=0;u>i;i++){var o=e?e[i]:i;if(!t(n[o],o,n))return!1}return!0},m.some=m.any=function(n,t,r){t=x(t,r);for(var e=!k(n)&&m.keys(n),u=(e||n).length,i=0;u>i;i++){var o=e?e[i]:i;if(t(n[o],o,n))return!0}return!1},m.contains=m.includes=m.include=function(n,t,r,e){return k(n)||(n=m.values(n)),("number"!=typeof r||e)&&(r=0),m.indexOf(n,t,r)>=0},m.invoke=function(n,t){var r=l.call(arguments,2),e=m.isFunction(t);return m.map(n,function(n){var u=e?t:n[t];return null==u?u:u.apply(n,r)})},m.pluck=function(n,t){return m.map(n,m.property(t))},m.where=function(n,t){return m.filter(n,m.matcher(t))},m.findWhere=function(n,t){return m.find(n,m.matcher(t))},m.max=function(n,t,r){var e,u,i=-1/0,o=-1/0;if(null==t&&null!=n){n=k(n)?n:m.values(n);for(var a=0,c=n.length;c>a;a++)e=n[a],e>i&&(i=e)}else t=x(t,r),m.each(n,function(n,r,e){u=t(n,r,e),(u>o||u===-1/0&&i===-1/0)&&(i=n,o=u)});return i},m.min=function(n,t,r){var e,u,i=1/0,o=1/0;if(null==t&&null!=n){n=k(n)?n:m.values(n);for(var a=0,c=n.length;c>a;a++)e=n[a],i>e&&(i=e)}else t=x(t,r),m.each(n,function(n,r,e){u=t(n,r,e),(o>u||1/0===u&&1/0===i)&&(i=n,o=u)});return i},m.shuffle=function(n){for(var t,r=k(n)?n:m.values(n),e=r.length,u=Array(e),i=0;e>i;i++)t=m.random(0,i),t!==i&&(u[i]=u[t]),u[t]=r[i];return u},m.sample=function(n,t,r){return null==t||r?(k(n)||(n=m.values(n)),n[m.random(n.length-1)]):m.shuffle(n).slice(0,Math.max(0,t))},m.sortBy=function(n,t,r){return t=x(t,r),m.pluck(m.map(n,function(n,r,e){return{value:n,index:r,criteria:t(n,r,e)}}).sort(function(n,t){var r=n.criteria,e=t.criteria;if(r!==e){if(r>e||r===void 0)return 1;if(e>r||e===void 0)return-1}return n.index-t.index}),"value")};var F=function(n){return function(t,r,e){var u={};return r=x(r,e),m.each(t,function(e,i){var o=r(e,i,t);n(u,e,o)}),u}};m.groupBy=F(function(n,t,r){m.has(n,r)?n[r].push(t):n[r]=[t]}),m.indexBy=F(function(n,t,r){n[r]=t}),m.countBy=F(function(n,t,r){m.has(n,r)?n[r]++:n[r]=1}),m.toArray=function(n){return n?m.isArray(n)?l.call(n):k(n)?m.map(n,m.identity):m.values(n):[]},m.size=function(n){return null==n?0:k(n)?n.length:m.keys(n).length},m.partition=function(n,t,r){t=x(t,r);var e=[],u=[];return m.each(n,function(n,r,i){(t(n,r,i)?e:u).push(n)}),[e,u]},m.first=m.head=m.take=function(n,t,r){return null==n?void 0:null==t||r?n[0]:m.initial(n,n.length-t)},m.initial=function(n,t,r){return l.call(n,0,Math.max(0,n.length-(null==t||r?1:t)))},m.last=function(n,t,r){return null==n?void 0:null==t||r?n[n.length-1]:m.rest(n,Math.max(0,n.length-t))},m.rest=m.tail=m.drop=function(n,t,r){return l.call(n,null==t||r?1:t)},m.compact=function(n){return m.filter(n,m.identity)};var S=function(n,t,r,e){for(var u=[],i=0,o=e||0,a=O(n);a>o;o++){var c=n[o];if(k(c)&&(m.isArray(c)||m.isArguments(c))){t||(c=S(c,t,r));var f=0,l=c.length;for(u.length+=l;l>f;)u[i++]=c[f++]}else r||(u[i++]=c)}return u};m.flatten=function(n,t){return S(n,t,!1)},m.without=function(n){return m.difference(n,l.call(arguments,1))},m.uniq=m.unique=function(n,t,r,e){m.isBoolean(t)||(e=r,r=t,t=!1),null!=r&&(r=x(r,e));for(var u=[],i=[],o=0,a=O(n);a>o;o++){var c=n[o],f=r?r(c,o,n):c;t?(o&&i===f||u.push(c),i=f):r?m.contains(i,f)||(i.push(f),u.push(c)):m.contains(u,c)||u.push(c)}return u},m.union=function(){return m.uniq(S(arguments,!0,!0))},m.intersection=function(n){for(var t=[],r=arguments.length,e=0,u=O(n);u>e;e++){var i=n[e];if(!m.contains(t,i)){for(var o=1;r>o&&m.contains(arguments[o],i);o++);o===r&&t.push(i)}}return t},m.difference=function(n){var t=S(arguments,!0,!0,1);return m.filter(n,function(n){return!m.contains(t,n)})},m.zip=function(){return m.unzip(arguments)},m.unzip=function(n){for(var t=n&&m.max(n,O).length||0,r=Array(t),e=0;t>e;e++)r[e]=m.pluck(n,e);return r},m.object=function(n,t){for(var r={},e=0,u=O(n);u>e;e++)t?r[n[e]]=t[e]:r[n[e][0]]=n[e][1];return r},m.findIndex=t(1),m.findLastIndex=t(-1),m.sortedIndex=function(n,t,r,e){r=x(r,e,1);for(var u=r(t),i=0,o=O(n);o>i;){var a=Math.floor((i+o)/2);r(n[a])<u?i=a+1:o=a}return i},m.indexOf=r(1,m.findIndex,m.sortedIndex),m.lastIndexOf=r(-1,m.findLastIndex),m.range=function(n,t,r){null==t&&(t=n||0,n=0),r=r||1;for(var e=Math.max(Math.ceil((t-n)/r),0),u=Array(e),i=0;e>i;i++,n+=r)u[i]=n;return u};var E=function(n,t,r,e,u){if(!(e instanceof t))return n.apply(r,u);var i=j(n.prototype),o=n.apply(i,u);return m.isObject(o)?o:i};m.bind=function(n,t){if(g&&n.bind===g)return g.apply(n,l.call(arguments,1));if(!m.isFunction(n))throw new TypeError("Bind must be called on a function");var r=l.call(arguments,2),e=function(){return E(n,e,t,this,r.concat(l.call(arguments)))};return e},m.partial=function(n){var t=l.call(arguments,1),r=function(){for(var e=0,u=t.length,i=Array(u),o=0;u>o;o++)i[o]=t[o]===m?arguments[e++]:t[o];for(;e<arguments.length;)i.push(arguments[e++]);return E(n,r,this,this,i)};return r},m.bindAll=function(n){var t,r,e=arguments.length;if(1>=e)throw new Error("bindAll must be passed function names");for(t=1;e>t;t++)r=arguments[t],n[r]=m.bind(n[r],n);return n},m.memoize=function(n,t){var r=function(e){var u=r.cache,i=""+(t?t.apply(this,arguments):e);return m.has(u,i)||(u[i]=n.apply(this,arguments)),u[i]};return r.cache={},r},m.delay=function(n,t){var r=l.call(arguments,2);return setTimeout(function(){return n.apply(null,r)},t)},m.defer=m.partial(m.delay,m,1),m.throttle=function(n,t,r){var e,u,i,o=null,a=0;r||(r={});var c=function(){a=r.leading===!1?0:m.now(),o=null,i=n.apply(e,u),o||(e=u=null)};return function(){var f=m.now();a||r.leading!==!1||(a=f);var l=t-(f-a);return e=this,u=arguments,0>=l||l>t?(o&&(clearTimeout(o),o=null),a=f,i=n.apply(e,u),o||(e=u=null)):o||r.trailing===!1||(o=setTimeout(c,l)),i}},m.debounce=function(n,t,r){var e,u,i,o,a,c=function(){var f=m.now()-o;t>f&&f>=0?e=setTimeout(c,t-f):(e=null,r||(a=n.apply(i,u),e||(i=u=null)))};return function(){i=this,u=arguments,o=m.now();var f=r&&!e;return e||(e=setTimeout(c,t)),f&&(a=n.apply(i,u),i=u=null),a}},m.wrap=function(n,t){return m.partial(t,n)},m.negate=function(n){return function(){return!n.apply(this,arguments)}},m.compose=function(){var n=arguments,t=n.length-1;return function(){for(var r=t,e=n[t].apply(this,arguments);r--;)e=n[r].call(this,e);return e}},m.after=function(n,t){return function(){return--n<1?t.apply(this,arguments):void 0}},m.before=function(n,t){var r;return function(){return--n>0&&(r=t.apply(this,arguments)),1>=n&&(t=null),r}},m.once=m.partial(m.before,2);var M=!{toString:null}.propertyIsEnumerable("toString"),I=["valueOf","isPrototypeOf","toString","propertyIsEnumerable","hasOwnProperty","toLocaleString"];m.keys=function(n){if(!m.isObject(n))return[];if(v)return v(n);var t=[];for(var r in n)m.has(n,r)&&t.push(r);return M&&e(n,t),t},m.allKeys=function(n){if(!m.isObject(n))return[];var t=[];for(var r in n)t.push(r);return M&&e(n,t),t},m.values=function(n){for(var t=m.keys(n),r=t.length,e=Array(r),u=0;r>u;u++)e[u]=n[t[u]];return e},m.mapObject=function(n,t,r){t=x(t,r);for(var e,u=m.keys(n),i=u.length,o={},a=0;i>a;a++)e=u[a],o[e]=t(n[e],e,n);return o},m.pairs=function(n){for(var t=m.keys(n),r=t.length,e=Array(r),u=0;r>u;u++)e[u]=[t[u],n[t[u]]];return e},m.invert=function(n){for(var t={},r=m.keys(n),e=0,u=r.length;u>e;e++)t[n[r[e]]]=r[e];return t},m.functions=m.methods=function(n){var t=[];for(var r in n)m.isFunction(n[r])&&t.push(r);return t.sort()},m.extend=_(m.allKeys),m.extendOwn=m.assign=_(m.keys),m.findKey=function(n,t,r){t=x(t,r);for(var e,u=m.keys(n),i=0,o=u.length;o>i;i++)if(e=u[i],t(n[e],e,n))return e},m.pick=function(n,t,r){var e,u,i={},o=n;if(null==o)return i;m.isFunction(t)?(u=m.allKeys(o),e=b(t,r)):(u=S(arguments,!1,!1,1),e=function(n,t,r){return t in r},o=Object(o));for(var a=0,c=u.length;c>a;a++){var f=u[a],l=o[f];e(l,f,o)&&(i[f]=l)}return i},m.omit=function(n,t,r){if(m.isFunction(t))t=m.negate(t);else{var e=m.map(S(arguments,!1,!1,1),String);t=function(n,t){return!m.contains(e,t)}}return m.pick(n,t,r)},m.defaults=_(m.allKeys,!0),m.create=function(n,t){var r=j(n);return t&&m.extendOwn(r,t),r},m.clone=function(n){return m.isObject(n)?m.isArray(n)?n.slice():m.extend({},n):n},m.tap=function(n,t){return t(n),n},m.isMatch=function(n,t){var r=m.keys(t),e=r.length;if(null==n)return!e;for(var u=Object(n),i=0;e>i;i++){var o=r[i];if(t[o]!==u[o]||!(o in u))return!1}return!0};var N=function(n,t,r,e){if(n===t)return 0!==n||1/n===1/t;if(null==n||null==t)return n===t;n instanceof m&&(n=n._wrapped),t instanceof m&&(t=t._wrapped);var u=s.call(n);if(u!==s.call(t))return!1;switch(u){case"[object RegExp]":case"[object String]":return""+n==""+t;case"[object Number]":return+n!==+n?+t!==+t:0===+n?1/+n===1/t:+n===+t;case"[object Date]":case"[object Boolean]":return+n===+t}var i="[object Array]"===u;if(!i){if("object"!=typeof n||"object"!=typeof t)return!1;var o=n.constructor,a=t.constructor;if(o!==a&&!(m.isFunction(o)&&o instanceof o&&m.isFunction(a)&&a instanceof a)&&"constructor"in n&&"constructor"in t)return!1}r=r||[],e=e||[];for(var c=r.length;c--;)if(r[c]===n)return e[c]===t;if(r.push(n),e.push(t),i){if(c=n.length,c!==t.length)return!1;for(;c--;)if(!N(n[c],t[c],r,e))return!1}else{var f,l=m.keys(n);if(c=l.length,m.keys(t).length!==c)return!1;for(;c--;)if(f=l[c],!m.has(t,f)||!N(n[f],t[f],r,e))return!1}return r.pop(),e.pop(),!0};m.isEqual=function(n,t){return N(n,t)},m.isEmpty=function(n){return null==n?!0:k(n)&&(m.isArray(n)||m.isString(n)||m.isArguments(n))?0===n.length:0===m.keys(n).length},m.isElement=function(n){return!(!n||1!==n.nodeType)},m.isArray=h||function(n){return"[object Array]"===s.call(n)},m.isObject=function(n){var t=typeof n;return"function"===t||"object"===t&&!!n},m.each(["Arguments","Function","String","Number","Date","RegExp","Error"],function(n){m["is"+n]=function(t){return s.call(t)==="[object "+n+"]"}}),m.isArguments(arguments)||(m.isArguments=function(n){return m.has(n,"callee")}),"function"!=typeof/./&&"object"!=typeof Int8Array&&(m.isFunction=function(n){return"function"==typeof n||!1}),m.isFinite=function(n){return isFinite(n)&&!isNaN(parseFloat(n))},m.isNaN=function(n){return m.isNumber(n)&&n!==+n},m.isBoolean=function(n){return n===!0||n===!1||"[object Boolean]"===s.call(n)},m.isNull=function(n){return null===n},m.isUndefined=function(n){return n===void 0},m.has=function(n,t){return null!=n&&p.call(n,t)},m.noConflict=function(){return u._=i,this},m.identity=function(n){return n},m.constant=function(n){return function(){return n}},m.noop=function(){},m.property=w,m.propertyOf=function(n){return null==n?function(){}:function(t){return n[t]}},m.matcher=m.matches=function(n){return n=m.extendOwn({},n),function(t){return m.isMatch(t,n)}},m.times=function(n,t,r){var e=Array(Math.max(0,n));t=b(t,r,1);for(var u=0;n>u;u++)e[u]=t(u);return e},m.random=function(n,t){return null==t&&(t=n,n=0),n+Math.floor(Math.random()*(t-n+1))},m.now=Date.now||function(){return(new Date).getTime()};var B={"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#x27;","`":"&#x60;"},T=m.invert(B),R=function(n){var t=function(t){return n[t]},r="(?:"+m.keys(n).join("|")+")",e=RegExp(r),u=RegExp(r,"g");return function(n){return n=null==n?"":""+n,e.test(n)?n.replace(u,t):n}};m.escape=R(B),m.unescape=R(T),m.result=function(n,t,r){var e=null==n?void 0:n[t];return e===void 0&&(e=r),m.isFunction(e)?e.call(n):e};var q=0;m.uniqueId=function(n){var t=++q+"";return n?n+t:t},m.templateSettings={evaluate:/<%([\s\S]+?)%>/g,interpolate:/<%=([\s\S]+?)%>/g,escape:/<%-([\s\S]+?)%>/g};var K=/(.)^/,z={"'":"'","\\":"\\","\r":"r","\n":"n","\u2028":"u2028","\u2029":"u2029"},D=/\\|'|\r|\n|\u2028|\u2029/g,L=function(n){return"\\"+z[n]};m.template=function(n,t,r){!t&&r&&(t=r),t=m.defaults({},t,m.templateSettings);var e=RegExp([(t.escape||K).source,(t.interpolate||K).source,(t.evaluate||K).source].join("|")+"|$","g"),u=0,i="__p+='";n.replace(e,function(t,r,e,o,a){return i+=n.slice(u,a).replace(D,L),u=a+t.length,r?i+="'+\n((__t=("+r+"))==null?'':_.escape(__t))+\n'":e?i+="'+\n((__t=("+e+"))==null?'':__t)+\n'":o&&(i+="';\n"+o+"\n__p+='"),t}),i+="';\n",t.variable||(i="with(obj||{}){\n"+i+"}\n"),i="var __t,__p='',__j=Array.prototype.join,"+"print=function(){__p+=__j.call(arguments,'');};\n"+i+"return __p;\n";try{var o=new Function(t.variable||"obj","_",i)}catch(a){throw a.source=i,a}var c=function(n){return o.call(this,n,m)},f=t.variable||"obj";return c.source="function("+f+"){\n"+i+"}",c},m.chain=function(n){var t=m(n);return t._chain=!0,t};var P=function(n,t){return n._chain?m(t).chain():t};m.mixin=function(n){m.each(m.functions(n),function(t){var r=m[t]=n[t];m.prototype[t]=function(){var n=[this._wrapped];return f.apply(n,arguments),P(this,r.apply(m,n))}})},m.mixin(m),m.each(["pop","push","reverse","shift","sort","splice","unshift"],function(n){var t=o[n];m.prototype[n]=function(){var r=this._wrapped;return t.apply(r,arguments),"shift"!==n&&"splice"!==n||0!==r.length||delete r[0],P(this,r)}}),m.each(["concat","join","slice"],function(n){var t=o[n];m.prototype[n]=function(){return P(this,t.apply(this._wrapped,arguments))}}),m.prototype.value=function(){return this._wrapped},m.prototype.valueOf=m.prototype.toJSON=m.prototype.value,m.prototype.toString=function(){return""+this._wrapped},"function"==typeof define&&define.amd&&define("underscore",[],function(){return m})}).call(this);
//# sourceMappingURL=underscore-min.map;
(function(t){var e=typeof self=="object"&&self.self==self&&self||typeof global=="object"&&global.global==global&&global;if(typeof define==="function"&&define.amd){define('backbone',["underscore","jquery","exports"],function(i,r,n){e.Backbone=t(e,n,i,r)})}else if(typeof exports!=="undefined"){var i=require("underscore"),r;try{r=require("jquery")}catch(n){}t(e,exports,i,r)}else{e.Backbone=t(e,{},e._,e.jQuery||e.Zepto||e.ender||e.$)}})(function(t,e,i,r){var n=t.Backbone;var s=Array.prototype.slice;e.VERSION="1.2.3";e.$=r;e.noConflict=function(){t.Backbone=n;return this};e.emulateHTTP=false;e.emulateJSON=false;var a=function(t,e,r){switch(t){case 1:return function(){return i[e](this[r])};case 2:return function(t){return i[e](this[r],t)};case 3:return function(t,n){return i[e](this[r],h(t,this),n)};case 4:return function(t,n,s){return i[e](this[r],h(t,this),n,s)};default:return function(){var t=s.call(arguments);t.unshift(this[r]);return i[e].apply(i,t)}}};var o=function(t,e,r){i.each(e,function(e,n){if(i[n])t.prototype[n]=a(e,n,r)})};var h=function(t,e){if(i.isFunction(t))return t;if(i.isObject(t)&&!e._isModel(t))return u(t);if(i.isString(t))return function(e){return e.get(t)};return t};var u=function(t){var e=i.matches(t);return function(t){return e(t.attributes)}};var l=e.Events={};var c=/\s+/;var f=function(t,e,r,n,s){var a=0,o;if(r&&typeof r==="object"){if(n!==void 0&&"context"in s&&s.context===void 0)s.context=n;for(o=i.keys(r);a<o.length;a++){e=f(t,e,o[a],r[o[a]],s)}}else if(r&&c.test(r)){for(o=r.split(c);a<o.length;a++){e=t(e,o[a],n,s)}}else{e=t(e,r,n,s)}return e};l.on=function(t,e,i){return d(this,t,e,i)};var d=function(t,e,i,r,n){t._events=f(v,t._events||{},e,i,{context:r,ctx:t,listening:n});if(n){var s=t._listeners||(t._listeners={});s[n.id]=n}return t};l.listenTo=function(t,e,r){if(!t)return this;var n=t._listenId||(t._listenId=i.uniqueId("l"));var s=this._listeningTo||(this._listeningTo={});var a=s[n];if(!a){var o=this._listenId||(this._listenId=i.uniqueId("l"));a=s[n]={obj:t,objId:n,id:o,listeningTo:s,count:0}}d(t,e,r,this,a);return this};var v=function(t,e,i,r){if(i){var n=t[e]||(t[e]=[]);var s=r.context,a=r.ctx,o=r.listening;if(o)o.count++;n.push({callback:i,context:s,ctx:s||a,listening:o})}return t};l.off=function(t,e,i){if(!this._events)return this;this._events=f(g,this._events,t,e,{context:i,listeners:this._listeners});return this};l.stopListening=function(t,e,r){var n=this._listeningTo;if(!n)return this;var s=t?[t._listenId]:i.keys(n);for(var a=0;a<s.length;a++){var o=n[s[a]];if(!o)break;o.obj.off(e,r,this)}if(i.isEmpty(n))this._listeningTo=void 0;return this};var g=function(t,e,r,n){if(!t)return;var s=0,a;var o=n.context,h=n.listeners;if(!e&&!r&&!o){var u=i.keys(h);for(;s<u.length;s++){a=h[u[s]];delete h[a.id];delete a.listeningTo[a.objId]}return}var l=e?[e]:i.keys(t);for(;s<l.length;s++){e=l[s];var c=t[e];if(!c)break;var f=[];for(var d=0;d<c.length;d++){var v=c[d];if(r&&r!==v.callback&&r!==v.callback._callback||o&&o!==v.context){f.push(v)}else{a=v.listening;if(a&&--a.count===0){delete h[a.id];delete a.listeningTo[a.objId]}}}if(f.length){t[e]=f}else{delete t[e]}}if(i.size(t))return t};l.once=function(t,e,r){var n=f(p,{},t,e,i.bind(this.off,this));return this.on(n,void 0,r)};l.listenToOnce=function(t,e,r){var n=f(p,{},e,r,i.bind(this.stopListening,this,t));return this.listenTo(t,n)};var p=function(t,e,r,n){if(r){var s=t[e]=i.once(function(){n(e,s);r.apply(this,arguments)});s._callback=r}return t};l.trigger=function(t){if(!this._events)return this;var e=Math.max(0,arguments.length-1);var i=Array(e);for(var r=0;r<e;r++)i[r]=arguments[r+1];f(m,this._events,t,void 0,i);return this};var m=function(t,e,i,r){if(t){var n=t[e];var s=t.all;if(n&&s)s=s.slice();if(n)_(n,r);if(s)_(s,[e].concat(r))}return t};var _=function(t,e){var i,r=-1,n=t.length,s=e[0],a=e[1],o=e[2];switch(e.length){case 0:while(++r<n)(i=t[r]).callback.call(i.ctx);return;case 1:while(++r<n)(i=t[r]).callback.call(i.ctx,s);return;case 2:while(++r<n)(i=t[r]).callback.call(i.ctx,s,a);return;case 3:while(++r<n)(i=t[r]).callback.call(i.ctx,s,a,o);return;default:while(++r<n)(i=t[r]).callback.apply(i.ctx,e);return}};l.bind=l.on;l.unbind=l.off;i.extend(e,l);var y=e.Model=function(t,e){var r=t||{};e||(e={});this.cid=i.uniqueId(this.cidPrefix);this.attributes={};if(e.collection)this.collection=e.collection;if(e.parse)r=this.parse(r,e)||{};r=i.defaults({},r,i.result(this,"defaults"));this.set(r,e);this.changed={};this.initialize.apply(this,arguments)};i.extend(y.prototype,l,{changed:null,validationError:null,idAttribute:"id",cidPrefix:"c",initialize:function(){},toJSON:function(t){return i.clone(this.attributes)},sync:function(){return e.sync.apply(this,arguments)},get:function(t){return this.attributes[t]},escape:function(t){return i.escape(this.get(t))},has:function(t){return this.get(t)!=null},matches:function(t){return!!i.iteratee(t,this)(this.attributes)},set:function(t,e,r){if(t==null)return this;var n;if(typeof t==="object"){n=t;r=e}else{(n={})[t]=e}r||(r={});if(!this._validate(n,r))return false;var s=r.unset;var a=r.silent;var o=[];var h=this._changing;this._changing=true;if(!h){this._previousAttributes=i.clone(this.attributes);this.changed={}}var u=this.attributes;var l=this.changed;var c=this._previousAttributes;for(var f in n){e=n[f];if(!i.isEqual(u[f],e))o.push(f);if(!i.isEqual(c[f],e)){l[f]=e}else{delete l[f]}s?delete u[f]:u[f]=e}this.id=this.get(this.idAttribute);if(!a){if(o.length)this._pending=r;for(var d=0;d<o.length;d++){this.trigger("change:"+o[d],this,u[o[d]],r)}}if(h)return this;if(!a){while(this._pending){r=this._pending;this._pending=false;this.trigger("change",this,r)}}this._pending=false;this._changing=false;return this},unset:function(t,e){return this.set(t,void 0,i.extend({},e,{unset:true}))},clear:function(t){var e={};for(var r in this.attributes)e[r]=void 0;return this.set(e,i.extend({},t,{unset:true}))},hasChanged:function(t){if(t==null)return!i.isEmpty(this.changed);return i.has(this.changed,t)},changedAttributes:function(t){if(!t)return this.hasChanged()?i.clone(this.changed):false;var e=this._changing?this._previousAttributes:this.attributes;var r={};for(var n in t){var s=t[n];if(i.isEqual(e[n],s))continue;r[n]=s}return i.size(r)?r:false},previous:function(t){if(t==null||!this._previousAttributes)return null;return this._previousAttributes[t]},previousAttributes:function(){return i.clone(this._previousAttributes)},fetch:function(t){t=i.extend({parse:true},t);var e=this;var r=t.success;t.success=function(i){var n=t.parse?e.parse(i,t):i;if(!e.set(n,t))return false;if(r)r.call(t.context,e,i,t);e.trigger("sync",e,i,t)};z(this,t);return this.sync("read",this,t)},save:function(t,e,r){var n;if(t==null||typeof t==="object"){n=t;r=e}else{(n={})[t]=e}r=i.extend({validate:true,parse:true},r);var s=r.wait;if(n&&!s){if(!this.set(n,r))return false}else{if(!this._validate(n,r))return false}var a=this;var o=r.success;var h=this.attributes;r.success=function(t){a.attributes=h;var e=r.parse?a.parse(t,r):t;if(s)e=i.extend({},n,e);if(e&&!a.set(e,r))return false;if(o)o.call(r.context,a,t,r);a.trigger("sync",a,t,r)};z(this,r);if(n&&s)this.attributes=i.extend({},h,n);var u=this.isNew()?"create":r.patch?"patch":"update";if(u==="patch"&&!r.attrs)r.attrs=n;var l=this.sync(u,this,r);this.attributes=h;return l},destroy:function(t){t=t?i.clone(t):{};var e=this;var r=t.success;var n=t.wait;var s=function(){e.stopListening();e.trigger("destroy",e,e.collection,t)};t.success=function(i){if(n)s();if(r)r.call(t.context,e,i,t);if(!e.isNew())e.trigger("sync",e,i,t)};var a=false;if(this.isNew()){i.defer(t.success)}else{z(this,t);a=this.sync("delete",this,t)}if(!n)s();return a},url:function(){var t=i.result(this,"urlRoot")||i.result(this.collection,"url")||F();if(this.isNew())return t;var e=this.get(this.idAttribute);return t.replace(/[^\/]$/,"$&/")+encodeURIComponent(e)},parse:function(t,e){return t},clone:function(){return new this.constructor(this.attributes)},isNew:function(){return!this.has(this.idAttribute)},isValid:function(t){return this._validate({},i.defaults({validate:true},t))},_validate:function(t,e){if(!e.validate||!this.validate)return true;t=i.extend({},this.attributes,t);var r=this.validationError=this.validate(t,e)||null;if(!r)return true;this.trigger("invalid",this,r,i.extend(e,{validationError:r}));return false}});var b={keys:1,values:1,pairs:1,invert:1,pick:0,omit:0,chain:1,isEmpty:1};o(y,b,"attributes");var x=e.Collection=function(t,e){e||(e={});if(e.model)this.model=e.model;if(e.comparator!==void 0)this.comparator=e.comparator;this._reset();this.initialize.apply(this,arguments);if(t)this.reset(t,i.extend({silent:true},e))};var w={add:true,remove:true,merge:true};var E={add:true,remove:false};var k=function(t,e,i){i=Math.min(Math.max(i,0),t.length);var r=Array(t.length-i);var n=e.length;for(var s=0;s<r.length;s++)r[s]=t[s+i];for(s=0;s<n;s++)t[s+i]=e[s];for(s=0;s<r.length;s++)t[s+n+i]=r[s]};i.extend(x.prototype,l,{model:y,initialize:function(){},toJSON:function(t){return this.map(function(e){return e.toJSON(t)})},sync:function(){return e.sync.apply(this,arguments)},add:function(t,e){return this.set(t,i.extend({merge:false},e,E))},remove:function(t,e){e=i.extend({},e);var r=!i.isArray(t);t=r?[t]:i.clone(t);var n=this._removeModels(t,e);if(!e.silent&&n)this.trigger("update",this,e);return r?n[0]:n},set:function(t,e){if(t==null)return;e=i.defaults({},e,w);if(e.parse&&!this._isModel(t))t=this.parse(t,e);var r=!i.isArray(t);t=r?[t]:t.slice();var n=e.at;if(n!=null)n=+n;if(n<0)n+=this.length+1;var s=[];var a=[];var o=[];var h={};var u=e.add;var l=e.merge;var c=e.remove;var f=false;var d=this.comparator&&n==null&&e.sort!==false;var v=i.isString(this.comparator)?this.comparator:null;var g;for(var p=0;p<t.length;p++){g=t[p];var m=this.get(g);if(m){if(l&&g!==m){var _=this._isModel(g)?g.attributes:g;if(e.parse)_=m.parse(_,e);m.set(_,e);if(d&&!f)f=m.hasChanged(v)}if(!h[m.cid]){h[m.cid]=true;s.push(m)}t[p]=m}else if(u){g=t[p]=this._prepareModel(g,e);if(g){a.push(g);this._addReference(g,e);h[g.cid]=true;s.push(g)}}}if(c){for(p=0;p<this.length;p++){g=this.models[p];if(!h[g.cid])o.push(g)}if(o.length)this._removeModels(o,e)}var y=false;var b=!d&&u&&c;if(s.length&&b){y=this.length!=s.length||i.some(this.models,function(t,e){return t!==s[e]});this.models.length=0;k(this.models,s,0);this.length=this.models.length}else if(a.length){if(d)f=true;k(this.models,a,n==null?this.length:n);this.length=this.models.length}if(f)this.sort({silent:true});if(!e.silent){for(p=0;p<a.length;p++){if(n!=null)e.index=n+p;g=a[p];g.trigger("add",g,this,e)}if(f||y)this.trigger("sort",this,e);if(a.length||o.length)this.trigger("update",this,e)}return r?t[0]:t},reset:function(t,e){e=e?i.clone(e):{};for(var r=0;r<this.models.length;r++){this._removeReference(this.models[r],e)}e.previousModels=this.models;this._reset();t=this.add(t,i.extend({silent:true},e));if(!e.silent)this.trigger("reset",this,e);return t},push:function(t,e){return this.add(t,i.extend({at:this.length},e))},pop:function(t){var e=this.at(this.length-1);return this.remove(e,t)},unshift:function(t,e){return this.add(t,i.extend({at:0},e))},shift:function(t){var e=this.at(0);return this.remove(e,t)},slice:function(){return s.apply(this.models,arguments)},get:function(t){if(t==null)return void 0;var e=this.modelId(this._isModel(t)?t.attributes:t);return this._byId[t]||this._byId[e]||this._byId[t.cid]},at:function(t){if(t<0)t+=this.length;return this.models[t]},where:function(t,e){return this[e?"find":"filter"](t)},findWhere:function(t){return this.where(t,true)},sort:function(t){var e=this.comparator;if(!e)throw new Error("Cannot sort a set without a comparator");t||(t={});var r=e.length;if(i.isFunction(e))e=i.bind(e,this);if(r===1||i.isString(e)){this.models=this.sortBy(e)}else{this.models.sort(e)}if(!t.silent)this.trigger("sort",this,t);return this},pluck:function(t){return i.invoke(this.models,"get",t)},fetch:function(t){t=i.extend({parse:true},t);var e=t.success;var r=this;t.success=function(i){var n=t.reset?"reset":"set";r[n](i,t);if(e)e.call(t.context,r,i,t);r.trigger("sync",r,i,t)};z(this,t);return this.sync("read",this,t)},create:function(t,e){e=e?i.clone(e):{};var r=e.wait;t=this._prepareModel(t,e);if(!t)return false;if(!r)this.add(t,e);var n=this;var s=e.success;e.success=function(t,e,i){if(r)n.add(t,i);if(s)s.call(i.context,t,e,i)};t.save(null,e);return t},parse:function(t,e){return t},clone:function(){return new this.constructor(this.models,{model:this.model,comparator:this.comparator})},modelId:function(t){return t[this.model.prototype.idAttribute||"id"]},_reset:function(){this.length=0;this.models=[];this._byId={}},_prepareModel:function(t,e){if(this._isModel(t)){if(!t.collection)t.collection=this;return t}e=e?i.clone(e):{};e.collection=this;var r=new this.model(t,e);if(!r.validationError)return r;this.trigger("invalid",this,r.validationError,e);return false},_removeModels:function(t,e){var i=[];for(var r=0;r<t.length;r++){var n=this.get(t[r]);if(!n)continue;var s=this.indexOf(n);this.models.splice(s,1);this.length--;if(!e.silent){e.index=s;n.trigger("remove",n,this,e)}i.push(n);this._removeReference(n,e)}return i.length?i:false},_isModel:function(t){return t instanceof y},_addReference:function(t,e){this._byId[t.cid]=t;var i=this.modelId(t.attributes);if(i!=null)this._byId[i]=t;t.on("all",this._onModelEvent,this)},_removeReference:function(t,e){delete this._byId[t.cid];var i=this.modelId(t.attributes);if(i!=null)delete this._byId[i];if(this===t.collection)delete t.collection;t.off("all",this._onModelEvent,this)},_onModelEvent:function(t,e,i,r){if((t==="add"||t==="remove")&&i!==this)return;if(t==="destroy")this.remove(e,r);if(t==="change"){var n=this.modelId(e.previousAttributes());var s=this.modelId(e.attributes);if(n!==s){if(n!=null)delete this._byId[n];if(s!=null)this._byId[s]=e}}this.trigger.apply(this,arguments)}});var S={forEach:3,each:3,map:3,collect:3,reduce:4,foldl:4,inject:4,reduceRight:4,foldr:4,find:3,detect:3,filter:3,select:3,reject:3,every:3,all:3,some:3,any:3,include:3,includes:3,contains:3,invoke:0,max:3,min:3,toArray:1,size:1,first:3,head:3,take:3,initial:3,rest:3,tail:3,drop:3,last:3,without:0,difference:0,indexOf:3,shuffle:1,lastIndexOf:3,isEmpty:1,chain:1,sample:3,partition:3,groupBy:3,countBy:3,sortBy:3,indexBy:3};o(x,S,"models");var I=e.View=function(t){this.cid=i.uniqueId("view");i.extend(this,i.pick(t,P));this._ensureElement();this.initialize.apply(this,arguments)};var T=/^(\S+)\s*(.*)$/;var P=["model","collection","el","id","attributes","className","tagName","events"];i.extend(I.prototype,l,{tagName:"div",$:function(t){return this.$el.find(t)},initialize:function(){},render:function(){return this},remove:function(){this._removeElement();this.stopListening();return this},_removeElement:function(){this.$el.remove()},setElement:function(t){this.undelegateEvents();this._setElement(t);this.delegateEvents();return this},_setElement:function(t){this.$el=t instanceof e.$?t:e.$(t);this.el=this.$el[0]},delegateEvents:function(t){t||(t=i.result(this,"events"));if(!t)return this;this.undelegateEvents();for(var e in t){var r=t[e];if(!i.isFunction(r))r=this[r];if(!r)continue;var n=e.match(T);this.delegate(n[1],n[2],i.bind(r,this))}return this},delegate:function(t,e,i){this.$el.on(t+".delegateEvents"+this.cid,e,i);return this},undelegateEvents:function(){if(this.$el)this.$el.off(".delegateEvents"+this.cid);return this},undelegate:function(t,e,i){this.$el.off(t+".delegateEvents"+this.cid,e,i);return this},_createElement:function(t){return document.createElement(t)},_ensureElement:function(){if(!this.el){var t=i.extend({},i.result(this,"attributes"));if(this.id)t.id=i.result(this,"id");if(this.className)t["class"]=i.result(this,"className");this.setElement(this._createElement(i.result(this,"tagName")));this._setAttributes(t)}else{this.setElement(i.result(this,"el"))}},_setAttributes:function(t){this.$el.attr(t)}});e.sync=function(t,r,n){var s=H[t];i.defaults(n||(n={}),{emulateHTTP:e.emulateHTTP,emulateJSON:e.emulateJSON});var a={type:s,dataType:"json"};if(!n.url){a.url=i.result(r,"url")||F()}if(n.data==null&&r&&(t==="create"||t==="update"||t==="patch")){a.contentType="application/json";a.data=JSON.stringify(n.attrs||r.toJSON(n))}if(n.emulateJSON){a.contentType="application/x-www-form-urlencoded";a.data=a.data?{model:a.data}:{}}if(n.emulateHTTP&&(s==="PUT"||s==="DELETE"||s==="PATCH")){a.type="POST";if(n.emulateJSON)a.data._method=s;var o=n.beforeSend;n.beforeSend=function(t){t.setRequestHeader("X-HTTP-Method-Override",s);if(o)return o.apply(this,arguments)}}if(a.type!=="GET"&&!n.emulateJSON){a.processData=false}var h=n.error;n.error=function(t,e,i){n.textStatus=e;n.errorThrown=i;if(h)h.call(n.context,t,e,i)};var u=n.xhr=e.ajax(i.extend(a,n));r.trigger("request",r,u,n);return u};var H={create:"POST",update:"PUT",patch:"PATCH","delete":"DELETE",read:"GET"};e.ajax=function(){return e.$.ajax.apply(e.$,arguments)};var $=e.Router=function(t){t||(t={});if(t.routes)this.routes=t.routes;this._bindRoutes();this.initialize.apply(this,arguments)};var A=/\((.*?)\)/g;var C=/(\(\?)?:\w+/g;var R=/\*\w+/g;var j=/[\-{}\[\]+?.,\\\^$|#\s]/g;i.extend($.prototype,l,{initialize:function(){},route:function(t,r,n){if(!i.isRegExp(t))t=this._routeToRegExp(t);if(i.isFunction(r)){n=r;r=""}if(!n)n=this[r];var s=this;e.history.route(t,function(i){var a=s._extractParameters(t,i);if(s.execute(n,a,r)!==false){s.trigger.apply(s,["route:"+r].concat(a));s.trigger("route",r,a);e.history.trigger("route",s,r,a)}});return this},execute:function(t,e,i){if(t)t.apply(this,e)},navigate:function(t,i){e.history.navigate(t,i);return this},_bindRoutes:function(){if(!this.routes)return;this.routes=i.result(this,"routes");var t,e=i.keys(this.routes);while((t=e.pop())!=null){this.route(t,this.routes[t])}},_routeToRegExp:function(t){t=t.replace(j,"\\$&").replace(A,"(?:$1)?").replace(C,function(t,e){return e?t:"([^/?]+)"}).replace(R,"([^?]*?)");return new RegExp("^"+t+"(?:\\?([\\s\\S]*))?$")},_extractParameters:function(t,e){var r=t.exec(e).slice(1);return i.map(r,function(t,e){if(e===r.length-1)return t||null;return t?decodeURIComponent(t):null})}});var M=e.History=function(){this.handlers=[];this.checkUrl=i.bind(this.checkUrl,this);if(typeof window!=="undefined"){this.location=window.location;this.history=window.history}};var N=/^[#\/]|\s+$/g;var O=/^\/+|\/+$/g;var U=/#.*$/;M.started=false;i.extend(M.prototype,l,{interval:50,atRoot:function(){var t=this.location.pathname.replace(/[^\/]$/,"$&/");return t===this.root&&!this.getSearch()},matchRoot:function(){var t=this.decodeFragment(this.location.pathname);var e=t.slice(0,this.root.length-1)+"/";return e===this.root},decodeFragment:function(t){return decodeURI(t.replace(/%25/g,"%2525"))},getSearch:function(){var t=this.location.href.replace(/#.*/,"").match(/\?.+/);return t?t[0]:""},getHash:function(t){var e=(t||this).location.href.match(/#(.*)$/);return e?e[1]:""},getPath:function(){var t=this.decodeFragment(this.location.pathname+this.getSearch()).slice(this.root.length-1);return t.charAt(0)==="/"?t.slice(1):t},getFragment:function(t){if(t==null){if(this._usePushState||!this._wantsHashChange){t=this.getPath()}else{t=this.getHash()}}return t.replace(N,"")},start:function(t){if(M.started)throw new Error("Backbone.history has already been started");M.started=true;this.options=i.extend({root:"/"},this.options,t);this.root=this.options.root;this._wantsHashChange=this.options.hashChange!==false;this._hasHashChange="onhashchange"in window&&(document.documentMode===void 0||document.documentMode>7);this._useHashChange=this._wantsHashChange&&this._hasHashChange;this._wantsPushState=!!this.options.pushState;this._hasPushState=!!(this.history&&this.history.pushState);this._usePushState=this._wantsPushState&&this._hasPushState;this.fragment=this.getFragment();this.root=("/"+this.root+"/").replace(O,"/");if(this._wantsHashChange&&this._wantsPushState){if(!this._hasPushState&&!this.atRoot()){var e=this.root.slice(0,-1)||"/";this.location.replace(e+"#"+this.getPath());return true}else if(this._hasPushState&&this.atRoot()){this.navigate(this.getHash(),{replace:true})}}if(!this._hasHashChange&&this._wantsHashChange&&!this._usePushState){this.iframe=document.createElement("iframe");this.iframe.src="javascript:0";this.iframe.style.display="none";this.iframe.tabIndex=-1;var r=document.body;var n=r.insertBefore(this.iframe,r.firstChild).contentWindow;n.document.open();n.document.close();n.location.hash="#"+this.fragment}var s=window.addEventListener||function(t,e){return attachEvent("on"+t,e)};if(this._usePushState){s("popstate",this.checkUrl,false)}else if(this._useHashChange&&!this.iframe){s("hashchange",this.checkUrl,false)}else if(this._wantsHashChange){this._checkUrlInterval=setInterval(this.checkUrl,this.interval)}if(!this.options.silent)return this.loadUrl()},stop:function(){var t=window.removeEventListener||function(t,e){return detachEvent("on"+t,e)};if(this._usePushState){t("popstate",this.checkUrl,false)}else if(this._useHashChange&&!this.iframe){t("hashchange",this.checkUrl,false)}if(this.iframe){document.body.removeChild(this.iframe);this.iframe=null}if(this._checkUrlInterval)clearInterval(this._checkUrlInterval);M.started=false},route:function(t,e){this.handlers.unshift({route:t,callback:e})},checkUrl:function(t){var e=this.getFragment();if(e===this.fragment&&this.iframe){e=this.getHash(this.iframe.contentWindow)}if(e===this.fragment)return false;if(this.iframe)this.navigate(e);this.loadUrl()},loadUrl:function(t){if(!this.matchRoot())return false;t=this.fragment=this.getFragment(t);return i.some(this.handlers,function(e){if(e.route.test(t)){e.callback(t);return true}})},navigate:function(t,e){if(!M.started)return false;if(!e||e===true)e={trigger:!!e};t=this.getFragment(t||"");var i=this.root;if(t===""||t.charAt(0)==="?"){i=i.slice(0,-1)||"/"}var r=i+t;t=this.decodeFragment(t.replace(U,""));if(this.fragment===t)return;this.fragment=t;if(this._usePushState){this.history[e.replace?"replaceState":"pushState"]({},document.title,r)}else if(this._wantsHashChange){this._updateHash(this.location,t,e.replace);if(this.iframe&&t!==this.getHash(this.iframe.contentWindow)){var n=this.iframe.contentWindow;if(!e.replace){n.document.open();n.document.close()}this._updateHash(n.location,t,e.replace)}}else{return this.location.assign(r)}if(e.trigger)return this.loadUrl(t)},_updateHash:function(t,e,i){if(i){var r=t.href.replace(/(javascript:|#).*$/,"");t.replace(r+"#"+e)}else{t.hash="#"+e}}});e.history=new M;var q=function(t,e){var r=this;var n;if(t&&i.has(t,"constructor")){n=t.constructor}else{n=function(){return r.apply(this,arguments)}}i.extend(n,r,e);var s=function(){this.constructor=n};s.prototype=r.prototype;n.prototype=new s;if(t)i.extend(n.prototype,t);n.__super__=r.prototype;return n};y.extend=x.extend=$.extend=I.extend=M.extend=q;var F=function(){throw new Error('A "url" property or function must be specified')};var z=function(t,e){var i=e.error;e.error=function(r){if(i)i.call(e.context,t,r,e);t.trigger("error",t,r,e)}};return e});
//# sourceMappingURL=backbone-min.map;
/*!

 handlebars v3.0.3

Copyright (C) 2011-2014 by Yehuda Katz

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in
all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
THE SOFTWARE.

@license
*/
!function(a,b){"object"==typeof exports&&"object"==typeof module?module.exports=b():"function"==typeof define&&define.amd?define('handlebars',b):"object"==typeof exports?exports.Handlebars=b():a.Handlebars=b()}(this,function(){return function(a){function b(d){if(c[d])return c[d].exports;var e=c[d]={exports:{},id:d,loaded:!1};return a[d].call(e.exports,e,e.exports,b),e.loaded=!0,e.exports}var c={};return b.m=a,b.c=c,b.p="",b(0)}([function(a,b,c){"use strict";function d(){var a=r();return a.compile=function(b,c){return k.compile(b,c,a)},a.precompile=function(b,c){return k.precompile(b,c,a)},a.AST=i["default"],a.Compiler=k.Compiler,a.JavaScriptCompiler=m["default"],a.Parser=j.parser,a.parse=j.parse,a}var e=c(8)["default"];b.__esModule=!0;var f=c(1),g=e(f),h=c(2),i=e(h),j=c(3),k=c(4),l=c(5),m=e(l),n=c(6),o=e(n),p=c(7),q=e(p),r=g["default"].create,s=d();s.create=d,q["default"](s),s.Visitor=o["default"],s["default"]=s,b["default"]=s,a.exports=b["default"]},function(a,b,c){"use strict";function d(){var a=new g.HandlebarsEnvironment;return m.extend(a,g),a.SafeString=i["default"],a.Exception=k["default"],a.Utils=m,a.escapeExpression=m.escapeExpression,a.VM=o,a.template=function(b){return o.template(b,a)},a}var e=c(8)["default"];b.__esModule=!0;var f=c(9),g=e(f),h=c(10),i=e(h),j=c(11),k=e(j),l=c(12),m=e(l),n=c(13),o=e(n),p=c(7),q=e(p),r=d();r.create=d,q["default"](r),r["default"]=r,b["default"]=r,a.exports=b["default"]},function(a,b){"use strict";b.__esModule=!0;var c={Program:function(a,b,c,d){this.loc=d,this.type="Program",this.body=a,this.blockParams=b,this.strip=c},MustacheStatement:function(a,b,c,d,e,f){this.loc=f,this.type="MustacheStatement",this.path=a,this.params=b||[],this.hash=c,this.escaped=d,this.strip=e},BlockStatement:function(a,b,c,d,e,f,g,h,i){this.loc=i,this.type="BlockStatement",this.path=a,this.params=b||[],this.hash=c,this.program=d,this.inverse=e,this.openStrip=f,this.inverseStrip=g,this.closeStrip=h},PartialStatement:function(a,b,c,d,e){this.loc=e,this.type="PartialStatement",this.name=a,this.params=b||[],this.hash=c,this.indent="",this.strip=d},ContentStatement:function(a,b){this.loc=b,this.type="ContentStatement",this.original=this.value=a},CommentStatement:function(a,b,c){this.loc=c,this.type="CommentStatement",this.value=a,this.strip=b},SubExpression:function(a,b,c,d){this.loc=d,this.type="SubExpression",this.path=a,this.params=b||[],this.hash=c},PathExpression:function(a,b,c,d,e){this.loc=e,this.type="PathExpression",this.data=a,this.original=d,this.parts=c,this.depth=b},StringLiteral:function(a,b){this.loc=b,this.type="StringLiteral",this.original=this.value=a},NumberLiteral:function(a,b){this.loc=b,this.type="NumberLiteral",this.original=this.value=Number(a)},BooleanLiteral:function(a,b){this.loc=b,this.type="BooleanLiteral",this.original=this.value="true"===a},UndefinedLiteral:function(a){this.loc=a,this.type="UndefinedLiteral",this.original=this.value=void 0},NullLiteral:function(a){this.loc=a,this.type="NullLiteral",this.original=this.value=null},Hash:function(a,b){this.loc=b,this.type="Hash",this.pairs=a},HashPair:function(a,b,c){this.loc=c,this.type="HashPair",this.key=a,this.value=b},helpers:{helperExpression:function(a){return!("SubExpression"!==a.type&&!a.params.length&&!a.hash)},scopedId:function(a){return/^\.|this\b/.test(a.original)},simpleId:function(a){return 1===a.parts.length&&!c.helpers.scopedId(a)&&!a.depth}}};b["default"]=c,a.exports=b["default"]},function(a,b,c){"use strict";function d(a,b){if("Program"===a.type)return a;g["default"].yy=o,o.locInfo=function(a){return new o.SourceLocation(b&&b.srcName,a)};var c=new k["default"];return c.accept(g["default"].parse(a))}var e=c(8)["default"];b.__esModule=!0,b.parse=d;var f=c(14),g=e(f),h=c(2),i=e(h),j=c(15),k=e(j),l=c(16),m=e(l),n=c(12);b.parser=g["default"];var o={};n.extend(o,m,i["default"])},function(a,b,c){"use strict";function d(){}function e(a,b,c){if(null==a||"string"!=typeof a&&"Program"!==a.type)throw new k["default"]("You must pass a string or Handlebars AST to Handlebars.precompile. You passed "+a);b=b||{},"data"in b||(b.data=!0),b.compat&&(b.useDepths=!0);var d=c.parse(a,b),e=(new c.Compiler).compile(d,b);return(new c.JavaScriptCompiler).compile(e,b)}function f(a,b,c){function d(){var b=c.parse(a,f),d=(new c.Compiler).compile(b,f),e=(new c.JavaScriptCompiler).compile(d,f,void 0,!0);return c.template(e)}function e(a,b){return g||(g=d()),g.call(this,a,b)}var f=void 0===arguments[1]?{}:arguments[1];if(null==a||"string"!=typeof a&&"Program"!==a.type)throw new k["default"]("You must pass a string or Handlebars AST to Handlebars.compile. You passed "+a);"data"in f||(f.data=!0),f.compat&&(f.useDepths=!0);var g=void 0;return e._setup=function(a){return g||(g=d()),g._setup(a)},e._child=function(a,b,c,e){return g||(g=d()),g._child(a,b,c,e)},e}function g(a,b){if(a===b)return!0;if(l.isArray(a)&&l.isArray(b)&&a.length===b.length){for(var c=0;c<a.length;c++)if(!g(a[c],b[c]))return!1;return!0}}function h(a){if(!a.path.parts){var b=a.path;a.path=new n["default"].PathExpression(!1,0,[b.original+""],b.original+"",b.loc)}}var i=c(8)["default"];b.__esModule=!0,b.Compiler=d,b.precompile=e,b.compile=f;var j=c(11),k=i(j),l=c(12),m=c(2),n=i(m),o=[].slice;d.prototype={compiler:d,equals:function(a){var b=this.opcodes.length;if(a.opcodes.length!==b)return!1;for(var c=0;b>c;c++){var d=this.opcodes[c],e=a.opcodes[c];if(d.opcode!==e.opcode||!g(d.args,e.args))return!1}b=this.children.length;for(var c=0;b>c;c++)if(!this.children[c].equals(a.children[c]))return!1;return!0},guid:0,compile:function(a,b){this.sourceNode=[],this.opcodes=[],this.children=[],this.options=b,this.stringParams=b.stringParams,this.trackIds=b.trackIds,b.blockParams=b.blockParams||[];var c=b.knownHelpers;if(b.knownHelpers={helperMissing:!0,blockHelperMissing:!0,each:!0,"if":!0,unless:!0,"with":!0,log:!0,lookup:!0},c)for(var d in c)d in c&&(b.knownHelpers[d]=c[d]);return this.accept(a)},compileProgram:function(a){var b=new this.compiler,c=b.compile(a,this.options),d=this.guid++;return this.usePartial=this.usePartial||c.usePartial,this.children[d]=c,this.useDepths=this.useDepths||c.useDepths,d},accept:function(a){this.sourceNode.unshift(a);var b=this[a.type](a);return this.sourceNode.shift(),b},Program:function(a){this.options.blockParams.unshift(a.blockParams);for(var b=a.body,c=b.length,d=0;c>d;d++)this.accept(b[d]);return this.options.blockParams.shift(),this.isSimple=1===c,this.blockParams=a.blockParams?a.blockParams.length:0,this},BlockStatement:function(a){h(a);var b=a.program,c=a.inverse;b=b&&this.compileProgram(b),c=c&&this.compileProgram(c);var d=this.classifySexpr(a);"helper"===d?this.helperSexpr(a,b,c):"simple"===d?(this.simpleSexpr(a),this.opcode("pushProgram",b),this.opcode("pushProgram",c),this.opcode("emptyHash"),this.opcode("blockValue",a.path.original)):(this.ambiguousSexpr(a,b,c),this.opcode("pushProgram",b),this.opcode("pushProgram",c),this.opcode("emptyHash"),this.opcode("ambiguousBlockValue")),this.opcode("append")},PartialStatement:function(a){this.usePartial=!0;var b=a.params;if(b.length>1)throw new k["default"]("Unsupported number of partial arguments: "+b.length,a);b.length||b.push({type:"PathExpression",parts:[],depth:0});var c=a.name.original,d="SubExpression"===a.name.type;d&&this.accept(a.name),this.setupFullMustacheParams(a,void 0,void 0,!0);var e=a.indent||"";this.options.preventIndent&&e&&(this.opcode("appendContent",e),e=""),this.opcode("invokePartial",d,c,e),this.opcode("append")},MustacheStatement:function(a){this.SubExpression(a),this.opcode(a.escaped&&!this.options.noEscape?"appendEscaped":"append")},ContentStatement:function(a){a.value&&this.opcode("appendContent",a.value)},CommentStatement:function(){},SubExpression:function(a){h(a);var b=this.classifySexpr(a);"simple"===b?this.simpleSexpr(a):"helper"===b?this.helperSexpr(a):this.ambiguousSexpr(a)},ambiguousSexpr:function(a,b,c){var d=a.path,e=d.parts[0],f=null!=b||null!=c;this.opcode("getContext",d.depth),this.opcode("pushProgram",b),this.opcode("pushProgram",c),this.accept(d),this.opcode("invokeAmbiguous",e,f)},simpleSexpr:function(a){this.accept(a.path),this.opcode("resolvePossibleLambda")},helperSexpr:function(a,b,c){var d=this.setupFullMustacheParams(a,b,c),e=a.path,f=e.parts[0];if(this.options.knownHelpers[f])this.opcode("invokeKnownHelper",d.length,f);else{if(this.options.knownHelpersOnly)throw new k["default"]("You specified knownHelpersOnly, but used the unknown helper "+f,a);e.falsy=!0,this.accept(e),this.opcode("invokeHelper",d.length,e.original,n["default"].helpers.simpleId(e))}},PathExpression:function(a){this.addDepth(a.depth),this.opcode("getContext",a.depth);var b=a.parts[0],c=n["default"].helpers.scopedId(a),d=!a.depth&&!c&&this.blockParamIndex(b);d?this.opcode("lookupBlockParam",d,a.parts):b?a.data?(this.options.data=!0,this.opcode("lookupData",a.depth,a.parts)):this.opcode("lookupOnContext",a.parts,a.falsy,c):this.opcode("pushContext")},StringLiteral:function(a){this.opcode("pushString",a.value)},NumberLiteral:function(a){this.opcode("pushLiteral",a.value)},BooleanLiteral:function(a){this.opcode("pushLiteral",a.value)},UndefinedLiteral:function(){this.opcode("pushLiteral","undefined")},NullLiteral:function(){this.opcode("pushLiteral","null")},Hash:function(a){var b=a.pairs,c=0,d=b.length;for(this.opcode("pushHash");d>c;c++)this.pushParam(b[c].value);for(;c--;)this.opcode("assignToHash",b[c].key);this.opcode("popHash")},opcode:function(a){this.opcodes.push({opcode:a,args:o.call(arguments,1),loc:this.sourceNode[0].loc})},addDepth:function(a){a&&(this.useDepths=!0)},classifySexpr:function(a){var b=n["default"].helpers.simpleId(a.path),c=b&&!!this.blockParamIndex(a.path.parts[0]),d=!c&&n["default"].helpers.helperExpression(a),e=!c&&(d||b);if(e&&!d){var f=a.path.parts[0],g=this.options;g.knownHelpers[f]?d=!0:g.knownHelpersOnly&&(e=!1)}return d?"helper":e?"ambiguous":"simple"},pushParams:function(a){for(var b=0,c=a.length;c>b;b++)this.pushParam(a[b])},pushParam:function(a){var b=null!=a.value?a.value:a.original||"";if(this.stringParams)b.replace&&(b=b.replace(/^(\.?\.\/)*/g,"").replace(/\//g,".")),a.depth&&this.addDepth(a.depth),this.opcode("getContext",a.depth||0),this.opcode("pushStringParam",b,a.type),"SubExpression"===a.type&&this.accept(a);else{if(this.trackIds){var c=void 0;if(!a.parts||n["default"].helpers.scopedId(a)||a.depth||(c=this.blockParamIndex(a.parts[0])),c){var d=a.parts.slice(1).join(".");this.opcode("pushId","BlockParam",c,d)}else b=a.original||b,b.replace&&(b=b.replace(/^\.\//g,"").replace(/^\.$/g,"")),this.opcode("pushId",a.type,b)}this.accept(a)}},setupFullMustacheParams:function(a,b,c,d){var e=a.params;return this.pushParams(e),this.opcode("pushProgram",b),this.opcode("pushProgram",c),a.hash?this.accept(a.hash):this.opcode("emptyHash",d),e},blockParamIndex:function(a){for(var b=0,c=this.options.blockParams.length;c>b;b++){var d=this.options.blockParams[b],e=d&&l.indexOf(d,a);if(d&&e>=0)return[b,e]}}}},function(a,b,c){"use strict";function d(a){this.value=a}function e(){}function f(a,b,c,d){var e=b.popStack(),f=0,g=c.length;for(a&&g--;g>f;f++)e=b.nameLookup(e,c[f],d);return a?[b.aliasable("this.strict"),"(",e,", ",b.quotedString(c[f]),")"]:e}var g=c(8)["default"];b.__esModule=!0;var h=c(9),i=c(11),j=g(i),k=c(12),l=c(17),m=g(l);e.prototype={nameLookup:function(a,b){return e.isValidJavaScriptVariableName(b)?[a,".",b]:[a,"['",b,"']"]},depthedLookup:function(a){return[this.aliasable("this.lookup"),'(depths, "',a,'")']},compilerInfo:function(){var a=h.COMPILER_REVISION,b=h.REVISION_CHANGES[a];return[a,b]},appendToBuffer:function(a,b,c){return k.isArray(a)||(a=[a]),a=this.source.wrap(a,b),this.environment.isSimple?["return ",a,";"]:c?["buffer += ",a,";"]:(a.appendToBuffer=!0,a)},initializeBuffer:function(){return this.quotedString("")},compile:function(a,b,c,d){this.environment=a,this.options=b,this.stringParams=this.options.stringParams,this.trackIds=this.options.trackIds,this.precompile=!d,this.name=this.environment.name,this.isChild=!!c,this.context=c||{programs:[],environments:[]},this.preamble(),this.stackSlot=0,this.stackVars=[],this.aliases={},this.registers={list:[]},this.hashes=[],this.compileStack=[],this.inlineStack=[],this.blockParams=[],this.compileChildren(a,b),this.useDepths=this.useDepths||a.useDepths||this.options.compat,this.useBlockParams=this.useBlockParams||a.useBlockParams;var e=a.opcodes,f=void 0,g=void 0,h=void 0,i=void 0;for(h=0,i=e.length;i>h;h++)f=e[h],this.source.currentLocation=f.loc,g=g||f.loc,this[f.opcode].apply(this,f.args);if(this.source.currentLocation=g,this.pushSource(""),this.stackSlot||this.inlineStack.length||this.compileStack.length)throw new j["default"]("Compile completed with content left on stack");var k=this.createFunctionContext(d);if(this.isChild)return k;var l={compiler:this.compilerInfo(),main:k},m=this.context.programs;for(h=0,i=m.length;i>h;h++)m[h]&&(l[h]=m[h]);return this.environment.usePartial&&(l.usePartial=!0),this.options.data&&(l.useData=!0),this.useDepths&&(l.useDepths=!0),this.useBlockParams&&(l.useBlockParams=!0),this.options.compat&&(l.compat=!0),d?l.compilerOptions=this.options:(l.compiler=JSON.stringify(l.compiler),this.source.currentLocation={start:{line:1,column:0}},l=this.objectLiteral(l),b.srcName?(l=l.toStringWithSourceMap({file:b.destName}),l.map=l.map&&l.map.toString()):l=l.toString()),l},preamble:function(){this.lastContext=0,this.source=new m["default"](this.options.srcName)},createFunctionContext:function(a){var b="",c=this.stackVars.concat(this.registers.list);c.length>0&&(b+=", "+c.join(", "));var d=0;for(var e in this.aliases){var f=this.aliases[e];this.aliases.hasOwnProperty(e)&&f.children&&f.referenceCount>1&&(b+=", alias"+ ++d+"="+e,f.children[0]="alias"+d)}var g=["depth0","helpers","partials","data"];(this.useBlockParams||this.useDepths)&&g.push("blockParams"),this.useDepths&&g.push("depths");var h=this.mergeSource(b);return a?(g.push(h),Function.apply(this,g)):this.source.wrap(["function(",g.join(","),") {\n  ",h,"}"])},mergeSource:function(a){var b=this.environment.isSimple,c=!this.forceBuffer,d=void 0,e=void 0,f=void 0,g=void 0;return this.source.each(function(a){a.appendToBuffer?(f?a.prepend("  + "):f=a,g=a):(f&&(e?f.prepend("buffer += "):d=!0,g.add(";"),f=g=void 0),e=!0,b||(c=!1))}),c?f?(f.prepend("return "),g.add(";")):e||this.source.push('return "";'):(a+=", buffer = "+(d?"":this.initializeBuffer()),f?(f.prepend("return buffer + "),g.add(";")):this.source.push("return buffer;")),a&&this.source.prepend("var "+a.substring(2)+(d?"":";\n")),this.source.merge()},blockValue:function(a){var b=this.aliasable("helpers.blockHelperMissing"),c=[this.contextName(0)];this.setupHelperArgs(a,0,c);var d=this.popStack();c.splice(1,0,d),this.push(this.source.functionCall(b,"call",c))},ambiguousBlockValue:function(){var a=this.aliasable("helpers.blockHelperMissing"),b=[this.contextName(0)];this.setupHelperArgs("",0,b,!0),this.flushInline();var c=this.topStack();b.splice(1,0,c),this.pushSource(["if (!",this.lastHelper,") { ",c," = ",this.source.functionCall(a,"call",b),"}"])},appendContent:function(a){this.pendingContent?a=this.pendingContent+a:this.pendingLocation=this.source.currentLocation,this.pendingContent=a},append:function(){if(this.isInline())this.replaceStack(function(a){return[" != null ? ",a,' : ""']}),this.pushSource(this.appendToBuffer(this.popStack()));else{var a=this.popStack();this.pushSource(["if (",a," != null) { ",this.appendToBuffer(a,void 0,!0)," }"]),this.environment.isSimple&&this.pushSource(["else { ",this.appendToBuffer("''",void 0,!0)," }"])}},appendEscaped:function(){this.pushSource(this.appendToBuffer([this.aliasable("this.escapeExpression"),"(",this.popStack(),")"]))},getContext:function(a){this.lastContext=a},pushContext:function(){this.pushStackLiteral(this.contextName(this.lastContext))},lookupOnContext:function(a,b,c){var d=0;c||!this.options.compat||this.lastContext?this.pushContext():this.push(this.depthedLookup(a[d++])),this.resolvePath("context",a,d,b)},lookupBlockParam:function(a,b){this.useBlockParams=!0,this.push(["blockParams[",a[0],"][",a[1],"]"]),this.resolvePath("context",b,1)},lookupData:function(a,b){this.pushStackLiteral(a?"this.data(data, "+a+")":"data"),this.resolvePath("data",b,0,!0)},resolvePath:function(a,b,c,d){var e=this;if(this.options.strict||this.options.assumeObjects)return void this.push(f(this.options.strict,this,b,a));for(var g=b.length;g>c;c++)this.replaceStack(function(f){var g=e.nameLookup(f,b[c],a);return d?[" && ",g]:[" != null ? ",g," : ",f]})},resolvePossibleLambda:function(){this.push([this.aliasable("this.lambda"),"(",this.popStack(),", ",this.contextName(0),")"])},pushStringParam:function(a,b){this.pushContext(),this.pushString(b),"SubExpression"!==b&&("string"==typeof a?this.pushString(a):this.pushStackLiteral(a))},emptyHash:function(a){this.trackIds&&this.push("{}"),this.stringParams&&(this.push("{}"),this.push("{}")),this.pushStackLiteral(a?"undefined":"{}")},pushHash:function(){this.hash&&this.hashes.push(this.hash),this.hash={values:[],types:[],contexts:[],ids:[]}},popHash:function(){var a=this.hash;this.hash=this.hashes.pop(),this.trackIds&&this.push(this.objectLiteral(a.ids)),this.stringParams&&(this.push(this.objectLiteral(a.contexts)),this.push(this.objectLiteral(a.types))),this.push(this.objectLiteral(a.values))},pushString:function(a){this.pushStackLiteral(this.quotedString(a))},pushLiteral:function(a){this.pushStackLiteral(a)},pushProgram:function(a){this.pushStackLiteral(null!=a?this.programExpression(a):null)},invokeHelper:function(a,b,c){var d=this.popStack(),e=this.setupHelper(a,b),f=c?[e.name," || "]:"",g=["("].concat(f,d);this.options.strict||g.push(" || ",this.aliasable("helpers.helperMissing")),g.push(")"),this.push(this.source.functionCall(g,"call",e.callParams))},invokeKnownHelper:function(a,b){var c=this.setupHelper(a,b);this.push(this.source.functionCall(c.name,"call",c.callParams))},invokeAmbiguous:function(a,b){this.useRegister("helper");var c=this.popStack();this.emptyHash();var d=this.setupHelper(0,a,b),e=this.lastHelper=this.nameLookup("helpers",a,"helper"),f=["(","(helper = ",e," || ",c,")"];this.options.strict||(f[0]="(helper = ",f.push(" != null ? helper : ",this.aliasable("helpers.helperMissing"))),this.push(["(",f,d.paramsInit?["),(",d.paramsInit]:[],"),","(typeof helper === ",this.aliasable('"function"')," ? ",this.source.functionCall("helper","call",d.callParams)," : helper))"])},invokePartial:function(a,b,c){var d=[],e=this.setupParams(b,1,d,!1);a&&(b=this.popStack(),delete e.name),c&&(e.indent=JSON.stringify(c)),e.helpers="helpers",e.partials="partials",d.unshift(a?b:this.nameLookup("partials",b,"partial")),this.options.compat&&(e.depths="depths"),e=this.objectLiteral(e),d.push(e),this.push(this.source.functionCall("this.invokePartial","",d))},assignToHash:function(a){var b=this.popStack(),c=void 0,d=void 0,e=void 0;this.trackIds&&(e=this.popStack()),this.stringParams&&(d=this.popStack(),c=this.popStack());var f=this.hash;c&&(f.contexts[a]=c),d&&(f.types[a]=d),e&&(f.ids[a]=e),f.values[a]=b},pushId:function(a,b,c){"BlockParam"===a?this.pushStackLiteral("blockParams["+b[0]+"].path["+b[1]+"]"+(c?" + "+JSON.stringify("."+c):"")):"PathExpression"===a?this.pushString(b):this.pushStackLiteral("SubExpression"===a?"true":"null")},compiler:e,compileChildren:function(a,b){for(var c=a.children,d=void 0,e=void 0,f=0,g=c.length;g>f;f++){d=c[f],e=new this.compiler;var h=this.matchExistingProgram(d);null==h?(this.context.programs.push(""),h=this.context.programs.length,d.index=h,d.name="program"+h,this.context.programs[h]=e.compile(d,b,this.context,!this.precompile),this.context.environments[h]=d,this.useDepths=this.useDepths||e.useDepths,this.useBlockParams=this.useBlockParams||e.useBlockParams):(d.index=h,d.name="program"+h,this.useDepths=this.useDepths||d.useDepths,this.useBlockParams=this.useBlockParams||d.useBlockParams)}},matchExistingProgram:function(a){for(var b=0,c=this.context.environments.length;c>b;b++){var d=this.context.environments[b];if(d&&d.equals(a))return b}},programExpression:function(a){var b=this.environment.children[a],c=[b.index,"data",b.blockParams];return(this.useBlockParams||this.useDepths)&&c.push("blockParams"),this.useDepths&&c.push("depths"),"this.program("+c.join(", ")+")"},useRegister:function(a){this.registers[a]||(this.registers[a]=!0,this.registers.list.push(a))},push:function(a){return a instanceof d||(a=this.source.wrap(a)),this.inlineStack.push(a),a},pushStackLiteral:function(a){this.push(new d(a))},pushSource:function(a){this.pendingContent&&(this.source.push(this.appendToBuffer(this.source.quotedString(this.pendingContent),this.pendingLocation)),this.pendingContent=void 0),a&&this.source.push(a)},replaceStack:function(a){var b=["("],c=void 0,e=void 0,f=void 0;if(!this.isInline())throw new j["default"]("replaceStack on non-inline");var g=this.popStack(!0);if(g instanceof d)c=[g.value],b=["(",c],f=!0;else{e=!0;var h=this.incrStack();b=["((",this.push(h)," = ",g,")"],c=this.topStack()}var i=a.call(this,c);f||this.popStack(),e&&this.stackSlot--,this.push(b.concat(i,")"))},incrStack:function(){return this.stackSlot++,this.stackSlot>this.stackVars.length&&this.stackVars.push("stack"+this.stackSlot),this.topStackName()},topStackName:function(){return"stack"+this.stackSlot},flushInline:function(){var a=this.inlineStack;this.inlineStack=[];for(var b=0,c=a.length;c>b;b++){var e=a[b];if(e instanceof d)this.compileStack.push(e);else{var f=this.incrStack();this.pushSource([f," = ",e,";"]),this.compileStack.push(f)}}},isInline:function(){return this.inlineStack.length},popStack:function(a){var b=this.isInline(),c=(b?this.inlineStack:this.compileStack).pop();if(!a&&c instanceof d)return c.value;if(!b){if(!this.stackSlot)throw new j["default"]("Invalid stack pop");this.stackSlot--}return c},topStack:function(){var a=this.isInline()?this.inlineStack:this.compileStack,b=a[a.length-1];return b instanceof d?b.value:b},contextName:function(a){return this.useDepths&&a?"depths["+a+"]":"depth"+a},quotedString:function(a){return this.source.quotedString(a)},objectLiteral:function(a){return this.source.objectLiteral(a)},aliasable:function(a){var b=this.aliases[a];return b?(b.referenceCount++,b):(b=this.aliases[a]=this.source.wrap(a),b.aliasable=!0,b.referenceCount=1,b)},setupHelper:function(a,b,c){var d=[],e=this.setupHelperArgs(b,a,d,c),f=this.nameLookup("helpers",b,"helper");return{params:d,paramsInit:e,name:f,callParams:[this.contextName(0)].concat(d)}},setupParams:function(a,b,c){var d={},e=[],f=[],g=[],h=void 0;d.name=this.quotedString(a),d.hash=this.popStack(),this.trackIds&&(d.hashIds=this.popStack()),this.stringParams&&(d.hashTypes=this.popStack(),d.hashContexts=this.popStack());var i=this.popStack(),j=this.popStack();(j||i)&&(d.fn=j||"this.noop",d.inverse=i||"this.noop");for(var k=b;k--;)h=this.popStack(),c[k]=h,this.trackIds&&(g[k]=this.popStack()),this.stringParams&&(f[k]=this.popStack(),e[k]=this.popStack());return this.trackIds&&(d.ids=this.source.generateArray(g)),this.stringParams&&(d.types=this.source.generateArray(f),d.contexts=this.source.generateArray(e)),this.options.data&&(d.data="data"),this.useBlockParams&&(d.blockParams="blockParams"),d},setupHelperArgs:function(a,b,c,d){var e=this.setupParams(a,b,c,!0);return e=this.objectLiteral(e),d?(this.useRegister("options"),c.push("options"),["options=",e]):(c.push(e),"")}},function(){for(var a="break else new var case finally return void catch for switch while continue function this with default if throw delete in try do instanceof typeof abstract enum int short boolean export interface static byte extends long super char final native synchronized class float package throws const goto private transient debugger implements protected volatile double import public let yield await null true false".split(" "),b=e.RESERVED_WORDS={},c=0,d=a.length;d>c;c++)b[a[c]]=!0}(),e.isValidJavaScriptVariableName=function(a){return!e.RESERVED_WORDS[a]&&/^[a-zA-Z_$][0-9a-zA-Z_$]*$/.test(a)},b["default"]=e,a.exports=b["default"]},function(a,b,c){"use strict";function d(){this.parents=[]}var e=c(8)["default"];b.__esModule=!0;var f=c(11),g=e(f),h=c(2),i=e(h);d.prototype={constructor:d,mutating:!1,acceptKey:function(a,b){var c=this.accept(a[b]);if(this.mutating){if(c&&(!c.type||!i["default"][c.type]))throw new g["default"]('Unexpected node type "'+c.type+'" found when accepting '+b+" on "+a.type);a[b]=c}},acceptRequired:function(a,b){if(this.acceptKey(a,b),!a[b])throw new g["default"](a.type+" requires "+b)},acceptArray:function(a){for(var b=0,c=a.length;c>b;b++)this.acceptKey(a,b),a[b]||(a.splice(b,1),b--,c--)},accept:function(a){if(a){this.current&&this.parents.unshift(this.current),this.current=a;var b=this[a.type](a);return this.current=this.parents.shift(),!this.mutating||b?b:b!==!1?a:void 0}},Program:function(a){this.acceptArray(a.body)},MustacheStatement:function(a){this.acceptRequired(a,"path"),this.acceptArray(a.params),this.acceptKey(a,"hash")},BlockStatement:function(a){this.acceptRequired(a,"path"),this.acceptArray(a.params),this.acceptKey(a,"hash"),this.acceptKey(a,"program"),this.acceptKey(a,"inverse")},PartialStatement:function(a){this.acceptRequired(a,"name"),this.acceptArray(a.params),this.acceptKey(a,"hash")},ContentStatement:function(){},CommentStatement:function(){},SubExpression:function(a){this.acceptRequired(a,"path"),this.acceptArray(a.params),this.acceptKey(a,"hash")},PathExpression:function(){},StringLiteral:function(){},NumberLiteral:function(){},BooleanLiteral:function(){},UndefinedLiteral:function(){},NullLiteral:function(){},Hash:function(a){this.acceptArray(a.pairs)},HashPair:function(a){this.acceptRequired(a,"value")}},b["default"]=d,a.exports=b["default"]},function(a,b){(function(c){"use strict";b.__esModule=!0,b["default"]=function(a){var b="undefined"!=typeof c?c:window,d=b.Handlebars;a.noConflict=function(){b.Handlebars===a&&(b.Handlebars=d)}},a.exports=b["default"]}).call(b,function(){return this}())},function(a,b){"use strict";b["default"]=function(a){return a&&a.__esModule?a:{"default":a}},b.__esModule=!0},function(a,b,c){"use strict";function d(a,b){this.helpers=a||{},this.partials=b||{},e(this)}function e(a){a.registerHelper("helperMissing",function(){if(1===arguments.length)return void 0;throw new k["default"]('Missing helper: "'+arguments[arguments.length-1].name+'"')}),a.registerHelper("blockHelperMissing",function(b,c){var d=c.inverse,e=c.fn;if(b===!0)return e(this);if(b===!1||null==b)return d(this);if(o(b))return b.length>0?(c.ids&&(c.ids=[c.name]),a.helpers.each(b,c)):d(this);if(c.data&&c.ids){var g=f(c.data);g.contextPath=i.appendContextPath(c.data.contextPath,c.name),c={data:g}}return e(b,c)}),a.registerHelper("each",function(a,b){function c(b,c,e){j&&(j.key=b,j.index=c,j.first=0===c,j.last=!!e,l&&(j.contextPath=l+b)),h+=d(a[b],{data:j,blockParams:i.blockParams([a[b],b],[l+b,null])})}if(!b)throw new k["default"]("Must pass iterator to #each");var d=b.fn,e=b.inverse,g=0,h="",j=void 0,l=void 0;if(b.data&&b.ids&&(l=i.appendContextPath(b.data.contextPath,b.ids[0])+"."),p(a)&&(a=a.call(this)),b.data&&(j=f(b.data)),a&&"object"==typeof a)if(o(a))for(var m=a.length;m>g;g++)c(g,g,g===a.length-1);else{var n=void 0;for(var q in a)a.hasOwnProperty(q)&&(n&&c(n,g-1),n=q,g++);n&&c(n,g-1,!0)}return 0===g&&(h=e(this)),h}),a.registerHelper("if",function(a,b){return p(a)&&(a=a.call(this)),!b.hash.includeZero&&!a||i.isEmpty(a)?b.inverse(this):b.fn(this)}),a.registerHelper("unless",function(b,c){return a.helpers["if"].call(this,b,{fn:c.inverse,inverse:c.fn,hash:c.hash})}),a.registerHelper("with",function(a,b){p(a)&&(a=a.call(this));var c=b.fn;if(i.isEmpty(a))return b.inverse(this);if(b.data&&b.ids){var d=f(b.data);d.contextPath=i.appendContextPath(b.data.contextPath,b.ids[0]),b={data:d}}return c(a,b)}),a.registerHelper("log",function(b,c){var d=c.data&&null!=c.data.level?parseInt(c.data.level,10):1;a.log(d,b)}),a.registerHelper("lookup",function(a,b){return a&&a[b]})}function f(a){var b=i.extend({},a);return b._parent=a,b}var g=c(8)["default"];b.__esModule=!0,b.HandlebarsEnvironment=d,b.createFrame=f;var h=c(12),i=g(h),j=c(11),k=g(j),l="3.0.1";b.VERSION=l;var m=6;b.COMPILER_REVISION=m;var n={1:"<= 1.0.rc.2",2:"== 1.0.0-rc.3",3:"== 1.0.0-rc.4",4:"== 1.x.x",5:"== 2.0.0-alpha.x",6:">= 2.0.0-beta.1"};b.REVISION_CHANGES=n;var o=i.isArray,p=i.isFunction,q=i.toString,r="[object Object]";d.prototype={constructor:d,logger:s,log:t,registerHelper:function(a,b){if(q.call(a)===r){if(b)throw new k["default"]("Arg not supported with multiple helpers");i.extend(this.helpers,a)}else this.helpers[a]=b},unregisterHelper:function(a){delete this.helpers[a]},registerPartial:function(a,b){if(q.call(a)===r)i.extend(this.partials,a);else{if("undefined"==typeof b)throw new k["default"]("Attempting to register a partial as undefined");this.partials[a]=b}},unregisterPartial:function(a){delete this.partials[a]}};var s={methodMap:{0:"debug",1:"info",2:"warn",3:"error"},DEBUG:0,INFO:1,WARN:2,ERROR:3,level:1,log:function(a,b){if("undefined"!=typeof console&&s.level<=a){var c=s.methodMap[a];(console[c]||console.log).call(console,b)}}};b.logger=s;var t=s.log;b.log=t},function(a,b){"use strict";function c(a){this.string=a}b.__esModule=!0,c.prototype.toString=c.prototype.toHTML=function(){return""+this.string},b["default"]=c,a.exports=b["default"]},function(a,b){"use strict";function c(a,b){var e=b&&b.loc,f=void 0,g=void 0;e&&(f=e.start.line,g=e.start.column,a+=" - "+f+":"+g);for(var h=Error.prototype.constructor.call(this,a),i=0;i<d.length;i++)this[d[i]]=h[d[i]];Error.captureStackTrace&&Error.captureStackTrace(this,c),e&&(this.lineNumber=f,this.column=g)}b.__esModule=!0;var d=["description","fileName","lineNumber","message","name","number","stack"];c.prototype=new Error,b["default"]=c,a.exports=b["default"]},function(a,b){"use strict";function c(a){return j[a]}function d(a){for(var b=1;b<arguments.length;b++)for(var c in arguments[b])Object.prototype.hasOwnProperty.call(arguments[b],c)&&(a[c]=arguments[b][c]);return a}function e(a,b){for(var c=0,d=a.length;d>c;c++)if(a[c]===b)return c;return-1}function f(a){if("string"!=typeof a){if(a&&a.toHTML)return a.toHTML();if(null==a)return"";if(!a)return a+"";a=""+a}return l.test(a)?a.replace(k,c):a}function g(a){return a||0===a?o(a)&&0===a.length?!0:!1:!0}function h(a,b){return a.path=b,a}function i(a,b){return(a?a+".":"")+b}b.__esModule=!0,b.extend=d,b.indexOf=e,b.escapeExpression=f,b.isEmpty=g,b.blockParams=h,b.appendContextPath=i;var j={"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#x27;","`":"&#x60;"},k=/[&<>"'`]/g,l=/[&<>"'`]/,m=Object.prototype.toString;b.toString=m;var n=function(a){return"function"==typeof a};n(/x/)&&(b.isFunction=n=function(a){return"function"==typeof a&&"[object Function]"===m.call(a)});var n;b.isFunction=n;var o=Array.isArray||function(a){return a&&"object"==typeof a?"[object Array]"===m.call(a):!1};b.isArray=o},function(a,b,c){"use strict";function d(a){var b=a&&a[0]||1,c=p.COMPILER_REVISION;if(b!==c){if(c>b){var d=p.REVISION_CHANGES[c],e=p.REVISION_CHANGES[b];throw new o["default"]("Template was precompiled with an older version of Handlebars than the current runtime. Please update your precompiler to a newer version ("+d+") or downgrade your runtime to an older version ("+e+").")}throw new o["default"]("Template was precompiled with a newer version of Handlebars than the current runtime. Please update your runtime to a newer version ("+a[1]+").")}}function e(a,b){function c(c,d,e){e.hash&&(d=m.extend({},d,e.hash)),c=b.VM.resolvePartial.call(this,c,d,e);var f=b.VM.invokePartial.call(this,c,d,e);if(null==f&&b.compile&&(e.partials[e.name]=b.compile(c,a.compilerOptions,b),f=e.partials[e.name](d,e)),null!=f){if(e.indent){for(var g=f.split("\n"),h=0,i=g.length;i>h&&(g[h]||h+1!==i);h++)g[h]=e.indent+g[h];f=g.join("\n")}return f}throw new o["default"]("The partial "+e.name+" could not be compiled when running in runtime-only mode")}function d(b){var c=void 0===arguments[1]?{}:arguments[1],f=c.data;
d._setup(c),!c.partial&&a.useData&&(f=j(b,f));var g=void 0,h=a.useBlockParams?[]:void 0;return a.useDepths&&(g=c.depths?[b].concat(c.depths):[b]),a.main.call(e,b,e.helpers,e.partials,f,h,g)}if(!b)throw new o["default"]("No environment passed to template");if(!a||!a.main)throw new o["default"]("Unknown template object: "+typeof a);b.VM.checkRevision(a.compiler);var e={strict:function(a,b){if(!(b in a))throw new o["default"]('"'+b+'" not defined in '+a);return a[b]},lookup:function(a,b){for(var c=a.length,d=0;c>d;d++)if(a[d]&&null!=a[d][b])return a[d][b]},lambda:function(a,b){return"function"==typeof a?a.call(b):a},escapeExpression:m.escapeExpression,invokePartial:c,fn:function(b){return a[b]},programs:[],program:function(a,b,c,d,e){var g=this.programs[a],h=this.fn(a);return b||e||d||c?g=f(this,a,h,b,c,d,e):g||(g=this.programs[a]=f(this,a,h)),g},data:function(a,b){for(;a&&b--;)a=a._parent;return a},merge:function(a,b){var c=a||b;return a&&b&&a!==b&&(c=m.extend({},b,a)),c},noop:b.VM.noop,compilerInfo:a.compiler};return d.isTop=!0,d._setup=function(c){c.partial?(e.helpers=c.helpers,e.partials=c.partials):(e.helpers=e.merge(c.helpers,b.helpers),a.usePartial&&(e.partials=e.merge(c.partials,b.partials)))},d._child=function(b,c,d,g){if(a.useBlockParams&&!d)throw new o["default"]("must pass block params");if(a.useDepths&&!g)throw new o["default"]("must pass parent depths");return f(e,b,a[b],c,0,d,g)},d}function f(a,b,c,d,e,f,g){function h(b){var e=void 0===arguments[1]?{}:arguments[1];return c.call(a,b,a.helpers,a.partials,e.data||d,f&&[e.blockParams].concat(f),g&&[b].concat(g))}return h.program=b,h.depth=g?g.length:0,h.blockParams=e||0,h}function g(a,b,c){return a?a.call||c.name||(c.name=a,a=c.partials[a]):a=c.partials[c.name],a}function h(a,b,c){if(c.partial=!0,void 0===a)throw new o["default"]("The partial "+c.name+" could not be found");return a instanceof Function?a(b,c):void 0}function i(){return""}function j(a,b){return b&&"root"in b||(b=b?p.createFrame(b):{},b.root=a),b}var k=c(8)["default"];b.__esModule=!0,b.checkRevision=d,b.template=e,b.wrapProgram=f,b.resolvePartial=g,b.invokePartial=h,b.noop=i;var l=c(12),m=k(l),n=c(11),o=k(n),p=c(9)},function(a,b){"use strict";b.__esModule=!0;var c=function(){function a(){this.yy={}}var b={trace:function(){},yy:{},symbols_:{error:2,root:3,program:4,EOF:5,program_repetition0:6,statement:7,mustache:8,block:9,rawBlock:10,partial:11,content:12,COMMENT:13,CONTENT:14,openRawBlock:15,END_RAW_BLOCK:16,OPEN_RAW_BLOCK:17,helperName:18,openRawBlock_repetition0:19,openRawBlock_option0:20,CLOSE_RAW_BLOCK:21,openBlock:22,block_option0:23,closeBlock:24,openInverse:25,block_option1:26,OPEN_BLOCK:27,openBlock_repetition0:28,openBlock_option0:29,openBlock_option1:30,CLOSE:31,OPEN_INVERSE:32,openInverse_repetition0:33,openInverse_option0:34,openInverse_option1:35,openInverseChain:36,OPEN_INVERSE_CHAIN:37,openInverseChain_repetition0:38,openInverseChain_option0:39,openInverseChain_option1:40,inverseAndProgram:41,INVERSE:42,inverseChain:43,inverseChain_option0:44,OPEN_ENDBLOCK:45,OPEN:46,mustache_repetition0:47,mustache_option0:48,OPEN_UNESCAPED:49,mustache_repetition1:50,mustache_option1:51,CLOSE_UNESCAPED:52,OPEN_PARTIAL:53,partialName:54,partial_repetition0:55,partial_option0:56,param:57,sexpr:58,OPEN_SEXPR:59,sexpr_repetition0:60,sexpr_option0:61,CLOSE_SEXPR:62,hash:63,hash_repetition_plus0:64,hashSegment:65,ID:66,EQUALS:67,blockParams:68,OPEN_BLOCK_PARAMS:69,blockParams_repetition_plus0:70,CLOSE_BLOCK_PARAMS:71,path:72,dataName:73,STRING:74,NUMBER:75,BOOLEAN:76,UNDEFINED:77,NULL:78,DATA:79,pathSegments:80,SEP:81,$accept:0,$end:1},terminals_:{2:"error",5:"EOF",13:"COMMENT",14:"CONTENT",16:"END_RAW_BLOCK",17:"OPEN_RAW_BLOCK",21:"CLOSE_RAW_BLOCK",27:"OPEN_BLOCK",31:"CLOSE",32:"OPEN_INVERSE",37:"OPEN_INVERSE_CHAIN",42:"INVERSE",45:"OPEN_ENDBLOCK",46:"OPEN",49:"OPEN_UNESCAPED",52:"CLOSE_UNESCAPED",53:"OPEN_PARTIAL",59:"OPEN_SEXPR",62:"CLOSE_SEXPR",66:"ID",67:"EQUALS",69:"OPEN_BLOCK_PARAMS",71:"CLOSE_BLOCK_PARAMS",74:"STRING",75:"NUMBER",76:"BOOLEAN",77:"UNDEFINED",78:"NULL",79:"DATA",81:"SEP"},productions_:[0,[3,2],[4,1],[7,1],[7,1],[7,1],[7,1],[7,1],[7,1],[12,1],[10,3],[15,5],[9,4],[9,4],[22,6],[25,6],[36,6],[41,2],[43,3],[43,1],[24,3],[8,5],[8,5],[11,5],[57,1],[57,1],[58,5],[63,1],[65,3],[68,3],[18,1],[18,1],[18,1],[18,1],[18,1],[18,1],[18,1],[54,1],[54,1],[73,2],[72,1],[80,3],[80,1],[6,0],[6,2],[19,0],[19,2],[20,0],[20,1],[23,0],[23,1],[26,0],[26,1],[28,0],[28,2],[29,0],[29,1],[30,0],[30,1],[33,0],[33,2],[34,0],[34,1],[35,0],[35,1],[38,0],[38,2],[39,0],[39,1],[40,0],[40,1],[44,0],[44,1],[47,0],[47,2],[48,0],[48,1],[50,0],[50,2],[51,0],[51,1],[55,0],[55,2],[56,0],[56,1],[60,0],[60,2],[61,0],[61,1],[64,1],[64,2],[70,1],[70,2]],performAction:function(a,b,c,d,e,f){var g=f.length-1;switch(e){case 1:return f[g-1];case 2:this.$=new d.Program(f[g],null,{},d.locInfo(this._$));break;case 3:this.$=f[g];break;case 4:this.$=f[g];break;case 5:this.$=f[g];break;case 6:this.$=f[g];break;case 7:this.$=f[g];break;case 8:this.$=new d.CommentStatement(d.stripComment(f[g]),d.stripFlags(f[g],f[g]),d.locInfo(this._$));break;case 9:this.$=new d.ContentStatement(f[g],d.locInfo(this._$));break;case 10:this.$=d.prepareRawBlock(f[g-2],f[g-1],f[g],this._$);break;case 11:this.$={path:f[g-3],params:f[g-2],hash:f[g-1]};break;case 12:this.$=d.prepareBlock(f[g-3],f[g-2],f[g-1],f[g],!1,this._$);break;case 13:this.$=d.prepareBlock(f[g-3],f[g-2],f[g-1],f[g],!0,this._$);break;case 14:this.$={path:f[g-4],params:f[g-3],hash:f[g-2],blockParams:f[g-1],strip:d.stripFlags(f[g-5],f[g])};break;case 15:this.$={path:f[g-4],params:f[g-3],hash:f[g-2],blockParams:f[g-1],strip:d.stripFlags(f[g-5],f[g])};break;case 16:this.$={path:f[g-4],params:f[g-3],hash:f[g-2],blockParams:f[g-1],strip:d.stripFlags(f[g-5],f[g])};break;case 17:this.$={strip:d.stripFlags(f[g-1],f[g-1]),program:f[g]};break;case 18:var h=d.prepareBlock(f[g-2],f[g-1],f[g],f[g],!1,this._$),i=new d.Program([h],null,{},d.locInfo(this._$));i.chained=!0,this.$={strip:f[g-2].strip,program:i,chain:!0};break;case 19:this.$=f[g];break;case 20:this.$={path:f[g-1],strip:d.stripFlags(f[g-2],f[g])};break;case 21:this.$=d.prepareMustache(f[g-3],f[g-2],f[g-1],f[g-4],d.stripFlags(f[g-4],f[g]),this._$);break;case 22:this.$=d.prepareMustache(f[g-3],f[g-2],f[g-1],f[g-4],d.stripFlags(f[g-4],f[g]),this._$);break;case 23:this.$=new d.PartialStatement(f[g-3],f[g-2],f[g-1],d.stripFlags(f[g-4],f[g]),d.locInfo(this._$));break;case 24:this.$=f[g];break;case 25:this.$=f[g];break;case 26:this.$=new d.SubExpression(f[g-3],f[g-2],f[g-1],d.locInfo(this._$));break;case 27:this.$=new d.Hash(f[g],d.locInfo(this._$));break;case 28:this.$=new d.HashPair(d.id(f[g-2]),f[g],d.locInfo(this._$));break;case 29:this.$=d.id(f[g-1]);break;case 30:this.$=f[g];break;case 31:this.$=f[g];break;case 32:this.$=new d.StringLiteral(f[g],d.locInfo(this._$));break;case 33:this.$=new d.NumberLiteral(f[g],d.locInfo(this._$));break;case 34:this.$=new d.BooleanLiteral(f[g],d.locInfo(this._$));break;case 35:this.$=new d.UndefinedLiteral(d.locInfo(this._$));break;case 36:this.$=new d.NullLiteral(d.locInfo(this._$));break;case 37:this.$=f[g];break;case 38:this.$=f[g];break;case 39:this.$=d.preparePath(!0,f[g],this._$);break;case 40:this.$=d.preparePath(!1,f[g],this._$);break;case 41:f[g-2].push({part:d.id(f[g]),original:f[g],separator:f[g-1]}),this.$=f[g-2];break;case 42:this.$=[{part:d.id(f[g]),original:f[g]}];break;case 43:this.$=[];break;case 44:f[g-1].push(f[g]);break;case 45:this.$=[];break;case 46:f[g-1].push(f[g]);break;case 53:this.$=[];break;case 54:f[g-1].push(f[g]);break;case 59:this.$=[];break;case 60:f[g-1].push(f[g]);break;case 65:this.$=[];break;case 66:f[g-1].push(f[g]);break;case 73:this.$=[];break;case 74:f[g-1].push(f[g]);break;case 77:this.$=[];break;case 78:f[g-1].push(f[g]);break;case 81:this.$=[];break;case 82:f[g-1].push(f[g]);break;case 85:this.$=[];break;case 86:f[g-1].push(f[g]);break;case 89:this.$=[f[g]];break;case 90:f[g-1].push(f[g]);break;case 91:this.$=[f[g]];break;case 92:f[g-1].push(f[g])}},table:[{3:1,4:2,5:[2,43],6:3,13:[2,43],14:[2,43],17:[2,43],27:[2,43],32:[2,43],46:[2,43],49:[2,43],53:[2,43]},{1:[3]},{5:[1,4]},{5:[2,2],7:5,8:6,9:7,10:8,11:9,12:10,13:[1,11],14:[1,18],15:16,17:[1,21],22:14,25:15,27:[1,19],32:[1,20],37:[2,2],42:[2,2],45:[2,2],46:[1,12],49:[1,13],53:[1,17]},{1:[2,1]},{5:[2,44],13:[2,44],14:[2,44],17:[2,44],27:[2,44],32:[2,44],37:[2,44],42:[2,44],45:[2,44],46:[2,44],49:[2,44],53:[2,44]},{5:[2,3],13:[2,3],14:[2,3],17:[2,3],27:[2,3],32:[2,3],37:[2,3],42:[2,3],45:[2,3],46:[2,3],49:[2,3],53:[2,3]},{5:[2,4],13:[2,4],14:[2,4],17:[2,4],27:[2,4],32:[2,4],37:[2,4],42:[2,4],45:[2,4],46:[2,4],49:[2,4],53:[2,4]},{5:[2,5],13:[2,5],14:[2,5],17:[2,5],27:[2,5],32:[2,5],37:[2,5],42:[2,5],45:[2,5],46:[2,5],49:[2,5],53:[2,5]},{5:[2,6],13:[2,6],14:[2,6],17:[2,6],27:[2,6],32:[2,6],37:[2,6],42:[2,6],45:[2,6],46:[2,6],49:[2,6],53:[2,6]},{5:[2,7],13:[2,7],14:[2,7],17:[2,7],27:[2,7],32:[2,7],37:[2,7],42:[2,7],45:[2,7],46:[2,7],49:[2,7],53:[2,7]},{5:[2,8],13:[2,8],14:[2,8],17:[2,8],27:[2,8],32:[2,8],37:[2,8],42:[2,8],45:[2,8],46:[2,8],49:[2,8],53:[2,8]},{18:22,66:[1,32],72:23,73:24,74:[1,25],75:[1,26],76:[1,27],77:[1,28],78:[1,29],79:[1,31],80:30},{18:33,66:[1,32],72:23,73:24,74:[1,25],75:[1,26],76:[1,27],77:[1,28],78:[1,29],79:[1,31],80:30},{4:34,6:3,13:[2,43],14:[2,43],17:[2,43],27:[2,43],32:[2,43],37:[2,43],42:[2,43],45:[2,43],46:[2,43],49:[2,43],53:[2,43]},{4:35,6:3,13:[2,43],14:[2,43],17:[2,43],27:[2,43],32:[2,43],42:[2,43],45:[2,43],46:[2,43],49:[2,43],53:[2,43]},{12:36,14:[1,18]},{18:38,54:37,58:39,59:[1,40],66:[1,32],72:23,73:24,74:[1,25],75:[1,26],76:[1,27],77:[1,28],78:[1,29],79:[1,31],80:30},{5:[2,9],13:[2,9],14:[2,9],16:[2,9],17:[2,9],27:[2,9],32:[2,9],37:[2,9],42:[2,9],45:[2,9],46:[2,9],49:[2,9],53:[2,9]},{18:41,66:[1,32],72:23,73:24,74:[1,25],75:[1,26],76:[1,27],77:[1,28],78:[1,29],79:[1,31],80:30},{18:42,66:[1,32],72:23,73:24,74:[1,25],75:[1,26],76:[1,27],77:[1,28],78:[1,29],79:[1,31],80:30},{18:43,66:[1,32],72:23,73:24,74:[1,25],75:[1,26],76:[1,27],77:[1,28],78:[1,29],79:[1,31],80:30},{31:[2,73],47:44,59:[2,73],66:[2,73],74:[2,73],75:[2,73],76:[2,73],77:[2,73],78:[2,73],79:[2,73]},{21:[2,30],31:[2,30],52:[2,30],59:[2,30],62:[2,30],66:[2,30],69:[2,30],74:[2,30],75:[2,30],76:[2,30],77:[2,30],78:[2,30],79:[2,30]},{21:[2,31],31:[2,31],52:[2,31],59:[2,31],62:[2,31],66:[2,31],69:[2,31],74:[2,31],75:[2,31],76:[2,31],77:[2,31],78:[2,31],79:[2,31]},{21:[2,32],31:[2,32],52:[2,32],59:[2,32],62:[2,32],66:[2,32],69:[2,32],74:[2,32],75:[2,32],76:[2,32],77:[2,32],78:[2,32],79:[2,32]},{21:[2,33],31:[2,33],52:[2,33],59:[2,33],62:[2,33],66:[2,33],69:[2,33],74:[2,33],75:[2,33],76:[2,33],77:[2,33],78:[2,33],79:[2,33]},{21:[2,34],31:[2,34],52:[2,34],59:[2,34],62:[2,34],66:[2,34],69:[2,34],74:[2,34],75:[2,34],76:[2,34],77:[2,34],78:[2,34],79:[2,34]},{21:[2,35],31:[2,35],52:[2,35],59:[2,35],62:[2,35],66:[2,35],69:[2,35],74:[2,35],75:[2,35],76:[2,35],77:[2,35],78:[2,35],79:[2,35]},{21:[2,36],31:[2,36],52:[2,36],59:[2,36],62:[2,36],66:[2,36],69:[2,36],74:[2,36],75:[2,36],76:[2,36],77:[2,36],78:[2,36],79:[2,36]},{21:[2,40],31:[2,40],52:[2,40],59:[2,40],62:[2,40],66:[2,40],69:[2,40],74:[2,40],75:[2,40],76:[2,40],77:[2,40],78:[2,40],79:[2,40],81:[1,45]},{66:[1,32],80:46},{21:[2,42],31:[2,42],52:[2,42],59:[2,42],62:[2,42],66:[2,42],69:[2,42],74:[2,42],75:[2,42],76:[2,42],77:[2,42],78:[2,42],79:[2,42],81:[2,42]},{50:47,52:[2,77],59:[2,77],66:[2,77],74:[2,77],75:[2,77],76:[2,77],77:[2,77],78:[2,77],79:[2,77]},{23:48,36:50,37:[1,52],41:51,42:[1,53],43:49,45:[2,49]},{26:54,41:55,42:[1,53],45:[2,51]},{16:[1,56]},{31:[2,81],55:57,59:[2,81],66:[2,81],74:[2,81],75:[2,81],76:[2,81],77:[2,81],78:[2,81],79:[2,81]},{31:[2,37],59:[2,37],66:[2,37],74:[2,37],75:[2,37],76:[2,37],77:[2,37],78:[2,37],79:[2,37]},{31:[2,38],59:[2,38],66:[2,38],74:[2,38],75:[2,38],76:[2,38],77:[2,38],78:[2,38],79:[2,38]},{18:58,66:[1,32],72:23,73:24,74:[1,25],75:[1,26],76:[1,27],77:[1,28],78:[1,29],79:[1,31],80:30},{28:59,31:[2,53],59:[2,53],66:[2,53],69:[2,53],74:[2,53],75:[2,53],76:[2,53],77:[2,53],78:[2,53],79:[2,53]},{31:[2,59],33:60,59:[2,59],66:[2,59],69:[2,59],74:[2,59],75:[2,59],76:[2,59],77:[2,59],78:[2,59],79:[2,59]},{19:61,21:[2,45],59:[2,45],66:[2,45],74:[2,45],75:[2,45],76:[2,45],77:[2,45],78:[2,45],79:[2,45]},{18:65,31:[2,75],48:62,57:63,58:66,59:[1,40],63:64,64:67,65:68,66:[1,69],72:23,73:24,74:[1,25],75:[1,26],76:[1,27],77:[1,28],78:[1,29],79:[1,31],80:30},{66:[1,70]},{21:[2,39],31:[2,39],52:[2,39],59:[2,39],62:[2,39],66:[2,39],69:[2,39],74:[2,39],75:[2,39],76:[2,39],77:[2,39],78:[2,39],79:[2,39],81:[1,45]},{18:65,51:71,52:[2,79],57:72,58:66,59:[1,40],63:73,64:67,65:68,66:[1,69],72:23,73:24,74:[1,25],75:[1,26],76:[1,27],77:[1,28],78:[1,29],79:[1,31],80:30},{24:74,45:[1,75]},{45:[2,50]},{4:76,6:3,13:[2,43],14:[2,43],17:[2,43],27:[2,43],32:[2,43],37:[2,43],42:[2,43],45:[2,43],46:[2,43],49:[2,43],53:[2,43]},{45:[2,19]},{18:77,66:[1,32],72:23,73:24,74:[1,25],75:[1,26],76:[1,27],77:[1,28],78:[1,29],79:[1,31],80:30},{4:78,6:3,13:[2,43],14:[2,43],17:[2,43],27:[2,43],32:[2,43],45:[2,43],46:[2,43],49:[2,43],53:[2,43]},{24:79,45:[1,75]},{45:[2,52]},{5:[2,10],13:[2,10],14:[2,10],17:[2,10],27:[2,10],32:[2,10],37:[2,10],42:[2,10],45:[2,10],46:[2,10],49:[2,10],53:[2,10]},{18:65,31:[2,83],56:80,57:81,58:66,59:[1,40],63:82,64:67,65:68,66:[1,69],72:23,73:24,74:[1,25],75:[1,26],76:[1,27],77:[1,28],78:[1,29],79:[1,31],80:30},{59:[2,85],60:83,62:[2,85],66:[2,85],74:[2,85],75:[2,85],76:[2,85],77:[2,85],78:[2,85],79:[2,85]},{18:65,29:84,31:[2,55],57:85,58:66,59:[1,40],63:86,64:67,65:68,66:[1,69],69:[2,55],72:23,73:24,74:[1,25],75:[1,26],76:[1,27],77:[1,28],78:[1,29],79:[1,31],80:30},{18:65,31:[2,61],34:87,57:88,58:66,59:[1,40],63:89,64:67,65:68,66:[1,69],69:[2,61],72:23,73:24,74:[1,25],75:[1,26],76:[1,27],77:[1,28],78:[1,29],79:[1,31],80:30},{18:65,20:90,21:[2,47],57:91,58:66,59:[1,40],63:92,64:67,65:68,66:[1,69],72:23,73:24,74:[1,25],75:[1,26],76:[1,27],77:[1,28],78:[1,29],79:[1,31],80:30},{31:[1,93]},{31:[2,74],59:[2,74],66:[2,74],74:[2,74],75:[2,74],76:[2,74],77:[2,74],78:[2,74],79:[2,74]},{31:[2,76]},{21:[2,24],31:[2,24],52:[2,24],59:[2,24],62:[2,24],66:[2,24],69:[2,24],74:[2,24],75:[2,24],76:[2,24],77:[2,24],78:[2,24],79:[2,24]},{21:[2,25],31:[2,25],52:[2,25],59:[2,25],62:[2,25],66:[2,25],69:[2,25],74:[2,25],75:[2,25],76:[2,25],77:[2,25],78:[2,25],79:[2,25]},{21:[2,27],31:[2,27],52:[2,27],62:[2,27],65:94,66:[1,95],69:[2,27]},{21:[2,89],31:[2,89],52:[2,89],62:[2,89],66:[2,89],69:[2,89]},{21:[2,42],31:[2,42],52:[2,42],59:[2,42],62:[2,42],66:[2,42],67:[1,96],69:[2,42],74:[2,42],75:[2,42],76:[2,42],77:[2,42],78:[2,42],79:[2,42],81:[2,42]},{21:[2,41],31:[2,41],52:[2,41],59:[2,41],62:[2,41],66:[2,41],69:[2,41],74:[2,41],75:[2,41],76:[2,41],77:[2,41],78:[2,41],79:[2,41],81:[2,41]},{52:[1,97]},{52:[2,78],59:[2,78],66:[2,78],74:[2,78],75:[2,78],76:[2,78],77:[2,78],78:[2,78],79:[2,78]},{52:[2,80]},{5:[2,12],13:[2,12],14:[2,12],17:[2,12],27:[2,12],32:[2,12],37:[2,12],42:[2,12],45:[2,12],46:[2,12],49:[2,12],53:[2,12]},{18:98,66:[1,32],72:23,73:24,74:[1,25],75:[1,26],76:[1,27],77:[1,28],78:[1,29],79:[1,31],80:30},{36:50,37:[1,52],41:51,42:[1,53],43:100,44:99,45:[2,71]},{31:[2,65],38:101,59:[2,65],66:[2,65],69:[2,65],74:[2,65],75:[2,65],76:[2,65],77:[2,65],78:[2,65],79:[2,65]},{45:[2,17]},{5:[2,13],13:[2,13],14:[2,13],17:[2,13],27:[2,13],32:[2,13],37:[2,13],42:[2,13],45:[2,13],46:[2,13],49:[2,13],53:[2,13]},{31:[1,102]},{31:[2,82],59:[2,82],66:[2,82],74:[2,82],75:[2,82],76:[2,82],77:[2,82],78:[2,82],79:[2,82]},{31:[2,84]},{18:65,57:104,58:66,59:[1,40],61:103,62:[2,87],63:105,64:67,65:68,66:[1,69],72:23,73:24,74:[1,25],75:[1,26],76:[1,27],77:[1,28],78:[1,29],79:[1,31],80:30},{30:106,31:[2,57],68:107,69:[1,108]},{31:[2,54],59:[2,54],66:[2,54],69:[2,54],74:[2,54],75:[2,54],76:[2,54],77:[2,54],78:[2,54],79:[2,54]},{31:[2,56],69:[2,56]},{31:[2,63],35:109,68:110,69:[1,108]},{31:[2,60],59:[2,60],66:[2,60],69:[2,60],74:[2,60],75:[2,60],76:[2,60],77:[2,60],78:[2,60],79:[2,60]},{31:[2,62],69:[2,62]},{21:[1,111]},{21:[2,46],59:[2,46],66:[2,46],74:[2,46],75:[2,46],76:[2,46],77:[2,46],78:[2,46],79:[2,46]},{21:[2,48]},{5:[2,21],13:[2,21],14:[2,21],17:[2,21],27:[2,21],32:[2,21],37:[2,21],42:[2,21],45:[2,21],46:[2,21],49:[2,21],53:[2,21]},{21:[2,90],31:[2,90],52:[2,90],62:[2,90],66:[2,90],69:[2,90]},{67:[1,96]},{18:65,57:112,58:66,59:[1,40],66:[1,32],72:23,73:24,74:[1,25],75:[1,26],76:[1,27],77:[1,28],78:[1,29],79:[1,31],80:30},{5:[2,22],13:[2,22],14:[2,22],17:[2,22],27:[2,22],32:[2,22],37:[2,22],42:[2,22],45:[2,22],46:[2,22],49:[2,22],53:[2,22]},{31:[1,113]},{45:[2,18]},{45:[2,72]},{18:65,31:[2,67],39:114,57:115,58:66,59:[1,40],63:116,64:67,65:68,66:[1,69],69:[2,67],72:23,73:24,74:[1,25],75:[1,26],76:[1,27],77:[1,28],78:[1,29],79:[1,31],80:30},{5:[2,23],13:[2,23],14:[2,23],17:[2,23],27:[2,23],32:[2,23],37:[2,23],42:[2,23],45:[2,23],46:[2,23],49:[2,23],53:[2,23]},{62:[1,117]},{59:[2,86],62:[2,86],66:[2,86],74:[2,86],75:[2,86],76:[2,86],77:[2,86],78:[2,86],79:[2,86]},{62:[2,88]},{31:[1,118]},{31:[2,58]},{66:[1,120],70:119},{31:[1,121]},{31:[2,64]},{14:[2,11]},{21:[2,28],31:[2,28],52:[2,28],62:[2,28],66:[2,28],69:[2,28]},{5:[2,20],13:[2,20],14:[2,20],17:[2,20],27:[2,20],32:[2,20],37:[2,20],42:[2,20],45:[2,20],46:[2,20],49:[2,20],53:[2,20]},{31:[2,69],40:122,68:123,69:[1,108]},{31:[2,66],59:[2,66],66:[2,66],69:[2,66],74:[2,66],75:[2,66],76:[2,66],77:[2,66],78:[2,66],79:[2,66]},{31:[2,68],69:[2,68]},{21:[2,26],31:[2,26],52:[2,26],59:[2,26],62:[2,26],66:[2,26],69:[2,26],74:[2,26],75:[2,26],76:[2,26],77:[2,26],78:[2,26],79:[2,26]},{13:[2,14],14:[2,14],17:[2,14],27:[2,14],32:[2,14],37:[2,14],42:[2,14],45:[2,14],46:[2,14],49:[2,14],53:[2,14]},{66:[1,125],71:[1,124]},{66:[2,91],71:[2,91]},{13:[2,15],14:[2,15],17:[2,15],27:[2,15],32:[2,15],42:[2,15],45:[2,15],46:[2,15],49:[2,15],53:[2,15]},{31:[1,126]},{31:[2,70]},{31:[2,29]},{66:[2,92],71:[2,92]},{13:[2,16],14:[2,16],17:[2,16],27:[2,16],32:[2,16],37:[2,16],42:[2,16],45:[2,16],46:[2,16],49:[2,16],53:[2,16]}],defaultActions:{4:[2,1],49:[2,50],51:[2,19],55:[2,52],64:[2,76],73:[2,80],78:[2,17],82:[2,84],92:[2,48],99:[2,18],100:[2,72],105:[2,88],107:[2,58],110:[2,64],111:[2,11],123:[2,70],124:[2,29]},parseError:function(a){throw new Error(a)},parse:function(a){function b(){var a;return a=c.lexer.lex()||1,"number"!=typeof a&&(a=c.symbols_[a]||a),a}var c=this,d=[0],e=[null],f=[],g=this.table,h="",i=0,j=0,k=0;this.lexer.setInput(a),this.lexer.yy=this.yy,this.yy.lexer=this.lexer,this.yy.parser=this,"undefined"==typeof this.lexer.yylloc&&(this.lexer.yylloc={});var l=this.lexer.yylloc;f.push(l);var m=this.lexer.options&&this.lexer.options.ranges;"function"==typeof this.yy.parseError&&(this.parseError=this.yy.parseError);for(var n,o,p,q,r,s,t,u,v,w={};;){if(p=d[d.length-1],this.defaultActions[p]?q=this.defaultActions[p]:((null===n||"undefined"==typeof n)&&(n=b()),q=g[p]&&g[p][n]),"undefined"==typeof q||!q.length||!q[0]){var x="";if(!k){v=[];for(s in g[p])this.terminals_[s]&&s>2&&v.push("'"+this.terminals_[s]+"'");x=this.lexer.showPosition?"Parse error on line "+(i+1)+":\n"+this.lexer.showPosition()+"\nExpecting "+v.join(", ")+", got '"+(this.terminals_[n]||n)+"'":"Parse error on line "+(i+1)+": Unexpected "+(1==n?"end of input":"'"+(this.terminals_[n]||n)+"'"),this.parseError(x,{text:this.lexer.match,token:this.terminals_[n]||n,line:this.lexer.yylineno,loc:l,expected:v})}}if(q[0]instanceof Array&&q.length>1)throw new Error("Parse Error: multiple actions possible at state: "+p+", token: "+n);switch(q[0]){case 1:d.push(n),e.push(this.lexer.yytext),f.push(this.lexer.yylloc),d.push(q[1]),n=null,o?(n=o,o=null):(j=this.lexer.yyleng,h=this.lexer.yytext,i=this.lexer.yylineno,l=this.lexer.yylloc,k>0&&k--);break;case 2:if(t=this.productions_[q[1]][1],w.$=e[e.length-t],w._$={first_line:f[f.length-(t||1)].first_line,last_line:f[f.length-1].last_line,first_column:f[f.length-(t||1)].first_column,last_column:f[f.length-1].last_column},m&&(w._$.range=[f[f.length-(t||1)].range[0],f[f.length-1].range[1]]),r=this.performAction.call(w,h,j,i,this.yy,q[1],e,f),"undefined"!=typeof r)return r;t&&(d=d.slice(0,-1*t*2),e=e.slice(0,-1*t),f=f.slice(0,-1*t)),d.push(this.productions_[q[1]][0]),e.push(w.$),f.push(w._$),u=g[d[d.length-2]][d[d.length-1]],d.push(u);break;case 3:return!0}}return!0}},c=function(){var a={EOF:1,parseError:function(a,b){if(!this.yy.parser)throw new Error(a);this.yy.parser.parseError(a,b)},setInput:function(a){return this._input=a,this._more=this._less=this.done=!1,this.yylineno=this.yyleng=0,this.yytext=this.matched=this.match="",this.conditionStack=["INITIAL"],this.yylloc={first_line:1,first_column:0,last_line:1,last_column:0},this.options.ranges&&(this.yylloc.range=[0,0]),this.offset=0,this},input:function(){var a=this._input[0];this.yytext+=a,this.yyleng++,this.offset++,this.match+=a,this.matched+=a;var b=a.match(/(?:\r\n?|\n).*/g);return b?(this.yylineno++,this.yylloc.last_line++):this.yylloc.last_column++,this.options.ranges&&this.yylloc.range[1]++,this._input=this._input.slice(1),a},unput:function(a){var b=a.length,c=a.split(/(?:\r\n?|\n)/g);this._input=a+this._input,this.yytext=this.yytext.substr(0,this.yytext.length-b-1),this.offset-=b;var d=this.match.split(/(?:\r\n?|\n)/g);this.match=this.match.substr(0,this.match.length-1),this.matched=this.matched.substr(0,this.matched.length-1),c.length-1&&(this.yylineno-=c.length-1);var e=this.yylloc.range;return this.yylloc={first_line:this.yylloc.first_line,last_line:this.yylineno+1,first_column:this.yylloc.first_column,last_column:c?(c.length===d.length?this.yylloc.first_column:0)+d[d.length-c.length].length-c[0].length:this.yylloc.first_column-b},this.options.ranges&&(this.yylloc.range=[e[0],e[0]+this.yyleng-b]),this},more:function(){return this._more=!0,this},less:function(a){this.unput(this.match.slice(a))},pastInput:function(){var a=this.matched.substr(0,this.matched.length-this.match.length);return(a.length>20?"...":"")+a.substr(-20).replace(/\n/g,"")},upcomingInput:function(){var a=this.match;return a.length<20&&(a+=this._input.substr(0,20-a.length)),(a.substr(0,20)+(a.length>20?"...":"")).replace(/\n/g,"")},showPosition:function(){var a=this.pastInput(),b=new Array(a.length+1).join("-");return a+this.upcomingInput()+"\n"+b+"^"},next:function(){if(this.done)return this.EOF;this._input||(this.done=!0);var a,b,c,d,e;this._more||(this.yytext="",this.match="");for(var f=this._currentRules(),g=0;g<f.length&&(c=this._input.match(this.rules[f[g]]),!c||b&&!(c[0].length>b[0].length)||(b=c,d=g,this.options.flex));g++);return b?(e=b[0].match(/(?:\r\n?|\n).*/g),e&&(this.yylineno+=e.length),this.yylloc={first_line:this.yylloc.last_line,last_line:this.yylineno+1,first_column:this.yylloc.last_column,last_column:e?e[e.length-1].length-e[e.length-1].match(/\r?\n?/)[0].length:this.yylloc.last_column+b[0].length},this.yytext+=b[0],this.match+=b[0],this.matches=b,this.yyleng=this.yytext.length,this.options.ranges&&(this.yylloc.range=[this.offset,this.offset+=this.yyleng]),this._more=!1,this._input=this._input.slice(b[0].length),this.matched+=b[0],a=this.performAction.call(this,this.yy,this,f[d],this.conditionStack[this.conditionStack.length-1]),this.done&&this._input&&(this.done=!1),a?a:void 0):""===this._input?this.EOF:this.parseError("Lexical error on line "+(this.yylineno+1)+". Unrecognized text.\n"+this.showPosition(),{text:"",token:null,line:this.yylineno})},lex:function(){var a=this.next();return"undefined"!=typeof a?a:this.lex()},begin:function(a){this.conditionStack.push(a)},popState:function(){return this.conditionStack.pop()},_currentRules:function(){return this.conditions[this.conditionStack[this.conditionStack.length-1]].rules},topState:function(){return this.conditionStack[this.conditionStack.length-2]},pushState:function(a){this.begin(a)}};return a.options={},a.performAction=function(a,b,c,d){function e(a,c){return b.yytext=b.yytext.substr(a,b.yyleng-c)}switch(c){case 0:if("\\\\"===b.yytext.slice(-2)?(e(0,1),this.begin("mu")):"\\"===b.yytext.slice(-1)?(e(0,1),this.begin("emu")):this.begin("mu"),b.yytext)return 14;break;case 1:return 14;case 2:return this.popState(),14;case 3:return b.yytext=b.yytext.substr(5,b.yyleng-9),this.popState(),16;case 4:return 14;case 5:return this.popState(),13;case 6:return 59;case 7:return 62;case 8:return 17;case 9:return this.popState(),this.begin("raw"),21;case 10:return 53;case 11:return 27;case 12:return 45;case 13:return this.popState(),42;case 14:return this.popState(),42;case 15:return 32;case 16:return 37;case 17:return 49;case 18:return 46;case 19:this.unput(b.yytext),this.popState(),this.begin("com");break;case 20:return this.popState(),13;case 21:return 46;case 22:return 67;case 23:return 66;case 24:return 66;case 25:return 81;case 26:break;case 27:return this.popState(),52;case 28:return this.popState(),31;case 29:return b.yytext=e(1,2).replace(/\\"/g,'"'),74;case 30:return b.yytext=e(1,2).replace(/\\'/g,"'"),74;case 31:return 79;case 32:return 76;case 33:return 76;case 34:return 77;case 35:return 78;case 36:return 75;case 37:return 69;case 38:return 71;case 39:return 66;case 40:return 66;case 41:return"INVALID";case 42:return 5}},a.rules=[/^(?:[^\x00]*?(?=(\{\{)))/,/^(?:[^\x00]+)/,/^(?:[^\x00]{2,}?(?=(\{\{|\\\{\{|\\\\\{\{|$)))/,/^(?:\{\{\{\{\/[^\s!"#%-,\.\/;->@\[-\^`\{-~]+(?=[=}\s\/.])\}\}\}\})/,/^(?:[^\x00]*?(?=(\{\{\{\{\/)))/,/^(?:[\s\S]*?--(~)?\}\})/,/^(?:\()/,/^(?:\))/,/^(?:\{\{\{\{)/,/^(?:\}\}\}\})/,/^(?:\{\{(~)?>)/,/^(?:\{\{(~)?#)/,/^(?:\{\{(~)?\/)/,/^(?:\{\{(~)?\^\s*(~)?\}\})/,/^(?:\{\{(~)?\s*else\s*(~)?\}\})/,/^(?:\{\{(~)?\^)/,/^(?:\{\{(~)?\s*else\b)/,/^(?:\{\{(~)?\{)/,/^(?:\{\{(~)?&)/,/^(?:\{\{(~)?!--)/,/^(?:\{\{(~)?![\s\S]*?\}\})/,/^(?:\{\{(~)?)/,/^(?:=)/,/^(?:\.\.)/,/^(?:\.(?=([=~}\s\/.)|])))/,/^(?:[\/.])/,/^(?:\s+)/,/^(?:\}(~)?\}\})/,/^(?:(~)?\}\})/,/^(?:"(\\["]|[^"])*")/,/^(?:'(\\[']|[^'])*')/,/^(?:@)/,/^(?:true(?=([~}\s)])))/,/^(?:false(?=([~}\s)])))/,/^(?:undefined(?=([~}\s)])))/,/^(?:null(?=([~}\s)])))/,/^(?:-?[0-9]+(?:\.[0-9]+)?(?=([~}\s)])))/,/^(?:as\s+\|)/,/^(?:\|)/,/^(?:([^\s!"#%-,\.\/;->@\[-\^`\{-~]+(?=([=~}\s\/.)|]))))/,/^(?:\[[^\]]*\])/,/^(?:.)/,/^(?:$)/],a.conditions={mu:{rules:[6,7,8,9,10,11,12,13,14,15,16,17,18,19,20,21,22,23,24,25,26,27,28,29,30,31,32,33,34,35,36,37,38,39,40,41,42],inclusive:!1},emu:{rules:[2],inclusive:!1},com:{rules:[5],inclusive:!1},raw:{rules:[3,4],inclusive:!1},INITIAL:{rules:[0,1,42],inclusive:!0}},a}();return b.lexer=c,a.prototype=b,b.Parser=a,new a}();b["default"]=c,a.exports=b["default"]},function(a,b,c){"use strict";function d(){}function e(a,b,c){void 0===b&&(b=a.length);var d=a[b-1],e=a[b-2];return d?"ContentStatement"===d.type?(e||!c?/\r?\n\s*?$/:/(^|\r?\n)\s*?$/).test(d.original):void 0:c}function f(a,b,c){void 0===b&&(b=-1);var d=a[b+1],e=a[b+2];return d?"ContentStatement"===d.type?(e||!c?/^\s*?\r?\n/:/^\s*?(\r?\n|$)/).test(d.original):void 0:c}function g(a,b,c){var d=a[null==b?0:b+1];if(d&&"ContentStatement"===d.type&&(c||!d.rightStripped)){var e=d.value;d.value=d.value.replace(c?/^\s+/:/^[ \t]*\r?\n?/,""),d.rightStripped=d.value!==e}}function h(a,b,c){var d=a[null==b?a.length-1:b-1];if(d&&"ContentStatement"===d.type&&(c||!d.leftStripped)){var e=d.value;return d.value=d.value.replace(c?/\s+$/:/[ \t]+$/,""),d.leftStripped=d.value!==e,d.leftStripped}}var i=c(8)["default"];b.__esModule=!0;var j=c(6),k=i(j);d.prototype=new k["default"],d.prototype.Program=function(a){var b=!this.isRootSeen;this.isRootSeen=!0;for(var c=a.body,d=0,i=c.length;i>d;d++){var j=c[d],k=this.accept(j);if(k){var l=e(c,d,b),m=f(c,d,b),n=k.openStandalone&&l,o=k.closeStandalone&&m,p=k.inlineStandalone&&l&&m;k.close&&g(c,d,!0),k.open&&h(c,d,!0),p&&(g(c,d),h(c,d)&&"PartialStatement"===j.type&&(j.indent=/([ \t]+$)/.exec(c[d-1].original)[1])),n&&(g((j.program||j.inverse).body),h(c,d)),o&&(g(c,d),h((j.inverse||j.program).body))}}return a},d.prototype.BlockStatement=function(a){this.accept(a.program),this.accept(a.inverse);var b=a.program||a.inverse,c=a.program&&a.inverse,d=c,i=c;if(c&&c.chained)for(d=c.body[0].program;i.chained;)i=i.body[i.body.length-1].program;var j={open:a.openStrip.open,close:a.closeStrip.close,openStandalone:f(b.body),closeStandalone:e((d||b).body)};if(a.openStrip.close&&g(b.body,null,!0),c){var k=a.inverseStrip;k.open&&h(b.body,null,!0),k.close&&g(d.body,null,!0),a.closeStrip.open&&h(i.body,null,!0),e(b.body)&&f(d.body)&&(h(b.body),g(d.body))}else a.closeStrip.open&&h(b.body,null,!0);return j},d.prototype.MustacheStatement=function(a){return a.strip},d.prototype.PartialStatement=d.prototype.CommentStatement=function(a){var b=a.strip||{};return{inlineStandalone:!0,open:b.open,close:b.close}},b["default"]=d,a.exports=b["default"]},function(a,b,c){"use strict";function d(a,b){this.source=a,this.start={line:b.first_line,column:b.first_column},this.end={line:b.last_line,column:b.last_column}}function e(a){return/^\[.*\]$/.test(a)?a.substr(1,a.length-2):a}function f(a,b){return{open:"~"===a.charAt(2),close:"~"===b.charAt(b.length-3)}}function g(a){return a.replace(/^\{\{~?\!-?-?/,"").replace(/-?-?~?\}\}$/,"")}function h(a,b,c){c=this.locInfo(c);for(var d=a?"@":"",e=[],f=0,g="",h=0,i=b.length;i>h;h++){var j=b[h].part,k=b[h].original!==j;if(d+=(b[h].separator||"")+j,k||".."!==j&&"."!==j&&"this"!==j)e.push(j);else{if(e.length>0)throw new n["default"]("Invalid path: "+d,{loc:c});".."===j&&(f++,g+="../")}}return new this.PathExpression(a,f,e,d,c)}function i(a,b,c,d,e,f){var g=d.charAt(3)||d.charAt(2),h="{"!==g&&"&"!==g;return new this.MustacheStatement(a,b,c,h,e,this.locInfo(f))}function j(a,b,c,d){if(a.path.original!==c){var e={loc:a.path.loc};throw new n["default"](a.path.original+" doesn't match "+c,e)}d=this.locInfo(d);var f=new this.Program([b],null,{},d);return new this.BlockStatement(a.path,a.params,a.hash,f,void 0,{},{},{},d)}function k(a,b,c,d,e,f){if(d&&d.path&&a.path.original!==d.path.original){var g={loc:a.path.loc};throw new n["default"](a.path.original+" doesn't match "+d.path.original,g)}b.blockParams=a.blockParams;var h=void 0,i=void 0;return c&&(c.chain&&(c.program.body[0].closeStrip=d.strip),i=c.strip,h=c.program),e&&(e=h,h=b,b=e),new this.BlockStatement(a.path,a.params,a.hash,b,h,a.strip,i,d&&d.strip,this.locInfo(f))}var l=c(8)["default"];b.__esModule=!0,b.SourceLocation=d,b.id=e,b.stripFlags=f,b.stripComment=g,b.preparePath=h,b.prepareMustache=i,b.prepareRawBlock=j,b.prepareBlock=k;var m=c(11),n=l(m)},function(a,b,c){"use strict";function d(a,b,c){if(f.isArray(a)){for(var d=[],e=0,g=a.length;g>e;e++)d.push(b.wrap(a[e],c));return d}return"boolean"==typeof a||"number"==typeof a?a+"":a}function e(a){this.srcFile=a,this.source=[]}b.__esModule=!0;var f=c(12),g=void 0;try{}catch(h){}g||(g=function(a,b,c,d){this.src="",d&&this.add(d)},g.prototype={add:function(a){f.isArray(a)&&(a=a.join("")),this.src+=a},prepend:function(a){f.isArray(a)&&(a=a.join("")),this.src=a+this.src},toStringWithSourceMap:function(){return{code:this.toString()}},toString:function(){return this.src}}),e.prototype={prepend:function(a,b){this.source.unshift(this.wrap(a,b))},push:function(a,b){this.source.push(this.wrap(a,b))},merge:function(){var a=this.empty();return this.each(function(b){a.add(["  ",b,"\n"])}),a},each:function(a){for(var b=0,c=this.source.length;c>b;b++)a(this.source[b])},empty:function(){var a=void 0===arguments[0]?this.currentLocation||{start:{}}:arguments[0];return new g(a.start.line,a.start.column,this.srcFile)},wrap:function(a){var b=void 0===arguments[1]?this.currentLocation||{start:{}}:arguments[1];return a instanceof g?a:(a=d(a,this,b),new g(b.start.line,b.start.column,this.srcFile,a))},functionCall:function(a,b,c){return c=this.generateList(c),this.wrap([a,b?"."+b+"(":"(",c,")"])},quotedString:function(a){return'"'+(a+"").replace(/\\/g,"\\\\").replace(/"/g,'\\"').replace(/\n/g,"\\n").replace(/\r/g,"\\r").replace(/\u2028/g,"\\u2028").replace(/\u2029/g,"\\u2029")+'"'},objectLiteral:function(a){var b=[];for(var c in a)if(a.hasOwnProperty(c)){var e=d(a[c],this);"undefined"!==e&&b.push([this.quotedString(c),":",e])
}var f=this.generateList(b);return f.prepend("{"),f.add("}"),f},generateList:function(a,b){for(var c=this.empty(b),e=0,f=a.length;f>e;e++)e&&c.add(","),c.add(d(a[e],this,b));return c},generateArray:function(a,b){var c=this.generateList(a,b);return c.prepend("["),c.add("]"),c}},b["default"]=e,a.exports=b["default"]}])});
/**
 * @license RequireJS text 2.0.14 Copyright (c) 2010-2014, The Dojo Foundation All Rights Reserved.
 * Available via the MIT or new BSD license.
 * see: http://github.com/requirejs/text for details
 */
/*jslint regexp: true */
/*global require, XMLHttpRequest, ActiveXObject,
  define, window, process, Packages,
  java, location, Components, FileUtils */

define('text',['module'], function (module) {
    'use strict';

    var text, fs, Cc, Ci, xpcIsWindows,
        progIds = ['Msxml2.XMLHTTP', 'Microsoft.XMLHTTP', 'Msxml2.XMLHTTP.4.0'],
        xmlRegExp = /^\s*<\?xml(\s)+version=[\'\"](\d)*.(\d)*[\'\"](\s)*\?>/im,
        bodyRegExp = /<body[^>]*>\s*([\s\S]+)\s*<\/body>/im,
        hasLocation = typeof location !== 'undefined' && location.href,
        defaultProtocol = hasLocation && location.protocol && location.protocol.replace(/\:/, ''),
        defaultHostName = hasLocation && location.hostname,
        defaultPort = hasLocation && (location.port || undefined),
        buildMap = {},
        masterConfig = (module.config && module.config()) || {};

    text = {
        version: '2.0.14',

        strip: function (content) {
            //Strips <?xml ...?> declarations so that external SVG and XML
            //documents can be added to a document without worry. Also, if the string
            //is an HTML document, only the part inside the body tag is returned.
            if (content) {
                content = content.replace(xmlRegExp, "");
                var matches = content.match(bodyRegExp);
                if (matches) {
                    content = matches[1];
                }
            } else {
                content = "";
            }
            return content;
        },

        jsEscape: function (content) {
            return content.replace(/(['\\])/g, '\\$1')
                .replace(/[\f]/g, "\\f")
                .replace(/[\b]/g, "\\b")
                .replace(/[\n]/g, "\\n")
                .replace(/[\t]/g, "\\t")
                .replace(/[\r]/g, "\\r")
                .replace(/[\u2028]/g, "\\u2028")
                .replace(/[\u2029]/g, "\\u2029");
        },

        createXhr: masterConfig.createXhr || function () {
            //Would love to dump the ActiveX crap in here. Need IE 6 to die first.
            var xhr, i, progId;
            if (typeof XMLHttpRequest !== "undefined") {
                return new XMLHttpRequest();
            } else if (typeof ActiveXObject !== "undefined") {
                for (i = 0; i < 3; i += 1) {
                    progId = progIds[i];
                    try {
                        xhr = new ActiveXObject(progId);
                    } catch (e) {}

                    if (xhr) {
                        progIds = [progId];  // so faster next time
                        break;
                    }
                }
            }

            return xhr;
        },

        /**
         * Parses a resource name into its component parts. Resource names
         * look like: module/name.ext!strip, where the !strip part is
         * optional.
         * @param {String} name the resource name
         * @returns {Object} with properties "moduleName", "ext" and "strip"
         * where strip is a boolean.
         */
        parseName: function (name) {
            var modName, ext, temp,
                strip = false,
                index = name.lastIndexOf("."),
                isRelative = name.indexOf('./') === 0 ||
                             name.indexOf('../') === 0;

            if (index !== -1 && (!isRelative || index > 1)) {
                modName = name.substring(0, index);
                ext = name.substring(index + 1);
            } else {
                modName = name;
            }

            temp = ext || modName;
            index = temp.indexOf("!");
            if (index !== -1) {
                //Pull off the strip arg.
                strip = temp.substring(index + 1) === "strip";
                temp = temp.substring(0, index);
                if (ext) {
                    ext = temp;
                } else {
                    modName = temp;
                }
            }

            return {
                moduleName: modName,
                ext: ext,
                strip: strip
            };
        },

        xdRegExp: /^((\w+)\:)?\/\/([^\/\\]+)/,

        /**
         * Is an URL on another domain. Only works for browser use, returns
         * false in non-browser environments. Only used to know if an
         * optimized .js version of a text resource should be loaded
         * instead.
         * @param {String} url
         * @returns Boolean
         */
        useXhr: function (url, protocol, hostname, port) {
            var uProtocol, uHostName, uPort,
                match = text.xdRegExp.exec(url);
            if (!match) {
                return true;
            }
            uProtocol = match[2];
            uHostName = match[3];

            uHostName = uHostName.split(':');
            uPort = uHostName[1];
            uHostName = uHostName[0];

            return (!uProtocol || uProtocol === protocol) &&
                   (!uHostName || uHostName.toLowerCase() === hostname.toLowerCase()) &&
                   ((!uPort && !uHostName) || uPort === port);
        },

        finishLoad: function (name, strip, content, onLoad) {
            content = strip ? text.strip(content) : content;
            if (masterConfig.isBuild) {
                buildMap[name] = content;
            }
            onLoad(content);
        },

        load: function (name, req, onLoad, config) {
            //Name has format: some.module.filext!strip
            //The strip part is optional.
            //if strip is present, then that means only get the string contents
            //inside a body tag in an HTML string. For XML/SVG content it means
            //removing the <?xml ...?> declarations so the content can be inserted
            //into the current doc without problems.

            // Do not bother with the work if a build and text will
            // not be inlined.
            if (config && config.isBuild && !config.inlineText) {
                onLoad();
                return;
            }

            masterConfig.isBuild = config && config.isBuild;

            var parsed = text.parseName(name),
                nonStripName = parsed.moduleName +
                    (parsed.ext ? '.' + parsed.ext : ''),
                url = req.toUrl(nonStripName),
                useXhr = (masterConfig.useXhr) ||
                         text.useXhr;

            // Do not load if it is an empty: url
            if (url.indexOf('empty:') === 0) {
                onLoad();
                return;
            }

            //Load the text. Use XHR if possible and in a browser.
            if (!hasLocation || useXhr(url, defaultProtocol, defaultHostName, defaultPort)) {
                text.get(url, function (content) {
                    text.finishLoad(name, parsed.strip, content, onLoad);
                }, function (err) {
                    if (onLoad.error) {
                        onLoad.error(err);
                    }
                });
            } else {
                //Need to fetch the resource across domains. Assume
                //the resource has been optimized into a JS module. Fetch
                //by the module name + extension, but do not include the
                //!strip part to avoid file system issues.
                req([nonStripName], function (content) {
                    text.finishLoad(parsed.moduleName + '.' + parsed.ext,
                                    parsed.strip, content, onLoad);
                });
            }
        },

        write: function (pluginName, moduleName, write, config) {
            if (buildMap.hasOwnProperty(moduleName)) {
                var content = text.jsEscape(buildMap[moduleName]);
                write.asModule(pluginName + "!" + moduleName,
                               "define(function () { return '" +
                                   content +
                               "';});\n");
            }
        },

        writeFile: function (pluginName, moduleName, req, write, config) {
            var parsed = text.parseName(moduleName),
                extPart = parsed.ext ? '.' + parsed.ext : '',
                nonStripName = parsed.moduleName + extPart,
                //Use a '.js' file name so that it indicates it is a
                //script that can be loaded across domains.
                fileName = req.toUrl(parsed.moduleName + extPart) + '.js';

            //Leverage own load() method to load plugin value, but only
            //write out values that do not have the strip argument,
            //to avoid any potential issues with ! in file names.
            text.load(nonStripName, req, function (value) {
                //Use own write() method to construct full module value.
                //But need to create shell that translates writeFile's
                //write() to the right interface.
                var textWrite = function (contents) {
                    return write(fileName, contents);
                };
                textWrite.asModule = function (moduleName, contents) {
                    return write.asModule(moduleName, fileName, contents);
                };

                text.write(pluginName, nonStripName, textWrite, config);
            }, config);
        }
    };

    if (masterConfig.env === 'node' || (!masterConfig.env &&
            typeof process !== "undefined" &&
            process.versions &&
            !!process.versions.node &&
            !process.versions['node-webkit'] &&
            !process.versions['atom-shell'])) {
        //Using special require.nodeRequire, something added by r.js.
        fs = require.nodeRequire('fs');

        text.get = function (url, callback, errback) {
            try {
                var file = fs.readFileSync(url, 'utf8');
                //Remove BOM (Byte Mark Order) from utf8 files if it is there.
                if (file[0] === '\uFEFF') {
                    file = file.substring(1);
                }
                callback(file);
            } catch (e) {
                if (errback) {
                    errback(e);
                }
            }
        };
    } else if (masterConfig.env === 'xhr' || (!masterConfig.env &&
            text.createXhr())) {
        text.get = function (url, callback, errback, headers) {
            var xhr = text.createXhr(), header;
            xhr.open('GET', url, true);

            //Allow plugins direct access to xhr headers
            if (headers) {
                for (header in headers) {
                    if (headers.hasOwnProperty(header)) {
                        xhr.setRequestHeader(header.toLowerCase(), headers[header]);
                    }
                }
            }

            //Allow overrides specified in config
            if (masterConfig.onXhr) {
                masterConfig.onXhr(xhr, url);
            }

            xhr.onreadystatechange = function (evt) {
                var status, err;
                //Do not explicitly handle errors, those should be
                //visible via console output in the browser.
                if (xhr.readyState === 4) {
                    status = xhr.status || 0;
                    if (status > 399 && status < 600) {
                        //An http 4xx or 5xx error. Signal an error.
                        err = new Error(url + ' HTTP status: ' + status);
                        err.xhr = xhr;
                        if (errback) {
                            errback(err);
                        }
                    } else {
                        callback(xhr.responseText);
                    }

                    if (masterConfig.onXhrComplete) {
                        masterConfig.onXhrComplete(xhr, url);
                    }
                }
            };
            xhr.send(null);
        };
    } else if (masterConfig.env === 'rhino' || (!masterConfig.env &&
            typeof Packages !== 'undefined' && typeof java !== 'undefined')) {
        //Why Java, why is this so awkward?
        text.get = function (url, callback) {
            var stringBuffer, line,
                encoding = "utf-8",
                file = new java.io.File(url),
                lineSeparator = java.lang.System.getProperty("line.separator"),
                input = new java.io.BufferedReader(new java.io.InputStreamReader(new java.io.FileInputStream(file), encoding)),
                content = '';
            try {
                stringBuffer = new java.lang.StringBuffer();
                line = input.readLine();

                // Byte Order Mark (BOM) - The Unicode Standard, version 3.0, page 324
                // http://www.unicode.org/faq/utf_bom.html

                // Note that when we use utf-8, the BOM should appear as "EF BB BF", but it doesn't due to this bug in the JDK:
                // http://bugs.sun.com/bugdatabase/view_bug.do?bug_id=4508058
                if (line && line.length() && line.charAt(0) === 0xfeff) {
                    // Eat the BOM, since we've already found the encoding on this file,
                    // and we plan to concatenating this buffer with others; the BOM should
                    // only appear at the top of a file.
                    line = line.substring(1);
                }

                if (line !== null) {
                    stringBuffer.append(line);
                }

                while ((line = input.readLine()) !== null) {
                    stringBuffer.append(lineSeparator);
                    stringBuffer.append(line);
                }
                //Make sure we return a JavaScript string and not a Java string.
                content = String(stringBuffer.toString()); //String
            } finally {
                input.close();
            }
            callback(content);
        };
    } else if (masterConfig.env === 'xpconnect' || (!masterConfig.env &&
            typeof Components !== 'undefined' && Components.classes &&
            Components.interfaces)) {
        //Avert your gaze!
        Cc = Components.classes;
        Ci = Components.interfaces;
        Components.utils['import']('resource://gre/modules/FileUtils.jsm');
        xpcIsWindows = ('@mozilla.org/windows-registry-key;1' in Cc);

        text.get = function (url, callback) {
            var inStream, convertStream, fileObj,
                readData = {};

            if (xpcIsWindows) {
                url = url.replace(/\//g, '\\');
            }

            fileObj = new FileUtils.File(url);

            //XPCOM, you so crazy
            try {
                inStream = Cc['@mozilla.org/network/file-input-stream;1']
                           .createInstance(Ci.nsIFileInputStream);
                inStream.init(fileObj, 1, 0, false);

                convertStream = Cc['@mozilla.org/intl/converter-input-stream;1']
                                .createInstance(Ci.nsIConverterInputStream);
                convertStream.init(inStream, "utf-8", inStream.available(),
                Ci.nsIConverterInputStream.DEFAULT_REPLACEMENT_CHARACTER);

                convertStream.readString(inStream.available(), readData);
                convertStream.close();
                inStream.close();
                callback(readData.value);
            } catch (e) {
                throw new Error((fileObj && fileObj.path || '') + ': ' + e);
            }
        };
    }
    return text;
});


define('text!hbs/story-template.hbs',[],function () { return '<div class="story-card priortiy-{{priority}}" data-priority="{{priority}}" data-story-id="{{id}}">\n\t<button class="story-edit-button">Edit</button>\n\t<button class="story-delete-button">Delete</button>\n\t<button class="new-task-button">New task</button>\n\t<dl>\n\t\t<dt>Priority</dt>\n\t\t<dd>{{priority}}</dd>\n\t\t<dt>Created</dt>\n\t\t<dd>{{created}}</dd>\n\t\t<dt>Last modified</dt>\n\t\t<dd>{{modified}}</dd>\n\t</dl>\n\n\t<h2 class="story-name">As a {{persona}} I want to {{feature}} so that I can {{justification}}</h2>\n</div>\n\n\n\t<table class="tasks">\n\t\t<thead>\n\t\t\t<tr>\n\t\t\t\t<th>To do</th>\n\t\t\t\t<th>In progress</th>\n\t\t\t\t<th>Done</th>\n\t\t\t</tr>\n\t\t</thead>\n\t\t<tbody>\n\t\t\t<tr>\n\t\t\t\t<td class="status-todo"></td>\n\t\t\t\t<td class="status-inprogress"></td>\n\t\t\t\t<td class="status-done"></td>\n\t\t\t</tr>\n\t\t</tbody>\n\t</table>\n\n';});

define(
    'constants',[],function() {
        'use strict';

        return {
            apiBaseUrl: 'http://localhost:3000',

            genericClasses: {
                overlayActive: 'overlay-active',
                overlayContent: 'overlay-content'
            },

            genericEvents: {
                closeOverlay: 'click.closeOverlay'
            },

            genericSelectors: {
                overlay: '.overlay',
                board: '.board',
                addStoryButton: '.add-story-button'
            },

            editStoryModel: {
                properties: {
                    storyModel: 'storyModel'
                }
            },

            editTaskModel: {
                properties: {
                    taskModel: 'taskModel'
                }
            },

            story: {
                properties: {
                    apiUrl: '/v1/stories',
                    idAttribute: 'id',
                    priority: 'priority',
                    persona: 'persona',
                    feature: 'feature',
                    created: 'created',
                    modified: 'modified'

                },
                cssClasses: {
                    storyRow: 'story-row'
                }
            },

            task: {
                properties: {
                    apiUrl: '/v1/tasks',
                    idAttribute: 'id',
                    priority: 'priority',
                    status: 'status',
                    storyID: 'story_id',
                    description: 'description'
                },
                cssClasses: {
                    taskCard: 'task-card'
                }
            }
        };
    }
);

define('text!hbs/edit-story-template.hbs',[],function () { return '<h3>{{#if priority}}Edit{{else}}New{{/if}} story</h3>\n<form>\n\t<label for="priority">Priority</label>\n\t<select id="priority" name="priority" selected="{{priority}}">\n\t\t{{#select priority}}\n\t\t\t<option value="1">1</option>\n\t\t\t<option value="2">2</option>\n\t\t\t<option value="3">3</option>\n\t\t{{/select}}\n\t</select>\n\n\t<div class="natural-language-input">\n\t\t<label for="persona">As a</label>\n\t\t<input type="text" name="persona" id="persona" value="{{persona}}" />\n\n\t\t<label for="feature">I want to</label>\n\t\t<input type="text" name="feature" id="feature" value="{{feature}}" />\n\n\t\t<label for="justification">So that I can</label>\n\t\t<input type="text" name="justification" id="justification" value="{{justification}}"/>\n\t</div>\n\n\t<button type="button" class="save-button">Save</button>\n</form>';});

define('editStoryView',[
    'jquery',
    'backbone',
    'handlebars',
    'constants',
    'text!hbs/edit-story-template.hbs'
],function(
    $,
    Backbone,
    Handlebars,
    constants,
    mainTemplate
) {

    var GENERIC_CLASSES = constants.genericClasses,
        GENERIC_EVENTS = constants.genericEvents,
        GENERIC_SELECTORS = constants.genericSelectors,
        editStory,
        $html,
        $body;

    EditStory = Backbone.View.extend({
        tagName: 'div',

        className: GENERIC_CLASSES.overlayContent,

        events: {
            'click .save-button': 'saveStoryChanges'
        },

        initialize: function() {
            $html = $('html');
            $body = $('body');

            this.render();
        },

        saveStoryChanges: function() {
            var paramArray = $('form').serializeArray();

            this.model.updateStoryModel(paramArray);

            $html.removeClass(GENERIC_CLASSES.overlayActive);
            $body.off(GENERIC_EVENTS.closeOverlay);
        },

        mainTemplate:  Handlebars.compile(mainTemplate),

        render: function() {
            this.$el.html(this.mainTemplate(this.model.attributes));

            $(GENERIC_SELECTORS.overlay).html(this.$el);
            $html.addClass(GENERIC_CLASSES.overlayActive);

            window.event.stopPropagation();

            $body.on(GENERIC_EVENTS.closeOverlay, function(event) {

                if ( $(event.target).closest(GENERIC_SELECTORS.overlay).length === 0 ) {
                    $html.removeClass(GENERIC_CLASSES.overlayActive);
                }
            });

            return this;
        }
    });

    return EditStory;

});
define('storyModel',['backbone', 'constants', 'underscore'], function(Backbone, constants, _) {

    var PROPERTIES = constants.story.properties,
        StoryModel;

    StoryModel = Backbone.Model.extend({
        
        initialize: function(attr, options) {
            this.urlRoot = PROPERTIES.apiUrl;
            this.idAttribute = PROPERTIES.idAttribute;

            if (options && options.newModel) {
                this.newModel = true;
            }

            this.set(PROPERTIES.created, this.formatDateTime(this.get(PROPERTIES.created)));
            this.set(PROPERTIES.modified, this.formatDateTime(this.get(PROPERTIES.modified)));
        },

        showError: function(error) {
            console.log(error);
        },

        onSaveSuccess: function(options, response) {
         
            if (this.newModel) {
                this.set(PROPERTIES.idAttribute, response);
                this.fetch({success: _.bind(function(model, response, options) {
                    this.set(PROPERTIES.created, this.formatDateTime(response[PROPERTIES.created]));
                    this.set(PROPERTIES.modified, this.formatDateTime(response[PROPERTIES.modified]));
                }, this)});
                this.newModel = false;
            }
        },

        syncWithApi:  function(changedAttributes) {
            if (!_.isEmpty(changedAttributes)) {
                this.save(changedAttributes, {patch:true, error: this.showError, success: _.bind(this.onSaveSuccess, this)});
            }
        },

        formatDateTime: function(timestamp) {
            if (timestamp) {
                var date = new Date(timestamp);
                
                return date.toLocaleString();
            }
        }
    });

    return StoryModel;
});
define('editStoryModel',['backbone', 'storyModel', 'constants'], function(Backbone, StoryModel, constants) {
    var PROPERTIES = constants.editStoryModel.properties,
        EditStoryModel;

    EditStoryModel = Backbone.Model.extend({

        initialize: function(attr, options) {
            if (this.get(PROPERTIES.storyModel)) {
                _.extend(this.attributes, this.get(PROPERTIES.storyModel).attributes);
            }

            this.storiesCollection = options && options.storiesCollection;
        },

        updateStoryModel: function(paramArray) {
            var storyModel = this.get(PROPERTIES.storyModel),
                dataChanged = {};

            _.each(paramArray, function(element, index, list) {
                if (storyModel.get(element.name) !== element.value) {
                    dataChanged[element.name] = element.value;      
                }
            });

            storyModel.syncWithApi(dataChanged);
            
            if (this.storiesCollection) {
                this.storiesCollection.add(storyModel);
            }
        }
    });

    return EditStoryModel;
});

define('text!hbs/edit-task-template.hbs',[],function () { return '<h3>{{#if priority}}Edit{{else}}New{{/if}} task</h3>\n<form>\n\t<label for="priority">Priority</label>\n\t<select id="priority" name="priority" selected="{{priority}}">\n\t\t{{#select priority}}\n\t\t\t<option value="1">1</option>\n\t\t\t<option value="2">2</option>\n\t\t\t<option value="3">3</option>\n\t\t{{/select}}\n\t</select>\n\n\t<label for="status">Status</label>\n\t<select id="status" name="status" selected="{{status}}">\n\t\t{{#select status}}\n\t\t\t<option value="to do">To do</option>\n\t\t\t<option value="in progress">In progress</option>\n\t\t\t<option value="done">Done</option>\n\t\t{{/select}}\n\t</select>\n\n\t<label for="description">Description</label>\n\t<input type="text" name="description" id="description" value="{{description}}" />\n\n\t<button type="button" class="save-button">Save</button>\n</form>';});

define('editTaskView',[
    'jquery',
    'backbone',
    'handlebars',
    'constants',
    'text!hbs/edit-task-template.hbs'
],function(
    $,
    Backbone,
    Handlebars,
    constants,
    mainTemplate
) {

    var GENERIC_CLASSES = constants.genericClasses,
        GENERIC_EVENTS = constants.genericEvents,
        GENERIC_SELECTORS = constants.genericSelectors,
        editTask,
        $html,
        $body;

    EditTask = Backbone.View.extend({
        tagName: 'div',

        className: GENERIC_CLASSES.overlayContent,

        events: {
            'click .save-button': 'saveTaskChanges'
        },

        initialize: function() {
            $html = $('html');
            $body = $('body');

            this.render();
        },

        saveTaskChanges: function() {
            var paramArray = $('form').serializeArray();

            this.model.updateTaskModel(paramArray);

            $html.removeClass(GENERIC_CLASSES.overlayActive);
            $body.off(GENERIC_EVENTS.closeOverlay);
        },

        mainTemplate:  Handlebars.compile(mainTemplate),

        render: function() {
            this.$el.html(this.mainTemplate(this.model.attributes));
            $(GENERIC_SELECTORS.overlay).html(this.$el);
            $html.addClass(GENERIC_CLASSES.overlayActive);

            window.event.stopPropagation();

            $body.on(GENERIC_EVENTS.closeOverlay, function(event) {
                if ($(event.target).closest(GENERIC_SELECTORS.overlay).length === 0 ) {
                    $html.removeClass(GENERIC_CLASSES.overlayActive);
                }
            });

            return this;
        }
    });

    return EditTask;

});
define('editTaskModel',['backbone', 'taskModel', 'constants'], function(Backbone, TaskModel, constants) {
    
    var PROPERTIES = constants.editTaskModel.properties,
        EditTaskModel;
    
    EditTaskModel = Backbone.Model.extend({

        initialize: function(attr, options) {
            if (this.get(PROPERTIES.taskModel)) {
                _.extend(this.attributes, this.get(PROPERTIES.taskModel).attributes);
            }

            this.tasksCollection = options && options.tasksCollection;
        },

        updateTaskModel: function(paramArray) {
            var taskModel = this.get(PROPERTIES.taskModel),
                dataChanged = {};

            _.each(paramArray, function(element, index, list) {
                if (taskModel.get(element.name) !== element.value) {
                    dataChanged[element.name] = element.value;      
                } 
            });

            taskModel.syncWithApi(dataChanged);
            
            if (this.tasksCollection) {
                this.tasksCollection.add(taskModel);
            }
        }
    });

    return EditTaskModel;
});

define('text!hbs/task-template.hbs',[],function () { return '<p class="task-description">{{description}}</p>\n<button class="task-edit-button">Edit</button>\n<button class="task-delete-button">Delete</button>\n';});

define('taskView',[
    'jquery',
    'backbone',
    'handlebars',
    'editTaskView',
    'editTaskModel',
    'constants',
    'text!hbs/task-template.hbs'
],function(
    $,
    Backbone,
    Handlebars,
    EditTaskView,
    EditTaskModel,
    constants,
    mainTemplate
) {

    var CSS_CLASSES = constants.task.cssClasses,
        PROPERTIES = constants.task.properties,
        TaskView;

    TaskView = Backbone.View.extend({

        tagName: 'div',

        className: CSS_CLASSES.taskCard,

        events: {
            'click .task-edit-button': 'onTaskEditClick',
            'click .task-delete-button': 'onTaskDeleteClick'
        },

        initialize: function() {
            this.render();

            this.$el.addClass('priority-' + this.model.get(PROPERTIES.priority));

            this.listenTo(this.model.on('change:modified', _.bind(this.render, this)));
            
            this.listenTo(this.model.on('destroy', _.bind(this.removeView, this)));
        },

        removeView: function() {
            this.remove();
        },

        mainTemplate:  Handlebars.compile(mainTemplate),

        render: function() {
            this.$el.html(this.mainTemplate(this.model.attributes));
            this.placeTaskCard();

            return this;
        },

        placeTaskCard: function() {
            // use constants here
            $('.story-card')
                .filter('[data-story-id="' + this.model.get(PROPERTIES.storyID) + '"]')
                .next('table')
                .find('.status-' + this.model.get(PROPERTIES.status).replace(/\s+/g, ''))
                .append(this.$el);
        },

        onTaskEditClick: function() {
            var editTask = new EditTaskView({
                model: new EditTaskModel({
                    taskModel: this.model
                })
            });
        },

        onTaskDeleteClick: function() {
            var warningMessage = confirm(
                'Are you sure you want to delete the task "' +
                    this.model.get(PROPERTIES.description) +
                    '"?'
            );

            if (warningMessage === true) {
                this.model.destroy();
            } else {
                return;
            }
        }
    });

    return TaskView;

});
define('taskModel',['backbone', 'taskView', 'constants', 'underscore'], function(Backbone, TaskView, constants, _) {

    var PROPERTIES = constants.task.properties,
        TaskModel;

    TaskModel = Backbone.Model.extend({

        initialize: function(attr, options) {
            this.urlRoot = PROPERTIES.apiUrl;
            this.idAttribute = PROPERTIES.idAttribute;
        },

        showError: function(error) {
            console.log(error);
        },

        onNewTaskSaveSuccess: function(options, response) {
            var view = new TaskView({model: this});
        },

        syncWithApi:  function(changedAttributes) {
            if (!_.isEmpty(changedAttributes)) {
                changedAttributes[PROPERTIES.storyID] = this.get(PROPERTIES.storyID);

                if (this.get(PROPERTIES.idAttribute)) {
                    // existing model
                    this.save(changedAttributes, {patch:true, error: this.showError});
                } else {
                    // new model
                    this.save(changedAttributes, {error: this.showError, success: _.bind(this.onNewTaskSaveSuccess, this)});
                }
            }
        }
    });

    return TaskModel;
});
define('storyView',[
    'jquery',
    'backbone',
    'handlebars',
    'text!hbs/story-template.hbs',
    'editStoryView',
    'editStoryModel',
    'taskModel',
    'taskView',
    'editTaskModel',
    'editTaskView',
    'constants'
],function(
    $,
    Backbone,
    Handlebars,
    mainTemplate,
    EditStoryView,
    EditStoryModel,
    TaskModel,
    TaskView,
    EditTaskModel,
    EditTaskView,
    constants
) {

    var GENERIC_CLASSES = constants.genericClasses,
        GENERIC_EVENTS = constants.genericEvents,
        GENERIC_SELECTORS = constants.genericSelectors,
        CSS_CLASSES = constants.story.cssClasses,
        PROPERTIES = constants.story.properties,
        StoryView,
        $html,
        $body;

    StoryView = Backbone.View.extend({
        tagName: 'div',

        className: CSS_CLASSES.storyRow,

        events: {
            'click .story-edit-button': 'onStoryEditClick',
            'click .story-delete-button': 'onStoryDeleteClick',
            'click .new-task-button': 'onNewTaskClick'
        },

        initialize: function() {
            $html = $('html');
            $body = $('body');

            this.listenTo(this.model.on('destroy', _.bind(this.removeView, this)));
            this.model.on('change:modified', _.bind(this.render, this));
        },

        removeView: function() {
            this.remove();
        },

        setupNewTaskModel: function(storyID) {
            newTaskModel = new TaskModel({}, {newModel: true});

            taskCreator = new EditTaskView({
                model: new EditTaskModel({
                    taskModel: new TaskModel({
                        story_id: storyID
                    },{
                        newModel: true
                    })
                })
            });
        },

        onNewTaskClick: function(event) {
            var storyID,
                newTaskModel,
                taskCreator;

            $html.addClass(GENERIC_CLASSES.overlayActive);

            event.stopPropagation();

            $body.on(GENERIC_EVENTS.closeOverlay, function(event) {
                if ( $(event.target).closest(GENERIC_SELECTORS.overlay).length === 0 ) {
                    $html.removeClass(GENERIC_CLASSES.overlayActive);
                    $body.off(GENERIC_EVENTS.closeOverlay);
                }
            });

            storyID = this.model.get(PROPERTIES.idAttribute);

            this.setupNewTaskModel(storyID);
            
        },

        onStoryEditClick: function() {
            var thisStoryModel,
                editStory;

            thisStoryModel = this.model;

            editStory = new EditStoryView({
                model: new EditStoryModel({
                    storyModel: thisStoryModel
                })
            });
        },

        onStoryDeleteClick: function() {
            var warningMessage = confirm(
                'Are you sure you want to delete the story "As a ' +
                    this.model.get(PROPERTIES.persona) +
                    ' I want to ' +
                    this.model.get(PROPERTIES.feature) +
                    '..."'
            );

            if (warningMessage === true) {
                this.model.destroy();
            } else {
                return;
            }
        },

        mainTemplate:  Handlebars.compile(mainTemplate),

        render: function() {
            this.$el.html(this.mainTemplate(this.model.attributes));

            return this;
        }
    });

  return StoryView;

});
define('storiesCollection',['backbone', 'storyModel', 'constants'], function(Backbone, Story, constants) {
    
    var PROPERTIES = constants.story.properties,
        Stories;

    Stories = Backbone.Collection.extend({
        model: Story,

        url: constants.apiBaseUrl + PROPERTIES.apiUrl,

        parse: function(response) {
            // return only stories with data (removed stories still occupy an array index in API)
            return _.without(response, null);
        }
    });

    return Stories;
});
define('tasksCollection',['backbone', 'taskModel', 'constants'], function(Backbone, Task, constants) {

    var PROPERTIES = constants.task.properties,
        Tasks;

    Tasks = Backbone.Collection.extend({
        model: Task,

        url: constants.apiBaseUrl + PROPERTIES.apiUrl,

        parse: function(response) {
            return _.without(response, null);
        }
    });

    return Tasks;
});
require([
    'jquery',
    'backbone',
    'storyView',
    'storyModel',
    'storiesCollection',
    'tasksCollection',
    'taskView',
    'editStoryView',
    'editStoryModel',
    'constants',
    'handlebars'
], function (
    $,
    Backbone,
    StoryView,
    StoryModel,
    StoriesCollection,
    TasksCollection,
    TaskView,
    EditStoryView,
    EditStoryModel,
    constants,
    Handlebars
) {
    var stories,
        tasks,
        addItemView,
        showError,
        GENERIC_CLASSES = constants.genericClasses,
        GENERIC_EVENTS = constants.genericEvents,
        GENERIC_SELECTORS = constants.genericSelectors,
        $html = $('html'),
        $body = $('body');

    Backbone.history.start();


    Handlebars.registerHelper('select', function( value, options ){
        var $el = $('<select />').html( options.fn(this) );
        $el.find('[value="' + value + '"]').attr({'selected':'selected'});
        return $el.html();
    });

    addItemView = function(modelAdded) {
        var view = new StoryView({model: modelAdded});

        $(GENERIC_SELECTORS.board).append( view.render().el );
    };

    addTaskView = function(modelAdded) {
        var view = new TaskView({model: modelAdded});
    };

    showError = function(error) {
        console.log(error);
    };
    
    stories = new StoriesCollection();
    tasks = new TasksCollection();

    stories.on('add', addItemView, this);
    tasks.on('add', addTaskView, this);

    stories.fetch({
        error: showError
    }).done(function(){
        tasks.fetch({
            error: showError
        });
    });


    $(GENERIC_SELECTORS.addStoryButton).on('click', function(event) {
        var newStoryModel,
            editStory;

        $html.addClass(GENERIC_CLASSES.overlayActive);
        event.stopPropagation();

        $body.on(GENERIC_EVENTS.closeOverlay, function(event) {
            if ($(event.target).closest(GENERIC_SELECTORS.overlay).length === 0 ) {
                $html.removeClass(GENERIC_CLASSES.overlayActive);
                $body.off(GENERIC_EVENTS.closeOverlay);
            }
        });

        newStoryModel = new StoryModel({}, {newModel: true});

        editStory = new EditStoryView({
            model: new EditStoryModel({
                storyModel: newStoryModel
            }, {
                storiesCollection: stories
            }
          )
        });
    });
});
define("js/main.js", function(){});

}());