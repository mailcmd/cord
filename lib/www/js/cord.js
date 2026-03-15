/*
  Alternatives for name:
  - CORD (change object, render dom)
  - MTRT (mutate this, render that)
  - JARL (just another reactive lib)
  
  TODO:
   - [x] Why templates? Can I just use directly the element?
   - [x] I need an evaluator, it is not enough just replace field name.
   - [ ] Open websocket to enable server side change container (SSCC)
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
            return DATAS[target._ref][field];
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
    // TODO: Review performance (got from DeepSeek)
    const eval = function(str, context) {
        const sandbox = new Proxy(context, {
            get(target, prop) {
                if (prop in target) {
                    return target[prop];
                }
                return undefined;
            },
            has(target, prop) {
                return true;
            }
        });        
        const keys = Object.keys(sandbox);
        const values = Object.values(sandbox);
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
                return PROXIES[container_ref];
            }
        });
        
        const container_elems = document.querySelectorAll(`*[cord-ref]`);
        for (let elem of container_elems) {
            const container_ref = elem.getAttribute('cord-ref');
            PROXIES[container_ref] = new Proxy({_ref: container_ref}, handler);
            DATAS[container_ref] = {};
            elem.cordContent = elem.innerHTML;
            elem.cordAttrs = {};
            const attrs = elem.attributes;
            for (let i = 0; i < attrs.length; i++) {
                elem.cordAttrs[attrs[i].nodeName] = attrs[i].nodeValue;
            }
        }
    };

    const render_container = function(container_ref) {
        const container_elems = document.querySelectorAll(`*[cord-ref="${container_ref}"]`);
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
