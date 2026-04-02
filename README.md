<h1>WORK IN PROGRESS, NOT USABLE YET!</h1>

# TODO

## SECUTIRY
   - The security of CORD is almost zero. Client rendering and client template 
     alloc make CORD a shit for build secure system. 
     Things to think about:
      - [ ] Delayed templates load. Load templates after security check, not preload. 
      - [ ] Session track on server side.
      - [ ] Hide or ofuscate template path/names.
      - [ ] Secure systems MUST use websocket, not HTTP fetch.
   
   - Thinking about a way to keep authorized sessions open
     -> client send user/pass
     <- server auth and if ok create a cuople of keys, one for client and the other 
        for the server
     * From here the server encrypt with his key the messages and the client decrypt
       them, and in reverse, the client encrypt his messages with its key and the 
       server decrypt them with its key. 
     * NOTE: Complex, I should add in client side 3rd party libraries and I do not want
      
   - Another Idea
     * Server create the token using an internal and private encrypt algorithm. 
       Token has inside an expire date/time. 
     * Server send token to the client. 
     * Client can not decrypt the token but use it to simple xor crypt the message. 
     * Server receive messages from a cliente. 
     * Server look for the stored token for that client. 
     * Server check if the token is expired. 
       -> If yes: 
          * decrypt the message using the expired token and store it. 
          * then send to client a new token with the response of the message if it is
            required. 
       -> If no: 
          * decrypt the message using the expired token and store it. 
          * send the response of the message if it is required (with the current token)

## CORD-js
   - [x] Why templates? Can I just use directly the element? It seems that not :(
   - [x] I need an evaluator, it is not enough just replace field name.
   - [x] Check if there is changes, if not do nothing (if change only attrs no update inside).
   - [x] Open websocket to enable server side change container (SSCC)
   - [x] Dynamic fetch and add templates/html from server
   - [x] EventSource support (work as websocket but no channels)
   - [x] What happend with containers inside containers?
   - [x] Foreach: add index (i variable)
   - [x] Add :if/:else statement
   - [x] Improve foreach parser to allow nested statements
   - [x] Improve if/else parser to allow nested statements
   - [x] Create a custom element cord-template to create noscript templates
   - [x] Create a custom element cord-container to invoke a cord-template 
   - [ ] cord-style tag to load css and create superclasses.
   - [x] foreach and if parser while loop make security exit (max nested depth)
   - [ ] If inside foreach 
   - [ ] Attributes type 'disabled' or 'checked'
   
## SERVER
   - [ ] For CORD-server define a way to add extra headers to index.html

## WEBSOCKET
   - [x] Define format for direct server update of cord_containers
   - [x] Client subscribe to channels on server
   - [x] Server send news to clients
   - [x] Broadcast channel, all clients subscribed automatically.
   - [x] Send broadcast to notify about channels add/remove 
   


# CORD

CORD is a tiny framework for web development. 

## Concepts

CORD is etentially a javascript client library (CORD-js) that allow to build reactive web pages, 
i.e, changing some property of an object, automatically update the page content. 

CORD also has a server side component (CORD-server)) developed in Elixir language that open a HTTP 
server, a WebSocket server and a EventSource script server. But you can use CORD without any of 
this or use your own server side deployment. 

## How to use?

This is a typical index page for using cord:
```html
<!DOCTYPE html>
<html>
<head>
  <title>My title</title>

  <link rel="stylesheet" type="text/css" href="..."/>
  <link rel="stylesheet" type="text/css" href="..."/>
  ... 
</head>

<body>
  <!-- main content start -->
  
  [HERE CORD CONTENT]
  
  <!-- main content end -->
  
  <script src="cord-js"></script>
  
  <script type="text/javascript" src="..."></script>
  <script type="text/javascript" src="..."></script>
  ...
</body>

</html>

```

Some example cord content could be:
```html
<cord-template cord-tpl-id="list">
  <div>
    <input placeholder="Task description..." size="50" id="desc" />
    <button onclick="list_add_item(desc.value, '%cord-id%', '%list%')">
      Add
    </button>
  </div>
  <ul>
    :foreach item in %list% :do
    <li>
      <span>${item.desc}</span>
      <button onclick="list_remove_item(${i}, '%cord-id%', '%list%')">
        Remove
      </button>
    </li> 
    :endforeach
  </ul>

  <cord-script>
  function list_add_item(text, cord_id, list) {
    if (!text.trim()) return; 
    $CORD.update_object(
      cord_id,
      list,
      {action: 'push', datas: [{desc: text}]}
    );
    desc.value='';
    desc.focus();
  };

  function list_remove_item(i, cord_id, list) {
    $CORD.update_object(cord_id, list, {action: 'splice', datas: [i, 1]});
  }; 
  </cord-script>
  
</cord-template>

<cord-container cord-id="tasks-list" cord-tpl-ref="list" cord-map="list:tasks">
</cord-container>

<cord-container cord-id="counter">
  <button onclick="$CORD.$.counter.$value-=1">&lt; Substract 10 </button>
  ${value * 10}
  <button onclick="$CORD.$.counter.$value+=1">Add 10 &gt;</button>
</cord-container>

```

As you can be there is some cord-x tags used to deploy content in the page. 

### cord-template 
Used to create reusable components. You must set a cord template name using the attribute 
`cord-tpl-id` and inside the template you can use normal html tags, varnames or expression in 
the js format `${...}`, and some control structures like `:if/:else` or `:foreach/:endforeach` 
(these control structures are in an early state for now, they do not allow nested statements yet).

Inside a template you can use expression like `%somename%` (mapped object). With these expressions the template
receive params from outside. More about mapping outside object below. 

### cord-script
Inside `cord-template` you can define one or more `cord-script` to put the js code useful for the 
template. 

### cord-container 
Here is where the content will be deployed. It is important to set the attribute `cord-id` because
every cord action over a container will be referenced with this id. 

You can define html content just directly inside the cord-container or set the attribute 
`cord-tpl-ref` with a template id. If you reference a template the template content will deployed
inside the container. 

When you reference a template also can pass to the template params as maps. This allow maps 
container objects to be expanded inside the template replacing mapped object (see `%somename%` 
above). 

For all templates always exists a default map that expand the value of the `cord-id` attribute in 
the mapped object `%cord-id%`. 

The way to pass maps to the template is using the `cord-map` attribute. Example: 
```html
<cord-container ... cord-map="list:tasks" ...>
```
In this example the container object `tasks` will replace any use of `%list%` inside the template.

## Using the js library
Just including `cord.js` it is intantiated `$CORD` object. CORD has a small API: 

### `$CORD.init(config)`
The config is in the form: 

```js
const config = {
    createGlobals: true,                          // create a global variable for every container
    strict: true,                                 // if true return undefined when you reference 
                                                  // container field that does not exists, if false
                                                  // return an empty string.
                                                  
    websocket: {                                  // If defined set the way to connecto to websocket
        url: 'ws://localhost:8080/websocket',     // server. With reconnect in true the ws will do
        reconnect: true,                          // the best effort to keep the connection open.
        reconnect_delay: 1000,
        onmessage: <function_name>                // Generic message receiver. CORD intercept msg
                                                  // and verify if action is 'cord-update' or 
                                                  // 'cord-update-object' to attend CORD updates.
                                                  // If not, call this 'onmessage' function with 
                                                  // the message as parameter. 
                                                  // When you use $CORD.ws.send(msg, ...), if you 
                                                  // set in the msg 'msg_id' parameter and set in 
                                                  // second parameter a callback, the interception 
                                                  // of CORD is disabled for messages that arrive
                                                  // with the same 'msg_id'.
                                                  
    },
    eventsource: {                                // Same as websocket but with one direction 
        url: 'http://localhost:8080/eventsource', // service backed by EventSource.
        reconnect: true,
        reconnect_delay: 1000,
        onmessage: <function_name>                // Generic message receiver. CORD intercept msg
                                                  // and verify if action is 'cord-update' or 
                                                  // 'cord-update-object' to attend CORD updates.
                                                  // If not, call this 'onmessage' function with 
                                                  // the message as parameter. 
    },
    containers: {                                 // Set initials values for the fields inside
        'tasks-list': {                           // every cord-id defined container. 
            tasks: [ 
                {desc: "task 1"} 
            ]
        },
        counter: {
            value: 0
        }
    }
};

// 'cordready' event is dispached when finalize CORD bootstrap process
window.addEventListener('cordready', e => {
    $CORD.init(config);
});

```

### $CORD.update(<cord-id>, <field>, <value>)
### $CORD.update(<cord-id>, <fields_datas>)

`update` allow update fields values inside a container. You can use it in 2 ways: 

```js
$CORD.update('counter', 'value', 1000);
// or 
$CORD.update('tasks-list', {tasks: [ {desc: 'task 1'}, {desc: 'task 2'} ]});
```

### $CORD.update_object(<cord-id>, <field>, <operation>)
This is a more sofisticate way to update fields value. Ex: if you do not want to rewrite all the 
tasks with a new array and you only pretend to add a new task, you can do:

```js
$CORD.update_object('tasks-list', 'tasks', {action: 'push', datas: [{desc: 'task 3'}] });
// or to remove the last pushed:
$CORD.update_object('tasks-list', 'tasks', {action: 'pop', datas: [] });
```

Actually what this function do is call for the field `tasks` (that is an Array) the function 
`action` with params `...datas`:

```js
$CORD.update_object('tasks-list', 'tasks', {action: 'pop', datas: [] });
// is like 
<container-tasks-list>.tasks.pop(...[])

// You could also call:
$CORD.update_object('tasks-list', 'tasks', {action: 'splice', datas: [2,1] });
// that will be like call
<container-tasks-list>.tasks.splice(...[2, 1])
```

### $CORD.refresh(<cord-id>)
Well, not much to explain, just refresh (re-render) all fields of each container. 

`################################################################################################`



**Missing DOC** 
- $CORD.$... 
- Websocket bidirectional communication and containers updates
- EventSource server events to update containers

  ## Some details to remember
    - $CORD.$.<cord-id>
      It is a reference to the container

    - $CORD.$.<cord-id>.<field_name>
      It is a reference to the field; it can be update but the refresh of the container will not
      happen until '$CORD.update(<cord-id>)' be called. So it is an 'update delayed'.

    - $CORD.$.<cord-id>.$<field_name>
      It is a reference to the field; it can be update and the refresh of the container will
      happen instantly. So it is an 'instant update'.

    - $CORD.set('<cord-id>:<field>', <value>) 
    - $CORD.get('<cord-id>:<field>') 


`################################################################################################`

## Directory Struct

  
 
## Installation

