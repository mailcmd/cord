/*
  Alternatives for name:
  - CORD (change object, render dom)
  - MTRT (mutate this, render that)
  - JARL (just another reactive lib)
  
  TODO:
   - [x] Why templates? Can I just use directly the element? It seems that not :(
   - [x] I need an evaluator, it is not enough just replace field name.
   - [ ] Check if there is changes, if not do nothing (if change only attrs no update inside).
   - [ ] Open websocket to enable server side change container (SSCC)

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
      <div cord-tpl-ref="clock" cord-id="clock-1"></div>

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
            return DATAS[target._ref][field_name];
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
        // var txt = document.createElement("textarea");
        // txt.innerHTML = html;
        // return txt.value;
    };

    const expand_for = function(html) {
        const matchs = html
           .matchAll(/:foreach[\t ]+(.+?)[\t ]+in[\t ]+(.+?)[\t ]+:do(.+?):end/sg)
           .toArray();
        
        const replaces = matchs
              .map( ([_, r, rows, body]) => {
                  const re1 = new RegExp(':\\{'+r+'\\.', 'g');
                  const re2 = new RegExp(':\\{'+r+'\\[', 'g');
                  return ('${'+rows+'.map( __'+r+'__ => { return `'+body+'`}).join(\'\')}')
                      .replace(re1, '${__'+r+'__.')
                      .replace(re2, '${__'+r+'__[');
              });
        
        return matchs
           .reduce((acc, [str, _a, _b, _c], i) => acc.replace(str, replaces[i]), html)
    };
    
    // TODO: Review performance (got from DeepSeek)
    const eval = function(str, context) {
        const sandbox = new Proxy(context, {
            get(target, prop) {                
                if (prop in target) {
                    return target[prop];
                } else if (prop == 'atob') {
                    return window.atob;
                } else {
                    return "";
                }
            },
            has(target, prop) {
                return true;
            }
        });        
        const keys = Object.keys(sandbox);
        const values = Object.values(sandbox);
        // console.log(str)
        str = decode_htmlentities(str);
        // console.log(str)
        const evaluator = new Function(...keys, 
            `with (this) { return \`${str}\`; }`
        );        
        return evaluator.apply(sandbox, values);
    };

    /////////////////////////////////////////////////////////////////////////////////
    // Internals
    /////////////////////////////////////////////////////////////////////////////////
    const bootstrap = function() {
        // Fields accesss object
        $this.$ = new Proxy({}, {
            get(target, container_ref, receiver) {
                return PROXIES[container_ref];
            },
            set(target, container_ref, value) {
                console.warn("You can't mutate this container object!")
            }
        });

        let container_elems;
        container_elems = document.querySelectorAll(`*[cord-id]`);
        for (let elem of container_elems) {
            const container_ref = elem.getAttribute('cord-id');
            if (!container_ref) {
                console.warn("Missing attr 'cord-id' for element", elem);
                continue;
            }
            PROXIES[container_ref] = new Proxy({_ref: container_ref}, handler);
            DATAS[container_ref] = {};
            const tpl_id = elem.getAttribute('cord-tpl-ref')
            const template = document.querySelector(`noscript[cord-tpl-id="${tpl_id}"]`)
            if (template) {                
                elem.cordContent = expand_for(template.innerHTML);
            } else {
                elem.cordContent = expand_for(elem.innerHTML);
            }
            elem.cordAttrs = {};
            const attrs = elem.attributes;
            for (let i = 0; i < attrs.length; i++) {
                elem.cordAttrs[attrs[i].nodeName] = attrs[i].nodeValue;
            }
        }
    };

    const render_container = function(container_ref) {
        const container_elems = document.querySelectorAll(`*[cord-id="${container_ref}"]`);
        for (let elem of container_elems) {
            const attrs = elem.cordAttrs;
            for (let attr in attrs) {
                elem.setAttribute(
                    attr,
                    eval(attrs[attr], DATAS[container_ref])
                );
            }
            elem.innerHTML = eval(elem.cordContent, DATAS[container_ref]);
        }
    };

    /////////////////////////////////////////////////////////////////////////////////
    // Public API
    /////////////////////////////////////////////////////////////////////////////////

    // TODO: A way to commit all change altogether when they are atomics  
    this.update = function(container_ref, datas = undefined, value = null) {
        if (typeof datas == 'object') {
            for (let field in datas) {
                this.$[container_ref][field] = datas[field];
            }
        } else if (typeof datas == 'undefined') {
            this.$[container_ref][datas] = value;
        }
        // create globals if required
        if (this.config.createGlobals) window[container_ref] = this.$[container_ref];
        // render container
        render_container(container_ref);
    }

    this.init = function(initials, config) {
        this.config = config;
        for (let container_ref in initials) {
            this.update(container_ref, initials[container_ref]);
        }
    }

    /////////////////////////////////////////////////////////////////////////////////
    // Init CORD
    /////////////////////////////////////////////////////////////////////////////////
    bootstrap();
};

const $CORD = new CORD();
