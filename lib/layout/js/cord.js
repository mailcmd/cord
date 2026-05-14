
/////////////////////////////////////////////////////////////////////////////////
// Useful garbage
/////////////////////////////////////////////////////////////////////////////////

Array.prototype.uniq = function() {return [...new Set(this)]};
Array.prototype.remove = function(i) {return this.splice(i, 1)};
Array.prototype.is_equal = function(array) {
    return this.length === array.length
        && this.every(function(v, i) { return v === array[i]})
};
Number.prototype.add = function(n) {return this + n};
Number.prototype.sub = function(n) {return this - n};
Number.prototype.mul = function(n) {return this * n};
Number.prototype.div = function(n) {return this / n};
Number.prototype.mod = function(n) {return this % n};

function io(a) {
    console.log('IO LOG:', a);
    return a;
}



/////////////////////////////////////////////////////////////////////////////////
// CORD MAIN OBJECT
/////////////////////////////////////////////////////////////////////////////////

const CORD = function() {
    const $this = this;

    // Internals datas
    const DATAS = {};

    // Proxies container object
    const PROXIES = {};

    const proxy_handler = {
        get(target, field, receiver) {
            // console.log('GETTER', target, field, DATAS)
            const [_, field_name] =
                  field.slice(0, 1) == '$' ? [true, field.slice(1)] : [false, field];
            if (field_name in DATAS[target._ref]) {
                return DATAS[target._ref][field_name]
            } else {
                return $this.config.strict ? undefined : "";
            }
        },
        set(target, field, value) {
            // console.log('SETTER', target._ref, field, value)
            const [commit, field_name] =
                  field.slice(0, 1) == '$' ? [true, field.slice(1)] : [false, field];
            DATAS[target._ref][field_name] = value;
            if (!commit) return;
            render_container_field(target._ref, field_name);
        }
    };

    /*
      ONMESSAGE FROM WEBSOCKET OR EVENTSOURCE
      =======================================
      'data' contains the raw text message from websocket server. It is parsed json
      and trait as an object. This object MUST have the following struct:
      {
        action: <string>,
        ... <rest of properties depend of action> ...
      }

      Actions allowed:
        - 'cord-update'
          Allow server side cord containers set.
          {
            action: 'cord-update',
            containers: {
              <string_container_ref>: { <fields_datas> },
              <string_container_ref>: { <fields_datas> },
              <string_container_ref>: { <fields_datas> },
              ...
            }
          }
        - 'cord-update-object'
          Allow server side cord containers update.
          {
            action: 'cord-update-object',
            containers: {
              <string_container_ref>: {
                <field_nam>: {
                  action:  '<function_name>',
                  datas: [<function_args>]
                }
                },
              ...
            },
            ...
          }

     */
    const onmessage = function({data, timeStamp}) {
        //console.log(data, timeStamp);
        let msg;
        try {
            msg = JSON.parse(data);
        } catch(e) {
            msg = data;
        }

        // console.log('MSG IN:', msg)

        // normalize msg
        if (typeof msg != 'object')
            msg = {action: 'unknown', data: msg}

        // if msg has msg_id look for callback
        if (msg.msg_id && $this?.ws?.callbacks && $this?.ws?.callbacks[msg.msg_id]) {
            $this?.ws?.callbacks[msg.msg_id](msg);
            return;
        }
        msg.action = msg.action ? msg.action : 'unknown';

        switch (msg.action) {
        case 'cord-update':
            for (cord_id in msg.containers) {
                $this.update(cord_id, msg.containers[cord_id]);
            }
            break;

        case 'cord-update-object':
            for (cord_id in msg.containers) {
                for (field in msg.containers[cord_id]) {
                    $this.update_object(cord_id, field, msg.containers[cord_id][field]);
                }
            }

            break;

        default:
            if ($this.config?.websocket?.onmessage) {
                $this.config.websocket.onmessage(msg);
            } else if ($this.config?.eventsource?.onmessage) {
                $this.config.eventsource.onmessage(msg);
            } else {
                console.warn(`TODO: action = ${msg.action} - msg:`, msg)
            }
            break;
        }

    };

    /////////////////////////////////////////////////////////////////////////////////
    // TOOLS
    /////////////////////////////////////////////////////////////////////////////////
    const querySpecialAttrElems = function(start_with, elem) {
        if (!document.body.contains(elem)) return [];
        const nodesSnapshot = document.evaluate(
            'descendant::*/attribute::*[starts-with(name(), "'+start_with+'")]',
            elem,
            null,
            XPathResult.ORDERED_NODE_SNAPSHOT_TYPE,
            null
        );
        const attr = [];
        for (var i=0; i < nodesSnapshot.snapshotLength; i++ ) {
            attr.push(nodesSnapshot.snapshotItem(i));
        }
        return attr;
    };

    const find_partial_key = function(obj, key) {
        if (key.slice(0, 7) == '$global') return key;
        for (let k in obj) {
            if (k == key) {
                return k;
            } else if (k.match(new RegExp('^'+key+'[\.\[]'))) {
                return k;
            }
        }
        return null;
    };

    const get_main_object = function(keys) {
        return keys.split(new RegExp('[\.\[]'))[0];
    };

    const global_to_real_var = function(str) {
        if (str[0] == '#') {
            return str.slice(1).split(':').reduce( (a,f) => {
                if (isNaN(parseInt(f))) {
                    return a+"."+f;
                } else {
                    return a+'['+f+']';
                }
            }, '$global');
        } else {
            return str;
        }
    };

    const blur_page = function() {
        document.body.style.filter = 'blur(10px)';
    };

    const unblur_page = function() {
        document.body.style.filter = '';
    };

    const get_curated_identifiers = function(list) {
        return list.map(identifier => {
            identifier = identifier
                .replace('$global.', '#')
                .replace(/^\$\./, '#')
                .replace(/#\{(.+?)\}/g, '#$1')
                .replace('$self.', '')
                .replace(/\[['"](.+?)['"]\]/g, '.$1');

            if (identifier[0] == '#') {
                const [p1, p2] = identifier.replace(/[#\$]/g, '').split(/[\[\.\:]/);
                return '#' + p1 + ':' + p2;
            } else {
                return identifier.replace(/\$/g, '').split('.')[0];
            }
        });
    };

    const lexer = function(str) {
        const separators = [';', ',', '+', '-', '*', '/', '%', ')', '|', '&', '%'];
        let i = 0, current_lexema = '', string_opener = '';
        const lexemas = [];

        str = str.replace(/ /g, '');

        while (i < str.length) {
            // end of identifier, save it
            if (string_opener == '' && separators.includes(str[i])) {
                if (current_lexema.length > 0) {
                    lexemas.push(current_lexema);
                    current_lexema = '';
                }

            // end of identifier but is a function, do not save it
            } else if (string_opener == '' && str[i] == '(') {
                if (current_lexema.length > 0) {
                    lexemas.push(current_lexema);
                    current_lexema = '';
                }

            // open a string inside a [...], is a lexema
            } else if (string_opener == '' && str[i] == '[') {
                if (['"', "'"].includes(str[i+1])) {
                    current_lexema += '.';
                    let j = 2;
                    while (!['"', "'"].includes(str[i+j]) && str[i+j]) {
                        current_lexema += str[i+j];
                        j++;
                    }
                    lexemas.push(current_lexema);
                    current_lexema = '';
                    i = i + j;
                } else if (current_lexema.length > 0) {
                    lexemas.push(current_lexema);
                    current_lexema = '';
                }

            // open a string
            } else if (string_opener == '' && ['"', "'"].includes(str[i])) {
                if (current_lexema.length > 0) {
                    lexemas.push(current_lexema);
                    current_lexema = '';
                }
                string_opener = str[i];

            // end of "..." string
            } else if (string_opener == '"' && str[i] == '"') {
                string_opener = '';
                current_lexema = '';

            // end of '...' string
            } else if (string_opener == "'" && str[i] == "'") {
                string_opener = '';
                current_lexema = '';

            // start of identifier
            } else if (current_lexema.length == 0 && str[i].match(/[a-zA-Z\_\$\#]/)) {
                current_lexema += str[i];

            // rest of the identifier
            } else if (current_lexema.length > 0) {
                current_lexema += str[i];
            }

            i++;
        }
        if (current_lexema.length > 0) lexemas.push(current_lexema);

        return lexemas;
    };

    const get_identifiers = function(str) {
        // console.log(str);
        str = decode_htmlentities(str);
        const strs = str
              .matchAll(/\$\{(.+?)\}/gs)
              .toArray()
              .map(([_, e]) => e);

        return strs
            .map(str => get_curated_identifiers(lexer(str)))
            .flat()
            .uniq()
            .map(global_to_real_var)
    };

    this.x = get_identifiers;

    const cord_eval = function(
        str,
        context,
        {as_string, is_foreach} = {as_string: true, is_foreach: false}
    )  {
        const escape_regex = function(string) {
            return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        };

        if (as_string) {
            str = '`'+str+'`';
        }

        const sandbox = new Proxy(context, {
            get(target, prop) {
                if (prop in target) {
                    return target[prop];
                } else if (prop in window) {
                    return window[prop];
                } else {
                    return $this.config.strict ? undefined : '';
                }
            },
            has(target, prop) {
                return true;
            }
        });

        return eval('with (sandbox) { '+str+' }');
    };

    // this.x = cord_eval;

    const get_text_nodes = function(elem, only_local = true) {
        const cid = elem.getAttribute('cord-id');
        const children = [];
        const walker = document.createTreeWalker(elem, NodeFilter.SHOW_TEXT);
        while(walker.nextNode()) {
            const node = walker.currentNode;
            if (node.textContent.trim().length == 0)
                continue;
            if (only_local
                && node.parentElement.closest('[cord-id]').getAttribute('cord-id') != cid)
                continue;
            children.push(node);
        }
        return children;
    };
    // this.x = get_text_nodes;

    const decode_htmlentities = function(html) {
        const STANDARD_HTML_ENTITIES = {
            nbsp: String.fromCharCode(160),
            amp: "&",
            quot: '"',
            lt: "<",
            gt: ">"
        };
        return html
            .replace(/&#(\d+);/g, (match, dec) => String.fromCharCode(dec))
            .replace(
                /&(nbsp|amp|quot|lt|gt);/g,
                (a, b) => STANDARD_HTML_ENTITIES[b]
            );
    };

    const remove_next_siblings = function(elem, sign) {
        let currentSibling = elem.nextElementSibling, nextSibling, count = 0;
        while (true) {
            if (!currentSibling) break;
            nextSibling = currentSibling.nextElementSibling;
            if (!sign || currentSibling.sign == sign) currentSibling.remove();
            currentSibling = nextSibling;
            count++;
        }
        return count;
    };

    const parse = function(html, cord_id, map) {
        html = expand_for(html);
        html = expand_if(html);
        html = expand_map(html, map);
        return html;
    };

    const expand_for = function(html) {
        return foreachsParser(html) || html;
    };

    const expand_if = function(html) {
        return ifsParser(html) || html;
    };

    const expand_map = function(html, map) {
        if (!map) return html;
        map = map
            .split('|')
            .map( m => m.split(':') );

        return map
            .reduce( (acc, [a, b]) => {
                const re = new RegExp('%'+a+'%', 'sg');
                return acc.replace(re, b)
            }, html);
    };

    const foreachsParser = function(str) {
        const findForeach = function(str, pos) {
            const pos0 = str.slice(pos).indexOf(':foreach');
            if (pos0 == -1) return null;
            return pos + pos0 + 8;
        };

        const findEndForeach = function(str, pos) {
            const pos2 = str.slice(pos).indexOf(':endforeach');
            if (pos2 == -1) return null;
            return pos + pos2;
        };

        const extractForEachParts = function(str) {
            const [[_, item, rows, apply, body]] =
                  str
                  .matchAll(/[\t ]+(.+?)[\t ]+in[\t ]+(.+?)[\t ]+(?:apply:(.+?)[\t ]|):do(.+?)$/sg)
                  .toArray()
            return [[':foreach' + str + ':endforeach', item, rows, apply, body]];
        };

        const replaceForeach = function(str, matches) {
            const replaces = matches
                  .map( ([_, r_var, rows_var, apply, body]) => {
                      return `
                  <template foreach="${rows_var}" sign="${Math.random()}"
                            item="${r_var}" ${apply?'apply="'+apply+'"':''}>
                    ${body}
                  </template>
                  `
                  });
            return matches
                .reduce((acc, [str, _a, _b, _c], i) => acc.replace(str, replaces[i]), str);
        };

        let curpos = 0, pos0, max_depth = 5;

        while (pos0 = findForeach(str, curpos)) {
            if (max_depth-- == 0) {
                console.error(`Foreach max depth reached or bad open/close syntax`);
                return false;
            }
            let pos1 = findForeach(str, pos0);
            let pos2 = findEndForeach(str, pos0);

            if (pos2 === null) {
                console.error(`Syntax error foreach in pos ${pos0} has no :endforeach`);
                return false;
            }
            // there is nested foreachs
            if (pos1 !== null && pos1 < pos2) {
                curpos = pos1 - 8;
                continue;
            }
            // there is not nested foreachs
            if (pos1 === null || pos2 < pos1) {
                const matches = extractForEachParts(str.slice(pos0, pos2));
                str = replaceForeach(str, matches);
                curpos = 0;
                continue;
            }
        }
        return str;
    };

    const ifsParser = function(str) {
        const findIf = function(str, pos) {
            const pos0 = str.indexOf(':if', pos);
            if (pos0 == -1) return null;
            return pos0 + 3;
        };

        const findElse = function(str, pos) {
            const pos2 = str.indexOf(':else', pos);
            if (pos2 == -1) return null;
            return pos2;
        };

        const findEndIf = function(str, pos) {
            const pos3 = str.indexOf(':endif', pos);
            if (pos3 == -1) return null;
            return pos3;
        };

        const extractIfParts = function(str) {
            const [[_, exp, body, elsebody]] = str
                  .matchAll(/[\t ]+(.+?):do(.+?)(?::else(.+?)|):endif/sg)
                  .toArray()
            return [[':if' + str, exp, body, elsebody]];
        };

        const replaceIf = function(str, matches) {
            const replaces = matches
                  .map( ([_, exp, body, elsebody]) => {
                      return `
                  <template if="\$\{${exp}\}">
                    ${body}
                  </template>
                  `+(elsebody ? `
                  <template if="\$\{!(${exp})\}">
                    ${elsebody}
                  </template>
                   `:'')
                  });

            return matches
                .reduce((acc, [str, _a, _b, _c], i) => acc.replace(str, replaces[i]), str);
        };

        let curpos = 0, pos0, max_depth = 5;

        while (pos0 = findIf(str, curpos)) {
            if (max_depth-- == 0) {
                console.error(`If max depth reached or bad open/close syntax`);
                return false;
            }
            let if_pos = findIf(str, pos0);
            let else_pos = findElse(str, pos0);
            let end_pos = findEndIf(str, pos0);

            if (end_pos === null) {
                console.error(`Syntax error if in pos ${pos0} has no :endif`);
                return false;
            }

            // there is not nested ifs
            if (if_pos === null || if_pos > end_pos) {
                const matches = extractIfParts(str.slice(pos0, end_pos + 6));
                str = replaceIf(str, matches);
                curpos = 0;
                continue;
            }

            // there is nested ifs -> if (if ... end) else ... end
            if (else_pos !== null && if_pos < else_pos) {
                const matches = extractIfParts(str.slice(if_pos, end_pos + 6));
                str = replaceIf(str, matches);
                curpos = 0;
                continue;
            }

            // there is nested ifs -> if ... else (if ... end) end
            if (else_pos !== null && if_pos > else_pos) {
                const matches = extractIfParts(str.slice(if_pos, end_pos + 6));
                str = replaceIf(str, matches);
                curpos = 0;
                continue;
            }

            // there is nested ifs -> if (if ... end)  end
            if (if_pos < end_pos) {
                const matches = extractIfParts(str.slice(if_pos, end_pos + 6));
                str = replaceIf(str, matches);
                curpos = 0;
                continue;
            }
        }
        return str;
    };

    /////////////////////////////////////////////////////////////////////////////////
    // Internals processes
    /////////////////////////////////////////////////////////////////////////////////

    /////////////////////////////////////////////////////////////////////////////////
    // JS Garbage Collector Helper
    /////////////////////////////////////////////////////////////////////////////////
    const gc_delete_obsolete = function() {
        for (let cord_id in DATAS) {
            if (!document.querySelector(`*[cord-id="${cord_id}"]`)) {
                delete DATAS[cord_id];
                console.log(`GC: container '${cord_id}' datas freed!`);
            }
        }
    };

    /////////////////////////////////////////////////////////////////////////////////
    // Bootstrap
    /////////////////////////////////////////////////////////////////////////////////
    const process_container_script = function(tpl, map, cord_id) {
        const tmp = document.createElement('span');
        tmp.innerHTML = tpl.innerHTML;
        tmp.querySelectorAll('cord-script').forEach( cs => {
            js = decode_htmlentities(cs.innerHTML);
            js = expand_map(js, map);
            try {
                eval(`(
                  function($self, $global){
                    ${js}
                })`)(PROXIES[cord_id], PROXIES);
            } catch(e){
                console.log('Error in cord-script tag content: ', e);
            }
            tpl.innerHTML = tpl.innerHTML
                .replace(cs.innerHTML, '')
                .replace('<cord-script>', '')
                .replace('</cord-script>', '');
        });
        tmp.querySelectorAll('cord-script-after-render').forEach( cs => {
            js = decode_htmlentities(cs.innerHTML);
            js = expand_map(js, map);
            tpl.cordEvalAfterRender = js;
            tpl.innerHTML = tpl.innerHTML
                .replace(cs.innerHTML, '')
                .replace('<cord-script-after-render>', '')
                .replace('</cord-script-after-render>', '');
        });
        tmp.remove();
    };

    const load_templates = async function(templates) {
        if (!templates) {
            templates = [];
            document.querySelectorAll('cord-load-templates').forEach( lt => {
                lt.innerHTML
                    .trim()
                    .split('\n')
                    .forEach( u => templates.push(u.trim()) );
                lt.remove();
            });
        }

        for (url of templates) {
            if (url.trim() == '') continue;
            const html = await $this.fetch(url);
            document.body.innerHTML += html.replace(/cord-template/g, 'noscript');
        }
    };

    /////////////////////////////////////////////////////////////////////////////////////////////
    // Process containers
    /////////////////////////////////////////////////////////////////////////////////////////////

    const process_special_attributes = function(elem) {
        const cord_id = elem.getAttribute('cord-id');
        // Process special attrs :on
        querySpecialAttrElems('on:', elem).forEach( attr => {
            const el = attr.ownerElement;
            const event = attr.nodeName.split(':')[1];
            const body = attr.nodeValue;
            const ev_fun = new Function('$self, $global', `
                   ${body}
                `).bind(el);
            el.removeEventListener(event, () => {ev_fun(PROXIES[cord_id], PROXIES)});
            el.addEventListener(event, () => {ev_fun(PROXIES[cord_id], PROXIES)});
            el.removeAttribute(attr.nodeName);
        });

        // Process special attrs :bind
        querySpecialAttrElems('bind:', elem).forEach( attr => {
            const el = attr.ownerElement;
            const prop = attr.nodeName.split(':')[1];
            const field = attr.nodeValue;
            const func = new Function('$self, $global, val', `${field} = val;`);

            Object.defineProperty(el, prop, {
                get() {
                    const _get = Object.getOwnPropertyDescriptor(
                        HTMLInputElement.prototype, prop
                    ).get;
                    return _get.call(this);
                },
                set(val) {
                    const _set = Object.getOwnPropertyDescriptor(
                        HTMLInputElement.prototype, prop
                    ).set;
                    func(PROXIES[cord_id], PROXIES, val);
                    return _set.call(this, val);
                }
            });
            if (el.tagName == 'SELECT') {
                el.removeEventListener('change', (e) => {
                    func(PROXIES[cord_id], PROXIES, e.target.value);
                });
                el.addEventListener('change', (e) => {
                    func(PROXIES[cord_id], PROXIES, e.target.value);
                });
            } else if (el.tagName == 'INPUT' && el.type.toLowerCase() == 'checkbox') {
                el.removeEventListener('change', (e) => {
                    func(PROXIES[cord_id], PROXIES, e.target.checked);
                });
                el.addEventListener('change', (e) => {
                    func(PROXIES[cord_id], PROXIES, e.target.checked);
                });
            } else if (el.tagName == 'INPUT' || el.tagName == 'TEXTAREA') {
                el.removeEventListener('input', (e) => {
                    func(PROXIES[cord_id], PROXIES, e.target.value);
                });
                el.addEventListener('input', (e) => {
                    func(PROXIES[cord_id], PROXIES, e.target.value);
                });
            }
            el.removeAttribute(attr.nodeName);
        });
    };

    const process_node = function(elem, node) {
        const cord_id = elem.getAttribute('cord-id');
        node.cordContent = node.textContent;
        node.cordContainer = cord_id;
        get_identifiers(node.cordContent, cord_id).forEach(f => {
            // if f is a global field
            if (f.slice(0, 7) == '$global') {
                const [_, _cord_id, _field] = f.slice(1).split(/[\.\[]/);
                if (!window.cordGlobalNodes[_cord_id])
                    window.cordGlobalNodes[_cord_id] = {};
                if (!window.cordGlobalNodes[_cord_id][_field])
                    window.cordGlobalNodes[_cord_id][_field] = new Set();
                window.cordGlobalNodes[_cord_id][_field].add(node);

                if (!elem.cordNodes[f]) elem.cordNodes[f] = [];
                elem.cordNodes[f].push(node);
                elem.cordGlobalFields.add(f);
                // if f is a local field
            } else {
                if (!elem.cordNodes[f]) elem.cordNodes[f] = [];
                elem.cordNodes[f].push(node);
            }
        });
    };

    const process_container_nodes = function(elem) {
        const cord_id = elem.getAttribute('cord-id');
        get_text_nodes(elem).forEach( node => process_node(elem, node) );
    };

    const process_attribute = function(elem, el) {
        const cord_id = elem.getAttribute('cord-id');
        const attrs = el.attributes;
        for (let i = 0; i < attrs.length; i++) {
            if (! /\$\{.+?\}/.test(attrs[i].nodeValue)) continue;
            get_identifiers(attrs[i].nodeValue, cord_id).forEach(f => {
                // if f is a global field
                if (f.slice(0, 7) == '$global') {
                    const [_, _cord_id, _field] = f.slice(1).split(/[\.\[]/);
                    if (!window.cordGlobalAttrs[_cord_id])
                        window.cordGlobalAttrs[_cord_id] = {};
                    if (!window.cordGlobalAttrs[_cord_id][_field])
                        window.cordGlobalAttrs[_cord_id][_field] = new Set();

                    window.cordGlobalAttrs[_cord_id][_field].add(
                        {node: el, name: attrs[i].nodeName, eval: attrs[i].nodeValue}
                    );
                    elem.cordGlobalFields.add(f);

                    // if f is a local field
                } else {
                    elem.cordAttrs.push(
                        {node: el, name: attrs[i].nodeName, eval: attrs[i].nodeValue}
                    );
                }
            });
        }
    };

    const process_container_attributes = function(elem) {
        const cord_id = elem.getAttribute('cord-id');
        elem.querySelectorAll('*:not(template)').forEach( el => process_attribute(elem, el) );
    };

    const process_container_foreachs = function(elem) {
        const cord_id = elem.getAttribute('cord-id');
        elem.querySelectorAll('template[foreach]').forEach( tpl => {
            tpl.cordContainer = cord_id;
            const field = tpl.getAttribute('foreach');
            // if field is a global field
            if (field.slice(0, 7) == '$global' || field[0] == '#') {
                const [_, _cord_id, _field] = field.slice(1).split(/[\.\[]/);
                if (!window.cordGlobalForeachs[_cord_id])
                    window.cordGlobalForeachs[_cord_id] = {};
                if (!window.cordGlobalForeachs[_cord_id][_field])
                    window.cordGlobalForeachs[_cord_id][_field] = new Set();
                window.cordGlobalForeachs[_cord_id][_field].add(tpl);
            // if field is a local field
            } else {
                const base_field = get_main_object(field) || '__literal__';
                if (!elem.cordForeach[base_field]) elem.cordForeach[base_field] = [];
                elem.cordForeach[base_field].push(tpl);
            }
            get_identifiers(tpl.innerHTML, cord_id).forEach(f => {
                // if f is a global field
                if (f.slice(0, 7) == '$global') {
                    const [_, _cord_id, _field] = f.slice(1).split(/[\.\[]/);
                    if (!window.cordGlobalForeachs[_cord_id])
                        window.cordGlobalForeachs[_cord_id] = {};
                    if (!window.cordGlobalForeachs[_cord_id][_field])
                        window.cordGlobalForeachs[_cord_id][_field] = new Set();
                    window.cordGlobalForeachs[_cord_id][_field].add(tpl);

                    if (!elem.cordForeach[f]) elem.cordForeach[f] = [];
                    elem.cordForeach[f].push(tpl);
                    elem.cordGlobalFields.add(f);

                // if f is a local field
                } else {
                    if (!elem.cordForeach[f]) elem.cordForeach[f] = [];
                    elem.cordForeach[f].push(tpl);
                }
            });
        });
    };

    const process_container_ifs = function(elem) {
        const cord_id = elem.getAttribute('cord-id');
        elem.querySelectorAll('template[if]').forEach(tpl => {
            tpl.cordContainer = cord_id;
            get_identifiers(tpl.getAttribute('if')+','+tpl.innerHTML, cord_id).forEach(f => {
                const exp = tpl.getAttribute('if');
                // if f is a global field
                if (f.slice(0, 7) == '$global') {
                    const [_, _cord_id, _field] = f.slice(1).split(/[\.\[]/);
                    if (!window.cordGlobalIfs[_cord_id])
                        window.cordGlobalIfs[_cord_id] = {};
                    if (!window.cordGlobalIfs[_cord_id][_field])
                        window.cordGlobalIfs[_cord_id][_field] = new Set();
                    window.cordGlobalIfs[_cord_id][_field].add(tpl);

                    if (!elem.cordIfs[f]) elem.cordIfs[f] = [];
                    elem.cordIfs[f].push(tpl);
                    elem.cordGlobalFields.add(f);

                    // if f is a local field
                } else {
                    if (!elem.cordIfs[f]) elem.cordIfs[f] = [];
                    elem.cordIfs[f].push(tpl);
                }
            });
        });
    };

    const process_containers = function() {
        // Get every elem with cord-id attr and not processed yet.
        const container_elems = [...document.querySelectorAll('*[cord-id]:not([processed])')];
        for (const elem of container_elems) {
            const cord_id = elem.getAttribute('cord-id');
            // check valid name of container
            if (!cord_id.match(/[a-zA-Z0-9\_]+/)) {
                console.error(
                    `Invalid cord id: ${cord_id}, valid characters [a-zA-Z0-9_]!`+
                    ' Skipping container process.'
                );
                continue;
            }

            // If not initiated yet, init container datas storage
            if (!DATAS[cord_id]) {
                PROXIES[cord_id] = new Proxy({_ref: cord_id}, proxy_handler);
                DATAS[cord_id] = {};
            }

            // Check if content is inside elem or in a noscript-template, then store content
            const tpl_id = elem.getAttribute('cord-tpl-ref');
            const template = document.querySelector(`noscript[cord-tpl-id="${tpl_id}"]`);
            if (tpl_id && !template) {
                console.error(`Container '${cord_id}' template ref '${tpl_id}' does not exist!!`);
                continue;
            }
            const container = template ? template : elem;
            const map = !template
                  ? undefined
                  : `cord-id:${cord_id}|` + (elem.getAttribute('cord-map')||'');

            // Process content of <cord-script> tags
            process_container_script(template || elem, map, cord_id);

            // Init html with the content parsed
            elem.innerHTML = parse(container.innerHTML, cord_id, map);

            if (template?.cordEvalAfterRender)
                elem.cordEvalAfterRender = template.cordEvalAfterRender;

            elem.cordGlobalFields = new Set();

            // cordNodes store data nodes associates to fields
            elem.cordNodes = {};
            process_container_nodes(elem);

            // cordForeach store foreach loops data templates associate to a field
            elem.cordForeach = {};
            process_container_foreachs(elem);

            // cordIfs store if statements data templates associate to a field
            elem.cordIfs = {};
            process_container_ifs(elem);

            // cordAttrs store attrs that has field names
            elem.cordAttrs = [];
            process_container_attributes(elem);

            // Process special attrs
            process_special_attributes(elem);

            elem.setAttribute('processed', 'true');
        }
    };

    const process_cord_tags = async function() {
        // load templates if required
        await load_templates();

        // process every cord-container
        process_containers();

        // noscripts processed are removed (Should I do this???)
        document.querySelectorAll('noscript[processed]').forEach( ns => ns.remove() );
    };

    const bootstrap = async function() {
        // Fields accesss object
        $this.$ = new Proxy({}, {
            get(target, cord_id, receiver) {
                return PROXIES[cord_id];
            },
            set(target, cord_id, value) {
                console.warn("You can't mutate this container object!")
            }
        });

        // create trash element
        $this.draft = document.createElement('span');
        $this.draft.style.display = 'none';
        document.body.appendChild($this.draft);

        await process_cord_tags();

        $this.ready = true;
        
        const cordReadyEvent = new CustomEvent('cordready', { detail: { cordInstance: $this } });
        window.dispatchEvent(cordReadyEvent);
    };

    /////////////////////////////////////////////////////////////////////////////////
    // Render
    /////////////////////////////////////////////////////////////////////////////////
    const render_foreachs = function(cord_id, tpls, obj) {
        tpls.forEach( tpl => {
            cord_id = tpl.cordContainer || cord_id;

            const parent = tpl.parentElement;
            const r_var = tpl.getAttribute('item');
            const foreach_field = tpl.getAttribute('foreach');
            const sign = tpl.getAttribute('sign');

            remove_next_siblings(tpl, sign);

            obj = new Proxy(obj, {
                get(target, prop, _) {
                    if (target.hasOwnProperty(prop)) {
                        return target[prop];
                    } else {
                        return cord_eval(prop, target, {as_string: false, is_foreach: true});
                    }
                }
            });

            if (!obj[foreach_field]) obj = DATAS[cord_id];

            let arr = !obj[foreach_field]['forEach']
                  ? Object.values(obj[foreach_field])
                  : obj[foreach_field];

            if (tpl.getAttribute('apply')) {
                arr = eval('arr.'+tpl.getAttribute('apply'));
            }

            const elem = document.querySelector(`*[cord-id="${cord_id}"]`);
            let lastElement = tpl;

            arr.forEach( (r, i) => {
                const row = { [r_var]: r, [r_var+'_i']: i };
                render_ifs(
                    cord_id,
                    tpl.content.querySelectorAll('template[if]'),
                    row
                );
                render_foreachs(
                    cord_id,
                    tpl.content.querySelectorAll('template[foreach]'),
                    row
                );
                const cloned_tpl = tpl.cloneNode(true);
                cloned_tpl.content.querySelectorAll('template').forEach( n => n.remove() );
                const env = {
                    ...{$self: DATAS[cord_id], $: DATAS, $global: DATAS},
                    ...DATAS[cord_id],
                    ...row
                };
                const html = cloned_tpl.innerHTML;
                const tmp = document.createElement('template');
                tmp.innerHTML = html;

                [...tmp.content.children].forEach( e => {
                    e.sign = sign;
                    lastElement.after(e);

                    const sub_attrs = [];
                    [e, ...e.querySelectorAll('*:not(template)')].forEach( el => {
                        const attrs = el.attributes;
                        for (let i = 0; i < attrs.length; i++) {
                            if (! /\$\{.+?\}/.test(attrs[i].nodeValue)) continue;
                            sub_attrs.push(
                                {node: el, name: attrs[i].nodeName, eval: attrs[i].nodeValue}
                            );
                        }
                    });
                    render_attributes(sub_attrs, env);
                    
                    // Set this attr just temporarily, it is not elegant but work
                    e.setAttribute('cord-id', cord_id);
                    process_special_attributes(e);
                    // All right, we'll erase the evidence and act like nothing ever happened.
                    e.removeAttribute('cord-id');

                    const nodes = get_text_nodes(e, false);
                    nodes.forEach( node => process_node(elem, node) );
                    render_nodes(nodes, row);
                    
                    lastElement = e;
                });
            });
        });
    };

    const render_ifs = function(cord_id, tpls, obj = {}) {
        tpls.forEach( tpl => {
            cord_id = tpl.cordContainer || cord_id;

            const env = {
                ...obj,
                ...DATAS[cord_id],
                ...{$self: DATAS[cord_id], $: DATAS, $global: DATAS}};
            const if_exp = tpl.getAttribute('if');
            const exp_eval = eval("'"+cord_eval(if_exp, env)+"'");
            const real_boolean = eval(exp_eval);

            if (!['true', 'false', true, false].includes(exp_eval)) {
                console.error(
                    'Error in IF expression, '+
                    `must to eval to 'true' or 'false' (${if_exp}) -> ${exp_eval}`
                );
                return;
            }

            if (real_boolean === tpl.lastEval) return;

            tpl.lastEval = real_boolean;

            if (tpl?.nextElementSibling?.is_cordif)
                tpl.nextElementSibling.remove();

            if (real_boolean === false) return;

            const elem = document.querySelector(`*[cord-id="${cord_id}"]`);

            render_ifs(
                cord_id,
                tpl.content.querySelectorAll('template[if]')
            );
            render_foreachs(
                cord_id,
                tpl.content.querySelectorAll('template[foreach]'),
                env
            );

            const cloned_tpl = tpl.cloneNode(true);
            cloned_tpl.content.querySelectorAll('template').forEach( n => n.remove() );

            const html = cloned_tpl.innerHTML;
            const tmp = document.createElement('template');
            tmp.innerHTML = `<span>${html}</span>`;
            [...tmp.content.children].forEach( e => {
                e.is_cordif = true;
                tpl.after(e);

                // Set this attr just temporarily, it is not elegant but work
                e.setAttribute('cord-id', cord_id);
                e.querySelectorAll('*:not(template)').forEach(el =>
                    process_attribute(elem, el)
                );
                process_special_attributes(e);
                // All right, we'll erase the evidence and act like nothing ever happened.
                e.removeAttribute('cord-id');

                const nodes = get_text_nodes(e, false);
                nodes.forEach( node => process_node(elem, node) );
                render_nodes(nodes);
            });

            render_attributes(elem.cordAttrs, env);
        });
    };

    const render_attributes = function(attrs, env, field, real_field) {
        for (let attr of attrs) {
            // attr: {node: el, name: attrs[i].nodeName, eval: attrs[i].nodeValue}
            if (field && !attr.eval.match(real_field)) continue;
            if (attr.name[0] == ':') {
                try {
                    if (eval(cord_eval(attr.eval, env))) {
                        attr.node.setAttribute(attr.name.slice(1), true);
                    } else {
                        attr.node.removeAttribute(attr.name.slice(1));
                    }
                    attr.node.removeAttribute(attr.name);
                } catch(e) {
                    console.error(
                        `Attribute ${attr.name} must eval to 'true' or 'false'`, attr.node);
                }
            } else {
                attr.node.setAttribute(
                    attr.name,
                    cord_eval(attr.eval, env)
                );
            }
        }
    };

    const render_nodes = function(nodes, env = {}) {
        nodes.forEach(node => {
            const lenv =  {
                ...DATAS[node.cordContainer],
                ...{$self: DATAS[node.cordContainer], $global: DATAS},
                ...env
            };
            node.textContent = cord_eval(node.cordContent, lenv);
        });
    };

    const render_container = function(cord_id, field) {
        const elem = document.querySelector(`*[cord-id="${cord_id}"]`);

        const is_global_field = (field && field.slice(0,7) == '$global');
        const real_field = is_global_field ? global_to_real_var(field) : field;

        const fields = field
              ? [field, ...elem.cordGlobalFields].uniq()
              : [...Object.keys(DATAS[cord_id]), ...elem.cordGlobalFields].uniq();

        // env has {$: DATAS} to eval global fields
        const env = {...DATAS[cord_id], ...{$self: DATAS[cord_id], $global: DATAS}}

        const cord_containers_affected = new Set();

        // Render attributes
        render_attributes(elem.cordAttrs, env, field, real_field);
        fields.forEach( field => {
            if (window.cordGlobalAttrs[cord_id] && window.cordGlobalAttrs[cord_id][field]) {
                render_attributes(window.cordGlobalAttrs[cord_id][field], env, field, real_field);
            }
        });

        // Render textNodes
        const nodes = new Set();
        //// First, build a uniq list of nodes
        fields.forEach( field => {
            if (elem.cordNodes && elem.cordNodes[field]) {
                elem.cordNodes[field].forEach(node => nodes.add(node));
            }
            if (window.cordGlobalNodes[cord_id] && window.cordGlobalNodes[cord_id][field]) {
                window.cordGlobalNodes[cord_id][field].forEach(node => nodes.add(node));
            }
        });
        //// Second, update content of every node
        render_nodes(nodes);

        const tpls = new Set();

        // Render foreachs
        fields.forEach( field => {
            let foreach_key;
            if (
                elem.cordForeach &&
                (foreach_key = find_partial_key(elem.cordForeach, field)) &&
                elem.cordForeach[foreach_key]
            ) {
                elem.cordForeach[foreach_key].forEach( tpl => {
                    if (tpl.cordContainer == cord_id) tpls.add(tpl)
                });
            } else if (elem.cordForeach['__literal__']) {
                elem.cordForeach['__literal__'].forEach( tpl => {
                    if (tpl.cordContainer == cord_id) tpls.add(tpl)
                });
            }
            if (window.cordGlobalForeachs[cord_id] && window.cordGlobalForeachs[cord_id][field]) {
                window.cordGlobalForeachs[cord_id][field].forEach( tpl => {
                    tpls.add(tpl);
                    if (tpl.cordContainer) cord_containers_affected.add(tpl.cordContainer)
                });
            }
        });
        render_foreachs(cord_id, [...tpls], env);

        tpls.clear();

        // Render ifs
        fields.forEach( field => {
            if (elem.cordIfs && elem.cordIfs[field]) {
                elem.cordIfs[field].forEach( tpl => tpls.add(tpl) );
            }
            if (window.cordGlobalIfs[cord_id] && window.cordGlobalIfs[cord_id][field]) {
                window.cordGlobalIfs[cord_id][field].forEach( tpl => {
                    tpls.add(tpl);
                    if (tpl.cordContainer) cord_containers_affected.add(tpl.cordContainer)
                });
            }
        });
        render_ifs(cord_id, tpls);

        // if some render add new containers, we need to process them
        process_containers();

        // if there are js to run after render in this container, we do it
        if (elem.cordEvalAfterRender) {
            try {
                eval(elem.cordEvalAfterRender);
            } catch(e){
                console.warn('Error in cord-script-after-render tag content: ', e.message);
            }
        }

        // if some of the containers affected has js to run after render, we do it
        [...cord_containers_affected].forEach(cid => {
            const js = document.querySelector(`[cord-id="${cid}"]`).cordEvalAfterRender;
            if (js) {
                try {
                    eval(js);
                } catch(e){
                    console.warn('Error in cord-script-after-render tag content: ', e.message);
                }
            }
        });
    };

    const render_container_field = function(cord_id, field) {
        render_container(cord_id, field);
    };

    /////////////////////////////////////////////////////////////////////////////////
    // Public API
    /////////////////////////////////////////////////////////////////////////////////

    this.blur_page = blur_page;
    this.unblur_page = unblur_page;

    this.load_template = async function(urls) {
        urls = typeof urls == 'string' ? [urls] : urls;
        const elem = document.createElement('cord-load-templates');
        elem.innerHTML = urls.join('\n');
        document.body.appendChild(elem);
        await load_templates();
    };

    this.load_container = async function(url, destination) {
        destination = typeof destination == 'string'
            ? document.querySelector(destination)
            : destination

        if (url) {
            const html = await this.fetch(url);
            destination.innerHTML = html;
        }

        process_containers();

        if (url) {
            const cord_id = destination.querySelector('cord-container').getAttribute('cord-id');
            this.refresh(cord_id);
        }
    };

    /*
      config = {
        id: <string>,          // the cord-id value
        tpl_ref: <string>,     // the cord-tpl-ref value
        tpl_url: <string,      // if the template is still not loaded, you can load passing url
        map: <string=key1:value1|key2:value2...>
        html: <string>         // if is not defined tpl you can pass the html contain here
        datas: <object>        // new container values
        datas_url: <string>    // if you do not pass 'datas' can pass datas_url the get datas
        parent: <dom_element>  // Element where the new container will be appended. If not defined
                               // default is draft element
      }
     */
    this.create_container = async function(config) {
        const config_error = item => {
            throw new Error(`New container config error, missing item '${item}'`);
        };

        const cord_id = config?.id || config_error('id');
        if (document.querySelector(`[cord-id="${cord_id}"]`)) {
            console.error(`CORD container id '${cord_id}' already exists!`);
            return false;
        }

        const cord_tpl_ref = config?.tpl_ref;
        const cord_tpl_url = config?.tpl_url;
        const cord_map = config?.map;
        const html = config?.html;
        const datas = config?.datas;
        const datas_url = config?.datas_url;
        const parent = config?.parent ?? this.draft;

        const container = document.createElement('cord-container');
        container.setAttribute('cord-id', cord_id);
        if (cord_tpl_url) await this.load_template(cord_tpl_url)
        if (cord_tpl_ref) container.setAttribute('cord-tpl-ref', cord_tpl_ref);
        if (cord_map) container.setAttribute('cord-map', cord_map);
        if (html) container.innerHTML = html;

        parent.appendChild(container);

        await process_containers();

        if (datas) {
            this.update(cord_id, datas)
        } else if (datas_url) {
            const datas = JSON.parse(await this.fetch(datas_url));
            this.update(cord_id, datas)
        } else {
            this.refresh(cord_id);
        }
    };

    this.destroy_container = async function(cord_id) {
        if (document.querySelector(`[cord-id="${cord_id}"]`)) {
            document.querySelector(`[cord-id="${cord_id}"]`).remove();
        } else {
            console.warn(`Destroy ERROR: Container with id '${cord_id}' does not exists!`)
        }
        if (DATAS[cord_id] && DATAS[cord_id].destroy) DATAS[cord_id].destroy();
        delete DATAS[cord_id];
        delete PROXIES[cord_id];
    };

    this.process_new_containers = process_containers;

    this.refresh = function(cord_id) {
        this.update(cord_id);
    };

    this.update = function(cord_id, datas, value) {
        const elem = document.querySelector(`*[cord-id="${cord_id}"]`);
        if (!elem) {
            console.warn(`Update ERROR: Container with id '${cord_id}' does not exists!`)
            return false;
        }

        datas = !datas ? DATAS[cord_id] : datas;

        const fields = new Set();

        if (typeof datas == 'object') {
            for (let field in datas) {
                fields.add(field);
            }
        } else if (typeof datas == 'string') {
            fields.add(datas);
            datas = {[datas]: value};
        }
        fields.add(...elem.cordGlobalFields);

        fields.forEach( field => {
            this.$[cord_id][field] = datas[field];
        });
        fields.forEach( field => {
            render_container_field(cord_id, field);
        });

        // create globals if required, I do it here for dynamic containers
        if (this.config.createGlobals && !window[cord_id])
            window[cord_id] = this.$[cord_id];
    };

    // Useful when you do a small change in a big object (ex: array push or pop)
    this.update_object = function(cord_id, field, operation = {action: null}) {
        const type = typeof DATAS[cord_id][field];
        if (type != 'object' && type != 'number') {
            console.warn(`Field '${field}' in container '${cord_id}' is not a valid field`)
            return false;
        }

        let obj = DATAS[cord_id][field];
        if (!DATAS[cord_id][field][operation.action]) {
            console.warn(
                `Operation '${operation.action}' not available for '${field}' in '${cord_id}'`);
            return false;
        }

        try {
            if (type == 'number') {
                DATAS[cord_id][field] = DATAS[cord_id][field][operation.action](...operation.datas);
            } else {
                DATAS[cord_id][field][operation.action](...operation.datas);
            }
            render_container_field(cord_id, field);
        } catch(e) {
            console.error(e)
        }
    };

    this.fetch = async function(url, result_type = 'text') {
        try {
            const response = await fetch(url);
            if (!response.ok) {
                throw new Error(`Response status: ${response.status}`);
            }

            const result = await response[result_type]();
            return result;

        } catch (error) {
            console.error(error.message);
            return false;
        }
    };

    this.get = function(path) {
        const [cord_id, ...fields] = path.split(':');
        if (this.$[cord_id]) {
            return fields.reduce( (o, f) => o[f], this.$[cord_id]);
        } else {
            console.warn(`Do not exists container '${cord_id}'!`);
            return undefined;
        }
    };

    this.set = function(path, value, commit = true) {
        const [cord_id, ...fields] = path.split(':');
        const last = fields.pop();
        const obj = fields.reduce( (o, f) => o[f], this.$[cord_id]);
        obj[last] = value;
        const field = (fields.length > 0 ? [fields.shift()] : [last])
        if (commit) render_container_field(cord_id, field);
    };

    // useful for boolean fields
    this.toggle = function(path, commit = true) {
        const [cord_id, ...fields] = path.split(':');
        const last = fields.pop();
        const obj = fields.reduce( (o, f) => o[f], this.$[cord_id]);
        obj[last] = !obj[last];
        const field = (fields.length > 0 ? [fields.shift()] : [last])
        if (commit) render_container_field(cord_id, field);
        return obj[last];
    };

    const default_config = {
        createGlobals: false,
        strict: false,
        websocket: null,
        eventsource: null,
        containers: {}
    };

    this.init = function(config = {}) {
        if (!this.ready) {
            throw new Error(
                `CORD is not ready yet, call 'init' inside '$CORD.onready' function.`
            );
        }

        this.config = { ...default_config, ...config};

        // Initialize containers fields
        for (let cord_id in this.config.containers) {
            for (let field in this.config.containers[cord_id]) {
                if (!this.$[cord_id]) {
                    PROXIES[cord_id] = new Proxy({_ref: cord_id}, proxy_handler);
                    DATAS[cord_id] = {};
                }
                this.$[cord_id][field] = this.config.containers[cord_id][field];
            }
        }

        // Complete render of all containers al least once
        [...document.querySelectorAll('*[cord-id]')].forEach( elem => {
            const cord_id = elem.getAttribute('cord-id');
            render_container(cord_id);
        });

        // If required init Websocket
        if (this.config.websocket) {
            this.ws = new CORDWebsocket(config, onmessage);
        }

        // If required init EventSource
        if (this.config.eventsource) {
            this.es = new CORDEventSource(config, onmessage);
        }

        // Program GC
        setInterval(gc_delete_obsolete, 60000);

        unblur_page();
        document.body.style.visibility = 'visible';
    }

    /////////////////////////////////////////////////////////////////////////////////
    // Init CORD
    /////////////////////////////////////////////////////////////////////////////////

    this.ready = false;
    window.cordGlobalNodes = {};
    window.cordGlobalForeachs = {};
    window.cordGlobalIfs = {};
    window.cordGlobalAttrs = {};

    blur_page();
    bootstrap();

};

/////////////////////////////////////////////////////////////////////////////////
// WebSocket support
/////////////////////////////////////////////////////////////////////////////////

const CORDWebsocket = function(config, onmessage = console.log) {
    const $this = this;

    /////////////////////////////////////////////////////////////////////////////////
    // Internals
    /////////////////////////////////////////////////////////////////////////////////
    const onerror = function(error) {
        console.error('CORD Websocket error!', error);
        if ($this.reconnect) check_status();
    };

    const onclose = function(msg) {
        console.warn('CORD Websocket closed!');
        const cordWSCloseEvent = new CustomEvent('cordwebsocketclosed',
                                                 { detail: { cordInstance: $this } });
        window.dispatchEvent(cordWSCloseEvent);
        if ($this.reconnect) check_status();
    };

    const check_status = function() {
        if ($this?.connection.readyState == WebSocket.CLOSED
            || $this?.connection.readyState === 0) {
            console.warn('CORD Websocket not connected!');
            if ($this.reconnect)
                setTimeout($this.connect.bind($this), $this.reconnect_delay);
            return false;
        } else if ($this?.connection.readyState == WebSocket.CONNECTING) {
            console.log('CORD EventSource: connecting...');
            return false;
        }
        $CORD.unblur_page();
        clearTimeout(this.ts);
        console.log('CORD Websocket: connected!');
        const cordWSReadyEvent = new CustomEvent('cordwebsocketready',
                                                 { detail: { cordInstance: $this } });
        window.dispatchEvent(cordWSReadyEvent);
        $this.connection.onerror = onerror;
        $this.connection.onmessage = onmessage;
        $this.connection.onclose = onclose;
        return true;
    };


    /////////////////////////////////////////////////////////////////////////////////
    // Public API
    /////////////////////////////////////////////////////////////////////////////////
    this.connect = function() {
        $CORD.blur_page();
        if (this.connection) this.connection.close();
        console.log('CORD Websocket: connecting...');
        this.connection = new WebSocket(this.url);
        this.ts = setTimeout(check_status, 1000);
    };

    this.send = function(message, callback = ()=>{}) {
        if (message.msg_id) {
            this.callbacks[message.msg_id] = callback;
        }
        message = typeof message != 'string' ? JSON.stringify(message) : message;

        this.connection.send(message);
    };

    this.get_status = function() {
        this.connection.readyState;
    };

    this.close = function() {
        this.connection.close();
    }

    /////////////////////////////////////////////////////////////////////////////////
    // Init
    /////////////////////////////////////////////////////////////////////////////////
    this.callbacks = {};
    this.onmessage = onmessage;
    this.url = config.websocket.url;
    this.reconnect = config.websocket.reconnect ?? true;
    this.reconnect_delay = config.websocket.reconnect_delay ?? 1000;
    this.connect();
};

/////////////////////////////////////////////////////////////////////////////////
// EventSource support
/////////////////////////////////////////////////////////////////////////////////

const CORDEventSource = function(config, onmessage = console.log) {
    const $this = this;

    const onerror = function(error) {
        console.error('CORD EventSource: error!', error);
        if ($this.reconnect) check_status();
    };

    const check_status = function() {
        if ($this?.connection.readyState == EventSource.CLOSED) {
            console.warn('CORD EventSource not connected!');
            if ($this.reconnect)
                setTimeout($this.connect.bind($this), $this.reconnect_delay);
            return false;
        } else if ($this?.connection.readyState == EventSource.CONNECTING) {
            console.log('CORD EventSource: connecting...');
            return false;
        }
        console.log('CORD EventSource: connected!');
        $this.connection.onerror = onerror;
        $this.connection.onmessage = onmessage;
        return true;
    };


    /////////////////////////////////////////////////////////////////////////////////
    // Public API
    /////////////////////////////////////////////////////////////////////////////////
    this.connect = function() {
        if (this.connection) this.connection.close();
        console.log('CORD EventSource: connecting...');
        this.connection = new EventSource(this.url);
        setTimeout(check_status, 1000);
    };

    this.get_status = function() {
        this.connection.readyState;
    };

    this.close = function() {
        this.connection.close();
    }

    /////////////////////////////////////////////////////////////////////////////////
    // Init
    /////////////////////////////////////////////////////////////////////////////////
    this.onmessage = onmessage;
    this.url = config.eventsource.url;
    this.reconnect = config.eventsource.reconnect;
    this.reconnect_delay = config.eventsource.reconnect_delay || 1000;
    this.connect();
};

/////////////////////////////////////////////////////////////////////////////////
// Custom elements
/////////////////////////////////////////////////////////////////////////////////

// cord-template
class CordTemplate extends HTMLElement {
  //static observedAttributes = ["cord-tpl-id"];

    constructor() {
        super();
    }

    connectedCallback() {
        const noscript = document.createElement('noscript');
        const html = this.innerHTML.replace('<!--', '').replace('-->', '');
        noscript.innerHTML = this.innerHTML.replace('<!--', '').replace('-->', '');
        const tpl_id = this.getAttribute('cord-tpl-id');
        noscript.setAttribute('cord-tpl-id', tpl_id);
        this.after(noscript);
        this.remove();
        console.log(`Added cord-template '${tpl_id}'`);
    }

    disconnectedCallback() {
    }

    connectedMoveCallback() {
    }

    adoptedCallback() {
    }

    attributeChangedCallback(name, oldValue, newValue) {
    }

}
customElements.define("cord-template", CordTemplate);




/////////////////////////////////////////////////////////////////////////////////
// Create main object
/////////////////////////////////////////////////////////////////////////////////
const $CORD = new CORD();
