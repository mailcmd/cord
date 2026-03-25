/////////////////////////////////////////////////////////////////////////////////
// Useful garbage
/////////////////////////////////////////////////////////////////////////////////

Array.prototype.uniq = function() {return [...new Set(this)]};
Array.prototype.remove = function(i) {return this.splice(i, 1)};

Number.prototype.add = function(n) {return this + n};
Number.prototype.sub = function(n) {return this - n};
Number.prototype.mul = function(n) {return this * n};
Number.prototype.div = function(n) {return this / n};
Number.prototype.mod = function(n) {return this % n};

/////////////////////////////////////////////////////////////////////////////////
// CORD EXTERNAL AUXILIARS UTILS 
/////////////////////////////////////////////////////////////////////////////////

const foreachsParser = function(str) {
    /*
      - Look for a :foreach and take not of a pos (pos0)
      - From pos0 look for another :foreach and take note of the pos (pos1)
      - Also from pos0 look for a :endforeach and take note of the pos (pos2)
      - If pos1 is -1 there is not nested foreach for this foreach.
      - If pos2 is -1 there is a syntax error
      - if pos1 < pos2 then there is a nested foreach
         Get slice of str from pos1 and repeat from 1
      - If pos2 > pos1 then is not a nested foreach
         Take note of the block and goto 1 with slice of str from pos2
    */

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
        const [[_, item, rows, body]] =
              str
            .matchAll(/[\t ]+(.+?)[\t ]+in[\t ]+(.+?)[\t ]+:do(.+?)$/sg)
            .toArray()
        return [[':foreach' + str + ':endforeach', item, rows, body]];
    };

    const replaceForeach = function(str, matches) {
        const replaces = matches
              .map( ([_, r_var, rows_var, body]) => {
                  return `
                  <template foreach="${rows_var}" item="${r_var}">
                    ${body}
                  </template>
                  `
              });
        return matches
            .reduce((acc, [str, _a, _b, _c], i) => acc.replace(str, replaces[i]), str);
    };
    
    let curpos = 0, pos0;
    while (pos0 = findForeach(str, curpos)) {
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
    /*
      - Look for a :if and take not of a pos (pos0)
      - From pos0 look for another :if and take note of the pos (pos1)
      - Also from pos0 look for a :else and take note of the pos (pos2)
      - Also from pos0 look for a :endif and take note of the pos (pos3)
      - If pos1 is -1 there is not nested ifs for this if.
      - If pos2 is -1 there is not else statement
      - If pos3 is -1 there is a syntax error
      - if pos1 < pos2 then there is a nested if
         Get slice of str from pos1 and repeat from 1
      - If pos2 > pos1 then is not a nested if
         Take note of the block and goto 1 with slice of str from pos2
    */

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
    
    let curpos = 0, pos0;
    
    while (pos0 = findIf(str, curpos)) {
        let if_pos = findIf(str, pos0);
        let else_pos = findElse(str, pos0);
        let end_pos = findEndIf(str, pos0);
        
        // console.log([str]);
        // console.log(pos0, if_pos, else_pos, end_pos);
        // 6 91 56 200
        // break;
        // debugger;

        if (end_pos === null) {
            console.error(`Syntax error if in pos ${pos0} has no :endif`);
            return false;
        }
        
        // there is not nested ifs 
        if (if_pos === null) {
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

        // there is not nested ifs 
        if (if_pos > end_pos) {
            const matches = extractIfParts(str.slice(pos0, end_pos + 6));
            str = replaceIf(str, matches);
            curpos = 0;
            continue;
        }        
    }
    return str;
};


/////////////////////////////////////////////////////////////////////////////////
// CORD MAIN OBJECT
/////////////////////////////////////////////////////////////////////////////////

const CORD = function() {
    const $this = this;

    // Internals datas
    const DATAS = {};

    // Proxies container object
    const PROXIES = {};

    const handler = {
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
          Allow server side cord containers update.
          {
            action: 'cord-update',
            containers: {
              <string_container_ref>: { <fields_datas> },
              <string_container_ref>: { <fields_datas> },
              <string_container_ref>: { <fields_datas> },
              ...
            }
          }
     */
    const onmessage = function({data, timeStamp}) {
        console.log(data, timeStamp);
        let msg = JSON.parse(data);

        // normalize msg
        if (typeof msg != 'object')
            msg = {action: 'unknown', data: msg}
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
            console.warn(`TODO: action = ${msg.action} - msg:`, msg)
            break;
        }

    };

    /////////////////////////////////////////////////////////////////////////////////
    // TOOLS
    /////////////////////////////////////////////////////////////////////////////////
    const get_identifiers = function(str) {
        str = '\`'+decode_htmlentities(str)+'\`';
        const result = [], discard_list = ['$'];
        const sandbox = new Proxy({}, {
            get(target, prop) {
                if (typeof prop == 'string') result.push(prop)
                return {};
            },
            has(target, prop) {
                return true;
            }
        });
        const keys = Object.keys(sandbox);
        const values = Object.values(sandbox);
        const evaluator = new Function(...keys,
         `with (this) { return ${str}; }`
        );
        try {
            evaluator.apply(sandbox, values);
        } catch(e){}
        return result
            .uniq()
            .map(s => s.trim())
            .filter(v => !(discard_list.includes(v)));
    }

    const get_text_nodes = function(elem) {
        const cid = elem.getAttribute('cord-id');
        const children = [];
        const walker = document.createTreeWalker(elem, NodeFilter.SHOW_TEXT);
        while(walker.nextNode()) {
            const node = walker.currentNode;
            if (node.textContent.trim().length == 0)
                continue;
            if (node.parentElement.closest('[cord-id]').getAttribute('cord-id') != cid)
                continue;
            children.push(node);
        }
        return children;
    };

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

    const remove_next_siblings = function(elem) {
        let currentSibling = elem.nextElementSibling, nextSibling, count = 0;
        while (true) {
            if (!currentSibling) break;
            nextSibling = currentSibling.nextElementSibling;
            currentSibling.remove();
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
        return foreachsParser(html);
    };

    // TODO: nested if
    const expand_if = function(html) {
        return ifsParser(html);
        // const matches = html
        //       .matchAll(/:if[\t ]+(.+?):do(.+?)(?::else(.+?)|):endif/sg)
        //       .toArray();

        // const replaces = matches
        //       .map( ([_, exp, body, elsebody]) => {
        //           return `
        //           <template if="\$\{${exp}\}">
        //             ${body}
        //           </template>
        //           `+(elsebody ? `
        //           <template if="\$\{!(${exp})\}">
        //             ${elsebody}
        //           </template>
        //            `:'')
        //       });

        // return matches
        //    .reduce((acc, [str, _a, _b], i) => acc.replace(str, replaces[i]), html)
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

    const cord_eval = function(str, context) {
        const sandbox = new Proxy(context, {
            get(target, prop) {
                if (prop in target) {
                    return target[prop];
                } else if (prop in window) {
                    return window[prop];
                } else {
                    return $this.config.strict ? undefined : "";
                }
            },
            has(target, prop) {
                return true;
            }
        });
        const keys = Object.keys(sandbox);
        const values = Object.values(sandbox);
        str = decode_htmlentities(str);
        const evaluator = new Function(...keys,
            `with (this) { return \`${str}\`; }`
        );
        return evaluator.bind(window).apply(sandbox, values);
    };

    /////////////////////////////////////////////////////////////////////////////////
    // Internals
    /////////////////////////////////////////////////////////////////////////////////
    const load_templates = async function() {
        const templates = [];
        [...document.querySelectorAll('cord-load-templates')].forEach( lt => {
            lt.innerHTML
                .trim()
                .split('\n')
                .forEach( u => templates.push(u.trim()) );
            lt.remove();
        });
        for (url of templates) {
            const html = await $this.fetch(url);
            document.body.innerHTML += html;
        }
    };

    const process_template_scripts = function() {
        document.querySelectorAll('noscript:not([processed])').forEach( noscript => {
            const matches = noscript.innerHTML
                  .matchAll(/<cord-script>(.+?)<\/cord-script>/gs)
                  .toArray();

            matches.forEach( ([t, js]) => {
                js = decode_htmlentities(js);
                try {
                    eval(js);
                } catch(e){
                    console.log('Error in cord-script tag content: ', e);
                }
                noscript.innerHTML = noscript.innerHTML.replace(t, '');
            });
            noscript.setAttribute('processed', 'true');
        });
    }

    const process_new_templates = async function() {
        // load templates if required
        await load_templates();

        // eval js inside noscript templates
        process_template_scripts();

        // Get every elem with cord-id attr.
        const container_elems = [...document.querySelectorAll('*[cord-id]:not([processed])')];
        for (const elem of container_elems) {
            const cord_id = elem.getAttribute('cord-id');
            // Init container datas storage
            PROXIES[cord_id] = new Proxy({_ref: cord_id}, handler);
            DATAS[cord_id] = {};

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

            // Init html with the content parsed 
            elem.innerHTML = parse(container.innerHTML, cord_id, map);

            // cordNodes store data nodes associates to fields
            elem.cordNodes = {};
            get_text_nodes(elem).forEach( node => {
                node.cordContent = node.textContent;
                // TODO: improve the way to extract indentifiers (fields name)
                get_identifiers(node.cordContent).forEach(f => {
                    if (!elem.cordNodes[f]) elem.cordNodes[f] = [];
                    elem.cordNodes[f].push(node);
                });
            });

            // cordForeach store for loops data templates associate to a field
            elem.cordForeach = {};
            elem.querySelectorAll('template[foreach]').forEach( tpl => {
                const field = tpl.getAttribute('foreach');
                if (!elem.cordForeach[field]) elem.cordForeach[field] = [];
                elem.cordForeach[field].push(tpl);
                get_identifiers(tpl.innerHTML).forEach(f => {
                    if (!elem.cordForeach[f]) elem.cordForeach[f] = [];
                    elem.cordForeach[f].push(tpl);
                });
            });

            // cordIfs store if statements data templates associate to a field
            elem.cordIfs = {};
            elem.querySelectorAll('template[if]').forEach( tpl => {
                const exp = tpl.getAttribute('if');
                get_identifiers(exp+','+tpl.innerHTML).forEach(f => {
                    if (!elem.cordIfs[f]) elem.cordIfs[f] = [];
                    elem.cordIfs[f].push(tpl);
                });
            });

            // cordAttrs store attrs that has field names
            elem.cordAttrs = {};
            const attrs = elem.attributes;
            for (let i = 0; i < attrs.length; i++) {
                elem.cordAttrs[attrs[i].nodeName] = attrs[i].nodeValue;
            }
            elem.setAttribute('processed', 'true');
        }

        // noscripts processed are removed
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

        await process_new_templates();

        $this.ready = true;
        const cordReadyEvent = new CustomEvent('cordready', { detail: { cordInstance: $this } });
        window.dispatchEvent(cordReadyEvent);
    };

    const render_foreachs = function(cord_id, tpls, obj) {
        tpls.forEach( tpl => {
            remove_next_siblings(tpl);
            const parent = tpl.parentElement;
            const r_var = tpl.getAttribute('item');
            const foreach_field = tpl.getAttribute('foreach');
            const arr = !obj[foreach_field]['forEach']
                  ? Object.values(obj[foreach_field])
                  : obj[foreach_field];
            
            arr.forEach( (r, i) => {
                render_foreachs(
                    cord_id,
                    tpl.content.querySelectorAll('template'),
                    {[r_var]: r}
                );
                const row = { [r_var]: r, [r_var+'_i']: i };
                const cloned_tpl = tpl.cloneNode(true);
                cloned_tpl.content.querySelectorAll('template').forEach( n => n.remove() );
                const html = cord_eval(cloned_tpl.innerHTML, {...DATAS[cord_id], ...row});
                const tmp = document.createElement('template');
                tmp.innerHTML = html;
                [...tmp.content.children].forEach( e => parent.appendChild(e) );
            });
        });
    };

    const render_ifs = function(cord_id, tpls) {
        tpls.forEach( tpl => {
            if (tpl?.nextElementSibling?.is_cordif)
                tpl.nextElementSibling.remove();
            const if_exp = tpl.getAttribute('if');
            if (!eval(cord_eval(if_exp, DATAS[cord_id]))) return;

            render_ifs(
                cord_id,
                tpl.content.querySelectorAll('template')
            );
            
            const cloned_tpl = tpl.cloneNode(true);
            cloned_tpl.content.querySelectorAll('template').forEach( n => n.remove() );
            const html = cord_eval(cloned_tpl.innerHTML, DATAS[cord_id]);
            const tmp = document.createElement('template');
            tmp.innerHTML = `<span>${html}</span>`;
            [...tmp.content.children].forEach( e => {
                e.is_cordif = true;
                tpl.after(e);
            });
        });
    };

    const render_container = function(cord_id, field) {
        const elem = document.querySelector(`*[cord-id="${cord_id}"]`);

        const datas = field ? {[field]: DATAS[cord_id]} : DATAS[cord_id];
        
        // Render attributes
        const attrs = elem.cordAttrs;
        for (let attr in attrs) {
            if (field && !attrs[attr].match(field)) continue;
            elem.setAttribute(
                attr,
                cord_eval(attrs[attr], DATAS[cord_id])
            );
        }

        // Render textNodes
        const nodes = new Set();
        //// First, build a uniq list of nodes
        for (let field in datas) {
            if (!elem.cordNodes || !elem.cordNodes[field]) continue;
            elem.cordNodes[field].forEach(node => nodes.add(node));
        }
        //// Second, update content of every node
        nodes.forEach(node => {
            node.textContent = cord_eval(node.cordContent, DATAS[cord_id]);
        })

        const tpls = new Set();
        // Render foreachs
        for (let field in datas) {
            if (!elem.cordForeach || !elem.cordForeach[field]) continue;
            elem.cordForeach[field].forEach( tpl => tpls.add(tpl) );
        }
        render_foreachs(cord_id, [...tpls], DATAS[cord_id]);

        tpls.clear();
        // Render ifs
        for (let field in datas) {
            if (!elem.cordIfs || !elem.cordIfs[field]) continue;
            elem.cordIfs[field].forEach( tpl => tpls.add(tpl) );
        }
        render_ifs(cord_id, tpls);
    };

    const render_container_field = function(cord_id, field) {
        render_container(cord_id, field);
    };

    /////////////////////////////////////////////////////////////////////////////////
    // Public API
    /////////////////////////////////////////////////////////////////////////////////

    this.refresh = function(cord_id) {
        this.update(cord_id);
    };

    this.update = function(cord_id, datas, value) {
        let fields = [];
        datas = !datas ? DATAS[cord_id] : datas;
        if (typeof datas == 'object') {
            for (let field in datas) {
                fields.push(field);
            }
        } else if (typeof datas == 'string') {
            fields.push(datas);
            datas = {[datas]: value};
        }

        fields.forEach( field => {
            this.$[cord_id][field] = datas[field];
            render_container_field(cord_id, field);
        });

        // create globals if required, I do it here for future dynamic templates load
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

    /*
      CONFIG
      ======
      config = {
          createGlobals: true,
          strict: false, // if true not defined field return undefined, if false return ""
          websocket: {
              url: 'ws://localhost:8080/websocket',
              reconnect: true,
              reconnect_delay: 1000
          },
          containers: { ... }
      };
    */

    const default_config = {
        createGlobals: false,
        strict: false,
        websocket: null,
        containers: {}
    };

    this.init = function(config = {}) {
        if (!this.ready) {
            throw new Error(`CORD is not ready yet, call 'init' inside '$CORD.onready' function.`);
        }

        this.config = { ...default_config, ...config};
        // Initialize containers fields
        for (let cord_id in this.config.containers) {
            for (let field in this.config.containers[cord_id]) {
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
    }

    /////////////////////////////////////////////////////////////////////////////////
    // Init CORD
    /////////////////////////////////////////////////////////////////////////////////
    this.ready = false;
    
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
        if ($this.reconnect) check_status();
    };

    const check_status = function() {
        if ($this?.connection.readyState == WebSocket.CLOSED) {
            console.warn('CORD Websocket not connected!');
            if ($this.reconnect)
                setTimeout($this.connect.bind($this), $this.reconnect_delay);
            return false;
        } else if ($this?.connection.readyState == WebSocket.CONNECTING) {
            console.log('CORD EventSource: connecting...');
            return false;
        }
        console.log('CORD Websocket: connected!');
        $this.connection.onerror = onerror;
        $this.connection.onmessage = onmessage;
        $this.connection.onclose = onclose;
        return true;
    };


    /////////////////////////////////////////////////////////////////////////////////
    // Public API
    /////////////////////////////////////////////////////////////////////////////////
    this.connect = function() {
        if (this.connection) this.connection.close();
        console.log('CORD Websocket: connecting...');
        this.connection = new WebSocket(this.url);
        setTimeout(check_status, 1000);
    };

    this.send = function(message) {
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
    this.onmessage = onmessage;
    this.url = config.websocket.url;
    this.reconnect = config.websocket.reconnect;
    this.reconnect_delay = config.websocket.reconnect_delay || 1000;
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
        noscript.innerHTML = this.innerHTML;
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


/* garbage:
            // try {
            //     tmp = window.eval(`
            //     (function(){
            //     const v = new Proxy({}, {
            //         has(target, prop) { return true; },
            //         get(target, prop) { return target[prop]; }
            //     })
            //     with(v) {
            //         ${js};
            //     }
            //     return Object.assign({}, v);
            //     })()
            //     `);
            //     DATAS[cord_id] = {...tmp, ...DATAS[cord_id]};            
            // } catch(e){
            //     console.log('Error in cord-script tag content: ', e);
            // }
*/
