const config = {
    createGlobals: true,
    strict: true,
    containers: {
        'tasks-list': {
            tasks: [ {desc: "tarea 1"} ]
        },
        counter: {
            value: 0
        }
    }
};

$CORD.init(config);

console.clear();
[...document.styleSheets].forEach( s => {
    [...s.rules]
        .forEach( r => {
            if (r instanceof CSSStyleRule
                && /^\.[\-_a-zA-Z][_a-zA-Z0-9\-]+$/.test(r.selectorText)) {
                for (prop in [...r.style]) {
                    
                }
            }                
        })
});
