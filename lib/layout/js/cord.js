/////////////////////////////////////////////////////////////////////////////////
// Useful garbage
/////////////////////////////////////////////////////////////////////////////////

const identifier_re = /(?<![@#$_\p{ID_Continue}\p{ID_Start}])(?!(?:await|break|case|catch|class|const|continue|debugger|default|delete|do|else|enum|export|extends|false|finally|for|function|if|import|in|instanceof|new|null|return|super|switch|this|throw|true|try|typeof|var|void|while|with|yield|implements|interface|let|package|private|protected|public|static|arguments|eval|globalThis|Infinity|NaN|undefined)(?![$_\p{ID_Continue}]))[$_\p{ID_Start}][$_\u200C\u200D\p{ID_Continue}]*/ug;

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
   - [ ] What happend with containers inside containers?

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
            if (commit) render_container(target._ref);
        }
    };

    /////////////////////////////////////////////////////////////////////////////////
    // TOOLS
    /////////////////////////////////////////////////////////////////////////////////
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
        return html;        
    };

    const expand_for = function(html) {
        const matches = html
           .matchAll(/:foreach[\t ]+(.+?)[\t ]+in[\t ]+(.+?)[\t ]+:do(.+?):end/sg)
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
    
    // TODO: Review performance (sourced from DeepSeek)
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
        const container_elems = [...document.querySelectorAll('*[cord-id]')].reverse();
        for (const elem of container_elems) {
            const cord_id = elem.getAttribute('cord-id');

            // Init container datas storage
            PROXIES[cord_id] = new Proxy({_ref: cord_id}, handler);
            DATAS[cord_id] = {};
            
            // Check if content is inside elem or in a template and store content
            const tpl_id = elem.getAttribute('cord-tpl-ref')
            const template = document.querySelector(`noscript[cord-tpl-id="${tpl_id}"]`)            
            const container = template ? template : elem;

            // Init html with the content parsed (:foreach to .map)
            elem.innerHTML = parse(container.innerHTML);

            // cordNodes store nodes associates to fields that they has inside
            elem.cordNodes = {};
            get_text_nodes(elem).forEach( node => {
                node.cordContent = node.textContent;
                // TODO: improve the way to extract indentifiers (fields name)
                const f = node.cordContent.match(identifier_re);
                (new Set(f))
                    .values()
                    .toArray()
                    .map(s => s.trim())
                    .filter(f => f != '$')
                    .forEach(f => {
                        if (!elem.cordNodes[f]) elem.cordNodes[f] = [];
                        elem.cordNodes[f].push(node);
                    });
            });

            // cordForeach store templates associate to a field
            elem.cordForeach = {};
            elem.querySelectorAll('template[foreach]').forEach( tpl => {
                const field = tpl.getAttribute('foreach');
                if (!elem.cordForeach[field]) elem.cordForeach[field] = [];
                elem.cordForeach[field].push(tpl);
            });
            
            // cordAttrs store attrs that has field names
            elem.cordAttrs = {};
            const attrs = elem.attributes;
            for (let i = 0; i < attrs.length; i++) {
                elem.cordAttrs[attrs[i].nodeName] = attrs[i].nodeValue;
            }
        }        
    };

    const render_container = function(cont_id) {
        const elem = document.querySelector(`*[cord-id="${cont_id}"]`);

        // Render attributes
        const attrs = elem.cordAttrs;
        for (let attr in attrs) {
            elem.setAttribute(
                attr,
                eval(attrs[attr], DATAS[cont_id])
            );
        }            

        // Render textNodes
        const nodes = new Set();
        //// First, build a uniq list of nodes
        for (let field in DATAS[cont_id]) {
            if (!elem.cordNodes[field]) continue;
            elem.cordNodes[field].forEach(node => nodes.add(node));
        }
        //// Second, update content of every node
        nodes.forEach(node => {
            node.textContent = eval(node.cordContent, DATAS[cont_id]);
        })

        // Render foreachs
        for (let field in DATAS[cont_id]) {
            if (!elem.cordForeach[field]) continue;
            elem.cordForeach[field].forEach( tpl => {               
                remove_next_siblings(tpl);
                const parent = tpl.parentElement;
                const r_var = tpl.getAttribute('item');
                (DATAS[cont_id][field]||[]).forEach( r => {
                    const row = { [r_var]: r };
                    const html = eval(tpl.innerHTML, row);
                    const tmp = document.createElement('template');
                    tmp.innerHTML = html;
                    [...tmp.content.children].forEach( e => parent.appendChild(e) );
                });
            });
        }        
    };

    const render_container_field = function(cont_id, field) {
        const elem = document.querySelector(`*[cord-id="${cont_id}"]`);

        // Render textNodes
        if (elem.cordNodes[field]) {
            elem.cordNodes[field].forEach(node => {
                node.textContent = eval(node.cordContent, DATAS[cont_id]);
            });
        }

        // Render foreachs
        if (elem.cordForeach[field]) {
            elem.cordForeach[field].forEach( tpl => {
                remove_next_siblings(tpl);
                const parent = tpl.parentElement;
                const r_var = tpl.getAttribute('item');
                (DATAS[cont_id][field]||[]).forEach( r => {
                    const row = { [r_var]: r };
                    const html = eval(tpl.innerHTML, row);
                    const tmp = document.createElement('template');
                    tmp.innerHTML = html;
                    [...tmp.content.children].forEach( e => parent.appendChild(e) );
                });
            });
        }
    };
    
    /////////////////////////////////////////////////////////////////////////////////
    // Public API
    /////////////////////////////////////////////////////////////////////////////////

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

        for (let field of fields) {
            this.$[cord_id][field] = datas[field];
            render_container_field(cord_id, field);
        }
        
        // create globals if required, I do it here for future dynamic templates load
        if (this.config.createGlobals && !window[cord_id])
            window[cord_id] = this.$[cord_id];
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

this.render = render_container;
    
    this.init = function(config = {}) {
        this.config = { ...default_config, ...config};
        // Initialize containers fields
        for (let cord_id in this.config.initials) {
            for (let field in this.config.initials[cord_id]) {
                this.$[cord_id][field] = this.config.initials[cord_id][field];
            }
        }

        // Complete render of all containers al least once
        [...document.querySelectorAll('*[cord-id]')].reverse().forEach( elem => {
            const cord_id = elem.getAttribute('cord-id');
            render_container(cord_id);
        });

        // If required init Websocket
        if (this.config.websocket) {
            this.ws = new CORDWebsocket(config);
        }
    }

    /////////////////////////////////////////////////////////////////////////////////
    // Init CORD
    /////////////////////////////////////////////////////////////////////////////////
    bootstrap();

};

/////////////////////////////////////////////////////////////////////////////////
// WebSocket
/////////////////////////////////////////////////////////////////////////////////

const CORDWebsocket = function(config) {
    const $this = this;
    
    /////////////////////////////////////////////////////////////////////////////////
    // Internals
    /////////////////////////////////////////////////////////////////////////////////
    /* 
      ONMESSAGE
      ==========
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
        //console.log(data, timeStamp);
        const msg = JSON.parse(data);
        console.log(msg);
        if (typeof msg != 'object')
            msg = {action: 'unknown', data: msg}
        
        switch (msg.action) {
        case 'cord-update':
            for (container_ref in msg.containers) {
                $CORD.update(container_ref, msg.containers[container_ref]);
                tmp.innerHTML = html;
            }
            break;
            
        case '__another_action__':
            // TODO: complete with more actions
            break;

        default:
            console.warn(`TODO: action = ${msg.action}`)
            break;
        }
        
    };
    
    const onerror = function(error) {
        console.error('CORD Websocket error!', error);
        if ($this.reconnect) check_status();
    };
    
    const onclose = function(msg) {
        console.warn('CORD Websocket closed!');
        if ($this.reconnect) check_status();
    };
    
    const check_status = function() {
        if ($this?.connection.readyState != WebSocket.OPEN) {
            console.warn('CORD Websocket not connected!');
            if ($this.reconnect)
                setTimeout($this.connect.bind($this), $this.reconnect_delay);
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
    
    /////////////////////////////////////////////////////////////////////////////////
    // Init 
    /////////////////////////////////////////////////////////////////////////////////
    this.url = config.websocket.url;
    this.reconnect = config.websocket.reconnect;
    this.reconnect_delay = config.websocket.reconnect_delay || 1000;
    this.connect();
};

const $CORD = new CORD();
