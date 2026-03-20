/////////////////////////////////////////////////////////////////////////////////
// Useful garbage
/////////////////////////////////////////////////////////////////////////////////

Array.prototype.uniq = function() {return [...new Set(this)]}

Number.prototype.add = function(n) {return this + n}
Number.prototype.sub = function(n) {return this - n}
Number.prototype.mul = function(n) {return this * n}
Number.prototype.div = function(n) {return this / n}
Number.prototype.mod = function(n) {return this % n}

/////////////////////////////////////////////////////////////////////////////////
// CORD MAIN OBJECT
/////////////////////////////////////////////////////////////////////////////////

/*
  Alternatives for name:
  - CORD (change object, render dom)
  - MTRT (mutate this, render that)
  - JARL (just another reactive lib)

  TODO:
   - [x] Why templates? Can I just use directly the element? It seems that not :(
   - [x] I need an evaluator, it is not enough just replace field name.
   - [x] Check if there is changes, if not do nothing (if change only attrs no update inside).
   - [x] Open websocket to enable server side change container (SSCC)
   - [ ] Dynamic fetch and add templates/html from server
   - [ ] EventSource support (work as websocket but no channels)
   - [x] What happend with containers inside containers?
   - [x] Foreach: add index (i variable)
   - [x] Add :if statement
   - [ ] Improve template parser (for, if) to allow nested statements (HARD!)

  WEBSOCKET TODO:
  - [ ] Create protocol for communication.
    + [ ] Client fetch of data/templates/etc
    + [ ] Client subscribe to channels on server
    + [ ] Server send news to clients
    + [x] Define format for direct server update of cord_containers

  # DOC

  ## Example
  <html>
    <body>
      <!-- Option 1: content inside the element (do not use templates) -->
      <button onclick="$CORD.$.counter.$value-=1">&lt;</button>
      <button onclick="$CORD.$.counter.$value+=1">&gt;</button>
      <div cord-id="counter">
        <button onclick="$CORD.$.counter.$value-=1">&lt;</button>
        ${value}
        <button onclick="$CORD.$.counter.$value+=1">&gt;</button>
      </div>

      <!-- Option 2: content inside a template (use templates) -->
      <noscript cord-tpl-id="clock">
        ${hour}:${min}:${sec}
      </noscript>
      <div cord-tpl-ref="clock" cord-id="clock-1" style="margin-left: ${margin_left}%;"></div>
      <input cord-id="clock-position"
        value="0" type="range" min="0" max="50" style="width: 50%;"
        onchange="$CORD.$['clock-1'].$margin_left = this.value"/>

      <script type="text/javascript" src="cord.js"></script>
      <script>
        const config = {
            createGlobals: true // Create global vars for every cord container.
                                // In the example below it will be created
                                // window['clock-1'] and window.counter.
        };

        // cord.js load instantiate '$CORD' constant to manage CORD
        $CORD.init({
            'clock-1': {
                hour: 0,
                min: 0,
                sec: 0
            },
            counter: {
                value: 15
            }
        }, config);

        // Example of automatic update of containers
        function update_clock() {
            const t = Temporal.Now.plainTimeISO();
            $CORD.update('clock-1', {
                hour: t.hour,
                min: t.minute,
                sec: t.second
            });
        }

        setInterval(update_clock, 1000);
      </script>

    </body>
  </html>

  ## Some details to remember
    - $CORD.$.<cord-id>
      It is a reference to the container

    - $CORD.$.<cord-id>.<field_name>
      It is a reference to the field; it can be update but the refresh of the container will not
      happen until '$CORD.update(<cord-id>)' be called. So it is an 'update delayed'.

    - $CORD.$.<cord-id>.$<field_name>
      It is a reference to the field; it can be update and the refresh of the container will
      happen instantly. So it is an 'instant update'.

*/

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
        str = '\`'+str+'\`';
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

    const parse = function(html) {
        html = expand_for(html);
        html = expand_if(html);
        return html;
    };

    // TODO: nested foreach 
    const expand_for = function(html) {
        const matches = html
           .matchAll(/:foreach[\t ]+(.+?)[\t ]+in[\t ]+(.+?)[\t ]+:do(.+?):endforeach/sg)
           .toArray();

        const replaces = matches
              .map( ([_, r_var, rows_var, body]) => {
                  return `
                  <template foreach="${rows_var}" item="${r_var}">
                    ${body}
                  </template>
                  `
              });

        return matches
           .reduce((acc, [str, _a, _b, _c], i) => acc.replace(str, replaces[i]), html)
    };

    // TODO: nested if
    const expand_if = function(html) {
        const matches = html
           .matchAll(/:if[\t ]+(.+?):do(.+?):endif/sg)
           .toArray();

        const replaces = matches
              .map( ([_, exp, body]) => {
                  return `
                  <template if="\$\{${exp}\}">
                    ${body}
                  </template>
                  `
              });

        return matches
           .reduce((acc, [str, _a, _b], i) => acc.replace(str, replaces[i]), html)
    };

    // TODO: Review performance (made with help of deepseek)
    const eval = function(str, context) {
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
    const bootstrap = function() {
        // Fields accesss object
        $this.$ = new Proxy({}, {
            get(target, cord_id, receiver) {
                return PROXIES[cord_id];
            },
            set(target, cord_id, value) {
                console.warn("You can't mutate this container object!")
            }
        });

        // Get every elem with cord-id attr.
        const container_elems = [...document.querySelectorAll('*[cord-id]')];
        for (const elem of container_elems) {
            const cord_id = elem.getAttribute('cord-id');
            // Init container datas storage
            PROXIES[cord_id] = new Proxy({_ref: cord_id}, handler);
            DATAS[cord_id] = {};

            // Check if content is inside elem or in a noscript-template, then store content
            const tpl_id = elem.getAttribute('cord-tpl-ref')
            const template = document.querySelector(`noscript[cord-tpl-id="${tpl_id}"]`)
            const container = template ? template : elem;

            // Init html with the content parsed (:foreach to .map)
            if (template)
                elem.innerHTML = parse(container.innerHTML);

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
        }
    };

    const render_foreachs = function(elem, cord_id, tpls) {
        tpls.forEach( tpl => {
            remove_next_siblings(tpl);
            const parent = tpl.parentElement;
            const r_var = tpl.getAttribute('item');
            const foreach_field = tpl.getAttribute('foreach');

            (DATAS[cord_id][foreach_field]||[]).forEach( (r, i) => {
                const row = { [r_var]: r, i: i };
                const html = eval(tpl.innerHTML, {...DATAS[cord_id], ...row});
                const tmp = document.createElement('template');
                tmp.innerHTML = html;
                [...tmp.content.children].forEach( e => parent.appendChild(e) );
            });
        });
    };

    const render_ifs = function(elem, cord_id, tpls) {
        tpls.forEach( tpl => {
            if (tpl?.nextElementSibling?.is_cordif) 
                tpl.nextElementSibling.remove();
            const if_exp = tpl.getAttribute('if');
            if (!window.eval(eval(if_exp, DATAS[cord_id]))) return;

            const html = eval(tpl.innerHTML, DATAS[cord_id]);
            const tmp = document.createElement('template');
            tmp.innerHTML = html;
            [...tmp.content.children].forEach( e => {
                e.is_cordif = true;
                tpl.after(e);
            });
        });
    };

    const render_container = function(cord_id) {
        const elem = document.querySelector(`*[cord-id="${cord_id}"]`);
        // Render attributes
        const attrs = elem.cordAttrs;
        for (let attr in attrs) {
            elem.setAttribute(
                attr,
                eval(attrs[attr], DATAS[cord_id])
            );
        }

        // Render textNodes
        const nodes = new Set();
        //// First, build a uniq list of nodes
        for (let field in DATAS[cord_id]) {
            if (!elem.cordNodes[field]) continue;
            elem.cordNodes[field].forEach(node => nodes.add(node));
        }
        //// Second, update content of every node
        nodes.forEach(node => {
            node.textContent = eval(node.cordContent, DATAS[cord_id]);
        })

        const tpls = new Set();
        // Render foreachs
        for (let field in DATAS[cord_id]) {
            if (!elem.cordForeach[field]) continue;
            elem.cordForeach[field].forEach( tpl => tpls.add(tpl) );
        }
        render_foreachs(elem, cord_id, [...tpls]);

        tpls.clear();
        // Render ifs
        for (let field in DATAS[cord_id]) {
            if (!elem.cordIfs[field]) continue;
            elem.cordIfs[field].forEach( tpl => tpls.add(tpl) );
        }
        render_ifs(elem, cord_id, tpls);
    };

    const render_container_field = function(cord_id, field) {
        const elem = document.querySelector(`*[cord-id="${cord_id}"]`);

        // Render attributes
        const attrs = elem.cordAttrs;
        for (let attr in attrs) {
            if (!attrs[attr].match(field)) continue;
            elem.setAttribute(
                attr,
                eval(attrs[attr], DATAS[cord_id])
            );
        }

        // Render textNodes
        if (elem.cordNodes[field]) {
            elem.cordNodes[field].forEach(node => {
                node.textContent = eval(node.cordContent, DATAS[cord_id]);
            });
        }

        // Render foreachs
        if (elem.cordForeach[field]) {
            render_foreachs(elem, cord_id, elem.cordForeach[field]);
        }

        // Render ifs
        if (elem.cordIfs[field]) {
            render_ifs(elem, cord_id, elem.cordIfs[field]);
        }
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
                DATAS[cord_id][field] = DATAS[cord_id][field][operation.action](operation.datas);
            } else {
                DATAS[cord_id][field][operation.action](operation.datas);
            }
            render_container_field(cord_id, field);
        } catch(e) {
            console.error(e)
        }
    };

    this.fetch = function(path) {

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
          initials: { ... }
      };
    */

    const default_config = {
        createGlobals: false,
        strict: false,
        websocket: null,
        initials: {}
    };

    this.init = function(config = {}) {
        this.config = { ...default_config, ...config};
        // Initialize containers fields
        for (let cord_id in this.config.initials) {
            for (let field in this.config.initials[cord_id]) {
                this.$[cord_id][field] = this.config.initials[cord_id][field];
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


const $CORD = new CORD();
